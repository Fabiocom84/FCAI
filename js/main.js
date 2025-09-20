// js/main.js

import { API_BASE_URL } from './config.js';
import { supabase } from './supabase-client.js';
import Legend from './legend.js';

function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function logoutUser(message) {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    
    if (message) {
        alert(message);
    }
    
    console.log('Token rimosso. Reindirizzamento a login.html...');
    window.location.href = 'login.html'; 
}

async function apiFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = { ...options.headers };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // --- CORREZIONE QUI ---
    // Costruisce l'URL completo unendo la base URL dal file di configurazione
    // con l'endpoint specifico della chiamata (es. '/api/commesse-init-data').
    const fullUrl = `${API_BASE_URL}${url}`;

    // Usa l'URL completo nella chiamata fetch.
    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
        logoutUser("La tua sessione è scaduta o non è valida. Per favore, effettua nuovamente il login.");
        throw new Error("Unauthorized"); 
    }
    return response;
}

window.apiFetch = apiFetch;

/**
 * Mostra un modale di dialogo personalizzato.
 * @param {object} options - { title, message, confirmText, cancelText }
 * @returns {Promise<boolean>} - Risolve a 'true' se confermato, 'false' se annullato.
 */
function showModal({ title, message, confirmText, cancelText }) {
    return new Promise(resolve => {
        const overlay = document.getElementById('custom-modal-overlay');
        const modalTitle = document.getElementById('custom-modal-title');
        const modalMessage = document.getElementById('custom-modal-message');
        const modalButtons = document.getElementById('custom-modal-buttons');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalButtons.innerHTML = ''; // Pulisce i pulsanti precedenti

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = confirmText || 'OK';
        confirmBtn.className = 'button button--primary';
        modalButtons.appendChild(confirmBtn);
        
        confirmBtn.onclick = () => {
            overlay.style.display = 'none';
            resolve(true);
        };

        if (cancelText) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = cancelText;
            cancelBtn.className = 'button';
            modalButtons.appendChild(cancelBtn);
            cancelBtn.onclick = () => {
                overlay.style.display = 'none';
                resolve(false);
            };
        }
        
        overlay.style.display = 'flex';
    });
}
window.showModal = showModal; // Rendi la funzione disponibile globalmente

let legendInstance;
let modalOverlay;

// Istanze dei modali
let insertDataModalInstance; 
let chatModalInstance;
let newOrderModalInstance;
let trainingModalInstance;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    legendInstance = new Legend();
    window.legendInstance = legendInstance;
    modalOverlay = document.getElementById('modalOverlay'); 
    window.modalOverlay = modalOverlay;

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault(); 
            logoutUser();
        });
    }

    // Associa i pulsanti alle rispettive funzioni di apertura
    document.getElementById('openInsertDataModalBtn')?.addEventListener('click', openInsertDataModal);
    document.getElementById('openChatModalBtn')?.addEventListener('click', openChatModal);
    document.getElementById('openNewOrderModalBtn')?.addEventListener('click', openNewOrderModal);
    document.getElementById('openTrainingModalBtn')?.addEventListener('click', openTrainingModal);

    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            const openModal = document.querySelector('.modal[style*="display: block"]');
            if (openModal) {
                switch (openModal.id) {
                    case 'insertDataModal': closeInsertDataModal(); break;
                    case 'chatModal': closeChatModal(); break;
                    case 'newOrderModal': closeNewOrderModal(); break;
                    case 'trainingModal': closeTrainingModal(); break;
                }
            }
        });
    }

    loadLatestEntries();
};

// --- FUNZIONI DI APERTURA MODALI ---

function openInsertDataModal() {
    if (!insertDataModalInstance) insertDataModalInstance = document.getElementById('insertDataModal');
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        if (window.prepareInsertDataModal) window.prepareInsertDataModal();
    }
}

function openChatModal() {
    if (!chatModalInstance) chatModalInstance = document.getElementById('chatModal');
    if (chatModalInstance) {
        chatModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

// --- MODIFICA QUI ---
async function openNewOrderModal() {
    if (!newOrderModalInstance) newOrderModalInstance = document.getElementById('newOrderModal');
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        
        // Aggiunge la chiamata alla funzione di preparazione per caricare i dati dei dropdown
        if (typeof window.prepareNewOrderModal === 'function') {
            await window.prepareNewOrderModal();
        }
    }
}

function openTrainingModal() {
    if (!trainingModalInstance) trainingModalInstance = document.getElementById('trainingModal');
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

// --- FUNZIONI DI CHIUSURA MODALI ---

function closeInsertDataModal() {
    if (!insertDataModalInstance) insertDataModalInstance = document.getElementById('insertDataModal');
    if (insertDataModalInstance) insertDataModalInstance.style.display = 'none';
    modalOverlay.style.display = 'none';
    if (window.cleanupInsertDataModal) window.cleanupInsertDataModal();
}

function closeChatModal() {
    if (!chatModalInstance) chatModalInstance = document.getElementById('chatModal');
    if (chatModalInstance) chatModalInstance.style.display = 'none';
    modalOverlay.style.display = 'none';
}

// --- MODIFICA QUI ---
function closeNewOrderModal() {
    if (!newOrderModalInstance) newOrderModalInstance = document.getElementById('newOrderModal');
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'none';
    }
    modalOverlay.style.display = 'none';

    // Aggiunge la chiamata alla funzione di pulizia per resettare il form
    if (typeof window.cleanupNewOrderModal === 'function') {
        window.cleanupNewOrderModal();
    }
}

function closeTrainingModal() {
    if (!trainingModalInstance) trainingModalInstance = document.getElementById('trainingModal');
    if (trainingModalInstance) trainingModalInstance.style.display = 'none';
    modalOverlay.style.display = 'none';
}

// --- Rendi le funzioni di chiusura globalmente accessibili per i modali ---
window.closeInsertDataModal = closeInsertDataModal;
window.closeChatModal = closeChatModal;
window.closeNewOrderModal = closeNewOrderModal;
window.closeTrainingModal = closeTrainingModal;

// --- FUNZIONI DI CARICAMENTO DATI (invariate) ---
async function loadLatestEntries() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/api/latest-entries`);
        if (!response.ok) throw new Error(`Errore HTTP! Stato: ${response.status}`);
        const data = await response.json();
        console.log("Dati ricevuti:", data);
        updateLatestEntries(data);
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error('Errore durante il recupero degli ultimi inserimenti:', error);
        }
    }
}

function updateLatestEntries(data) {
    const latestEntriesList = document.querySelector('.latest-entries ul');
    if (!latestEntriesList) return; 

    const entries = data.latest_entries; 
    latestEntriesList.innerHTML = '';

    if (entries && entries.length > 0) {
        entries.forEach(entry => {
            const listItem = document.createElement('li');
            listItem.style.marginBottom = '15px';
            listItem.style.padding = '10px';
            listItem.style.borderBottom = '1px solid #eee';
            listItem.innerHTML = entry; 
            latestEntriesList.appendChild(listItem);
        });
    } else {
        const listItem = document.createElement('li');
        listItem.textContent = 'Nessun inserimento recente.';
        latestEntriesList.appendChild(listItem);
    }
}