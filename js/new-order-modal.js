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

    // 1. Inizializza i componenti Choices UNA SOLA VOLTA.
    initializeAllChoices();

    // 2. Associa gli eventi ai pulsanti.
    if (elements.closeBtn) elements.closeBtn.addEventListener('click', closeAndCleanup);
    if (elements.saveBtn) elements.saveBtn.addEventListener('click', saveOrder);

    // 3. Definisci le funzioni globali.
    window.openNewOrderModal = openModal; // Rinominiamo per chiarezza
    window.closeNewOrderModal = closeAndCleanup; // Rinominiamo per chiarezza

    // --- FUNZIONI DI APERTURA/CHIUSURA GLOBALI ---

    async function openModal(isEditMode = false, commessaId = null) {
        editingCommessaId = isEditMode ? commessaId : null;
        
        // Mostra il modale e disabilita il salvataggio
        if (newOrderModal) newOrderModal.style.display = 'block';
        if (elements.modalOverlay) elements.modalOverlay.style.display = 'block';
        if (elements.saveBtn) elements.saveBtn.disabled = true;

        // SEQUENZA GARANTITA:
        // A. Carica i dati per i dropdown.
        const dropdownData = await loadDropdownData();

        if (isEditMode) {
            // B. Se in modifica, carica i dati della commessa.
            elements.modalTitle.textContent = 'MODIFICA COMMESSA';
            elements.saveBtnText.textContent = 'Salva Modifiche';
            try {
                const response = await apiFetch(`/api/commessa/${commessaId}`);
                if (!response.ok) throw new Error('Dati commessa non trovati.');
                const data = await response.json();
                // C. Popola il form. Ora i dropdown sono già pieni.
                populateForm(data);
            } catch (error) {
                console.error('Errore nel caricamento dati per modifica:', error);
            }
        } else {
            // B. Se in creazione, imposta i default.
            elements.modalTitle.textContent = 'NUOVA COMMESSA';
            elements.saveBtnText.textContent = 'Crea Commessa';
            if (dropdownData.status && statusChoices) {
                const inLavorazioneStatus = dropdownData.status.find(s => s.nome_status === 'In Lavorazione');
                if (inLavorazioneStatus) {
                    statusChoices.setChoiceByValue(String(inLavorazioneStatus.id_status));
                }
            }
        }
        
        // D. Riabilita il salvataggio.
        if (elements.saveBtn) elements.saveBtn.disabled = false;
    }

    function closeAndCleanup() {
        if (newOrderModal) newOrderModal.style.display = 'none';
        if (elements.modalOverlay) elements.modalOverlay.style.display = 'none';
        
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

        // Creiamo le istanze, che rimarranno attive per tutta la vita della pagina.
        clienteChoices = new Choices(clienteSelect, { ...commonConfig, placeholderValue: 'Seleziona un cliente' });
        modelloChoices = new Choices(modelloSelect, { ...commonConfig, placeholderValue: 'Seleziona un modello' });
        statusChoices = new Choices(statusSelect, { ...commonConfig, searchEnabled: false, placeholderValue: 'Seleziona uno stato' });
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

    function cleanupNewOrderModal() {
        if (newOrderForm) newOrderForm.reset();
        if (clienteChoices) clienteChoices.clearStore();
        if (modelloChoices) modelloChoices.clearStore();
        if (statusChoices) statusChoices.clearStore();

        if (modalTitle) modalTitle.textContent = 'NUOVA COMMESSA';
        if (saveOrderBtnText) saveOrderBtnText.textContent = 'Crea Commessa';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Carica un\'immagine...';
        if (annoInput) annoInput.value = new Date().getFullYear();
    }
    
    // --- FUNZIONI DI UTILITY ---

    function populateForm(data) {
        console.log("LOG 4: Esecuzione di populateForm...");
        if (nomeCommessaInput) nomeCommessaInput.value = data.impianto || '';
        if (voInput) voInput.value = data.vo || '';
        if (rifTecnicoInput) rifTecnicoInput.value = data.riferimento_tecnico || '';
        if (descrizioneInput) descrizioneInput.value = data.note || '';
        if (provinciaInput) provinciaInput.value = data.provincia || '';
        if (paeseInput) paeseInput.value = data.paese || '';
        if (annoInput) annoInput.value = data.anno || '';
        if (matricolaInput) matricolaInput.value = data.matricola || '';
        if (fileNameDisplay && data.immagine) {
            fileNameDisplay.textContent = data.immagine.split('/').pop();
        }
        
        console.log(`--- DEBUG POPOLAMENTO DROPDOWN ---`);

        console.log(`Tentativo di impostare CLIENTE con ID: ${data.id_cliente_fk}`);
        // ERRORE CORRETTO QUI: Rimosso ".store"
        console.log('Opzioni presenti nel dropdown CLIENTE in questo momento:', clienteChoices.choices);
        if (clienteChoices) clienteChoices.setChoiceByValue(String(data.id_cliente_fk || ''));

        console.log(`Tentativo di impostare MODELLO con ID: ${data.id_modello_fk}`);
        // ERRORE CORRETTO QUI: Rimosso ".store"
        console.log('Opzioni presenti nel dropdown MODELLO in questo momento:', modelloChoices.choices);
        if (modelloChoices) modelloChoices.setChoiceByValue(String(data.id_modello_fk || ''));

        console.log(`Tentativo di impostare STATUS con ID: ${data.id_status_fk}`);
        // ERRORE CORRETTO QUI: Rimosso ".store"
        console.log('Opzioni presenti nel dropdown STATUS in questo momento:', statusChoices.choices);
        if (statusChoices) statusChoices.setChoiceByValue(String(data.id_status_fk || ''));
        
        console.log(`--- FINE DEBUG ---`);
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
        if (file && fileNameDisplay) fileNameDisplay.textContent = file.name;
        else if (fileNameDisplay) fileNameDisplay.textContent = 'Carica un\'immagine...';
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