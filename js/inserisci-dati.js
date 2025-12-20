// js/inserisci-dati.js

import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal } from './shared-ui.js';
import Legend from './legend.js';

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza legenda
    new Legend();

    // Elementi DOM
    const form = document.getElementById('insertDataForm');
    const transcriptionArea = document.getElementById('voiceTranscription');
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');
    const statusText = document.getElementById('recordingStatus');
    const visualizer = document.getElementById('visualizer');
    const fileInput = document.getElementById('fileUpload');
    const fileNameDisplay = document.querySelector('.file-name');
    const saveBtn = document.getElementById('saveDataBtn');
    
    // Dropdown Choices
    let choicesInstance = null;
    const choicesElement = document.getElementById('riferimentoDropdown');

    // Variabili Stato
    let mediaRecorder = null;
    let audioChunks = [];
    let isBusy = false;

    // --- INIT ---
    initPage();

    async function initPage() {
        initChoices();
        await checkMicrophone();
        await loadCommesse();
    }

    // --- 1. SETUP CHOICES.JS ---
    function initChoices() {
        if (choicesElement) {
            choicesInstance = new Choices(choicesElement, {
                searchEnabled: true,
                itemSelectText: '',
                placeholder: true,
                placeholderValue: 'Nessuna associazione',
                noResultsText: 'Nessuna commessa trovata',
            });
        }
    }

    async function loadCommesse() {
        try {
            const res = await apiFetch('/api/get-etichette');
            if (!res.ok) throw new Error("Errore caricamento commesse");
            const data = await res.json();
            
            const options = data.map(item => ({
                value: item.id,
                label: item.label
            }));
            
            choicesInstance.setChoices(options, 'value', 'label', true);
        } catch (e) {
            console.error(e);
            choicesInstance.disable();
        }
    }

    // --- 2. MICROFONO & REGISTRAZIONE ---
    async function checkMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop()); // Stop immediato, serve solo per il permesso
            statusText.textContent = "Pronto per registrare";
            startBtn.disabled = false;
        } catch (e) {
            statusText.textContent = "⚠️ Accesso al microfono negato.";
            startBtn.disabled = true;
        }
    }

    startBtn.addEventListener('click', async () => {
        if (isBusy) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = async () => {
                visualizer.classList.remove('active');
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                // Se blob valido, invia
                if (audioBlob.size > 100) {
                    await transcribeAudio(audioBlob);
                } else {
                    statusText.textContent = "Registrazione troppo breve.";
                    isBusy = false;
                    toggleButtons(false);
                }
                
                // Ferma stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isBusy = true;
            statusText.textContent = "Registrazione in corso... Parla ora.";
            visualizer.classList.add('active');
            toggleButtons(true);

        } catch (e) {
            console.error(e);
            statusText.textContent = "Errore avvio microfono.";
        }
    });

    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            statusText.textContent = "Elaborazione trascrizione...";
            mediaRecorder.stop();
        }
    });

    async function transcribeAudio(blob) {
        const formData = new FormData();
        formData.append('audio', blob, 'rec.webm');

        try {
            const res = await apiFetch('/api/transcribe-voice', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.transcription) {
                // Aggiunge testo invece di sovrascrivere se c'è già qualcosa
                const currentText = transcriptionArea.value;
                transcriptionArea.value = currentText ? currentText + "\n" + data.transcription : data.transcription;
                statusText.textContent = "Trascrizione completata!";
            } else {
                throw new Error(data.error || "Nessun testo rilevato");
            }
        } catch (e) {
            statusText.textContent = "Errore trascrizione: " + e.message;
        } finally {
            isBusy = false;
            toggleButtons(false);
        }
    }

    function toggleButtons(isRecording) {
        startBtn.disabled = isRecording;
        stopBtn.disabled = !isRecording;
        startBtn.classList.toggle('recording', isRecording);
    }

    // --- 3. GESTIONE FILE ---
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        fileNameDisplay.textContent = file ? `File selezionato: ${file.name}` : "Clicca per caricare un file...";
        if(file) fileNameDisplay.style.color = "#28a745";
    });

    // --- 4. SALVATAGGIO ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isBusy) { alert("Attendi la fine della trascrizione."); return; }

        const text = transcriptionArea.value.trim();
        const file = fileInput.files[0];

        if (!text && !file) {
            alert("Inserisci del testo o carica un file prima di salvare.");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = "Salvataggio...";

        const formData = new FormData(form);
        // id_commessa_fk viene preso automaticamente dal select 'name="id_commessa_fk"'
        
        try {
            const res = await apiFetch('/api/registrazioni', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error("Errore salvataggio API");

            // Successo!
            showSuccessFeedbackModal(
                "Dati Salvati", 
                "Il contenuto è stato archiviato correttamente.", 
                null // Nessun parent modal da chiudere
            );

            // Redirect dopo un breve delay per mostrare il feedback
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1500);

        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio: " + e.message);
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<img src="img/save.png"> <span>SALVA DATI</span>`;
        }
    });
});