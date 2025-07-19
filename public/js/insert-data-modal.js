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
        this.etichetteSelect = this.modal ? this.modal.querySelector('#etichetteDropdown') : null; // Aggiunto per le etichette

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

    open() {
        this.modal.style.display = 'block';
        window.showOverlay(); // Mostra l'overlay tramite la funzione globale
        this.loadRiferimenti(); // Carica i riferimenti quando il modale si apre
        this.loadEtichette(); // Carica le etichette all'apertura del modale
    }

    close() {
        this.modal.style.display = 'none';
        window.hideOverlay(); // Nasconde l'overlay tramite la funzione globale
        this.resetForm(); // Resetta il form alla chiusura
        this.stopRecording(); // Assicurati di fermare la registrazione se aperta
    }

    resetForm() {
        this.voiceTranscription.value = '';
        this.riferimentoDropdown.value = '';
        this.etichetteSelect.value = ''; // Resetta la selezione delle etichette
        this.fileNameDisplay.textContent = 'Nessun file selezionato';
        this.fileUploadInput.value = ''; // Resetta l'input file
        this.recordingStatus.textContent = 'Pronto per registrare';
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.fileNameDisplay.textContent = file.name;
            // Qui potresti leggere il contenuto del file se necessario subito
            // Ad esempio, se è un file di testo e vuoi visualizzarne il contenuto.
        } else {
            this.fileNameDisplay.textContent = 'Nessun file selezionato';
        }
    }

    async saveData(event) {
        event.preventDefault(); // Impedisce l'invio del form tradizionale
    
        const transcription = this.voiceTranscription.value;
        const riferimento = this.riferimentoDropdown.value;
        const etichetta = this.etichetteSelect.value; // Ottieni il valore dell'etichetta selezionata
    
        let fileContent = null;
        let fileName = null;
    
        if (this.fileUploadInput.files.length > 0) {
            const file = this.fileUploadInput.files[0];
            fileName = file.name;
            try {
                // Legge il contenuto del file come Data URL (Base64)
                fileContent = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
                // Estrai solo la parte Base64 (dopo la virgola, es: "data:text/plain;base64,SGVsbG8gV29ybGQ=")
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
                    etichetta: etichetta, // Invia anche l'etichetta
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
            
            // Aggiorna la lista degli ultimi inserimenti sulla pagina principale
            if (typeof window.fetchLatestEntries === 'function') {
                window.fetchLatestEntries();
            }
    
        } catch (error) {
            console.error('Errore durante il salvataggio dei dati:', error);
            alert('Errore: ' + error.message);
        }
    }
    

    async loadRiferimenti() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('Authentication token not found.');
            // Gestisci il reindirizzamento o l'errore come necessario
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/get-riferimenti`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) {
                throw new Error(`Errore nella richiesta dei riferimenti: ${response.status} `);
            }
            const data = await response.json();
            const riferimenti = data.riferimenti; // Assumi che la risposta contenga un campo 'riferimenti'

            this.riferimentoDropdown.innerHTML = '<option value="" disabled selected>Seleziona un riferimento</option>';
            riferimenti.forEach(ref => {
                const option = document.createElement('option');
                option.value = ref;
                option.textContent = ref;
                this.riferimentoDropdown.appendChild(option);
            });
        } catch (error) {
            console.error('Errore nel caricamento dei riferimenti:', error);
            // alert('Impossibile caricare i riferimenti. Controlla la console per dettagli.');
        }
    }

    async loadEtichette() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('Authentication token not found for etichette.');
            alert('Autenticazione richiesta per le etichette. Effettua il login.');
            window.location.href = 'login.html'; // Reindirizza al login
            return;
        }
        
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/get-etichette`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}` // ✨ AGGIUNTA DELL'HEADER DI AUTORIZZAZIONE ✨
                }
            });
            if (!response.ok) {
                throw new Error(`Errore nella richiesta delle etichette: ${response.status} `);
            }
            const data = await response.json();
            const etichette = data.etichette; // Assumi che la risposta contenga un campo 'etichette'

            if (this.etichetteSelect) {
                this.etichetteSelect.innerHTML = '<option value="" disabled selected>Seleziona un\'etichetta</option>';
                etichette.forEach(etichetta => {
                    const option = document.createElement('option');
                    option.value = etichetta;
                    option.textContent = etichetta;
                    this.etichetteSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Errore nel caricamento delle etichette:', error);
            // alert('Impossibile caricare le etichette. Controlla la console per dettagli.');
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
            this.recordingStatus.textContent = "Registrazione in corso...";
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
        } catch (error) {
            console.error("Errore nell'accesso al microfono:", error);
            this.recordingStatus.textContent = "Errore: Microfono non accessibile.";
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.recordingStatus.textContent = "Elaborazione trascrizione...";
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
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
        this.recordingStatus.textContent = "Trascrizione in corso...";

        if (!audioBlob) {
            console.error("Nessun audio da trascrivere.");
            this.recordingStatus.textContent = "Nessun audio da trascrivere.";
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
        window.insertModalInstance = new InsertDataModal('insertDataModal', 'modalOverlay', '#openInsertDataModalBtn');
    }
});