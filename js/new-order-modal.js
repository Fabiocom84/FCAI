// js/new-order-modal.js

// --- Elementi DOM ---
const newOrderModal = document.getElementById('newOrderModal');
const closeNewOrderModalBtn = newOrderModal?.querySelector('.close-button');
const saveNewOrderButton = document.getElementById('saveNewOrderButton');
const newOrderForm = document.getElementById('newOrderForm');
const newOrderSuccessMessage = document.getElementById('newOrderSuccessMessage');

// Campi Select dei menu a tendina
const clienteSelect = document.getElementById('newOrderCliente'); // Ora troverà il <select>
const modelloSelect = document.getElementById('newOrderModello');
const statusSelect = document.getElementById('newOrderStatus');
const dataInput = document.getElementById('newOrderData');
const annoInput = document.getElementById('newOrderAnno');

// --- Funzioni e Logica ---

/**
 * Funzione chiamata da main.js per preparare il modale.
 */
window.prepareNewOrderModal = async function() {
    resetNewOrderModal();
    await loadDynamicDropdowns();
    setDefaultValues();
};

/**
 * Funzione chiamata da main.js per pulire il modale dopo la chiusura.
 */
window.cleanupNewOrderModal = function() {
    resetNewOrderModal();
};

/**
 * Carica i dati per tutti i menu a tendina dal backend.
 */
async function loadDynamicDropdowns() {
    try {
        const response = await apiFetch('/api/commesse-init-data');

        // Popola tutti e tre i menu
        populateSelect(clienteSelect, response.clienti, 'ragione_sociale', 'id_cliente');
        populateSelect(modelloSelect, response.modelli, 'nome_modello', 'id_modello');
        populateSelect(statusSelect, response.status, 'descrizione', 'id_status');

    } catch (error) {
        console.error('Errore nel caricamento delle opzioni dropdown:', error);
        alert('Errore nel caricamento dei dati. Riprova più tardi.');
    }
}

/**
 * Funzione generica per popolare un elemento <select>
 */
function populateSelect(selectElement, data, textField, valueField) {
    if (!selectElement) return;
    // La prima opzione viene creata dinamicamente dall'HTML corretto
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

/**
 * Salva i dati della nuova commessa.
 */
async function saveNewOrder(event) {
    event.preventDefault();
    if (!newOrderForm) return;

    saveNewOrderButton.disabled = true;
    const formData = new FormData(newOrderForm);

    try {
        const result = await apiFetch('/api/commesse', {
            method: 'POST',
            body: formData
        });

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

/**
 * Imposta i valori di default nel form.
 */
function setDefaultValues() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    if (dataInput) dataInput.value = `${year}-${month}-${day}`;
    if (annoInput) annoInput.value = year;
}

/**
 * Resetta lo stato del modale.
 */
function resetNewOrderModal() {
    if (newOrderForm) {
        newOrderForm.reset();
        newOrderForm.style.display = 'block';
    }
    if (newOrderSuccessMessage) {
        newOrderSuccessMessage.style.display = 'none';
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
    
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', (event) => {
            event.preventDefault();
            window.openNewOrderModal();
        });
    }

    if (closeNewOrderModalBtn) {
        // Ora questo listener si attaccherà correttamente al <span>
        closeNewOrderModalBtn.addEventListener('click', window.closeNewOrderModal);
    }
    
    if (saveNewOrderButton) {
        saveNewOrderButton.addEventListener('click', saveNewOrder);
    }
});