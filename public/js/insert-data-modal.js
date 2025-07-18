// js/insert-data-modal.js

class InsertDataModal {
    constructor(modalId, overlayId, openButtonSelector) {
        console.log("Creata una nuova istanza di InsertDataModal.");
        this.modal = document.getElementById(modalId);
        // this.overlay gestito centralmente da window.showOverlay()/hideOverlay()
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
        this.riferimentoDropdown = this.modal ? this.modal.querySelector('#riferimentoDropdown') : null; // Aggiunto check null

        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isSaving = false;
        this.isTranscribing = false;

        this.addEventListeners();
        this.setupFileUploadHandler();
        this.setupVoiceRecordingHandlers();
        this.loadEtichette();
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }

        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }

        // Event listener per chiudere il modale cliccando fuori
        if (this.modal) {
            this.modal.addEventListener('click', this.handleOutsideClick.bind(this));
        }

        // Event listener per il pulsante Salva
        if (this.saveButton) { // Non serve hasEventListener, basta aggiungerlo nel costruttore
            this.saveButton.addEventListener('click', this.saveData.bind(this));
        }
    }

    open() {
        console.log("InsertDataModal aperto.");
        if (this.modal) {
            // Resetta i valori dei campi
            if (this.fileUploadInput) this.fileUploadInput.value = '';
            if (this.fileNameDisplay) this.fileNameDisplay.textContent = '';
            if (this.voiceTranscription) this.voiceTranscription.value = '';
            if (this.recordingStatus) this.recordingStatus.textContent = 'Premi "Avvia Registrazione" per iniziare.';
            if (this.startButton) this.startButton.disabled = false;
            if (this.stopButton) this.stopButton.disabled = true;
            if (this.riferimentoDropdown) this.riferimentoDropdown.selectedIndex = 0; // Seleziona la prima opzione
            
            // Assicurati che il pulsante di salvataggio sia abilitato e con il testo corretto all'apertura
            if (this.saveButton) {
                this.saveButton.disabled = false;
                this.saveButton.textContent = 'Salva Dati';
                this.isSaving = false; // Reset dello stato di salvataggio
            }

            this.modal.style.display = "block";
            window.showOverlay(); // Usa la funzione centralizzata
            this.resetRecordingState(); // Resetta anche lo stato di registrazione
        }
    }

    close() {
        console.log("Funzione close() chiamata.");
        if (this.modal) {
            this.modal.style.display = "none";
            window.hideOverlay(); // Usa la funzione centralizzata
            this.resetRecordingState(); // Resetta lo stato di registrazione alla chiusura
        }
    }

    // Metodo per gestire il click esterno
    handleOutsideClick(event) {
        // Se l'elemento cliccato è il modale stesso (ovvero lo sfondo overlay)
        // e non un elemento figlio del modale, allora chiudi
        if (event.target === this.modal) {
            this.close();
        }
    }

    resetRecordingState() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
        }
        this.audioChunks = [];
        this.isRecording = false;
        this.isTranscribing = false;
        if (this.startButton) {
            this.startButton.disabled = false;
            this.startButton.textContent = 'Avvia Registrazione';
        }
        if (this.stopButton) {
            this.stopButton.disabled = true;
            this.stopButton.textContent = 'Ferma Registrazione';
        }
        if (this.recordingStatus) {
            this.recordingStatus.textContent = 'Premi "Avvia Registrazione" per iniziare.';
        }
    }

    async saveData() {
        console.log("Funzione saveData() chiamata.");
        if (this.isSaving) {
            console.log("Salvataggio già in corso, ignorando il clic.");
            return;
        }

        const textContent = this.voiceTranscription ? this.voiceTranscription.value.trim() : '';
        const file = this.fileUploadInput && this.fileUploadInput.files.length > 0 ? this.fileUploadInput.files[0] : null;
        const riferimento = this.riferimentoDropdown ? this.riferimentoDropdown.value : '';

        console.log("File caricato:", file ? file.name : "Nessun file");
        console.log("Valore Riferimento:", riferimento);
        console.log("Contenuto Testo (unified):", textContent);

        if (!textContent && !file && !riferimento) { // Controlla se tutti i campi sono vuoti
            alert("Nessun testo, file o riferimento da salvare. Impossibile procedere.");
            return;
        }

        if (!window.BACKEND_URL) {
            console.error("URL del backend non definito.");
            alert("Errore: URL del backend non configurato.");
            return;
        }

        this.isSaving = true;
        this.saveButton.disabled = true;
        this.saveButton.textContent = 'Salvataggio in corso...';
        console.log("Inizio salvataggio...");

        const formData = new FormData();
        formData.append('textContent', textContent);
        formData.append('riferimento', riferimento);

        if (file) {
            formData.append('file', file);
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/upload-and-save`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Errore sconosciuto nel salvataggio.');
            }

            console.log('Risposta dal backend (upload):', data);
            alert(data.message); // Mostra il messaggio di successo dal backend

            // Chiamiamo fetchLatestEntries() da main.js, se esiste e se è reso globale
            if (typeof fetchLatestEntries === 'function') {
                fetchLatestEntries(); // Aggiorna gli ultimi inserimenti
            } else {
                console.warn("Funzione fetchLatestEntries non trovata. Gli ultimi inserimenti potrebbero non essere aggiornati.");
            }
            this.close();

        } catch (error) {
            console.error('Errore durante la comunicazione con il backend (upload):', error);
            alert(`Impossibile salvare i dati: ${error.message}`);
        } finally {
            this.isSaving = false;
            this.saveButton.disabled = false;
            this.saveButton.textContent = 'Salva Dati';
        }
    }

    async loadEtichette() {
        if (!this.riferimentoDropdown) {
            console.error("L'elemento con ID 'riferimentoDropdown' non è stato trovato nel DOM.");
            return;
        }
        if (!window.BACKEND_URL) {
            console.error("URL del backend non definito per il caricamento etichette.");
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/get-etichette`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error(`Errore nella richiesta delle etichette: ${response.status} ${response.statusText}`);
            }

            const etichette = await response.json();

            // Rimuovi tutte le opzioni tranne la prima (quella di placeholder)
            while (this.riferimentoDropdown.options.length > 1) {
                this.riferimentoDropdown.remove(1);
            }

            etichette.forEach(etichetta => {
                const option = document.createElement('option');
                option.value = etichetta;
                option.textContent = etichetta;
                this.riferimentoDropdown.appendChild(option);
            });
        } catch (error) {
            console.error("Errore nel caricamento delle etichette:", error);
            alert("Errore nel caricamento delle etichette.");
        }
    }

    setupFileUploadHandler() {
        if (this.fileUploadInput && this.fileNameDisplay) {
            this.fileUploadInput.addEventListener('change', () => {
                if (this.fileUploadInput.files && this.fileUploadInput.files.length > 0) {
                    this.fileNameDisplay.textContent = "File selezionato: " + this.fileUploadInput.files[0].name;
                } else {
                    this.fileNameDisplay.textContent = "";
                }
            });
        }
    }

    setupVoiceRecordingHandlers() {
        if (this.startButton && this.stopButton && this.recordingStatus) {
            this.startButton.addEventListener('click', this.startRecording.bind(this));
            this.stopButton.addEventListener('click', this.stopRecording.bind(this));
        }
    }

    async startRecording() {
        if (!window.BACKEND_URL) {
            this.recordingStatus.textContent = "Errore: URL del backend non configurato per la trascrizione.";
            console.error("URL del backend non definito per la trascrizione.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.isRecording = true;

            this.startButton.disabled = true;
            this.startButton.textContent = 'Registrazione in corso...';
            this.stopButton.disabled = false;
            this.recordingStatus.textContent = "Registrazione in corso...";

            this.mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                this.startButton.textContent = 'Avvia Registrazione'; // Resetta il testo qui
                this.stopButton.disabled = true;
                this.recordingStatus.textContent = "Registrazione terminata. Invio per trascrizione...";
                this.sendAudioForTranscription(new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' }));
                stream.getTracks().forEach(track => track.stop()); // Ferma la traccia del microfono
            };

            this.mediaRecorder.start();
        } catch (error) {
            console.error("Errore nell'acquisizione audio:", error);
            this.recordingStatus.textContent = `Errore nell'acquisizione audio: ${error.message}.`;
            if (this.startButton) {
                this.startButton.disabled = false;
                this.startButton.textContent = 'Avvia Registrazione';
            }
            if (this.stopButton) this.stopButton.disabled = true;
        }
    }

    stopRecording() {
        if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        } else {
            console.warn("Nessuna registrazione attiva da fermare.");
        }
    }

    async sendAudioForTranscription(audioBlob) {
        this.isTranscribing = true;
        this.recordingStatus.textContent = "Trascrizione in corso...";
        
        if (!window.BACKEND_URL) {
            this.recordingStatus.textContent = "Errore: URL del backend non configurato per la trascrizione.";
            console.error("URL del backend non definito per la trascrizione.");
            this.isTranscribing = false;
            return;
        }

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/transcribe-voice`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Errore sconosciuto nella trascrizione.');
            }

            if (data.transcription) {
                this.voiceTranscription.value = data.transcription;
                this.recordingStatus.textContent = "Trascrizione completata.";
            } else {
                this.recordingStatus.textContent = "Nessuna trascrizione ricevuta.";
            }
        } catch (error) {
            console.error("Errore nell'invio dell'audio per la trascrizione:", error);
            this.recordingStatus.textContent = `Errore di trascrizione: ${error.message}.`;
        } finally {
            this.isTranscribing = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.insertModalInstance) {
        // Passa 'modalOverlay' come ID, ma la classe non lo userà direttamente, è un residuo per consistenza
        window.insertModalInstance = new InsertDataModal('insertDataModal', 'modalOverlay', '.insert-button');
    }
});