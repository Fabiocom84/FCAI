import { API_BASE_URL } from './config.js';

// --- FIX: Move all DOM element selections inside the event listener ---
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

    if (closeNewOrderModalBtn) {
        closeNewOrderModalBtn.addEventListener('click', window.closeNewOrderModal);
    }
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', saveOrder);
    }

    // Funzione chiamata da main.js per preparare il modale all'apertura
    window.prepareNewOrderModal = async function() {
        if (!newOrderModal) return;
        
        // Svuota i menu a tendina per evitare duplicati
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

    async function saveOrder(event) {
        event.preventDefault();
        saveOrderBtn.disabled = true;

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
            // Opzionale: ricarica le card nella vista commesse se la funzione esiste
            if (window.refreshCommesseView) window.refreshCommesseView();

        } catch (error) {
            alert('Errore nella creazione della commessa: ' + error.message);
        } finally {
            saveOrderBtn.disabled = false;
        }
    }
});