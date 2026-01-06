// js/inserisci-dati.js

import { apiFetch } from './api-client.js';
import { showModal, showSuccessFeedbackModal } from './shared-ui.js';
// MODIFICA: Importiamo la classe Default invece di una funzione nominata
import Legend from './legend.js'; 

// Stato interno
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioBlob = null;
let recognition = null; 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inizializzazione Inserisci Dati...");
    
    // MODIFICA: Istanziamo la classe Legend (che attiva i listener nel costruttore)
    new Legend();
    
    await loadCommesseDropdown();
    setupEventListeners();
});

async function loadCommesseDropdown() {
    const select = document.getElementById('riferimentoDropdown');
    if (!select) return;

    try {
        const response = await apiFetch('/api/commesse/simple'); 
        if (!response.ok) throw new Error("Errore caricamento commesse");
        
        const commesse = await response.json();
        
        select.innerHTML = '<option value="" selected>Nessuna associazione</option>';

        commesse.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id_commessa; 
            option.textContent = `${c.cliente || '?'} | ${c.descrizione || c.modello || 'N/D'}`;
            select.appendChild(option);
        });

        if (window.Choices) {
            new Choices(select, {
                searchEnabled: true,
                itemSelectText: '',
                shouldSort: false
            });
        }

    } catch (error) {
        console.error("Errore dropdown commesse:", error);
    }
}

function setupEventListeners() {
    const form = document.getElementById('insertDataForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    // Gestione Audio
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');

    if (startBtn && stopBtn) {
        startBtn.addEventListener('click', startRecording);
        stopBtn.addEventListener('click', stopRecording);
    }

    // Gestione File Input (Click standard)
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Gestione Drag & Drop
    const dropZone = document.querySelector('.file-drop-zone-expanded');
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('highlight'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('highlight'), false);
        });

        dropZone.addEventListener('drop', handleDrop, false);
    }
}

// --- FUNZIONI DRAG & DROP ---
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

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
    if (e.target.files.length > 0) {
        updateFileLabel(e.target.files[0].name);
    }
}

function updateFileLabel(filename) {
    const fileNameSpan = document.querySelector('.file-name');
    const dropIcon = document.querySelector('.drop-icon');
    
    if (fileNameSpan) {
        fileNameSpan.textContent = filename;
        fileNameSpan.style.color = '#27ae60';
        fileNameSpan.style.fontWeight = 'bold';
    }
    if (dropIcon) {
        dropIcon.textContent = '✅'; 
    }
}

// --- LOGICA REGISTRAZIONE ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        mediaRecorder.onstop = () => { audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); };

        mediaRecorder.start();
        isRecording = true;

        document.getElementById('startButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
        document.getElementById('recordingStatus').innerText = "Registrazione in corso... (Parla ora)";
        document.getElementById('recordingStatus').style.color = "#e74c3c";
        
        const visualizer = document.getElementById('visualizer');
        if(visualizer) visualizer.classList.add('active');

        setupSpeechRecognition();

    } catch (err) {
        console.error("Errore microfono:", err);
        showModal({ title: "Errore", message: "Impossibile accedere al microfono." });
    }
}

function stopRecording() {
    if (mediaRecorder) mediaRecorder.stop();
    if (recognition) recognition.stop();
    
    isRecording = false;

    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;
    document.getElementById('recordingStatus').innerText = "Registrazione completata. Audio pronto.";
    document.getElementById('recordingStatus').style.color = "#27ae60";
    
    const visualizer = document.getElementById('visualizer');
    if(visualizer) visualizer.classList.remove('active');
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

// --- LOGICA INVIO DATI ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('saveDataBtn');
    const originalBtnContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio in corso...</span>';

    try {
        const formData = new FormData();
        const text = document.getElementById('voiceTranscription').value;
        formData.append('transcription', text);

        const commessaId = document.getElementById('riferimentoDropdown').value;
        if (commessaId && commessaId !== "") formData.append('riferimento', commessaId); 

        const fileInput = document.getElementById('fileUpload');
        if (fileInput && fileInput.files[0]) {
            formData.append('fileUpload', fileInput.files[0]);
        } else if (audioBlob) {
            formData.append('fileUpload', audioBlob, 'registrazione_vocale.webm');
        }

        const response = await apiFetch('/api/registrazioni', {
            method: 'POST',
            body: formData 
        });

        if (!response.ok) throw new Error(`Errore server: ${response.status}`);

        const result = await response.json();
        console.log("Successo:", result);

        showSuccessFeedbackModal("Dati Salvati!", "Reindirizzamento alla Home in corso...", null);
        
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2500);

    } catch (error) {
        console.error("Errore salvataggio API:", error);
        showModal({ title: "Errore", message: "Problema tecnico: " + error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}