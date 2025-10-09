// js/new-order-modal.js

import { API_BASE_URL } from './config.js';
import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    
    let editingCommessaId = null;
    let clienteChoices, modelloChoices, statusChoices;

    const newOrderModal = document.getElementById('newOrderModal');
    if (!newOrderModal) return;

    // Seleziona tutti gli elementi DOM una sola volta
    const elements = {
        modalOverlay: document.getElementById('modalOverlay'),
        modalTitle: newOrderModal.querySelector('h2'),
        closeBtn: newOrderModal.querySelector('.close-button'),
        form: document.getElementById('newOrderForm'),
        saveBtn: document.getElementById('saveOrderBtn'),
        saveBtnText: document.getElementById('saveOrderBtn')?.querySelector('span'),
        clienteSelect: document.getElementById('cliente-select'),
        modelloSelect: document.getElementById('modello-select'),
        statusSelect: document.getElementById('status-select'),
        nomeCommessaInput: document.getElementById('nome-commessa'),
        voInput: document.getElementById('vo-offerta'),
        rifTecnicoInput: document.getElementById('riferimento-tecnico'),
        descrizioneInput: document.getElementById('descrizione-commessa'),
        provinciaInput: document.getElementById('provincia-commessa'),
        paeseInput: document.getElementById('paese-commessa'),
        annoInput: document.getElementById('anno-commessa'),
        matricolaInput: document.getElementById('matricola-commessa'),
        immagineInput: document.getElementById('immagineCommessa'),
        fileNameDisplay: newOrderModal.querySelector('label[for="immagineCommessa"] .file-name')
    };

    if (!elements.modal) return;

    // 1. Inizializza i componenti Choices una sola volta e li lascia pronti.
    initializeAllChoices();

    // 2. Associa gli eventi ai pulsanti.
    if (elements.closeBtn) elements.closeBtn.addEventListener('click', closeAndCleanup);
    if (elements.saveBtn) elements.saveBtn.addEventListener('click', saveOrder);

    // --- FUNZIONE PRINCIPALE DI APERTURA ---
    async function openModal(isEditMode = false, commessaId = null) {
        editingCommessaId = isEditMode ? commessaId : null;
        
        if (elements.modal) elements.modal.style.display = 'block';
        if (elements.overlay) elements.overlay.style.display = 'block';
        if (elements.saveBtn) elements.saveBtn.disabled = true;

        await loadDataAndPopulate(isEditMode, commessaId);
        
        if (elements.saveBtn) elements.saveBtn.disabled = false;
    }

    window.openNewOrderModal = openModal;

    // --- NUOVA FUNZIONE DI ORCHESTRAZIONE ---
    async function loadDataAndPopulate(isEditMode, commessaId) {
        try {
            // FASE A: Carica i dati per TUTTI i menu a tendina.
            const dropdownData = await loadDropdownData();

            if (isEditMode) {
                // FASE B (MODIFICA): Carica i dati specifici della commessa.
                elements.title.textContent = 'MODIFICA COMMESSA';
                elements.saveBtnText.textContent = 'Salva Modifiche';
                const response = await apiFetch(`/api/commessa/${commessaId}`);
                if (!response.ok) throw new Error('Dati commessa non trovati.');
                const data = await response.json();
                
                // FASE C (MODIFICA): Popola l'intero form.
                // Questo viene eseguito solo DOPO che la FASE A è completata.
                populateForm(data);
            } else {
                // FASE B (CREAZIONE): Imposta i valori di default.
                elements.title.textContent = 'NUOVA COMMESSA';
                elements.saveBtnText.textContent = 'Crea Commessa';
                if (dropdownData.status && statusChoices) {
                    const inLavorazioneStatus = dropdownData.status.find(s => s.nome_status === 'In Lavorazione');
                    if (inLavorazioneStatus) {
                        statusChoices.setChoiceByValue(String(inLavorazioneStatus.id_status));
                    }
                }
            }
        } catch (error) {
            console.error("Errore durante il caricamento e popolamento del modale:", error);
            showModal({ title: 'Errore', message: 'Impossibile caricare i dati necessari.', confirmText: 'Chiudi' });
        }
    }

    function closeAndCleanup() {
        if (elements.modal) elements.modal.style.display = 'none'; // <-- CORRETTO
        if (elements.overlay) elements.overlay.style.display = 'none';

        if (elements.form) elements.form.reset();
        if (clienteChoices) clienteChoices.clearStore();
        if (modelloChoices) modelloChoices.clearStore();
        if (statusChoices) statusChoices.clearStore();
        if (elements.fileNameDisplay) elements.fileNameDisplay.textContent = 'Carica un\'immagine...';
        if (elements.annoInput) elements.annoInput.value = new Date().getFullYear();
    }
    
    // --- FUNZIONI DI GESTIONE ---

    function initializeAllChoices() {
        const commonConfig = {
            searchEnabled: true,
            itemSelectText: 'Seleziona',
            searchPlaceholderValue: 'Digita per filtrare...',
            placeholder: true,
        };

        // CORREZIONE: Usa l'oggetto 'elements' per trovare gli elementi del DOM
        clienteChoices = new Choices(elements.clienteSelect, { ...commonConfig, placeholderValue: 'Seleziona un cliente' });
        modelloChoices = new Choices(elements.modelloSelect, { ...commonConfig, placeholderValue: 'Seleziona un modello' });
        statusChoices = new Choices(elements.statusSelect, { ...commonConfig, searchEnabled: false, placeholderValue: 'Seleziona uno stato' });
    }

    async function loadDropdownData() {
        try {
            const [clientiRes, modelliRes, statusRes] = await Promise.all([
                apiFetch('/api/simple/clienti'),
                apiFetch('/api/simple/modelli'),
                apiFetch('/api/simple/status_commessa')
            ]);
            const clienti = await clientiRes.json();
            const modelli = await modelliRes.json();
            const status = await statusRes.json();

            populateSelect(clienteChoices, clienti, 'id_cliente', 'ragione_sociale');
            populateSelect(modelloChoices, modelli, 'id_modello', 'nome_modello');
            populateSelect(statusChoices, status, 'id_status', 'nome_status');
            
            return { clienti, modelli, status };
        } catch (error) {
            console.error("Errore nel caricamento dati per il modale:", error);
            return {};
        }
    }
    
    // --- FUNZIONI DI UTILITY ---

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
            elements.fileNameDisplay.textContent = data.immagine.split('/').pop();
        }
        
        if (clienteChoices) clienteChoices.setChoiceByValue(String(data.id_cliente_fk || ''));
        if (modelloChoices) modelloChoices.setChoiceByValue(String(data.id_modello_fk || ''));
        if (statusChoices) statusChoices.setChoiceByValue(String(data.id_status_fk || ''));
    }


    function populateSelect(choicesInstance, items, valueField, textField) {
        if (!choicesInstance) return;
        const options = items.map(item => ({ value: item[valueField], label: item[textField] }));
        choicesInstance.setChoices(options, 'value', 'label', true);
    }
    
    function formatVO(event) {
        let value = event.target.value.replace(/\D/g, '');
        if (value.length > 2) value = value.substring(0, 2) + '-' + value.substring(2, 6);
        event.target.value = value;
    }

    function formatRifTecnico(event) {
        let value = event.target.value;
        if (value.length === 0) return;
        let firstChar = value.charAt(0).toUpperCase().replace(/[^A-Z]/, '');
        let otherChars = value.substring(1).replace(/\D/g, '');
        event.target.value = firstChar + otherChars.substring(0, 4);
    }
    
    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && elements.fileNameDisplay) {
            elements.fileNameDisplay.textContent = file.name;
        } else if (elements.fileNameDisplay) {
            elements.fileNameDisplay.textContent = 'Carica un\'immagine...';
        }
    }

    // --- FUNZIONE DI SALVATAGGIO ---

    async function saveOrder(event) {
        event.preventDefault();
        if (!newOrderForm.checkValidity()) {
            newOrderForm.reportValidity();
            return;
        }
        if(saveOrderBtn) saveOrderBtn.disabled = true;

        const formData = new FormData(newOrderForm);
        const url = editingCommessaId ? `/api/commesse/${editingCommessaId}` : '/api/commesse';
        const method = editingCommessaId ? 'PUT' : 'POST';

        try {
            const response = await apiFetch(url, { method: method, body: formData });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore sconosciuto.');
            }
            
            if (window.refreshCommesseView) window.refreshCommesseView();
            window.closeNewOrderModal(); 

        } catch (error) {
            let userFriendlyMessage = `Si è verificato un errore. Dettagli: ${error.message}`;
            if (error.message?.includes('violates not-null constraint')) {
                if (error.message.includes('id_cliente_fk')) userFriendlyMessage = 'È necessario selezionare un cliente.';
                else if (error.message.includes('id_modello_fk')) userFriendlyMessage = 'È necessario selezionare un modello.';
                else userFriendlyMessage = 'Assicurati di aver compilato tutti i campi obbligatori (*).';
            }
            await showModal({ title: 'Attenzione', message: userFriendlyMessage, confirmText: 'Chiudi' });
        } finally {
            if(saveOrderBtn) saveOrderBtn.disabled = false;
        }
    }    
});