// js/inserisci-dati.js

import { apiFetch } from './api-client.js';
import { API_BASE_URL } from './config.js';
import { showModal, showSuccessFeedbackModal } from './shared-ui.js';
import Legend from './legend.js'; 

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inizializzazione Inserisci Dati - Modalità: Audio Effimero");
    new Legend();
    await loadCommesseDropdown();
    setupEventListeners();
});

// --- 1. SETUP UI E DROPDOWN (Invariato) ---
async function loadCommesseDropdown() {
    const select = document.getElementById('riferimentoDropdown');
    if (!select) return;

    try {
        const response = await apiFetch('/api/get-etichette');
        if (!response.ok) return;

        const commesse = await response.json();
        select.innerHTML = '<option value="" selected>Nessuna associazione</option>';

        commesse.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.label;
            select.appendChild(option);
        });

        if (window.Choices) {
            new Choices(select, { 
                searchEnabled: true, 
                itemSelectText: '', 
                shouldSort: false,
                placeholder: true,
                placeholderValue: 'Cerca commessa...'
            });
        }
    } catch (error) {
        console.error("Errore dropdown:", error);
    }
}

function setupEventListeners() {
    const form = document.getElementById('insertDataForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    // Gestione bottoni audio
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');
    if (startBtn && stopBtn) {
        startBtn.addEventListener('click', startRecording);
        stopBtn.addEventListener('click', stopRecordingAndTranscribe); // CAMBIATO: Stop & Transcribe
    }

    // Gestione File Upload (Allegati)
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop UI
    setupDragAndDrop();
}

// --- 2. GESTIONE AUDIO (NUOVA LOGICA: Registra -> Trascrivi -> Butta) ---

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Determina il mimeType supportato dal browser (importante per iOS vs Chrome)
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
        
        // UI Updates
        updateAudioUI(true);
        
    } catch (err) {
        console.error("Errore Microfono:", err);
        showModal({ title: "Errore Microfono", message: "Impossibile accedere al microfono. Verifica i permessi o usa HTTPS." });
    }
}

function stopRecordingAndTranscribe() {
    if (!mediaRecorder) return;

    // UI: Stato di elaborazione
    const statusText = document.getElementById('recordingStatus');
    statusText.innerText = "Elaborazione trascrizione...";
    statusText.style.color = "#e67e22"; // Arancione
    document.getElementById('stopButton').disabled = true;

    mediaRecorder.onstop = async () => {
        // 1. Crea il blob audio temporaneo
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        
        // 2. Invia SUBITO al backend per trascrizione
        await transcribeAudioFile(audioBlob, mimeType);
        
        // 3. Reset variabili (l'audio viene scartato lato frontend)
        audioChunks = [];
        isRecording = false;
        
        // Spegne tracce microfono
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        mediaRecorder = null;

        updateAudioUI(false);
    };

    mediaRecorder.stop();
}

async function transcribeAudioFile(blob, mimeType) {
    const textArea = document.getElementById('voiceTranscription');
    const originalPlaceholder = textArea.placeholder;
    textArea.placeholder = "⏳ L'AI sta trascrivendo il tuo audio...";
    textArea.disabled = true;

    try {
        // Preparazione file estensione corretta
        const ext = mimeType.includes('mp4') ? 'mp4' : (mimeType.includes('aac') ? 'aac' : 'webm');
        const filename = `recording.${ext}`;

        const formData = new FormData();
        formData.append('audio', blob, filename);

        // --- MODIFICA IMPORTANTE QUI SOTTO ---
        // Usiamo fetch nativa invece di apiFetch per evitare che venga aggiunto 
        // l'header 'Content-Type: application/json' che rompe l'invio del file.
        const token = localStorage.getItem('session_token');
        
        const response = await fetch(`${API_BASE_URL}/api/transcribe-voice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // NESSUN Content-Type qui! Il browser lo metterà automatico per il FormData
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore server: ${errText}`);
        }

        const data = await response.json();
        
        // Inserimento testo nel campo
        if (data.transcription) {
            const currentText = textArea.value;
            textArea.value = currentText ? currentText + " " + data.transcription : data.transcription;
        }

    } catch (error) {
        console.error("Errore trascrizione:", error);
        showModal({ title: "Errore", message: "Impossibile trascrivere l'audio.\n" + error.message });
    } finally {
        textArea.disabled = false;
        textArea.placeholder = originalPlaceholder;
        document.getElementById('recordingStatus').innerText = "Pronto per registrare";
        document.getElementById('recordingStatus').style.color = "#666";
    }
}

function updateAudioUI(isRec) {
    document.getElementById('startButton').disabled = isRec;
    document.getElementById('stopButton').disabled = !isRec;
    document.getElementById('visualizer').classList.toggle('active', isRec);
    
    const statusText = document.getElementById('recordingStatus');
    if (isRec) {
        statusText.innerText = "Registrazione in corso...";
        statusText.style.color = "#dc3545"; // Rosso
    }
}

// --- 3. SALVATAGGIO DATI (Niente Audio qui) ---

async function handleFormSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('saveDataBtn');
    const originalBtnContent = btn.innerHTML;
    
    // Controlli base
    const text = document.getElementById('voiceTranscription').value.trim();
    const fileInput = document.getElementById('fileUpload');
    const hasFile = fileInput.files.length > 0;

    if (!text && !hasFile) {
        showModal({ title: "Attenzione", message: "Inserisci del testo o allega un file prima di salvare." });
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio...</span>';

    try {
        const formData = new FormData();
        
        // Inviamo solo TESTO e RIFERIMENTO
        formData.append('transcription', text); 
        
        const commessaId = document.getElementById('riferimentoDropdown').value;
        if (commessaId) formData.append('riferimento', commessaId);

        // Se c'è un ALLEGATO (PDF/IMG), lo inviamo
        if (hasFile) {
            formData.append('fileUpload', fileInput.files[0]);
        }
        // NOTA: Non inviamo nessun audioBlob qui. L'audio è già morto.

        const token = localStorage.getItem('session_token');
        const url = `${API_BASE_URL}/api/registrazioni`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) throw new Error(await response.text());

        showSuccessFeedbackModal("Dati Salvati!", "Il contenuto è stato archiviato.", null);
        
        setTimeout(() => { window.location.href = "index.html"; }, 1500);

    } catch (error) {
        console.error("Errore salvataggio:", error);
        showModal({ title: "Errore", message: "Impossibile salvare: " + error.message });
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}

// --- 4. UTILITY UI (Drag & Drop) ---
function setupDragAndDrop() {
    const dropZone = document.querySelector('.file-drop-zone-expanded');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(evt => dropZone.classList.add('highlight'));
    ['dragleave', 'drop'].forEach(evt => dropZone.classList.remove('highlight'));

    dropZone.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length) {
            document.getElementById('fileUpload').files = files;
            handleFileSelect({ target: { files: files } });
        }
    });
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        document.querySelector('.file-name').textContent = file.name;
        document.querySelector('.file-name').style.color = '#27ae60';
        document.querySelector('.drop-icon').textContent = '📄';
    }
}