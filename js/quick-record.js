// js/quick-record.js
// Push-to-Talk: tieni premuto per registrare, rilascia per salvare automaticamente

import { API_BASE_URL } from './config.js';
import { IsAdmin } from './core-init.js';
import { saveToQueue, syncQueue, getPendingCount } from './offline-queue.js';

// --- 0. ADMIN GUARD ---
if (!IsAdmin) {
    window.location.replace('index.html');
}

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;

document.addEventListener('DOMContentLoaded', async () => {
    updateConnectionUI();
    setupPushToTalk();
    await updateQueueBadge();

    // Tenta sync all'apertura
    if (navigator.onLine) {
        syncQueue().then(() => updateQueueBadge()).catch(() => {});
    }
});

// --- 1. CONNESSIONE ---
function updateConnectionUI() {
    const bar = document.getElementById('connectionStatus');
    const icon = document.getElementById('connectionIcon');
    const text = document.getElementById('connectionText');

    if (navigator.onLine) {
        bar.className = 'qn-connection-bar qn-connection-online';
        icon.textContent = '🟢';
        text.textContent = 'Online';
    } else {
        bar.className = 'qn-connection-bar qn-connection-offline';
        icon.textContent = '🟠';
        text.textContent = 'Offline — salvataggio locale';
    }
}

window.addEventListener('online', () => {
    updateConnectionUI();
    syncQueue().then(() => updateQueueBadge()).catch(() => {});
});
window.addEventListener('offline', updateConnectionUI);

// --- 2. QUEUE BADGE ---
async function updateQueueBadge() {
    try {
        const count = await getPendingCount();
        const badge = document.getElementById('qrQueueBadge');
        const countEl = document.getElementById('qrQueueCount');

        if (count > 0) {
            countEl.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        // Silenzioso
    }
}

// --- 3. PUSH-TO-TALK ---
function setupPushToTalk() {
    const btn = document.getElementById('qrRecordBtn');

    // Previeni menu contestuale su long press (mobile)
    btn.addEventListener('contextmenu', e => e.preventDefault());

    // MOUSE (desktop)
    btn.addEventListener('mousedown', (e) => {
        if (e.button === 0) startRecording();
    });
    btn.addEventListener('mouseup', () => {
        if (isRecording) stopAndSave();
    });
    btn.addEventListener('mouseleave', () => {
        if (isRecording) stopAndSave();
    });

    // TOUCH (mobile)
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startRecording();
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (isRecording) stopAndSave();
    });
    btn.addEventListener('touchcancel', () => {
        if (isRecording) stopAndSave();
    });
}

// --- 4. REGISTRAZIONE ---
async function startRecording() {
    if (isRecording) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.start();
        isRecording = true;

        // UI
        const btn = document.getElementById('qrRecordBtn');
        btn.classList.add('recording');
        btn.textContent = '⏹';

        document.getElementById('qrStatusIcon').textContent = '🔴';
        document.getElementById('qrStatusText').textContent = 'Registrazione in corso...';
        document.getElementById('qrStatusSub').textContent = 'Rilascia per fermare';

        // Timer
        recordingSeconds = 0;
        updateTimerDisplay();
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            updateTimerDisplay();
        }, 1000);

    } catch (err) {
        console.error('Errore microfono:', err);
        showToast('Impossibile accedere al microfono', 'error');
    }
}

function stopAndSave() {
    if (!mediaRecorder || !isRecording) return;

    // Ferma timer
    clearInterval(recordingTimer);

    // UI: stato elaborazione
    const btn = document.getElementById('qrRecordBtn');
    btn.classList.remove('recording');
    btn.textContent = '⏳';

    document.getElementById('qrStatusIcon').textContent = '⏳';
    document.getElementById('qrStatusText').textContent = 'Salvataggio in corso...';
    document.getElementById('qrStatusSub').textContent = '';

    mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });

        // Spegni tracce microfono
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        isRecording = false;

        // Ignora registrazioni troppo brevi (< 0.5 secondi)
        if (recordingSeconds < 1 && audioBlob.size < 5000) {
            resetUI();
            showToast('Registrazione troppo breve', 'warning');
            return;
        }

        try {
            if (navigator.onLine) {
                await saveOnline(audioBlob, mimeType);
            } else {
                await saveOffline(audioBlob, mimeType);
            }
        } catch (err) {
            console.error('Errore salvataggio:', err);
            // Fallback: salva in locale anche se il tentativo online è fallito
            try {
                await saveOffline(audioBlob, mimeType);
            } catch (e2) {
                showToast('Errore critico: ' + e2.message, 'error');
            }
        }

        audioChunks = [];
        mediaRecorder = null;
        resetUI();
        await updateQueueBadge();
    };

    mediaRecorder.stop();
}

async function saveOnline(audioBlob, mimeType) {
    const token = localStorage.getItem('session_token');
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm';

    // 1. Trascrivi con Whisper
    const transcribeForm = new FormData();
    transcribeForm.append('audio', audioBlob, `recording.${ext}`);

    const transcribeRes = await fetch(`${API_BASE_URL}/api/transcribe-voice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: transcribeForm
    });

    if (!transcribeRes.ok) throw new Error('Trascrizione fallita');

    const data = await transcribeRes.json();
    const transcription = data.transcription;

    if (!transcription) {
        showToast('Nessuna trascrizione ottenuta', 'warning');
        return;
    }

    // 2. Salva come registrazione (senza commessa)
    const saveForm = new FormData();
    saveForm.append('transcription', transcription);

    const saveRes = await fetch(`${API_BASE_URL}/api/registrazioni`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: saveForm
    });

    if (!saveRes.ok) throw new Error('Salvataggio fallito');

    showToast('Nota salvata ✓', 'success');
}

async function saveOffline(audioBlob, mimeType) {
    await saveToQueue({
        audioBlob: audioBlob,
        mimeType: mimeType,
        textNote: null,
        timestamp: new Date().toISOString()
    });

    showToast('Salvata in locale ✓ — sincronizzerà con campo', 'warning');
}

// --- 5. UI HELPERS ---
function updateTimerDisplay() {
    const minutes = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    document.getElementById('qrTimer').textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function resetUI() {
    const btn = document.getElementById('qrRecordBtn');
    btn.classList.remove('recording');
    btn.textContent = '🎤';

    document.getElementById('qrStatusIcon').textContent = '🎤';
    document.getElementById('qrStatusText').textContent = 'Pronto';
    document.getElementById('qrStatusSub').textContent = '';
    document.getElementById('qrTimer').textContent = '0:00';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('qnToast');
    const toastText = document.getElementById('qnToastText');

    toast.className = `qn-toast qn-toast-${type}`;
    toastText.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
