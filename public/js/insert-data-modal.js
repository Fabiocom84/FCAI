// js/insert-data-modal.js

// Elementi DOM
const insertDataModal = document.getElementById('insertDataModal');
const closeInsertDataModalBtn = insertDataModal ? insertDataModal.querySelector('.close-button') : null;
const saveButton = insertDataModal ? insertDataModal.querySelector('.save-button') : null;
const fileUploadInput = insertDataModal ? insertDataModal.querySelector('#fileUpload') : null;
const fileNameDisplay = insertDataModal ? insertDataModal.querySelector('.file-name') : null;
const startButton = insertDataModal ? insertDataModal.querySelector('#startButton') : null;
const stopButton = insertDataModal ? insertDataModal.querySelector('#stopButton') : null;
const recordingStatus = insertDataModal ? insertDataModal.querySelector('#recordingStatus') : null;
const voiceTranscription = insertDataModal ? insertDataModal.querySelector('#voiceTranscription') : null;
const riferimentoDropdown = insertDataModal ? insertDataModal.querySelector('#riferimentoDropdown') : null;

// Variabili per la registrazione
let mediaRecorder = null;
let audioChunks = [];
let isTranscribing = false;

// Funzione unificata per la gestione della chiusura del modale
window.closeInsertDataModal = function() {
    if (insertDataModal) {
        insertDataModal.style.display = 'none';
    }
    window.modalOverlay.style.display = 'none';
    resetForm();
    stopRecording();
    console.log('Modale Inserisci Dati chiuso e form resettato.');
};

// Funzione per aprire il modale
window.openInsertDataModal = async function() {
    if (insertDataModal) {
        insertDataModal.style.display = 'block';
    }
    window.modalOverlay.style.display = 'block';
    await preCheckMicrophonePermission();
    await loadEtichette();
};

function resetForm() {
    if (voiceTranscription) voiceTranscription.value = '';
    if (riferimentoDropdown) riferimentoDropdown.value = '';
    if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato';
    if (fileUploadInput) fileUploadInput.value = '';
    if (recordingStatus) recordingStatus.textContent = 'Pronto per registrare';
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Ora gli event listener per open/close sono in main.js
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
        if (this.fileNameDisplay) { // Controllo null
            this.fileNameDisplay.textContent = file.name;
        }
    } else {
        if (this.fileNameDisplay) { // Controllo null
            this.fileNameDisplay.textContent = 'Nessun file selezionato';
        }
    }
}

async function saveData(event) {
    event.preventDefault();

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        alert('Autenticazione richiesta. Effettua il login.');
        return;
    }
    if (this.saveButton) {
        this.saveButton.disabled = true;
    }

    const modalForm = this.modal.querySelector('form');
    if (!modalForm) {
        console.error('Form non trovato all\'interno del modale.');
        return;
    }

    const formData = new FormData(modalForm);

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/save-data`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore durante il salvataggio dei dati.');
        }

        console.log('Dati salvati con successo!');
        const formContent = this.modal.querySelector('form');
        const successMessage = document.getElementById('insertDataSuccessMessage');

        if (formContent && successMessage) {
            formContent.style.display = 'none';
            successMessage.style.display = 'block';

            setTimeout(() => {
                this.close();
                formContent.style.display = 'block';
                successMessage.style.display = 'none';
            }, 2000);
        }

    } catch (error) {
        console.error('Errore nel salvataggio dei dati:', error);
        alert('Errore nel salvataggio dei dati: ' + error.message);
    } finally {
        if (this.saveButton) {
            this.saveButton.disabled = false;
        }
    }
}

// Funzione per caricare le etichette
async function loadEtichette() {
    if (!targetDropdown) {
        console.error(`Target dropdown per ${type} non trovato.`);
        return;
    }

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.error(`Authentication token not found for ${type}.`);
        alert(`Autenticazione richiesta per ${type}. Effettua il login.`);
        window.location.href = 'login.html'; // Reindirizza al login
        return;
    }
    
    try {
        const response = await fetch(`${window.BACKEND_URL}/api/get-etichette`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            throw new Error(`Errore nella richiesta delle ${type}: ${response.status} `);
        }
        const data = await response.json();
        const items = data.etichette; // Assumi che la risposta contenga un campo 'etichette'

        targetDropdown.innerHTML = `<option value="" disabled selected>Seleziona un ${type}</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            targetDropdown.appendChild(option);
        });
        console.log(`Dropdown popolato per ${targetDropdown.id} con ${items.length} ${type}.`);

    } catch (error) {
        console.error(`Errore nel caricamento delle ${type}:`, error);
        // alert(`Impossibile caricare le ${type}. Controlla la console per dettagli.`);
    }
}

// Funzione per richiedere il permesso in modo proattivo.
async function preCheckMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log("Permesso microfono concesso.");
        if (this.recordingStatus) {
            this.recordingStatus.textContent = "Pronto per registrare.";
        }
        if (this.startButton) {
            this.startButton.disabled = false;
        }
        return true;
    } catch (error) {
        console.error("Permesso microfono negato:", error);
        if (this.recordingStatus) {
            this.recordingStatus.textContent = "Errore: Permesso microfono negato. Ricarica la pagina e riprova.";
        }
        if (this.startButton) {
            this.startButton.disabled = true;
        }
        return false;
    }
}

// Funzioni per la registrazione audio (startRecording, stopRecording, onStop, transcribeAudio)
function startRecording() {
    if (this.isTranscribing) return; // Non avviare una nuova registrazione se una trascrizione è già in corso
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = event => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            this.onStop();
        };

        this.mediaRecorder.start();
        if (this.recordingStatus) { // Controllo null
            this.recordingStatus.textContent = "Registrazione in corso...";
        }
        if (this.startButton) { // Controllo null
            this.startButton.disabled = true;
        }
        if (this.stopButton) { // Controllo null
            this.stopButton.disabled = false;
        }
    } catch (error) {
        console.error("Errore nell'accesso al microfono:", error);
        if (this.recordingStatus) { // Controllo null
            this.recordingStatus.textContent = "Errore: Microfono non accessibile.";
        }
    }
}

function stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        if (this.recordingStatus) { // Controllo null
            this.recordingStatus.textContent = "Elaborazione trascrizione...";
        }
        if (this.startButton) { // Controllo null
            this.startButton.disabled = false;
        }
        if (this.stopButton) { // Controllo null
            this.stopButton.disabled = true;
        }
    }
}

function onStop() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    // Resetta i chunk per la prossima registrazione
    this.audioChunks = [];
    this.transcribeAudio(audioBlob);
}

async function transcribeAudio(audioBlob) {
    this.isTranscribing = true;
    if (this.recordingStatus) { // Controllo null
        this.recordingStatus.textContent = "Trascrizione in corso...";
    }
    if (!audioBlob) {
        console.error("Nessun audio da trascrivere.");
        if (this.recordingStatus) { // Controllo null
            this.recordingStatus.textContent = "Nessun audio da trascrivere.";
        }
        this.isTranscribing = false;
        return;
    }
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!authToken) {
        if (this.recordingStatus) {
            this.recordingStatus.textContent = "Errore: Autenticazione richiesta.";
        }
        console.error("Token di autenticazione mancante per la trascrizione.");
        this.isTranscribing = false;
        return;
    }
    try {
        const response = await fetch(`${window.BACKEND_URL}/api/transcribe-voice`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Errore sconosciuto nella trascrizione.');
        }
        if (data.transcription) {
            if (this.voiceTranscription) { // Controllo null
                this.voiceTranscription.value = data.transcription;
            }
            if (this.recordingStatus) { // Controllo null
                this.recordingStatus.textContent = "Trascrizione completata.";
            }
        } else {
            if (this.recordingStatus) { // Controllo null
                this.recordingStatus.textContent = "Nessuna trascrizione ricevuta.";
            }
        }
    } catch (error) {
        console.error("Errore nell'invio dell'audio per la trascrizione:", error);
        if (this.recordingStatus) { // Controllo null
            this.recordingStatus.textContent = `Errore di trascrizione: ${error.message}.`;
        }
    } finally {
        this.isTranscribing = false;
    }
}