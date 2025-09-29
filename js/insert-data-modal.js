// js/insert-data-modal.js

import { API_BASE_URL } from './config.js';

// Funzioni globali che saranno definite dopo il caricamento del DOM
window.prepareInsertDataModal = async () => {};
window.cleanupInsertDataModal = () => {};

document.addEventListener('DOMContentLoaded', () => {
    
    // Elementi DOM
    const insertDataModal = document.getElementById('insertDataModal');
    if (!insertDataModal) return; 

    const closeInsertDataModalBtn = insertDataModal.querySelector('.close-button');
    const saveButton = insertDataModal.querySelector('.save-button');
    const fileUploadInput = insertDataModal.querySelector('#fileUpload');
    const fileNameDisplay = insertDataModal.querySelector('.file-name');
    const startButton = insertDataModal.querySelector('#startButton');
    const stopButton = insertDataModal.querySelector('#stopButton');
    const recordingStatus = insertDataModal.querySelector('#recordingStatus');
    const voiceTranscription = insertDataModal.querySelector('#voiceTranscription');
    const riferimentoDropdown = insertDataModal.querySelector('#riferimentoDropdown');
    const modalForm = insertDataModal.querySelector('form');

    // Variabile per contenere l'istanza di Choices.js
    let choicesInstance = null;
    
    // Inizializza Choices.js sull'elemento select
    function initializeChoices() {
        if (riferimentoDropdown && !choicesInstance) {
            choicesInstance = new Choices(riferimentoDropdown, {
                searchEnabled: true,
                placeholder: true,
                placeholderValue: 'Cerca o seleziona una commessa...',
                itemSelectText: 'Seleziona',
                removeItemButton: true, // Aggiunge una 'x' per deselezionare
                allowHTML: false,
                searchPlaceholderValue: 'Digita per filtrare...',
            });
        }
    }
    initializeChoices();

    // Variabili per la registrazione
    let mediaRecorder = null;
    let audioChunks = [];
    let isTranscribing = false;

    // Ridefinizione delle funzioni globali con accesso al DOM
    window.prepareInsertDataModal = async function() {
        await preCheckMicrophonePermission();
        await loadEtichette();
    };

    window.cleanupInsertDataModal = function() {
        resetForm();
        stopRecording();
    };
    
    // Event listeners
    if (closeInsertDataModalBtn) closeInsertDataModalBtn.addEventListener('click', () => window.closeInsertDataModal());
    if (saveButton) saveButton.addEventListener('click', saveData);
    if (fileUploadInput) fileUploadInput.addEventListener('change', handleFileUpload);
    if (startButton) startButton.addEventListener('click', startRecording);
    if (stopButton) stopButton.addEventListener('click', stopRecording);

    function resetForm() {
        if (voiceTranscription) voiceTranscription.value = '';
        if (riferimentoDropdown) riferimentoDropdown.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Seleziona un file...';
        if (fileUploadInput) fileUploadInput.value = '';
        if (recordingStatus) recordingStatus.textContent = 'Pronto per registrare';
        if (startButton) startButton.disabled = false;
        if (stopButton) stopButton.disabled = true;
        // --- MODIFICA: Metodo corretto per resettare Choices.js ---
        if (choicesInstance) {
            choicesInstance.clearStore();
            // Aggiungiamo un'opzione placeholder di default
            choicesInstance.setChoices([{ value: '', label: 'Nessuna commessa associata', selected: true }]);
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && fileNameDisplay) {
            fileNameDisplay.textContent = file.name;
        } else if (fileNameDisplay) {
            fileNameDisplay.textContent = 'Seleziona un file...';
        }
    }

    async function saveData(event) {
        event.preventDefault();
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(modalForm);
        
        if (voiceTranscription && voiceTranscription.value) {
            formData.set('contenuto_testo', voiceTranscription.value);
        }

        try {
            // CORRETTO: Aggiunto window. prima di apiFetch
            const response = await window.apiFetch('/api/registrazioni', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore durante il salvataggio.');
            }

            window.showSuccessFeedbackModal('INSERISCI DATI', 'Dati salvati con successo!', 'insertDataModal');

        } catch (error) {
            await window.showModal({
                title: 'ERRORE NEL SALVATAGGIO',
                message: `Salvataggio fallito: ${error.message}`,
                confirmText: 'Chiudi'
            });
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    async function loadEtichette() {
        // --- MODIFICA: La funzione ora popola il menu usando l'API di Choices.js ---
        if (!choicesInstance) return;
        
        try {
            const response = await window.apiFetch('/api/get-etichette');
            const items = await response.json();
            
            // Pulisce le opzioni esistenti
            choicesInstance.clearStore();

            // Mappa i dati nel formato richiesto da Choices.js: { value, label }
            const options = items.map(item => ({
                value: item.id,
                label: item.label
            }));
            
            // Aggiunge l'opzione di default "Nessuna commessa" all'inizio dell'array
            options.unshift({ 
                value: '', 
                label: 'Nessuna commessa associata', 
                selected: true 
            });

            // Imposta le nuove opzioni nel menu
            choicesInstance.setChoices(options, 'value', 'label', false);

        } catch (error) {
            console.error('Errore nel caricamento delle etichette:', error);
            // Gestisci l'errore anche nell'interfaccia se necessario
            choicesInstance.clearStore();
            choicesInstance.disable();
        }
    }

    async function preCheckMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log("Permesso microfono concesso.");
            if (recordingStatus) recordingStatus.textContent = "Pronto per registrare.";
            if (startButton) startButton.disabled = false;
        } catch (error) {
            console.error("Permesso microfono negato:", error);
            if (recordingStatus) recordingStatus.textContent = "Permesso microfono negato.";
            if (startButton) startButton.disabled = true;
        }
    }

    async function startRecording(event) {
        event.preventDefault();
        event.stopPropagation();
        if (isTranscribing) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true }
            });

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                console.log("Stato della traccia audio:", audioTracks[0].readyState);
                console.log("Traccia audio abilitata:", audioTracks[0].enabled);
            } else {
                console.log("Nessuna traccia audio trovata nello stream.");
            }

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); };
            mediaRecorder.onstop = onStop;

            mediaRecorder.start();
            if (recordingStatus) recordingStatus.textContent = "Registrazione in corso...";
            if (startButton) startButton.disabled = true;
            if (stopButton) stopButton.disabled = false;
        } catch (error) {
            console.error("Errore nell'accesso al microfono:", error);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            if (recordingStatus) recordingStatus.textContent = "Elaborazione...";
            if (startButton) startButton.disabled = false;
            if (stopButton) stopButton.disabled = true;
        }
    }

    function onStop() {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log(`Dimensione del file audio registrato (Blob): ${audioBlob.size} bytes`);
        audioChunks = [];

        if (audioBlob.size > 100) {
            transcribeAudio(audioBlob);
        } else {
            if (recordingStatus) recordingStatus.textContent = "Registrazione vuota, nessun dato inviato.";
            isTranscribing = false;
        }
    }

    async function transcribeAudio(audioBlob) {
        isTranscribing = true;
        if (recordingStatus) recordingStatus.textContent = "Trascrizione in corso...";
        if (!audioBlob || audioBlob.size === 0) { isTranscribing = false; return; }
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        try {
            // CORRETTO: Aggiunto window. prima di apiFetch
            const response = await window.apiFetch('/api/transcribe-voice', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Errore sconosciuto.');
            
            if (voiceTranscription) voiceTranscription.value = data.transcription || '';
            if (recordingStatus) recordingStatus.textContent = "Trascrizione completata.";
            
        } catch (error) {
            console.error("Errore durante la trascrizione:", error);
            if (recordingStatus) recordingStatus.textContent = `Errore: ${error.message}`;
        } finally {
            isTranscribing = false;
        }
    }
});