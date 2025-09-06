// js/new-order-modal.js

// Elementi DOM
const newOrderModal = document.getElementById('newOrderModal');
const closeNewOrderModalBtn = newOrderModal ? newOrderModal.querySelector('.close-button') : null;
const saveNewOrderButton = document.getElementById('saveNewOrderButton');
const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn'); // Presumo che esista
const newOrderSuccessMessage = document.getElementById('newOrderSuccessMessage');

// Elementi dei dropdown
const modelloSelect = document.getElementById('newOrderModello');
const statusSelect = document.getElementById('newOrderStatus');

const backendUrl = window.BACKEND_URL;

// Elementi per l'animazione di caricamento
const loadingIndicator = document.createElement('div');
loadingIndicator.id = 'newOrderLoadingIndicator';
loadingIndicator.className = 'loading-indicator'; // Aggiungi una classe per lo stile CSS
loadingIndicator.style.display = 'none';
loadingIndicator.style.position = 'absolute';
loadingIndicator.style.top = '50%';
loadingIndicator.style.left = '50%';
loadingIndicator.style.transform = 'translate(-50%, -50%)';
loadingIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
loadingIndicator.style.padding = '20px';
loadingIndicator.style.borderRadius = '8px';
loadingIndicator.style.zIndex = '1000';
loadingIndicator.style.textAlign = 'center';

newOrderModal?.appendChild(loadingIndicator);

// Funzione unificata per mostrare/nascondere il caricamento
// Accetta un argomento per personalizzare il messaggio
function showLoading(message = 'Caricamento dati...') {
    if (loadingIndicator) {
        loadingIndicator.innerHTML = `<p>${message}</p>`;
        loadingIndicator.style.display = 'block';
    }
}

function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Funzione per popolare un dropdown in modo generico
function populateDropdown(selectElement, data, placeholder) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
    if (data && data.length > 0) {
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            selectElement.appendChild(option);
        });
    }
}

// Funzione per caricare i dati dei dropdown dal backend
async function loadDynamicDropdowns() {
    showLoading('Caricamento dati...');
    try {
        // Usiamo Promise.all con il nostro nuovo apiFetch
        const [modelsResponse, statusResponse] = await Promise.all([
            apiFetch(`${window.BACKEND_URL}/api/get-modelli`),
            apiFetch(`${window.BACKEND_URL}/api/get-all-statuses`)
        ]);

        if (!modelsResponse.ok || !statusResponse.ok) {
            throw new Error('Errore nel recupero dei dati dei dropdown.');
        }

        const modelsData = await modelsResponse.json();
        const statusData = await statusResponse.json();

        populateDropdown(modelloSelect, modelsData.models, 'Seleziona un modello');
        populateDropdown(statusSelect, statusData.statuses, 'Seleziona uno status');

    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error('Errore nel caricamento delle opzioni dropdown:', error);
        }
    } finally {
        hideLoading();
    }
}

async function saveNewOrder(event) {
    event.preventDefault();
    
    if (!newOrderForm) {
        console.error('Form non trovato');
        return;
    }
    const formData = new FormData(newOrderForm);

    showLoading('Salvataggio in corso...');
    try {
        // Usiamo apiFetch, che gestisce automaticamente il token per i FormData
        const response = await apiFetch(`${window.BACKEND_URL}/api/new-order`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore durante il salvataggio della commessa.');
        }
        
        const result = await response.json();
        console.log('Commessa salvata con successo:', result);
        
        newOrderForm.style.display = 'none';
        if (newOrderSuccessMessage) newOrderSuccessMessage.style.display = 'block';

        setTimeout(() => {
            closeNewOrderModal(); // Chiama la funzione di chiusura globale
        }, 2000);
        
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error('Errore nel salvataggio della nuova commessa:', error);
            alert('Errore nel salvataggio della nuova commessa: ' + error.message);
        }
    } finally {
        hideLoading();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
    
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            if (newOrderModal) newOrderModal.style.display = 'block';
            if (window.modalOverlay) window.modalOverlay.style.display = 'block';
            await loadDynamicDropdowns();
        });
    }

    if (closeNewOrderModalBtn) {
        // Usiamo la funzione di chiusura definita in main.js per coerenza
        closeNewOrderModalBtn.addEventListener('click', window.closeNewOrderModal);
    }
    
    if (saveNewOrderButton) {
        saveNewOrderButton.addEventListener('click', saveNewOrder);
    }
});

// Funzione di reset chiamata da main.js quando il modale si chiude
window.resetNewOrderModal = function() {
    if (newOrderForm) {
        newOrderForm.reset();
        newOrderForm.style.display = 'block';
    }
    if (newOrderSuccessMessage) {
        newOrderSuccessMessage.style.display = 'none';
    }
    hideLoading();
};