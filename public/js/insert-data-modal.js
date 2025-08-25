// js/insert-data-modal.js

class InsertDataModal {
    constructor(modalId, overlayId, openButtonSelector) {
        console.log("Creata una nuova istanza di InsertDataModal.");
        this.modal = document.getElementById(modalId);
        this.overlay = document.getElementById(overlayId);
        this.openButton = document.querySelector(openButtonSelector);
        this.closeButton = this.modal ? this.modal.querySelector('.close-button') : null;
        this.saveButton = this.modal ? this.modal.querySelector('.save-button') : null;
        this.helpButtonModal = this.modal ? this.modal.querySelector('.modal-header .help-button') : null;
        this.fileUploadInput = this.modal ? this.modal.querySelector('#fileUpload') : null;
        this.fileNameDisplay = this.modal ? this.modal.querySelector('.file-name') : null;
        this.startButton = this.modal ? this.modal.querySelector('#startButton') : null;
        this.stopButton = this.modal ? this.modal.querySelector('#stopButton') : null;
        this.recordingStatus = this.modal ? this.modal.querySelector('#recordingStatus') : null;
        this.voiceTranscription = this.modal ? this.modal.querySelector('#voiceTranscription') : null;
        this.riferimentoDropdown = this.modal ? this.modal.querySelector('#riferimentoDropdown') : null;

        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isTranscribing = false;

        this.addEventListeners();
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', () => this.open());
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
        }
        if (this.saveButton) {
            this.saveButton.addEventListener('click', (event) => this.saveData(event));
        }
        if (this.fileUploadInput) {
            this.fileUploadInput.addEventListener('change', (event) => this.handleFileUpload(event));
        }
        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startRecording());
        }
        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stopRecording());
        }
    }

    async checkMicrophonePermission() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("API del microfono non supportate in questo browser.");
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Ferma immediatamente il track per non mantenere il microfono attivo
            return true;
        } catch (error) {
            console.error("Errore durante la richiesta di permesso al microfono:", error);
            return false;
        }
    }

    async open() {
        this.modal.style.display = 'block';
        this.overlay.style.display = 'block';

        await this.preCheckMicrophonePermission();
        if (this.riferimentoDropdown) {
            await this.loadEtichette(this.riferimentoDropdown, 'riferimento');
        }
    }

    close() {
        this.modal.style.display = 'none';
        // Nascondi direttamente l'overlay, senza chiamare una funzione
        document.getElementById('modalOverlay').style.display = 'none'; 
        this.resetForm(); // Resetta il form alla chiusura
        this.stopRecording(); // Assicurati di fermare la registrazione se aperta
    }

    resetForm() {
        // Aggiungi controlli null prima di accedere a .value/textContent
        if (this.voiceTranscription) {
            this.voiceTranscription.value = '';
        }
        if (this.riferimentoDropdown) {
            this.riferimentoDropdown.value = '';
        }
        if (this.fileNameDisplay) {
            this.fileNameDisplay.textContent = 'Nessun file selezionato';
        }
        if (this.fileUploadInput) {
            this.fileUploadInput.value = '';
        }
        if (this.recordingStatus) {
            this.recordingStatus.textContent = 'Pronto per registrare';
        }
    }

    handleFileUpload(event) {
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

    async saveData(event) {
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

    // loadEtichette è stata modificata per essere riutilizzabile
    async loadEtichette(targetDropdown, type = 'etichetta') {
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
    async preCheckMicrophonePermission() {
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
    async startRecording() {
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

    stopRecording() {
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

    onStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        // Resetta i chunk per la prossima registrazione
        this.audioChunks = [];
        this.transcribeAudio(audioBlob);
    }

    async transcribeAudio(audioBlob) {
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
}