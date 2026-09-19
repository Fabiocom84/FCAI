// js/quick-note.js
// Logica per la pagina Quick Note (registra/scrivi + commessa opzionale)

import { API_BASE_URL } from './config.js';
import { IsAdmin } from './core-init.js';
import { saveToQueue, syncQueue } from './offline-queue.js';
import { creaBarraConnessione } from './connessione-ui.js';
import { apriMicrofono } from './registratore-audio.js';

// Quindici righe identiche a quelle di `quick-record.js` tranne questo
// messaggio: unificate in `connessione-ui.js` il 19/09/2026.
const updateConnectionUI = creaBarraConnessione('Offline — le note verranno salvate in locale');

// --- 0. ADMIN GUARD ---
if (!IsAdmin) {
    window.location.replace('index.html');
}

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', async () => {
    updateConnectionUI();
    await loadCommesse();
    setupEventListeners();

    // Tenta sync delle note in coda all'apertura
    if (navigator.onLine) {
        syncQueue().catch(() => {});
    }
});

// --- 1. CONNESSIONE ---
// La funzione e' costruita in cima al file da `creaBarraConnessione`.

window.addEventListener('online', updateConnectionUI);
window.addEventListener('offline', updateConnectionUI);

// --- 2. CARICAMENTO COMMESSE ---
async function loadCommesse() {
    const select = document.getElementById('qnCommessaDropdown');
    if (!select || !navigator.onLine) return;

    try {
        const token = localStorage.getItem('session_token');
        const res = await fetch(`${API_BASE_URL}/api/get-etichette`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const commesse = await res.json();
        commesse.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.label;
            select.appendChild(opt);
        });

        if (window.Choices) {
            new Choices(select, {
                searchEnabled: true,
                itemSelectText: '',
                shouldSort: false,
                placeholder: true,
                placeholderValue: 'Cerca commessa...',
                searchResultLimit: 100
            });
        }
    } catch (err) {
        console.warn('Impossibile caricare commesse:', err);
    }
}

// --- 3. EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('qnStartBtn').addEventListener('click', startRecording);
    document.getElementById('qnStopBtn').addEventListener('click', stopRecording);
    document.getElementById('qnSaveBtn').addEventListener('click', handleSave);
}

// --- 4. REGISTRAZIONE AUDIO ---
async function startRecording() {
    try {
        const { registratore, pezzi } = await apriMicrofono();
        mediaRecorder = registratore;
        audioChunks = pezzi;

        mediaRecorder.start();
        isRecording = true;
        updateRecordUI(true);

    } catch (err) {
        console.error('Errore microfono:', err);
        showToast('Impossibile accedere al microfono', 'error');
    }
}

function stopRecording() {
    if (!mediaRecorder) return;

    mediaRecorder.onstop = () => {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        isRecording = false;
        updateRecordUI(false);

        const statusEl = document.getElementById('qnRecordingStatus');
        statusEl.textContent = 'Audio registrato ✓';
        statusEl.style.color = 'var(--col-28a745)';
    };

    mediaRecorder.stop();
}

function updateRecordUI(recording) {
    document.getElementById('qnStartBtn').disabled = recording;
    document.getElementById('qnStopBtn').disabled = !recording;
    document.getElementById('qnVisualizer').classList.toggle('active', recording);

    const status = document.getElementById('qnRecordingStatus');
    if (recording) {
        status.textContent = 'Registrazione in corso...';
        status.style.color = 'var(--col-dc3545)';
    }
}

// --- 5. SALVATAGGIO ---
async function handleSave() {
    const textArea = document.getElementById('qnTextArea');
    const text = textArea.value.trim();
    const hasAudio = audioChunks.length > 0;

    if (!text && !hasAudio) {
        showToast('Registra un vocale o scrivi una nota', 'warning');
        return;
    }

    const saveBtn = document.getElementById('qnSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Salvataggio...';

    const commessaId = document.getElementById('qnCommessaDropdown').value || null;

    try {
        if (navigator.onLine) {
            await saveOnline(text, hasAudio, commessaId);
        } else {
            await saveOffline(text, hasAudio);
        }

        // Reset
        textArea.value = '';
        audioChunks = [];
        const status = document.getElementById('qnRecordingStatus');
        status.textContent = 'Pronto';
        status.style.color = 'var(--col-666666)';

    } catch (err) {
        console.error('Errore salvataggio:', err);
        showToast('Errore: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Salva Nota';
    }
}

async function saveOnline(text, hasAudio, commessaId) {
    const token = localStorage.getItem('session_token');
    let transcription = text;

    // Se c'è audio, trascrivilo prima con Whisper
    if (hasAudio) {
        const mimeType = mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm';

        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${ext}`);

        const res = await fetch(`${API_BASE_URL}/api/transcribe-voice`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!res.ok) throw new Error('Trascrizione fallita');

        const data = await res.json();
        transcription = transcription
            ? transcription + ' ' + data.transcription
            : data.transcription;
    }

    if (!transcription) {
        showToast('Nessun contenuto da salvare', 'warning');
        return;
    }

    // Salva la registrazione
    const saveForm = new FormData();
    saveForm.append('transcription', transcription);
    if (commessaId) saveForm.append('riferimento', commessaId);

    const res = await fetch(`${API_BASE_URL}/api/registrazioni`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: saveForm
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Salvataggio fallito (${res.status})`);
    }

    showToast('Nota salvata ✓', 'success');
}

async function saveOffline(text, hasAudio) {
    let audioBlob = null;
    let mimeType = null;

    if (hasAudio) {
        mimeType = mediaRecorder?.mimeType || 'audio/webm';
        audioBlob = new Blob(audioChunks, { type: mimeType });
    }

    await saveToQueue({
        audioBlob: audioBlob,
        mimeType: mimeType,
        textNote: text || null,
        timestamp: new Date().toISOString()
    });

    showToast('Nota salvata in locale ✓ — si sincronizzerà con il campo', 'warning');
}

// --- 6. TOAST ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('qnToast');
    const toastText = document.getElementById('qnToastText');

    toast.className = `qn-toast qn-toast-${type}`;
    toastText.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
