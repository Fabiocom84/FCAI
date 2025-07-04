class InsertDataModal {
    constructor(modalId, overlayId, openButtonSelector) {
    console.log("Creata una nuova istanza di InsertDataModal.");
        this.modal = document.getElementById(modalId);
        this.overlay = document.getElementById(overlayId);
        this.openButton = document.querySelector(openButtonSelector);
        this.closeButton = this.modal ? this.modal.querySelector('.close-button') : null;
        this.saveButton = this.modal ? this.modal.querySelector('.save-button') : null;
        this.helpButtonModal = this.modal ? this.modal.querySelector('.modal-header .help-button') : null; // Ottieni il pulsante "?" nel modal
        // this.manualTextInput = this.modal ? this.modal.querySelector('#manualTextInput') : null; // RIMOSSO
        this.fileUploadInput = this.modal ? this.modal.querySelector('#fileUpload') : null;
        this.fileNameDisplay = this.modal ? this.modal.querySelector('.file-name') : null;
        this.startButton = this.modal ? this.modal.querySelector('#startButton') : null;
        this.stopButton = this.modal ? this.modal.querySelector('#stopButton') : null;
        this.recordingStatus = this.modal ? this.modal.querySelector('#recordingStatus') : null;
        this.voiceTranscription = this.modal ? this.modal.querySelector('#voiceTranscription') : null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isSaving = false;
        this.isTranscribing = false; // Nuovo stato per l'elaborazione della trascrizione
        this.riferimentoDropdown = this.modal.querySelector('#riferimentoDropdown');

        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', this.close.bind(this)); // Chiude cliccando fuori
        }
        if (this.saveButton && !this.saveButton.hasEventListener) {
            console.log("Aggiungo event listener al saveButton.");
            this.saveButton.addEventListener('click', this.saveData.bind(this));
            this.saveButton.hasEventListener = true; // Flag per evitare duplicazioni
        }

        // Inizializzazione di eventuali altri elementi del modal
        this.fileUploadInput = this.modal ? this.modal.querySelector('#fileUpload') : null;
        this.fileNameDisplay = this.modal ? this.modal.querySelector('.file-name') : null;
        this.startButton = this.modal ? this.modal.querySelector('#startButton') : null;
        this.stopButton = this.modal ? this.modal.querySelector('#stopButton') : null;
        this.recordingStatus = this.modal ? this.modal.querySelector('#recordingStatus') : null;
        this.voiceTranscription = this.modal ? this.modal.querySelector('#voiceTranscription') : null;

        this.setupFileUploadHandler();
        this.setupVoiceRecordingHandlers();
        this.loadEtichette();
    }

    open() {
    console.log("InsertDataModal aperto");
    if (this.modal && this.overlay) {
        // Resetta i valori dei campi qui
        if (this.fileUploadInput) {
            this.fileUploadInput.value = ''; // Resetta la selezione del file
        }
        if (this.fileNameDisplay) {
            this.fileNameDisplay.textContent = '';
        }
        if (this.voiceTranscription) {
            this.voiceTranscription.value = ''; // Resetta il campo di testo unificato
        }
        if (this.recordingStatus) {
            this.recordingStatus.textContent = 'Premi "Avvia Registrazione" per iniziare.';
        }
        if (this.startButton) {
            this.startButton.disabled = false;
        }
        if (this.stopButton) {
            this.stopButton.disabled = true;
        }
        if (this.riferimentoDropdown)
            this.riferimentoDropdown.selectedIndex = 0; // Resetta il dropdown alla prima opzione

         this.modal.style.display = "block";
         this.overlay.style.display = "block";
        }
    }

        close() {
        console.log("Funzione close() chiamata.");
        if (this.modal && this.overlay) {
            this.modal.style.display = "none";
            this.overlay.style.display = "none";
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

    saveData() {
        console.log("Funzione saveData() chiamata.");
        if (this.isSaving) {
            console.log("Salvataggio già in corso, ignorando il clic.");
            return;
        }

        // const manualText = this.manualTextInput ? this.manualTextInput.value.trim() : ''; // RIMOSSO
        const textContent = this.voiceTranscription ? this.voiceTranscription.value.trim() : ''; // Ora prende il testo dal campo unificato
        const file = this.fileUploadInput && this.fileUploadInput.files.length > 0 ? this.fileUploadInput.files[0] : null;
        const riferimento = this.riferimentoDropdown ? this.riferimentoDropdown.value : ''; // Ottieni il valore selezionato

        console.log("File caricato:", file);
        console.log("Valore Riferimento:", riferimento);
        console.log("Contenuto Testo (unified):", textContent); // Log del contenuto del campo unificato

        // La condizione per salvare ora include solo il textContent, il file o il riferimento
        if (textContent || file || riferimento) {
            this.isSaving = true;
            this.saveButton.disabled = true;
            this.saveButton.textContent = 'Salvataggio in corso...';
            console.log("Inizio salvataggio (con testo unificato, file o riferimento)...");

            const formData = new FormData();
            formData.append('textContent', textContent); // Invia il campo unificato come 'textContent' o come preferisci sul backend
            formData.append('riferimento', riferimento);

            if (file) {
                formData.append('file', file);
            }

            fetch(`${window.BACKEND_URL}/api/upload-and-save`, {
                method: 'POST',
                body: formData, // Invia FormData senza impostare Content-Type
            })
            .then(response => response.json())
            .then(data => {
                console.log('Risposta dal backend (upload):', data);
                if (data.message === 'Dati salvati con successo.') {
                    // Assicurati che loadLatestEntries sia accessibile globalmente o passato come callback
                    if (typeof loadLatestEntries === 'function') {
                        loadLatestEntries(); // Carica gli ultimi inserimenti
                    } else {
                        console.warn("Funzione loadLatestEntries non trovata. Gli ultimi inserimenti potrebbero non essere aggiornati.");
                    }
                    this.close();
            } else {
                alert('Errore nel salvataggio: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Errore durante la comunicazione con il backend (upload):', error);
            alert('Impossibile salvare i dati.');
        })
        .finally(() => {
            this.isSaving = false;
            this.saveButton.disabled = false;
            this.saveButton.textContent = 'Salva Dati';
        });
    } else {
       alert("Nessun testo, file o riferimento da salvare."); // Aggiorna il messaggio di allerta
    }
}

loadEtichette() {
        if (!this.riferimentoDropdown) {
            console.error("L'elemento con ID 'riferimentoDropdown' non è stato trovato nel DOM.");
            return;
        }

        const backendUrl = window.BACKEND_URL; // Assicurati che BACKEND_URL sia definito

        fetch(`${backendUrl}/api/get-etichette`, { // Assicurati che l'endpoint sia corretto
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Errore nella richiesta delle etichette: ${response.status}`);
            }
            return response.json();
        })
        .then(etichette => {
            // Pulisci le opzioni esistenti tranne la prima (quella disabilitata)
            while (this.riferimentoDropdown.options.length > 1) {
                this.riferimentoDropdown.remove(1);
            }

            etichette.forEach(etichetta => {
                const option = document.createElement('option');
                option.value = etichetta;
                option.textContent = etichetta;
                this.riferimentoDropdown.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Errore nel caricamento delle etichette:", error);
            // Potresti voler mostrare un messaggio di errore all'utente
        });
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

    startRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];
                this.isRecording = true;
                this.startButton.disabled = true;
                this.startButton.textContent = 'Registrazione in corso...'; // Feedback visivo
                this.stopButton.disabled = false;
                this.recordingStatus.textContent = "Registrazione in corso...";

                this.mediaRecorder.ondataavailable = event => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                this.mediaRecorder.onstop = () => {
                    this.isRecording = false;
                    this.startButton.textContent = 'Avvia Registrazione'; // Resetta il testo
                    this.stopButton.disabled = true;
                    this.recordingStatus.textContent = "Registrazione terminata. Invio per trascrizione..."; // Feedback invio
                    this.sendAudioForTranscription(new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' }));
                    stream.getTracks().forEach(track => track.stop());
                };

                this.mediaRecorder.start();
            })
            .catch(error => {
                console.error("Errore nell'acquisizione audio:", error);
                this.recordingStatus.textContent = "Errore nell'acquisizione audio.";
                if (this.startButton) {
                    this.startButton.disabled = false;
                    this.startButton.textContent = 'Avvia Registrazione';
                }
                if (this.stopButton) this.stopButton.disabled = true;
            });
    }

    stopRecording() {
        if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
    }

    sendAudioForTranscription(audioBlob) {
        this.isTranscribing = true;
        this.recordingStatus.textContent = "Trascrizione in corso..."; // Feedback elaborazione

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        fetch(`${window.BACKEND_URL}/api/transcribe-voice`, {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            this.isTranscribing = false;
            if (data.transcription) {
                this.voiceTranscription.value = data.transcription;
                this.recordingStatus.textContent = "Trascrizione completata.";
            } else if (data.error) {
                console.error("Errore nella trascrizione:", data.error);
                this.recordingStatus.textContent = "Errore nella trascrizione.";
            } else {
                this.recordingStatus.textContent = "Nessuna trascrizione ricevuta.";
            }
        })
        .catch(error => {
            this.isTranscribing = false;
            console.error("Errore nell'invio dell'audio per la trascrizione:", error);
            this.recordingStatus.textContent = "Errore di comunicazione con il server di trascrizione.";
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.insertModalInstance) {
        window.insertModalInstance = new InsertDataModal('insertDataModal', 'modalOverlay', '.insert-button');
    }
});