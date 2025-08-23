// js/new-order-modal.js

// Elementi DOM
const newOrderModal = document.getElementById('newOrderModal');
const closeNewOrderModalBtn = newOrderModal ? newOrderModal.querySelector('.close-button') : null;
const saveNewOrderButton = document.getElementById('saveNewOrderButton');
const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn'); // Presumo che esista

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
    showLoading('Caricamento dati per i dropdown...');
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.error('Token di autenticazione non trovato.');
        hideLoading();
        return;
    }

    try {
        const [modelsResponse, statusResponse] = await Promise.all([
            fetch(`${backendUrl}/api/get-modelli`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
            fetch(`${backendUrl}/api/get-all-statuses`, { headers: { 'Authorization': `Bearer ${authToken}` } })
        ]);

        if (!modelsResponse.ok || !statusResponse.ok) {
            throw new Error('Errore nel recupero dei dati dei dropdown.');
        }

        const modelsData = await modelsResponse.json();
        const statusData = await statusResponse.json();

        populateDropdown(modelloSelect, modelsData.models, 'Seleziona un modello');
        populateDropdown(statusSelect, statusData.statuses, 'Seleziona uno status');

        console.log('Dropdown popolati con successo.');

    } catch (error) {
        console.error('Errore nel caricamento delle opzioni dropdown:', error);
    } finally {
        hideLoading();
    }
}

// Funzione per aprire il modale
if (openNewOrderModalBtn) {
    openNewOrderModalBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        newOrderModal.style.display = 'block';
        modalOverlay.style.display = 'block';
        console.log('Modale Nuova Commessa aperto.');
        await loadDynamicDropdowns();
    });
}

// Funzione per chiudere il modale e resettare il form
window.closeNewOrderModal = function() {
    newOrderModal.style.display = 'none';
    modalOverlay.style.display = 'none';
    // Resetta i campi del form quando il modale viene chiuso
    const newOrderForm = document.getElementById('newOrderForm'); // Recupera il form
    if (newOrderForm) {
        newOrderForm.reset();
    }
    hideLoading(); // Assicurati che l'indicatore sia nascosto alla chiusura
    console.log('Modale Nuova Commessa chiuso e form resettato.');
};

// Event listener per il pulsante di chiusura (X)
if (closeNewOrderModalBtn) {
    closeNewOrderModalBtn.addEventListener('click', () => {
        closeNewOrderModal();
    });
}

// Chiudi il modale cliccando sull'overlay
if (modalOverlay) {
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            closeNewOrderModal();
        }
    });
}

// Gestione del salvataggio dei dati
if (saveNewOrderButton) {
    saveNewOrderButton.addEventListener('click', async () => {
        console.log('Pulsante "Salva Nuova Commessa" cliccato.');
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta. Effettua il login.');
            window.location.href = '/login.html';
            return;
        }

        const newOrderForm = document.getElementById('newOrderForm'); // Recupera il form
        const formData = new FormData(newOrderForm);

        // Controllo campi obbligatori
        const requiredFields = ['cliente', 'impianto', 'modello', 'commessa', 'data', 'status'];
        const isValid = requiredFields.every(field => {
            if (!formData.get(field) || formData.get(field).trim() === '') {
                alert(`Per favore, compila il campo obbligatorio: ${field}`);
                return false;
            }
            return true;
        });

        if (!isValid) return;

        showLoading('Salvataggio in corso...');
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/new-order`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante il salvataggio della commessa.');
            }

            const result = await response.json();
            console.log('Commessa salvata con successo:', result);
            alert('Nuova commessa aggiunta con successo!');
            closeNewOrderModal();
        } catch (error) {
            console.error('Errore nel salvataggio della nuova commessa:', error);
            alert('Errore nel salvataggio della nuova commessa: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}