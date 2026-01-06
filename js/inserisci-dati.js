// js/inserisci-dati.js

// 1. IMPORT CORRETTI
import { apiFetch } from './api-client.js';
import { API_BASE_URL } from './config.js'; // PRENDIAMO L'URL DALLA FONTE CORRETTA
import { showModal, showSuccessFeedbackModal } from './shared-ui.js';
import Legend from './legend.js'; 

// Variabili di stato
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioBlob = null;
let recognition = null; 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inizializzazione Inserisci Dati...");
    new Legend();
    await loadCommesseDropdown();
    setupEventListeners();
});

async function loadCommesseDropdown() {
    const select = document.getElementById('riferimentoDropdown');
    if (!select) return;

    try {
        const response = await apiFetch('/api/commesse/simple'); 
        
        if (!response.ok) {
            // Gestione silenziosa dell'errore per non bloccare la pagina se il backend è giù
            console.warn("API Commesse non raggiungibile, uso fallback vuoto.");
            return;
        }
        
        const commesse = await response.json();
        
        select.innerHTML = '<option value="" selected>Nessuna associazione</option>';

        commesse.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id_commessa; 
            option.textContent = `${c.cliente || '?'} | ${c.descrizione || c.modello || 'N/D'}`;
            select.appendChild(option);
        });

        if (window.Choices) {
            new Choices(select, { searchEnabled: true, itemSelectText: '', shouldSort: false });
        }

    } catch (error) {
        console.warn("Errore caricamento dropdown:", error);
    }
}

function setupEventListeners() {
    const form = document.getElementById('insertDataForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');

    if (startBtn && stopBtn) {
        startBtn.addEventListener('click', startRecording);
        stopBtn.addEventListener('click', stopRecording);
    }

    const fileInput = document.getElementById('fileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Drag & Drop
    const dropZone = document.querySelector('.file-drop-zone-expanded');
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => 
            dropZone.addEventListener(evt, preventDefaults, false)
        );
        ['dragenter', 'dragover'].forEach(evt => 
            dropZone.addEventListener(evt, () => dropZone.classList.add('highlight'), false)
        );
        ['dragleave', 'drop'].forEach(evt => 
            dropZone.addEventListener(evt, () => dropZone.classList.remove('highlight'), false)
        );
        dropZone.addEventListener('drop', handleDrop, false);
    }
}

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    const fileInput = document.getElementById('fileUpload');
    if (files && files.length > 0) {
        fileInput.files = files; 
        updateFileLabel(files[0].name);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) updateFileLabel(e.target.files[0].name);
}

function updateFileLabel(filename) {
    const fileNameSpan = document.querySelector('.file-name');
    const dropIcon = document.querySelector('.drop-icon');
    if (fileNameSpan) {
        fileNameSpan.textContent = filename;
        fileNameSpan.style.color = '#27ae60';
        fileNameSpan.style.fontWeight = 'bold';
    }
    if (dropIcon) dropIcon.textContent = '✅'; 
}

// --- AUDIO ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => { audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); };
        mediaRecorder.start();
        
        isRecording = true;
        document.getElementById('startButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
        document.getElementById('recordingStatus').innerText = "Registrazione in corso...";
        document.getElementById('recordingStatus').style.color = "#e74c3c";
        document.getElementById('visualizer').classList.add('active');
        
        setupSpeechRecognition();
    } catch (err) {
        console.error(err);
        showModal({ title: "Errore", message: "Microfono non accessibile." });
    }
}

function stopRecording() {
    if (mediaRecorder) mediaRecorder.stop();
    if (recognition) recognition.stop();
    isRecording = false;
    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;
    document.getElementById('recordingStatus').innerText = "Registrazione completata.";
    document.getElementById('recordingStatus').style.color = "#27ae60";
    document.getElementById('visualizer').classList.remove('active');
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            const textArea = document.getElementById('voiceTranscription');
            if (finalTranscript && textArea) textArea.value += (textArea.value ? ' ' : '') + finalTranscript;
        };
        recognition.start();
    }
}

// --- INVIO DATI (Fix 500 Error + Content-Type) ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('saveDataBtn');
    const originalBtnContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio...</span>';

    try {
        // 1. Costruzione FormData
        const formData = new FormData();
        const text = document.getElementById('voiceTranscription').value;
        const commessaId = document.getElementById('riferimentoDropdown').value;
        const fileInput = document.getElementById('fileUpload');

        // Campi backend
        formData.append('transcription', text || ""); 

        if (commessaId && commessaId.trim() !== "") {
            formData.append('riferimento', commessaId);
        }

        if (fileInput && fileInput.files[0]) {
            formData.append('fileUpload', fileInput.files[0]);
        } else if (audioBlob) {
            formData.append('fileUpload', audioBlob, 'registrazione_vocale.webm');
        }

        // 2. Chiamata Fetch Nativa per bypassare header JSON di apiFetch
        const token = localStorage.getItem('session_token');
        const url = `${API_BASE_URL}/api/registrazioni`; // URL Completo da Config

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Lasciamo che il browser gestisca il Content-Type (multipart/form-data + boundary)
            },
            body: formData
        });

        if (!response.ok) {
            // Tentiamo di leggere l'errore JSON, altrimenti testo
            const errText = await response.text();
            throw new Error(`Errore server ${response.status}: ${errText}`);
        }

        const result = await response.json();
        console.log("Successo:", result);

        showSuccessFeedbackModal("Dati Salvati!", "Reindirizzamento...", null);
        
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);

    } catch (error) {
        console.error("Errore salvataggio:", error);
        showModal({ title: "Errore", message: "Impossibile salvare i dati.\n" + error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}