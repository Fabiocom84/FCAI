// js/new-order-modal.js

import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. VARIABILE DI STATO ---
    let editingCommessaId = null; // Memorizza l'ID della commessa se siamo in modalità "modifica"

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

    // --- 3. EVENT LISTENERS ---
    if (closeNewOrderModalBtn) closeNewOrderModalBtn.addEventListener('click', () => window.closeNewOrderModal());
    if (saveOrderBtn) saveOrderBtn.addEventListener('click', saveOrder);
    if (voInput) voInput.addEventListener('input', formatVO);
    if (rifTecnicoInput) rifTecnicoInput.addEventListener('input', formatRifTecnico);
    if (immagineInput) immagineInput.addEventListener('change', handleImageUpload);
    
    // --- 4. FUNZIONI GLOBALI DI GESTIONE MODALE ---

    // Chiamata da `commesse.js` per aprire il modale in modalità MODIFICA
    window.openNewOrderModalForEdit = async (commessaId) => {
        editingCommessaId = commessaId;

        await prepareAndOpenModal();

        if (modalTitle) modalTitle.textContent = 'MODIFICA COMMESSA';
        if (saveOrderBtnText) saveOrderBtnText.textContent = 'Salva Modifiche';

        try {
            const response = await window.apiFetch(`/api/commessa/${commessaId}`);
            if (!response.ok) throw new Error('Dati commessa non trovati.');
            const data = await response.json();
            populateForm(data);
        } catch (error) {
            console.error('Errore nel caricamento dati per modifica:', error);
            window.showModal({ title: 'Errore', message: 'Impossibile caricare i dati della commessa.', confirmText: 'Chiudi' });
        }
    };

    // Funzione di utility per preparare e aprire il modale
    async function prepareAndOpenModal() {
        if (typeof window.prepareNewOrderModal === 'function') {
            await window.prepareNewOrderModal();
        }
        if (typeof window.openNewOrderModal === 'function') {
            window.openNewOrderModal();
        }
    }

    // Prepara i dati dei dropdown (viene chiamata una sola volta)
    window.prepareNewOrderModal = async function() {
        if (!newOrderModal) return;
        try {
            const [clientiRes, modelliRes, statusRes] = await Promise.all([
                window.apiFetch('/api/simple/clienti'),
                window.apiFetch('/api/simple/modelli'),
                window.apiFetch('/api/simple/status_commessa')
            ]);
            const clienti = await clientiRes.json();
            const modelli = await modelliRes.json();
            const status = await statusRes.json();

            populateSelect(clienteSelect, clienti, 'id_cliente', 'ragione_sociale', 'Seleziona un cliente');
            populateSelect(modelloSelect, modelli, 'id_modello', 'nome_modello', 'Seleziona un modello');
            populateSelect(statusSelect, status, 'id_status', 'nome_status', 'Seleziona uno stato');
        } catch (error) {
            console.error("Errore nel caricamento dati per il modale:", error);
        }
    };

    // Pulisce il modale alla chiusura e lo resetta per una nuova creazione
    window.cleanupNewOrderModal = function() {
        if (newOrderForm) newOrderForm.reset();
        editingCommessaId = null; // Fondamentale per resettare lo stato

        if (modalTitle) modalTitle.textContent = 'NUOVA COMMESSA';
        if (saveOrderBtnText) saveOrderBtnText.textContent = 'Crea Commessa';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Carica un\'immagine...';
        if (annoInput) annoInput.value = new Date().getFullYear();
        setDefaultStatus();
    };
    
    // --- 5. FUNZIONI DI UTILITY INTERNE ---

    function populateForm(data) {
        if(nomeCommessaInput) nomeCommessaInput.value = data.impianto || '';
        if(clienteSelect) clienteSelect.value = data.id_cliente_fk || '';
        if(modelloSelect) modelloSelect.value = data.id_modello_fk || '';
        if(voInput) voInput.value = data.vo || '';
        if(rifTecnicoInput) rifTecnicoInput.value = data.riferimento_tecnico || '';
        if(descrizioneInput) descrizioneInput.value = data.note || '';
        if(provinciaInput) provinciaInput.value = data.provincia || '';
        if(paeseInput) paeseInput.value = data.paese || '';
        if(annoInput) annoInput.value = data.anno || '';
        if(matricolaInput) matricolaInput.value = data.matricola || '';
        if(statusSelect) statusSelect.value = data.id_status_fk || '';
        if(fileNameDisplay && data.immagine) {
            fileNameDisplay.textContent = data.immagine.split('/').pop();
        }
    }

    function populateSelect(selectElement, items, valueField, textField, placeholder) {
        selectElement.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            selectElement.appendChild(option);
        });
    }
    
    function setDefaultStatus() {
        const statusOptions = statusSelect.options;
        for (let i = 0; i < statusOptions.length; i++) {
            if (statusOptions[i].textContent.toLowerCase() === 'in lavorazione') {
                statusSelect.value = statusOptions[i].value;
                break;
            }
        }
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
            const response = await window.apiFetch(url, { method: method, body: formData });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore sconosciuto.');
            }
            
            const successTitle = editingCommessaId ? 'MODIFICA COMMESSA' : 'NUOVA COMMESSA';
            const successMessage = editingCommessaId ? 'Dati aggiornati con successo!' : 'Dati salvati con successo!';
            window.showSuccessFeedbackModal(successTitle, successMessage, 'newOrderModal');
            
            if (window.refreshCommesseView) window.refreshCommesseView();

        } catch (error) {
            // Logica per i messaggi di errore chiari (invariata)
            let userFriendlyMessage = `Si è verificato un errore. Dettagli: ${error.message}`;
            if (error.message && error.message.includes('violates not-null constraint')) {
                if (error.message.includes('id_cliente_fk')) userFriendlyMessage = 'È necessario selezionare un cliente.';
                else if (error.message.includes('id_modello_fk')) userFriendlyMessage = 'È necessario selezionare un modello.';
                else userFriendlyMessage = 'Assicurati di aver compilato tutti i campi obbligatori (*).';
            }
            await window.showModal({ title: 'Attenzione', message: userFriendlyMessage, confirmText: 'Chiudi' });
        } finally {
            if(saveOrderBtn) saveOrderBtn.disabled = false;
        }
    }
});