// js/inserisci-dati.js

import { apiFetch } from './api-client.js';
import { showModal, showSuccessFeedback } from './shared-ui.js';

// Stato interno
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioBlob = null;
let recognition = null; // Per trascrizione live

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inizializzazione Inserisci Dati...");
    
    // 1. Carica le commesse nel dropdown
    await loadCommesseDropdown();

    // 2. Setup Event Listeners
    setupEventListeners();
});

async function loadCommesseDropdown() {
    const select = document.getElementById('riferimentoDropdown');
    if (!select) return;

    try {
        // Usa apiFetch che gestisce token e URL base
        const response = await apiFetch('/api/commesse/simple'); 
        if (!response.ok) throw new Error("Errore caricamento commesse");
        
        const commesse = await response.json();
        
        // Pulisci (mantieni la prima option vuota)
        select.innerHTML = '<option value="" selected>Nessuna associazione</option>';

        commesse.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id_commessa; // Assicurati che l'ID sia corretto
            // Formattazione etichetta: Cliente | Descrizione
            option.textContent = `${c.cliente || '?'} | ${c.descrizione || c.modello || 'N/D'}`;
            select.appendChild(option);
        });

        // Re-inizializza Choices.js se vuoi l'effetto grafico carino
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
    // Gestione Form Submit
    const form = document.getElementById('insertDataForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Gestione Audio
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');

    if (startBtn && stopBtn) {
        startBtn.addEventListener('click', startRecording);
        stopBtn.addEventListener('click', stopRecording);
    }

    // Gestione File Input (Aggiorna nome file quando selezionato)
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileNameSpan = document.querySelector('.file-name');
            if (fileNameSpan && e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                fileNameSpan.style.color = '#27ae60';
                fileNameSpan.style.fontWeight = 'bold';
            }
        });
    }
}

// --- LOGICA REGISTRAZIONE ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        };

        mediaRecorder.start();
        isRecording = true;

        // UI Updates
        document.getElementById('startButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
        document.getElementById('recordingStatus').innerText = "Registrazione in corso... (Parla ora)";
        document.getElementById('recordingStatus').style.color = "#e74c3c";
        
        // Attiva animazione visualizer
        const visualizer = document.getElementById('visualizer');
        if(visualizer) visualizer.classList.add('active');

        // Avvia trascrizione live (Speech-to-Text browser)
        setupSpeechRecognition();

    } catch (err) {
        console.error("Errore microfono:", err);
        showModal({ title: "Errore", message: "Impossibile accedere al microfono. Controlla i permessi." });
    }
}

function stopRecording() {
    if (mediaRecorder) mediaRecorder.stop();
    if (recognition) recognition.stop();
    
    isRecording = false;

    // UI Updates
    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;
    document.getElementById('recordingStatus').innerText = "Registrazione completata. Audio pronto.";
    document.getElementById('recordingStatus').style.color = "#27ae60";
    
    const visualizer = document.getElementById('visualizer');
    if(visualizer) visualizer.classList.remove('active');
}

function setupSpeechRecognition() {
    // Supporto browser (Chrome, Edge, Safari recenti)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            
            // Inserisci nella textarea se c'è testo
            const textArea = document.getElementById('voiceTranscription');
            if (finalTranscript && textArea) {
                // Aggiunge spazio se c'è già testo
                textArea.value += (textArea.value ? ' ' : '') + finalTranscript;
            }
        };
        recognition.start();
    }
}

// --- LOGICA INVIO DATI ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('saveDataBtn');
    const originalBtnContent = btn.innerHTML;
    
    // Feedback Caricamento
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio in corso...</span>';

    try {
        const formData = new FormData();
        
        // 1. Recupera Testo
        const text = document.getElementById('voiceTranscription').value;
        formData.append('transcription', text);

        // 2. Recupera Riferimento Commessa (Gestione attenta)
        const commessaId = document.getElementById('riferimentoDropdown').value;
        // IMPORTANTE: Invia solo se c'è un valore valido, altrimenti il backend potrebbe confondersi
        if (commessaId && commessaId !== "") {
            formData.append('riferimento', commessaId); 
        }

        // 3. Recupera File (se caricato da input o registrato)
        const fileInput = document.getElementById('fileUpload');
        
        if (fileInput && fileInput.files[0]) {
            // Caso A: File caricato manualmente
            formData.append('fileUpload', fileInput.files[0]);
        } else if (audioBlob) {
            // Caso B: Audio registrato dal microfono
            formData.append('fileUpload', audioBlob, 'registrazione_vocale.webm');
        }

        // Debug: controlla cosa stiamo inviando
        console.log("Invio dati al server...");
        for (var pair of formData.entries()) {
            console.log(pair[0]+ ', ' + pair[1]); 
        }

        // 4. Chiamata API
        const response = await apiFetch('/api/registrazioni', {
            method: 'POST',
            body: formData 
            // NOTA: Con FormData NON impostare 'Content-Type', lo fa il browser automaticamente
        });

        if (!response.ok) {
            throw new Error(`Errore server: ${response.status}`);
        }

        // 5. Successo
        const result = await response.json();
        console.log("Successo:", result);

        showSuccessFeedback({
            title: "Dati Salvati!",
            message: "Le informazioni sono state archiviate correttamente.",
            redirectUrl: "index.html" // Torna alla home dopo il successo
        });

    } catch (error) {
        console.error("Errore salvataggio API:", error);
        showModal({ 
            title: "Errore di Salvataggio", 
            message: "Si è verificato un problema tecnico. Riprova più tardi.\n" + error.message
        });
    } finally {
        // Ripristina bottone
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}