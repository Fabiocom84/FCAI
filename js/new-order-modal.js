// js/new-order-modal.js

// --- Elementi DOM ---
const newOrderModal = document.getElementById('newOrderModal');
const closeNewOrderModalBtn = newOrderModal?.querySelector('.close-button');
const saveNewOrderButton = document.getElementById('saveNewOrderButton');
const newOrderForm = document.getElementById('newOrderForm');
const newOrderSuccessMessage = document.getElementById('newOrderSuccessMessage');

// Campi Select dei menu a tendina
const clienteSelect = document.getElementById('newOrderCliente');
const modelloSelect = document.getElementById('newOrderModello');
const statusSelect = document.getElementById('newOrderStatus');
const dataInput = document.getElementById('newOrderData');
const annoInput = document.getElementById('newOrderAnno');

// --- Funzioni e Logica ---

window.prepareNewOrderModal = async function() {
    resetNewOrderModal();
    await loadDynamicDropdowns();
    setDefaultValues();
};

window.cleanupNewOrderModal = function() {
    resetNewOrderModal();
};

async function loadDynamicDropdowns() {
    try {
        const response = await window.apiFetch('/api/commesse-init-data');
        if (!response.ok) {
            throw new Error(`Errore di rete: ${response.status}`);
        }
        const data = await response.json(); // Estrai il JSON dalla risposta

        populateSelect(clienteSelect, data.clienti, 'ragione_sociale', 'id_cliente');
        populateSelect(modelloSelect, data.modelli, 'nome_modello', 'id_modello');
        populateSelect(statusSelect, data.status, 'descrizione', 'id_status');

    } catch (error) {
        console.error('Errore nel caricamento delle opzioni dropdown:', error);
        alert('Errore nel caricamento dei dati. Assicurati che il server backend sia in esecuzione e aggiornato.');
    }
}

function populateSelect(selectElement, data, textField, valueField) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="" disabled selected>Seleziona un'opzione</option>`;
    if (data && data.length > 0) {
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            selectElement.appendChild(option);
        });
    }
}

async function saveNewOrder(event) {
    event.preventDefault();
    if (!newOrderForm) return;

    saveNewOrderButton.disabled = true;
    const formData = new FormData(newOrderForm);

    try {
        const response = await window.apiFetch('/api/commesse', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante il salvataggio.');
        }
        
        const result = await response.json();
        console.log('Commessa salvata con successo:', result);
        
        newOrderForm.style.display = 'none';
        if (newOrderSuccessMessage) newOrderSuccessMessage.style.display = 'block';

        setTimeout(() => {
            window.closeNewOrderModal();
        }, 2000);
        
    } catch (error) {
        alert('Errore nel salvataggio: ' + error.message);
        console.error('Errore nel salvataggio della nuova commessa:', error);
    } finally {
        saveNewOrderButton.disabled = false;
    }
}

function setDefaultValues() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    if (dataInput) dataInput.value = `${year}-${month}-${day}`;
    if (annoInput) annoInput.value = year;
}

function resetNewOrderModal() {
    if (newOrderForm) {
        newOrderForm.reset();
        newOrderForm.style.display = 'block';
    }
    if (newOrderSuccessMessage) {
        newOrderSuccessMessage.style.display = 'none';
    }
}