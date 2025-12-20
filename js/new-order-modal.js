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
        descrizioneInput: document.getElementById('descrizione-commessa'), 
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
        
        // Blocca scroll body
        document.body.classList.add('modal-open');

        if (elements.saveBtn) elements.saveBtn.disabled = true; 

        try {
            // 1. Carica le opzioni per le tendine
            const dropdownData = await loadAndPopulateDropdowns();

            if (isEditMode && commessaId) {
                // --- MODALITÀ MODIFICA ---
                elements.title.textContent = 'MODIFICA COMMESSA';
                elements.saveBtnText.textContent = 'Salva Modifiche';

                const response = await apiFetch(`/api/commesse/${commessaId}`);
                if (!response.ok) throw new Error('Impossibile recuperare i dati della commessa.');
                
                const commessaData = await response.json();
                populateForm(commessaData);

            } else {
                // --- MODALITÀ NUOVA COMMESSA ---
                elements.title.textContent = 'NUOVA COMMESSA';
                elements.saveBtnText.textContent = 'Crea Commessa';
                
                // Anno Corrente
                if (elements.annoInput) elements.annoInput.value = new Date().getFullYear();

                // IMPOSTA DEFAULT STATUS "In Lavorazione"
                if (dropdownData && dropdownData.status) {
                    const inLavorazione = dropdownData.status.find(s => s.nome_status === 'In Lavorazione');
                    if (inLavorazione && statusChoices) {
                        statusChoices.setChoiceByValue(String(inLavorazione.id_status));
                    }
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
        document.body.classList.remove('modal-open');
        resetFormVisuals();
    }

    function resetFormVisuals() {
        if (elements.form) elements.form.reset();
        
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
            shouldSort: false,
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
        const [clientiRes, modelliRes, statusRes] = await Promise.all([
            apiFetch('/api/simple/clienti'),
            apiFetch('/api/simple/modelli'),
            apiFetch('/api/simple/status_commessa')
        ]);

        const clienti = await clientiRes.json();
        const modelli = await modelliRes.json();
        const status = await statusRes.json();

        updateChoicesOptions(clienteChoices, clienti, 'id_cliente', 'ragione_sociale');
        updateChoicesOptions(modelloChoices, modelli, 'id_modello', 'nome_modello');
        updateChoicesOptions(statusChoices, status, 'id_status', 'nome_status');

        return { clienti, modelli, status };
    }

    function updateChoicesOptions(instance, data, valueKey, labelKey) {
        if (!instance) return;
        const choicesData = data.map(item => ({
            value: String(item[valueKey]), 
            label: item[labelKey],
            selected: false,
            disabled: false,
        }));
        instance.setChoices(choicesData, 'value', 'label', true);
    }

    // --- POPOLAMENTO FORM (MODIFICA) ---

    function populateForm(data) {
        if (elements.nomeCommessaInput) elements.nomeCommessaInput.value = data.impianto || '';
        if (elements.voInput) elements.voInput.value = data.vo || '';
        if (elements.rifTecnicoInput) elements.rifTecnicoInput.value = data.riferimento_tecnico || '';
        if (elements.descrizioneInput) elements.descrizioneInput.value = data.note || '';
        
        if (elements.provinciaInput) elements.provinciaInput.value = data.provincia || '';
        if (elements.paeseInput) elements.paeseInput.value = data.paese || '';
        if (elements.annoInput) elements.annoInput.value = data.anno || '';
        if (elements.matricolaInput) elements.matricolaInput.value = data.matricola || '';
        
        if (elements.fileNameDisplay && data.immagine) {
            try {
                const urlParts = data.immagine.split('/');
                elements.fileNameDisplay.textContent = urlParts[urlParts.length - 1];
            } catch (e) {
                elements.fileNameDisplay.textContent = 'Immagine presente';
            }
        }

        if (clienteChoices && data.id_cliente_fk) clienteChoices.setChoiceByValue(String(data.id_cliente_fk));
        if (modelloChoices && data.id_modello_fk) modelloChoices.setChoiceByValue(String(data.id_modello_fk));
        if (statusChoices && data.id_status_fk) statusChoices.setChoiceByValue(String(data.id_status_fk));
    }

    // --- SALVATAGGIO ---

    async function saveOrder(event) {
        event.preventDefault();

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
            
            if (window.refreshCommesseView) {
                window.refreshCommesseView();
            }

            closeAndCleanup();
            
            await showModal({ title: 'Successo', message: 'Commessa salvata correttamente!', confirmText: 'OK' });

        } catch (error) {
            console.error("Errore salvataggio:", error);
            let msg = error.message;
            if (msg.includes('id_cliente_fk')) msg = 'Seleziona un cliente valido.';
            
            showModal({ title: 'Errore Salvataggio', message: msg, confirmText: 'OK' });
        } finally {
            if (elements.saveBtn) elements.saveBtn.disabled = false;
        }
    }

    // --- FORMATTERS ---

    function formatVO(event) {
        let value = event.target.value.replace(/[^0-9]/g, ''); 
        if (value.length > 6) value = value.substring(0, 6); 
        if (value.length > 2) {
            value = value.substring(0, 2) + '-' + value.substring(2);
        }
        event.target.value = value;
    }

    function formatRifTecnico(event) {
        let value = event.target.value.toUpperCase();
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