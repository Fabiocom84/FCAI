// js/new-order-modal.js

// --- Elementi DOM ---
const newOrderModal = document.getElementById('newOrderModal');
const saveNewOrderButton = document.getElementById('saveNewOrderButton');
const newOrderForm = document.getElementById('newOrderForm');
const newOrderSuccessMessage = document.getElementById('newOrderSuccessMessage');

// Campi del form
const clienteInput = document.getElementById('newOrderCliente');
const clienteDatalist = document.getElementById('cliente-list');
const clienteIdInput = document.getElementById('newOrderClienteId');
const modelloSelect = document.getElementById('newOrderModello');
const statusSelect = document.getElementById('newOrderStatus');
const dataInput = document.getElementById('newOrderData');
const annoInput = document.getElementById('newOrderAnno');

// Array per mantenere i dati dei clienti
let clientiData = [];

// --- Funzioni e Logica ---

window.prepareNewOrderModal = async function() {
    resetNewOrderModal();
    await loadDynamicData();
    setDefaultValues();
};

window.cleanupNewOrderModal = function() {
    resetNewOrderModal();
};

async function loadDynamicData() {
    try {
        const response = await (await window.apiFetch('/api/commesse-init-data')).json();

        // Salva i dati dei clienti per la ricerca
        clientiData = response.clienti || [];
        
        // Popola la datalist dei clienti
        clienteDatalist.innerHTML = '';
        clientiData.forEach(item => {
            const option = document.createElement('option');
            option.value = item.ragione_sociale;
            option.dataset.id = item.id_cliente; // Salva l'ID in un attributo data
            clienteDatalist.appendChild(option);
        });

        // Popola gli altri menu a tendina
        populateSelect(modelloSelect, response.modelli, 'nome_modello', 'id_modello');
        populateSelect(statusSelect, response.status, 'nome_status', 'id_status'); // Corretto con nome_status

    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        alert('Errore nel caricamento dei dati. Assicurati che il server sia attivo.');
    }
}

// Aggiungi un listener per quando l'utente seleziona un cliente dalla lista
clienteInput.addEventListener('input', () => {
    const selectedValue = clienteInput.value;
    const cliente = clientiData.find(c => c.ragione_sociale === selectedValue);
    
    // Se il valore corrisponde a un cliente, salva il suo ID nel campo nascosto
    clienteIdInput.value = cliente ? cliente.id_cliente : '';
});

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
        if (!response.ok) throw new Error((await response.json()).error);
        
        console.log('Commessa salvata con successo:', await response.json());
        newOrderForm.style.display = 'none';
        if (newOrderSuccessMessage) newOrderSuccessMessage.style.display = 'block';

        setTimeout(() => window.closeNewOrderModal(), 2000);
        
    } catch (error) {
        alert('Errore nel salvataggio: ' + error.message);
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
    if (newOrderForm) newOrderForm.reset();
    if (clienteIdInput) clienteIdInput.value = '';
    if (newOrderForm) newOrderForm.style.display = 'block';
    if (newOrderSuccessMessage) newOrderSuccessMessage.style.display = 'none';
}