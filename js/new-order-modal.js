// js/new-order-modal.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    
    let editingCommessaId = null;
    let clienteChoices = null;
    let modelloChoices = null;
    let statusChoices = null;

    // Riferimenti agli elementi del DOM
    const elements = {
        modal: document.getElementById('newOrderModal'),
        overlay: document.getElementById('modalOverlay'),
        title: document.getElementById('newOrderModal')?.querySelector('h2'),
        closeBtn: document.getElementById('newOrderModal')?.querySelector('.close-button'),
        form: document.getElementById('newOrderForm'),
        saveBtn: document.getElementById('saveOrderBtn'),
        saveBtnText: document.getElementById('saveOrderBtn')?.querySelector('span'),
        
        // Input Select
        clienteSelect: document.getElementById('cliente-select'),
        modelloSelect: document.getElementById('modello-select'),
        statusSelect: document.getElementById('status-select'),
        
        // Input Testo
        nomeCommessaInput: document.getElementById('nome-commessa'),
        voInput: document.getElementById('vo-offerta'),
        rifTecnicoInput: document.getElementById('riferimento-tecnico'),
        descrizioneInput: document.getElementById('descrizione-commessa'), // ID HTML
        provinciaInput: document.getElementById('provincia-commessa'),
        paeseInput: document.getElementById('paese-commessa'),
        annoInput: document.getElementById('anno-commessa'),
        matricolaInput: document.getElementById('matricola-commessa'),
        
        // Input File
        immagineInput: document.getElementById('immagineCommessa'),
        fileNameDisplay: document.getElementById('newOrderModal')?.querySelector('label[for="immagineCommessa"] .file-name')
    };

    if (!elements.modal) return;

    // Inizializza Choices.js una volta sola al caricamento della pagina
    initializeAllChoices();

    // Event Listeners
    if (elements.closeBtn) elements.closeBtn.addEventListener('click', closeAndCleanup);
    if (elements.saveBtn) elements.saveBtn.addEventListener('click', saveOrder);
    if (elements.immagineInput) elements.immagineInput.addEventListener('change', handleImageUpload);
    
    // Formattatori automatici
    if (elements.voInput) elements.voInput.addEventListener('input', formatVO);
    if (elements.rifTecnicoInput) elements.rifTecnicoInput.addEventListener('input', formatRifTecnico);

    // Esponi la funzione globalmente
    window.openNewOrderModal = openModal;

    // --- LOGICA PRINCIPALE ---

    async function openModal(isEditMode = false, commessaId = null) {
        editingCommessaId = isEditMode ? commessaId : null;
        
        // Resetta visivamente il form prima di caricare i nuovi dati
        resetFormVisuals();

        if (elements.modal) elements.modal.style.display = 'block';
        if (elements.overlay) elements.overlay.style.display = 'block';
        if (elements.saveBtn) elements.saveBtn.disabled = true; // Disabilita tasto salva durante il caricamento

        try {
            // 1. Carica le opzioni per le tendine (Clienti, Modelli, Status)
            const dropdownData = await loadAndPopulateDropdowns();

            if (isEditMode && commessaId) {
                // --- MODALITÀ MODIFICA ---
                elements.title.textContent = 'MODIFICA COMMESSA';
                elements.saveBtnText.textContent = 'Salva Modifiche';

                // 2. Recupera i dati della commessa specifica
                const response = await apiFetch(`/api/commesse/${commessaId}`);
                if (!response.ok) throw new Error('Impossibile recuperare i dati della commessa.');
                
                const commessaData = await response.json();
                
                // 3. Popola i campi del form
                populateForm(commessaData);

            } else {
                // --- MODALITÀ NUOVA COMMESSA ---
                elements.title.textContent = 'NUOVA COMMESSA';
                elements.saveBtnText.textContent = 'Crea Commessa';
                
                // Imposta anno corrente
                if (elements.annoInput) elements.annoInput.value = new Date().getFullYear();

                // Imposta default status "In Lavorazione"
                const inLavorazioneStatus = dropdownData.status.find(s => s.nome_status === 'In Lavorazione');
                if (inLavorazioneStatus && statusChoices) {
                    statusChoices.setChoiceByValue(String(inLavorazioneStatus.id_status));
                }
            }

        } catch (error) {
            console.error("Errore apertura modale:", error);
            showModal({ title: 'Errore', message: `Si è verificato un errore: ${error.message}`, confirmText: 'Chiudi' });
            closeAndCleanup();
        } finally {
            if (elements.saveBtn) elements.saveBtn.disabled = false;
        }
    }

    function closeAndCleanup() {
        if (elements.modal) elements.modal.style.display = 'none';
        if (elements.overlay) elements.overlay.style.display = 'none';
        resetFormVisuals();
    }

    function resetFormVisuals() {
        if (elements.form) elements.form.reset();
        
        // Resetta i Choices (rimuove la selezione attiva ma mantiene le opzioni se non facciamo clearStore)
        if (clienteChoices) clienteChoices.removeActiveItems();
        if (modelloChoices) modelloChoices.removeActiveItems();
        if (statusChoices) statusChoices.removeActiveItems();

        if (elements.fileNameDisplay) elements.fileNameDisplay.textContent = 'Carica un\'immagine...';
    }

    // --- GESTIONE CHOICES.JS ---

    function initializeAllChoices() {
        const commonConfig = {
            searchEnabled: true,
            itemSelectText: '',
            noResultsText: 'Nessun risultato trovato',
            noChoicesText: 'Nessuna opzione disponibile',
            shouldSort: false, // Mantiene l'ordine restituito dal server (spesso alfabetico)
        };

        if (elements.clienteSelect) {
            clienteChoices = new Choices(elements.clienteSelect, { ...commonConfig, placeholderValue: 'Seleziona un cliente' });
        }
        if (elements.modelloSelect) {
            modelloChoices = new Choices(elements.modelloSelect, { ...commonConfig, placeholderValue: 'Seleziona un modello' });
        }
        if (elements.statusSelect) {
            statusChoices = new Choices(elements.statusSelect, { ...commonConfig, searchEnabled: false, placeholderValue: 'Seleziona uno stato' });
        }
    }

    async function loadAndPopulateDropdowns() {
        // Esegue le chiamate in parallelo per velocità
        const [clientiRes, modelliRes, statusRes] = await Promise.all([
            apiFetch('/api/simple/clienti'),
            apiFetch('/api/simple/modelli'),
            apiFetch('/api/simple/status_commessa')
        ]);

        const clienti = await clientiRes.json();
        const modelli = await modelliRes.json();
        const status = await statusRes.json();

        // Popola le istanze di Choices
        updateChoicesOptions(clienteChoices, clienti, 'id_cliente', 'ragione_sociale');
        updateChoicesOptions(modelloChoices, modelli, 'id_modello', 'nome_modello');
        updateChoicesOptions(statusChoices, status, 'id_status', 'nome_status');

        return { clienti, modelli, status };
    }

    function updateChoicesOptions(instance, data, valueKey, labelKey) {
        if (!instance) return;
        
        // Mappa i dati nel formato richiesto da Choices.js
        const choicesData = data.map(item => ({
            value: String(item[valueKey]), // Converti ID in stringa per sicurezza
            label: item[labelKey],
            selected: false,
            disabled: false,
        }));

        // Sostituisce tutte le opzioni esistenti
        instance.setChoices(choicesData, 'value', 'label', true);
    }

    // --- POPOLAMENTO FORM (MODIFICA) ---

    function populateForm(data) {
        if (elements.nomeCommessaInput) elements.nomeCommessaInput.value = data.impianto || '';
        if (elements.voInput) elements.voInput.value = data.vo || '';
        if (elements.rifTecnicoInput) elements.rifTecnicoInput.value = data.riferimento_tecnico || '';
        
        // CORREZIONE FONDAMENTALE: Mappa 'data.note' (dal DB) dentro l'input descrizione (HTML)
        if (elements.descrizioneInput) elements.descrizioneInput.value = data.note || '';
        
        if (elements.provinciaInput) elements.provinciaInput.value = data.provincia || '';
        if (elements.paeseInput) elements.paeseInput.value = data.paese || '';
        if (elements.annoInput) elements.annoInput.value = data.anno || '';
        if (elements.matricolaInput) elements.matricolaInput.value = data.matricola || '';
        
        // Gestione nome file immagine
        if (elements.fileNameDisplay && data.immagine) {
            // Estrae il nome del file dall'URL completo
            try {
                const urlParts = data.immagine.split('/');
                elements.fileNameDisplay.textContent = urlParts[urlParts.length - 1];
            } catch (e) {
                elements.fileNameDisplay.textContent = 'Immagine presente';
            }
        }

        // Imposta i valori delle select Choices
        // Nota: i valori devono essere stringhe perché in updateChoicesOptions li abbiamo convertiti in stringhe
        if (clienteChoices && data.id_cliente_fk) {
            clienteChoices.setChoiceByValue(String(data.id_cliente_fk));
        }
        if (modelloChoices && data.id_modello_fk) {
            modelloChoices.setChoiceByValue(String(data.id_modello_fk));
        }
        if (statusChoices && data.id_status_fk) {
            statusChoices.setChoiceByValue(String(data.id_status_fk));
        }
    }

    // --- SALVATAGGIO ---

    async function saveOrder(event) {
        event.preventDefault();

        // Validazione HTML5 standard
        if (!elements.form.checkValidity()) {
            elements.form.reportValidity();
            return;
        }

        if (elements.saveBtn) elements.saveBtn.disabled = true;

        const formData = new FormData(elements.form);
        const url = editingCommessaId ? `/api/commesse/${editingCommessaId}` : '/api/commesse';
        const method = editingCommessaId ? 'PUT' : 'POST';

        try {
            const response = await apiFetch(url, { method: method, body: formData });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore durante il salvataggio.');
            }
            
            // Aggiorna la vista principale se la funzione esiste
            if (window.refreshCommesseView) {
                window.refreshCommesseView();
            }

            closeAndCleanup();
            
            // Mostra feedback positivo
            // Nota: showSuccessFeedbackModal è in shared-ui.js, usiamo showModal per consistenza o quello se importato
            // Se showSuccessFeedbackModal non è importato qui, usiamo showModal
            await showModal({ title: 'Successo', message: 'Commessa salvata correttamente!', confirmText: 'OK' });

        } catch (error) {
            console.error("Errore salvataggio:", error);
            let msg = error.message;
            if (msg.includes('id_cliente_fk')) msg = 'Seleziona un cliente valido.';
            if (msg.includes('id_modello_fk')) msg = 'Seleziona un modello valido.';
            
            showModal({ title: 'Errore Salvataggio', message: msg, confirmText: 'OK' });
        } finally {
            if (elements.saveBtn) elements.saveBtn.disabled = false;
        }
    }

    // --- FORMATTERS & UTILITY ---

    function formatVO(event) {
        let value = event.target.value.replace(/[^0-9]/g, ''); // Solo numeri
        if (value.length > 6) value = value.substring(0, 6); // Max 6 cifre totali (2+4)
        
        if (value.length > 2) {
            value = value.substring(0, 2) + '-' + value.substring(2);
        }
        event.target.value = value;
    }

    function formatRifTecnico(event) {
        let value = event.target.value.toUpperCase();
        // Permette solo lettera iniziale + numeri
        // Logica semplificata: forza prima lettera char, resto numeri
        if (value.length > 0) {
            const charPart = value.charAt(0).replace(/[^A-Z]/g, '');
            const numPart = value.substring(1).replace(/[^0-9]/g, '');
            event.target.value = (charPart + numPart).substring(0, 5);
        }
    }
    
    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && elements.fileNameDisplay) {
            elements.fileNameDisplay.textContent = file.name;
        }
    }
});