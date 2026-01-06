// js/inserisci-dati.js

import { apiFetch, API_BASE_URL } from './api-client.js'; // Importiamo anche API_BASE_URL se esportato, altrimenti lo ricostruiamo
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
        // Gestione robusta per evitare blocchi se il backend risponde male
        if (!response.ok) throw new Error("Errore server commesse");
        
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
        console.warn("Dropdown commesse non caricato:", error);
        // Non blocchiamo l'intera pagina, lasciamo la select base
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

// --- INVIO DATI (Fix 500 Error) ---
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

        // Backend fields: 'transcription', 'riferimento', 'fileUpload'
        formData.append('transcription', text || ""); 

        // IMPORTANTE: Se commessaId è vuoto, NON appenderlo. Il backend Python fa:
        // id = request.form.get('riferimento'); if id: ...
        // Se mandiamo "" (stringa vuota), Python potrebbe provare a convertirlo in int e fallire.
        if (commessaId && commessaId.trim() !== "") {
            formData.append('riferimento', commessaId);
        }

        if (fileInput && fileInput.files[0]) {
            formData.append('fileUpload', fileInput.files[0]);
        } else if (audioBlob) {
            formData.append('fileUpload', audioBlob, 'registrazione_vocale.webm');
        }

        // 2. Recupero Token e URL Base
        // NOTA: Usiamo fetch nativo per evitare che apiFetch forzi 'Content-Type: application/json'
        const token = localStorage.getItem('session_token');
        
        // Ricostruiamo l'URL completo (assumendo che api-client.js abbia una base URL o sia relativo)
        // Se usi un proxy o URL relativo, '/api/registrazioni' va bene.
        // Se API_BASE_URL è esportato da api-client, usalo qui. Altrimenti hardcodalo o usa relativo.
        // Fallback sicuro su URL relativo:
        const url = '/api/registrazioni'; 

        // 3. Chiamata Fetch Nativa (Lasciamo che il browser gestisca il Content-Type per FormData)
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // NON METTERE 'Content-Type': 'application/json' QUI!
                // NON METTERE 'Content-Type': 'multipart/form-data' QUI! (Il browser mette il boundary da solo)
            },
            body: formData
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `Errore server ${response.status}`);
        }

        // 4. Successo
        const result = await response.json();
        console.log("Successo:", result);

        showSuccessFeedbackModal("Dati Salvati!", "Reindirizzamento...", null);
        
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);

    } catch (error) {
        console.error("Errore salvataggio:", error);
        showModal({ title: "Errore", message: error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}