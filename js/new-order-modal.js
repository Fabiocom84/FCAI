// js/new-order-modal.js

import { API_BASE_URL } from './config.js';
import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- VARIABILI DI STATO ---
    let editingCommessaId = null;
    let clienteChoices, modelloChoices, statusChoices;

    // --- ELEMENTI DOM ---
    const newOrderModal = document.getElementById('newOrderModal');
    if (!newOrderModal) return;

    const modalTitle = newOrderModal.querySelector('h2');
    const closeNewOrderModalBtn = newOrderModal.querySelector('.close-button');
    const newOrderForm = document.getElementById('newOrderForm');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const saveOrderBtnText = saveOrderBtn?.querySelector('span');
    const nomeCommessaInput = document.getElementById('nome-commessa');
    const clienteSelect = document.getElementById('cliente-select');
    const modelloSelect = document.getElementById('modello-select');
    const voInput = document.getElementById('vo-offerta');
    const rifTecnicoInput = document.getElementById('riferimento-tecnico');
    const descrizioneInput = document.getElementById('descrizione-commessa');
    const provinciaInput = document.getElementById('provincia-commessa');
    const paeseInput = document.getElementById('paese-commessa');
    const annoInput = document.getElementById('anno-commessa');
    const matricolaInput = document.getElementById('matricola-commessa');
    const statusSelect = document.getElementById('status-select');
    const immagineInput = document.getElementById('immagineCommessa');
    const fileNameDisplay = newOrderModal.querySelector('label[for="immagineCommessa"] .file-name');
    const modalOverlay = document.getElementById('modalOverlay');

    // --- FUNZIONI DI APERTURA/CHIUSURA GLOBALI ---

    window.openNewOrderModal = async (isEditMode = false, commessaId = null) => {
        // FASE 1: Setup iniziale e pulizia
        console.log(`--- Apertura modale. Modalità modifica: ${isEditMode}, ID: ${commessaId} ---`);
        editingCommessaId = isEditMode ? commessaId : null;
        cleanupNewOrderModal();
        
        // FASE 2: Mostra il modale e disabilita il salvataggio
        if (newOrderModal) newOrderModal.style.display = 'block';
        if (modalOverlay) modalOverlay.style.display = 'block';
        if (saveOrderBtn) saveOrderBtn.disabled = true;

        // FASE 3: Inizializza i componenti grafici (Choices.js)
        initializeAllChoices();
        
        // --- BLOCCO DUPLICATO RIMOSSO DA QUI ---
        // Il controllo di sicurezza e la seconda visualizzazione del modale sono stati eliminati
        // perché erano ridondanti e causavano l'errore.

        // FASE 4: Carica i dati per i dropdown
        const dropdownData = await prepareNewOrderModal();
        console.log("LOG 2: Dati per i dropdown caricati.");

        // FASE 5: Logica di modifica o creazione
        if (isEditMode) {
            if (modalTitle) modalTitle.textContent = 'MODIFICA COMMESSA';
            if (saveOrderBtnText) saveOrderBtnText.textContent = 'Salva Modifiche';
            try {
                const response = await apiFetch(`/api/commessa/${commessaId}`);
                if (!response.ok) throw new Error('Dati commessa non trovati.');
                const data = await response.json();
                console.log("LOG 3: Dati della commessa da modificare caricati:", data);
                populateForm(data);
            } catch (error) {
                console.error('Errore nel caricamento dati per modifica:', error);
                showModal({ title: 'Errore', message: 'Impossibile caricare i dati della commessa.', confirmText: 'Chiudi' });
            }
        } else {
            if (modalTitle) modalTitle.textContent = 'NUOVA COMMESSA';
            if (saveOrderBtnText) saveOrderBtnText.textContent = 'Crea Commessa';
            if (dropdownData.status && statusChoices) {
                const inLavorazioneStatus = dropdownData.status.find(s => s.nome_status === 'In Lavorazione');
                if (inLavorazioneStatus) {
                    statusChoices.setChoiceByValue(String(inLavorazioneStatus.id_status));
                }
            }
        }
        
        // FASE 6: Riabilita il salvataggio
        if (saveOrderBtn) saveOrderBtn.disabled = false;
    };


    window.closeNewOrderModal = () => {
        if (newOrderModal) newOrderModal.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
        cleanupNewOrderModal();
    };

    // --- EVENT LISTENERS ---
    if (closeNewOrderModalBtn) closeNewOrderModalBtn.addEventListener('click', window.closeNewOrderModal);
    if (saveOrderBtn) saveOrderBtn.addEventListener('click', saveOrder);
    if (voInput) voInput.addEventListener('input', formatVO);
    if (rifTecnicoInput) rifTecnicoInput.addEventListener('input', formatRifTecnico);
    if (immagineInput) immagineInput.addEventListener('change', handleImageUpload);
    
    // --- FUNZIONI DI GESTIONE ---

    async function prepareNewOrderModal() {
        console.log("LOG 1: Avvio caricamento dati per i dropdown...");
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
        // editingCommessaId NON viene resettato qui, ma solo all'apertura del modale.

        if (modalTitle) modalTitle.textContent = 'NUOVA COMMESSA';
        if (saveOrderBtnText) saveOrderBtnText.textContent = 'Crea Commessa';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Carica un\'immagine...';
        if (annoInput) annoInput.value = new Date().getFullYear();

        if (clienteChoices) clienteChoices.clearStore();
        if (modelloChoices) modelloChoices.clearStore();
        if (statusChoices) statusChoices.clearStore();
    }
    
    // --- FUNZIONI DI UTILITY ---

    function populateForm(data) {
        console.log("LOG 4: Esecuzione di populateForm...");
        if(nomeCommessaInput) nomeCommessaInput.value = data.impianto || ''; 
        if(voInput) voInput.value = data.vo || '';
        if(rifTecnicoInput) rifTecnicoInput.value = data.riferimento_tecnico || '';
        if(descrizioneInput) descrizioneInput.value = data.note || '';
        if(provinciaInput) provinciaInput.value = data.provincia || '';
        if(paeseInput) paeseInput.value = data.paese || '';
        if(annoInput) annoInput.value = data.anno || '';
        if(matricolaInput) matricolaInput.value = data.matricola || '';        
        if(fileNameDisplay && data.immagine) {
            fileNameDisplay.textContent = data.immagine.split('/').pop();
        }
        console.log(`--- DEBUG POPOLAMENTO DROPDOWN ---`);
        console.log(`Tentativo di impostare CLIENTE con ID: ${data.id_cliente_fk}`);
        console.log('Opzioni presenti nel dropdown CLIENTE in questo momento:', clienteChoices.store.choices);
        if (clienteChoices) clienteChoices.setChoiceByValue(String(data.id_cliente_fk || ''));

        console.log(`Tentativo di impostare MODELLO con ID: ${data.id_modello_fk}`);
        console.log('Opzioni presenti nel dropdown MODELLO in questo momento:', modelloChoices.store.choices);
        if (modelloChoices) modelloChoices.setChoiceByValue(String(data.id_modello_fk || ''));

        console.log(`Tentativo di impostare STATUS con ID: ${data.id_status_fk}`);
        console.log('Opzioni presenti nel dropdown STATUS in questo momento:', statusChoices.store.choices);
        if (statusChoices) statusChoices.setChoiceByValue(String(data.id_status_fk || ''));
        console.log(`--- FINE DEBUG ---`);
    }

    // Modifichiamo anche initializeAllChoices per renderla asincrona
    function initializeAllChoices() {
        try {
            if (clienteChoices) clienteChoices.destroy();
            if (modelloChoices) modelloChoices.destroy();
            if (statusChoices) statusChoices.destroy();

            const commonConfig = {
                searchEnabled: true,
                itemSelectText: 'Seleziona',
                searchPlaceholderValue: 'Digita per filtrare...',
                placeholder: true,
            };

            clienteChoices = new Choices(clienteSelect, { ...commonConfig, placeholderValue: 'Seleziona un cliente' });
            modelloChoices = new Choices(modelloSelect, { ...commonConfig, placeholderValue: 'Seleziona un modello' });
            statusChoices = new Choices(statusSelect, { ...commonConfig, searchEnabled: false, placeholderValue: 'Seleziona uno stato' });
            
        } catch (error) {
            // Se c'è un errore durante la creazione, lo vedremo qui.
            console.error("!!! ERRORE DURANTE L'ESECUZIONE DI new Choices() !!!", error);
        }
    }

    function populateSelect(choicesInstance, items, valueField, textField) {
    console.log(`Popolazione di ${choicesInstance.element.id} con ${items.length} opzioni.`);
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