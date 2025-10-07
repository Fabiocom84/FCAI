// js/new-order-modal.js

import { API_BASE_URL } from './config.js';
import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. VARIABILE DI STATO ---
    let editingCommessaId = null; // Memorizza l'ID della commessa se siamo in modalità "modifica"
    let clienteChoices, modelloChoices, statusChoices;

    // --- 2. ELEMENTI DOM (dichiarati una sola volta) ---
    const newOrderModal = document.getElementById('newOrderModal');
    const modalTitle = newOrderModal?.querySelector('h2');
    const closeNewOrderModalBtn = newOrderModal?.querySelector('.close-button');
    const newOrderForm = document.getElementById('newOrderForm');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const saveOrderBtnText = saveOrderBtn?.querySelector('span');
    
    // Riferimenti ai campi del form
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
    const fileNameDisplay = newOrderModal?.querySelector('label[for="immagineCommessa"] .file-name');

    // --- FUNZIONI GLOBALI DI APERTURA/CHIUSURA ---

    window.openNewOrderModal = async (isEditMode = false, commessaId = null) => {
        editingCommessaId = isEditMode ? commessaId : null;
        window.cleanupNewOrderModal();
        initializeAllChoices();

        // Mostra il modale subito con un'indicazione di caricamento
        if (newOrderModal) newOrderModal.style.display = 'block';
        if (modalOverlay) modalOverlay.style.display = 'block';
        if (saveOrderBtn) saveOrderBtn.disabled = true; // Disabilita il salvataggio mentre si carica

        // Attende che i dati dei dropdown siano caricati e li memorizza
        const dropdownData = await window.prepareNewOrderModal();

        if (isEditMode) {
            if (modalTitle) modalTitle.textContent = 'MODIFICA COMMESSA';
            if (saveOrderBtnText) saveOrderBtnText.textContent = 'Salva Modifiche';
            try {
                const response = await apiFetch(`/api/commessa/${commessaId}`);
                if (!response.ok) throw new Error('Dati commessa non trovati.');
                const data = await response.json();
                // Ora populateForm viene chiamato DOPO che i dropdown sono pieni, risolvendo il bug
                populateForm(data); 
            } catch (error) {
                console.error('Errore nel caricamento dati per modifica:', error);
                showModal({ title: 'Errore', message: 'Impossibile caricare i dati della commessa.', confirmText: 'Chiudi' });
            }
        } else {
            if (modalTitle) modalTitle.textContent = 'NUOVA COMMESSA';
            if (saveOrderBtnText) saveOrderBtnText.textContent = 'Crea Commessa';

            // NUOVA LOGICA: Imposta lo stato di default su "In Lavorazione"
            if (dropdownData.status && statusChoices) {
                const inLavorazioneStatus = dropdownData.status.find(s => s.nome_status === 'In Lavorazione');
                if (inLavorazioneStatus) {
                    statusChoices.setChoiceByValue(String(inLavorazioneStatus.id_status));
                }
            }
        }

        if(saveOrderBtn) saveOrderBtn.disabled = false; // Riabilita il salvataggio
    };

    window.closeNewOrderModal = () => {
        if (newOrderModal) newOrderModal.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
        window.cleanupNewOrderModal();
    };

    // --- 3. EVENT LISTENERS ---
    // Aggiunge l'evento al pulsante 'X' di chiusura
    const closeBtn = newOrderModal?.querySelector('.close-button');
    if (closeBtn) closeBtn.addEventListener('click', window.closeNewOrderModal);
    if (saveOrderBtn) saveOrderBtn.addEventListener('click', saveOrder);
    
    if (closeNewOrderModalBtn) closeNewOrderModalBtn.addEventListener('click', () => window.closeNewOrderModal());
    if (saveOrderBtn) saveOrderBtn.addEventListener('click', saveOrder);
    if (voInput) voInput.addEventListener('input', formatVO);
    if (rifTecnicoInput) rifTecnicoInput.addEventListener('input', formatRifTecnico);
    if (immagineInput) immagineInput.addEventListener('change', handleImageUpload);
    
    // --- 4. FUNZIONI GLOBALI DI GESTIONE MODALE ---

    // Prepara i dati dei dropdown (viene chiamata una sola volta)
    window.prepareNewOrderModal = async function() {
        if (!newOrderModal) return {}; // Restituisce un oggetto vuoto se il modale non esiste
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

            // Restituisce i dati caricati
            return { clienti, modelli, status }; 

        } catch (error) {
            console.error("Errore nel caricamento dati per il modale:", error);
            return {}; // Restituisce un oggetto vuoto in caso di errore
        }
    };

    // Pulisce il modale alla chiusura e lo resetta per una nuova creazione
    window.cleanupNewOrderModal = function() {
        if (newOrderForm) newOrderForm.reset();
        editingCommessaId = null;

        if (modalTitle) modalTitle.textContent = 'NUOVA COMMESSA';
        if (saveOrderBtnText) saveOrderBtnText.textContent = 'Crea Commessa';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Carica un\'immagine...';
        if (annoInput) annoInput.value = new Date().getFullYear();

        if (clienteChoices) clienteChoices.clearStore();
        if (modelloChoices) modelloChoices.clearStore();
        if (statusChoices) statusChoices.clearStore();
        
    };
    
    // --- 5. FUNZIONI DI UTILITY INTERNE ---

    function populateForm(data) {
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
        if(clienteChoices) clienteChoices.setChoiceByValue(String(data.id_cliente_fk || ''));
        if(modelloChoices) modelloChoices.setChoiceByValue(String(data.id_modello_fk || ''));
        if(statusChoices) statusChoices.setChoiceByValue(String(data.id_status_fk || ''));
    }

    function initializeAllChoices() {
        const commonConfig = {
            searchEnabled: true,
            itemSelectText: 'Seleziona',
            searchPlaceholderValue: 'Digita per filtrare...',
            placeholder: true,
        };

        if (clienteSelect) {
            clienteChoices = new Choices(clienteSelect, {
                ...commonConfig,
                placeholderValue: 'Seleziona un cliente',
            });
        }
        if (modelloSelect) {
            modelloChoices = new Choices(modelloSelect, {
                ...commonConfig,
                placeholderValue: 'Seleziona un modello',
            });
        }
        if (statusSelect) {
            // Per lo status, la ricerca potrebbe non essere necessaria, ma la manteniamo per coerenza
            statusChoices = new Choices(statusSelect, {
                ...commonConfig,
                searchEnabled: false, // Disabilitiamo la ricerca per lo status
                placeholderValue: 'Seleziona uno stato',
            });
        }
    }

    function populateSelect(choicesInstance, items, valueField, textField) {
        if (!choicesInstance) return;

        const options = items.map(item => ({
            value: item[valueField],
            label: item[textField]
        }));
        
        // Usiamo l'API di Choices per impostare le opzioni
        choicesInstance.setChoices(options, 'value', 'label', true);
    }

    function formatVO(event) {
        let value = event.target.value.replace(/\D/g, '');
        if (value.length > 2) {
            value = value.substring(0, 2) + '-' + value.substring(2, 6);
        }
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
        if (file && fileNameDisplay) {
            fileNameDisplay.textContent = file.name;
        } else if (fileNameDisplay) {
            fileNameDisplay.textContent = 'Carica un\'immagine...';
        }
    }

    // --- 6. FUNZIONE DI SALVATAGGIO UNIFICATA ---

    async function saveOrder(event) {
        event.preventDefault();
        if (!newOrderForm.checkValidity()) {
            newOrderForm.reportValidity();
            return;
        }
        if(saveOrderBtn) saveOrderBtn.disabled = true;

        const formData = new FormData(newOrderForm);
        let url, method;

        if (editingCommessaId) {
            url = `/api/commesse/${editingCommessaId}`;
            method = 'PUT';
        } else {
            url = '/api/commesse';
            method = 'POST';
        }

        try {
            const response = await apiFetch(url, { method: method, body: formData });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore sconosciuto.');
            }
            
            // Non mostriamo più il modale di feedback qui per un'esperienza più fluida,
            // la chiusura e l'aggiornamento della griglia sono un feedback sufficiente.
            
            // Aggiorna la vista delle commesse in background
            if (window.refreshCommesseView) window.refreshCommesseView();

            // --- RIGA MANCANTE AGGIUNTA QUI ---
            // Chiude il modale di modifica/creazione dopo il salvataggio.
            window.closeNewOrderModal(); 

        } catch (error) {
            // Logica per i messaggi di errore chiari (invariata)
            let userFriendlyMessage = `Si è verificato un errore. Dettagli: ${error.message}`;
            if (error.message && error.message.includes('violates not-null constraint')) {
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