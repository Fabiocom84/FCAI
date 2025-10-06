// js/insert-data-modal.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const insertDataModal = document.getElementById('insertDataModal');
    if (!insertDataModal) return; 

    // Elementi DOM
    const modalForm = insertDataModal.querySelector('form');
    const saveButton = insertDataModal.querySelector('.save-button');
    const saveButtonText = saveButton.querySelector('span');
    const fileUploadInput = insertDataModal.querySelector('#fileUpload');
    const fileNameDisplay = insertDataModal.querySelector('.file-name');
    const startButton = insertDataModal.querySelector('#startButton');
    const stopButton = insertDataModal.querySelector('#stopButton');
    const recordingStatus = insertDataModal.querySelector('#recordingStatus');
    const voiceTranscription = insertDataModal.querySelector('#voiceTranscription');
    const riferimentoDropdown = insertDataModal.querySelector('#riferimentoDropdown');
    const closeInsertDataModalBtn = insertDataModal.querySelector('.close-button');

    // Variabili di stato
    let choicesInstance = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isBusy = false; // Stato unico per bloccare le operazioni asincrone

    // --- FUNZIONI DI INIZIALIZZAZIONE E PULIZIA ---

    // Espone le funzioni per essere chiamate da main.js quando il modale viene aperto/chiuso
    window.prepareInsertDataModal = async () => {
            // 1. Inizializza il componente grafico (Choices.js)
            initializeChoices(); 
            
            // 2. Controlla i permessi
            await preCheckMicrophonePermission();

            // 3. Carica i dati dal server (solo dopo che Choices è pronto)
            await loadEtichette(); 
        };

    window.cleanupInsertDataModal = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        resetForm();
    };
    
    // Inizializza la libreria Choices.js per la select delle commesse
    function initializeChoices() {
        // Se l'istanza esiste già, non fare nulla per evitare duplicati
        if (choicesInstance) return; 

        if (riferimentoDropdown) {
            choicesInstance = new Choices(riferimentoDropdown, {
                searchEnabled: true,
                removeItemButton: true,
                itemSelectText: 'Seleziona',
                searchPlaceholderValue: 'Digita per filtrare...',
                placeholder: true,
                placeholderValue: 'Nessuna commessa associata',
            });
        }
    }

    // Resetta completamente lo stato del form
    function resetForm() {
        modalForm.reset();
        fileNameDisplay.textContent = 'Seleziona un file...';
        recordingStatus.textContent = 'Pronto per registrare';
        startButton.disabled = false;
        stopButton.disabled = true;
        if (choicesInstance) {
            // Non distruggiamo l'istanza, la resettiamo
            choicesInstance.clearStore();
            choicesInstance.clearInput();
        }
    }

    // --- GESTIONE DEGLI EVENTI ---

    closeInsertDataModalBtn.addEventListener('click', () => {
        if(window.closeInsertDataModal) window.closeInsertDataModal();
    });
    saveButton.addEventListener('click', saveData);
    fileUploadInput.addEventListener('change', handleFileUpload);
    startButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);
    
    // --- LOGICA PRINCIPALE ---

    // Carica le commesse (etichette) dal backend
    async function loadEtichette() {
        if (!choicesInstance) return;
        
        try {
            const response = await apiFetch('/api/get-etichette');
            if (!response.ok) throw new Error('Errore di rete nel caricamento delle commesse.');
            
            const items = await response.json();
            
            const options = items.map(item => ({
                value: item.id,
                label: item.label
            }));
            
            choicesInstance.setChoices(options, 'value', 'label', false);
            choicesInstance.enable();

        } catch (error) {
            console.error('Errore nel caricamento delle etichette:', error);
            choicesInstance.clearStore();
            choicesInstance.disable();
        }
    }

    // Salva i dati della registrazione
    async function saveData(event) {
        event.preventDefault();
        if (isBusy) return;

        isBusy = true;
        const originalButtonText = saveButtonText.textContent;
        saveButton.disabled = true;
        saveButtonText.textContent = 'Salvataggio...';

        const formData = new FormData(modalForm);
        // Assicura che anche il testo in textarea sia aggiunto se presente
        formData.set('contenuto_testo', voiceTranscription.value);
        // Il campo 'riferimento' con l'ID della commessa viene già preso da FormData

        try {
            const response = await apiFetch('/api/registrazioni', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore durante il salvataggio.');
            }

            if (window.showSuccessFeedbackModal) {
                window.showSuccessFeedbackModal('INSERISCI DATI', 'Dati salvati con successo!', 'insertDataModal');
            }

        } catch (error) {
            await showModal({
                title: 'ERRORE NEL SALVATAGGIO',
                message: `Salvataggio fallito: ${error.message}`,
                confirmText: 'Chiudi'
            });
        } finally {
            isBusy = false;
            saveButton.disabled = false;
            saveButtonText.textContent = originalButtonText;
        }
    }

    // --- LOGICA DI REGISTRAZIONE AUDIO ---

    // Controlla il permesso del microfono all'apertura del modale
    async function preCheckMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            recordingStatus.textContent = "Pronto per registrare.";
            startButton.disabled = false;
        } catch (error) {
            recordingStatus.textContent = "Permesso microfono negato.";
            startButton.disabled = true;
        }
    }

    async function startRecording(event) {
        event.preventDefault();
        if (isBusy) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioChunks = [];
                if (audioBlob.size > 100) { // Evita blob vuoti
                    transcribeAudio(audioBlob);
                } else {
                    recordingStatus.textContent = "Registrazione troppo breve.";
                    isBusy = false;
                }
            };

            mediaRecorder.start();
            recordingStatus.textContent = "Registrazione in corso...";
            startButton.disabled = true;
            stopButton.disabled = false;
        } catch (error) {
            recordingStatus.textContent = "Errore microfono.";
            console.error("Errore nell'accesso al microfono:", error);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            isBusy = true; // L'operazione di trascrizione è impegnativa
            recordingStatus.textContent = "Elaborazione...";
            mediaRecorder.stop();
        }
        startButton.disabled = false;
        stopButton.disabled = true;
    }

    async function transcribeAudio(audioBlob) {
        recordingStatus.textContent = "Trascrizione in corso...";
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        try {
            const response = await apiFetch('/api/transcribe-voice', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Trascrizione fallita.');
            
            voiceTranscription.value = data.transcription || '';
            recordingStatus.textContent = "Trascrizione completata.";
            
        } catch (error) {
            console.error("Errore durante la trascrizione:", error);
            recordingStatus.textContent = `Errore: ${error.message}`;
        } finally {
            isBusy = false; // Libera lo stato solo alla fine
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        fileNameDisplay.textContent = file ? file.name : 'Seleziona un file...';
    }
});