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
        // Entrambi i dropdown ora useranno la logica di 'loadEtichette'
        this.riferimentoDropdown = this.modal ? this.modal.querySelector('#riferimentoDropdown') : null;
        this.etichetteSelect = this.modal ? this.modal.querySelector('#etichetteDropdown') : null;

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
        if (this.saveButton) {
            this.saveButton.addEventListener('click', (event) => this.saveData(event));
        }
        if (this.helpButtonModal) {
            this.helpButtonModal.addEventListener('click', (event) => {
                event.stopPropagation(); // Evita che l'evento si propaghi al modale e lo chiuda
                alert('Help feature coming soon for Insert Data Modal!');
            });
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

    async open() {
        this.modal.style.display = 'block';
        // Visualizza direttamente l'overlay, senza chiamare una funzione globale
        document.getElementById('modalOverlay').style.display = 'block';

        // Carica le etichette per il solo dropdown del riferimento
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
        if (this.etichetteSelect) {
            this.etichetteSelect.value = '';
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
        event.preventDefault(); // Impedisce l'invio del form tradizionale
    
        const transcription = this.voiceTranscription ? this.voiceTranscription.value : '';
        const riferimento = this.riferimentoDropdown ? this.riferimentoDropdown.value : '';
        const etichetta = this.etichetteSelect ? this.etichetteSelect.value : '';
    
        let fileContent = null;
        let fileName = null;
    
        if (this.fileUploadInput && this.fileUploadInput.files.length > 0) {
            const file = this.fileUploadInput.files[0];
            fileName = file.name;
            try {
                fileContent = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
                fileContent = fileContent.split(',')[1];
            } catch (error) {
                console.error("Errore durante la lettura del file:", error);
                alert("Impossibile leggere il file selezionato.");
                return;
            }
        }
    
        if (!transcription && !fileContent) {
            alert("Per favore, inserisci una trascrizione vocale o carica un file.");
            return;
        }
    
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta. Effettua il login.');
            window.location.href = 'login.html'; // Reindirizza al login
            return;
        }
    
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/save-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    transcription: transcription,
                    riferimento: riferimento,
                    etichetta: etichetta,
                    fileContent: fileContent,
                    fileName: fileName
                })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante il salvataggio dei dati.');
            }
    
            const result = await response.json();
            alert('Dati salvati con successo: ' + result.message);
            this.close(); // Chiudi il modale
    
            if (typeof window.fetchLatestEntries === 'function') {
                window.fetchLatestEntries();
            }
    
        } catch (error) {
            console.error('Errore durante il salvataggio dei dati:', error);
            alert('Errore: ' + error.message);
        }
    }
    
    // loadRiferimenti() è stato eliminato

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

            targetDropdown.innerHTML = `<option value="" disabled selected>Seleziona un'${type}</option>`;
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

document.addEventListener('DOMContentLoaded', () => {
    if (!window.insertModalInstance) {
        window.insertModalInstance = new InsertDataModal('insertDataModal', 'modalOverlay', '#openInsertDataModalBtn');
    }
});