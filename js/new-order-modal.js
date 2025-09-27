// js/new-order-modal.js

import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Elementi DOM ---
    const newOrderModal = document.getElementById('newOrderModal');
    const closeNewOrderModalBtn = newOrderModal?.querySelector('.close-button');
    const newOrderForm = document.getElementById('newOrderForm');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    
    // Dropdowns
    const clienteSelect = document.getElementById('cliente-select');
    const modelloSelect = document.getElementById('modello-select');
    const statusSelect = document.getElementById('status-select');

    // Input per la formattazione automatica
    const voInput = document.getElementById('vo-offerta');
    const rifTecnicoInput = document.getElementById('riferimento-tecnico');

    // --- NUOVO: Elementi per il feedback dell'upload ---
    const immagineInput = document.getElementById('immagineCommessa');
    const fileNameDisplay = newOrderModal?.querySelector('label[for="immagineCommessa"] .file-name');

    // --- Event Listeners ---
    if (closeNewOrderModalBtn) {
        closeNewOrderModalBtn.addEventListener('click', window.closeNewOrderModal);
    }
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', saveOrder);
    }
    
    if (voInput) {
        voInput.addEventListener('input', formatVO);
    }
    if (rifTecnicoInput) {
        rifTecnicoInput.addEventListener('input', formatRifTecnico);
    }

    // --- NUOVO: Feedback per upload immagine ---
    if (immagineInput) {
        immagineInput.addEventListener('change', handleImageUpload);
    }
    
    // Funzione chiamata da main.js per preparare il modale all'apertura
    window.prepareNewOrderModal = async function() {
        if (!newOrderModal) return;
        
        clienteSelect.innerHTML = '<option>Caricamento...</option>';
        modelloSelect.innerHTML = '<option>Caricamento...</option>';
        statusSelect.innerHTML = '<option>Caricamento...</option>';
        
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
            
            setDefaultStatus();

        } catch (error) {
            console.error("Errore nel caricamento dati per il modale:", error);
            clienteSelect.innerHTML = '<option>Errore</option>';
            modelloSelect.innerHTML = '<option>Errore</option>';
            statusSelect.innerHTML = '<option>Errore</option>';
        }
    };

    // Funzione chiamata da main.js per pulire il modale alla chiusura
    window.cleanupNewOrderModal = function() {
        if (newOrderForm) newOrderForm.reset();
        // Ripristina il testo del nome file
        if (fileNameDisplay) fileNameDisplay.textContent = 'Carica un\'immagine...';
    };

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
    
    // --- NUOVO: Funzione per gestire il nome del file ---
    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && fileNameDisplay) {
            fileNameDisplay.textContent = file.name;
        } else if (fileNameDisplay) {
            fileNameDisplay.textContent = 'Carica un\'immagine...';
        }
    }

    async function saveOrder(event) {
        event.preventDefault();
        if(saveOrderBtn) saveOrderBtn.disabled = true;

        const formData = new FormData(newOrderForm);

        try {
            const response = await window.apiFetch('/api/commesse', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore sconosciuto.');
            }
            
            alert('Commessa creata con successo!');
            window.closeNewOrderModal();
            if (window.refreshCommesseView) window.refreshCommesseView();

        } catch (error) {
            alert('Errore nella creazione della commessa: ' + error.message);
        } finally {
            if(saveOrderBtn) saveOrderBtn.disabled = false;
        }
    }
});