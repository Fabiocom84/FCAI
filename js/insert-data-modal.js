// js/insert-data-modal.js

import { API_BASE_URL } from './config.js';

// Elementi DOM
const insertDataModal = document.getElementById('insertDataModal');
const closeInsertDataModalBtn = insertDataModal?.querySelector('.close-button');
const saveButton = insertDataModal?.querySelector('.save-button');
const fileUploadInput = insertDataModal?.querySelector('#fileUpload');
const fileNameDisplay = insertDataModal?.querySelector('.file-name');
const startButton = insertDataModal?.querySelector('#startButton');
const stopButton = insertDataModal?.querySelector('#stopButton');
const recordingStatus = insertDataModal?.querySelector('#recordingStatus');
const voiceTranscription = insertDataModal?.querySelector('#voiceTranscription');
const riferimentoDropdown = insertDataModal?.querySelector('#riferimentoDropdown');

// Variabili per la registrazione
let mediaRecorder = null;
let audioChunks = [];
let isTranscribing = false;

// Funzione chiamata da main.js per preparare il modale all'apertura
window.prepareInsertDataModal = async function() {
    await preCheckMicrophonePermission();
    await loadEtichette();
    console.log('Modale Inserisci Dati preparato.');
};

// Funzione chiamata da main.js per pulire il modale alla chiusura
window.cleanupInsertDataModal = function() {
    resetForm();
    stopRecording(); // Assicura che ogni registrazione in corso venga fermata
    console.log('Modale Inserisci Dati resettato.');
};

function resetForm() {
    if (voiceTranscription) voiceTranscription.value = '';
    if (riferimentoDropdown) riferimentoDropdown.value = '';
    if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato';
    if (fileUploadInput) fileUploadInput.value = '';
    if (recordingStatus) recordingStatus.textContent = 'Pronto per registrare';
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;
    
    const formContent = insertDataModal?.querySelector('form');
    const successMessage = document.getElementById('insertDataSuccessMessage');
    if (formContent) formContent.style.display = 'block';
    if (successMessage) successMessage.style.display = 'none';
}

// Event listeners specifici del modale
document.addEventListener('DOMContentLoaded', () => {
    if (closeInsertDataModalBtn) {
        closeInsertDataModalBtn.addEventListener('click', window.closeInsertDataModal);
    }
    if (saveButton) {
        saveButton.addEventListener('click', saveData);
    }
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', handleFileUpload);
    }
    if (startButton) {
        startButton.addEventListener('click', startRecording);
    }
    if (stopButton) {
        stopButton.addEventListener('click', stopRecording);
    }
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    } else {
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato';
    }
}

async function saveData(event) {
    event.preventDefault();
    if (saveButton) saveButton.disabled = true;

    const modalForm = insertDataModal?.querySelector('form');
    if (!modalForm) {
        console.error('Form non trovato');
        if (saveButton) saveButton.disabled = false;
        return;
    }
    const formData = new FormData(modalForm);
    
    // Assicura che la trascrizione sia inclusa se il campo non è vuoto
    if (voiceTranscription && voiceTranscription.value) {
        formData.set('transcription', voiceTranscription.value);
    }
    
    // Rinomina il campo del dropdown per coerenza con il backend
    if (formData.has('riferimentoId')) {
        formData.set('id_commessa_fk', formData.get('riferimentoId'));
        formData.delete('riferimentoId');
    }

    try {
        const response = await window.apiFetch('/api/registrazioni', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante il salvataggio dei dati.');
        }

        // --- MODIFICATO: Usa il nuovo modale di feedback per il successo ---
        window.showSuccessFeedbackModal(
            'INSERISCI DATI',
            'Dati salvati con successo!',
            'insertDataModal' // ID del modale genitore da chiudere
        );

    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error('Errore nel salvataggio dei dati:', error);
            // --- MODIFICATO: Usa il modale custom per l'errore ---
            await window.showModal({
                title: 'Errore nel Salvataggio',
                message: `Salvataggio fallito: ${error.message}`,
                confirmText: 'Chiudi'
            });
        }
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}

async function loadEtichette() {
    if (!riferimentoDropdown) return;
    
    try {
        // --- MODIFICA QUI ---
        // Passiamo solo il percorso relativo.
        const response = await apiFetch('/api/get-etichette');
        const items = await response.json();

        riferimentoDropdown.innerHTML = `<option value="" selected>Nessuna commessa associata</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.label;
            riferimentoDropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Errore nel caricamento delle etichette:', error);
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = onStop;

        mediaRecorder.start();
        if (recordingStatus) recordingStatus.textContent = "Registrazione in corso...";
        if (startButton) startButton.disabled = true;
        if (stopButton) stopButton.disabled = false;
    } catch (error) {
        console.error("Errore nell'accesso al microfono:", error);
        if (recordingStatus) recordingStatus.textContent = "Errore: Microfono non accessibile.";
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        if (recordingStatus) recordingStatus.textContent = "Elaborazione trascrizione...";
        if (startButton) startButton.disabled = false;
        if (stopButton) stopButton.disabled = true;
    }
}

function onStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];
    transcribeAudio(audioBlob);
}

async function transcribeAudio(audioBlob) {
    isTranscribing = true;
    if (recordingStatus) recordingStatus.textContent = "Trascrizione in corso...";
    if (!audioBlob || audioBlob.size === 0) {
        isTranscribing = false; return;
    }
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    try {
        // --- MODIFICA QUI ---
        // Passiamo solo il percorso relativo.
        const response = await apiFetch('/api/transcribe-voice', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Errore sconosciuto nella trascrizione.');
        }
        if (voiceTranscription) voiceTranscription.value = data.transcription || '';
        if (recordingStatus) recordingStatus.textContent = data.transcription ? "Trascrizione completata." : "Nessuna trascrizione ricevuta.";
        
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error("Errore durante la trascrizione:", error);
            if (recordingStatus) recordingStatus.textContent = `Errore: ${error.message}`;
        }
    } finally {
        isTranscribing = false;
    }
}