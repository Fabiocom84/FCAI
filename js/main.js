// js/main.js

import { API_BASE_URL } from './config.js';
import { supabase } from './supabase-client.js';

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
    
    // Inizializza headers, ma non impostare Content-Type di default
    // Il browser lo imposterà automaticamente per FormData
    const headers = { ...options.headers };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Se il body non è FormData, imposta Content-Type a JSON
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        logoutUser("La tua sessione è scaduta o non è valida. Per favore, effettua nuovamente il login.");
        throw new Error("Unauthorized"); 
    }
    return response;
}

let legendInstance;
let modalOverlay;

// Istanze dei modali
let insertDataModalInstance; 
let chatModalInstance;
let newOrderModalInstance;
let trainingModalInstance;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();});

function initializeApp() {
    legendInstance = new Legend();
    window.legendInstance = legendInstance;
    modalOverlay = document.getElementById('modalOverlay'); 
    window.modalOverlay = modalOverlay;

    // Gestione Logout
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault(); 
            logoutUser();
        });
    }

    // Collega i pulsanti alle funzioni di apertura
    document.getElementById('openInsertDataModalBtn')?.addEventListener('click', openInsertDataModal);
    document.getElementById('openChatModalBtn')?.addEventListener('click', openChatModal);
    document.getElementById('openNewOrderModalBtn')?.addEventListener('click', openNewOrderModal);
    document.getElementById('openTrainingModalBtn')?.addEventListener('click', openTrainingModal);

    // Gestione chiusura con click sull'overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            const openModal = document.querySelector('.modal[style*="display: block"]');
            if (openModal) {
                switch (openModal.id) {
                    case 'insertDataModal':
                        closeInsertDataModal();
                        break;
                    case 'chatModal':
                        closeChatModal();
                        break;
                    case 'newOrderModal':
                        closeNewOrderModal();
                        break;
                    case 'trainingModal':
                        closeTrainingModal();
                        break;
                }
            }
        });
    }

    // Carica gli ultimi inserimenti all'avvio
    loadLatestEntries();
};

// --- FUNZIONI DI APERTURA MODALI ---

function openInsertDataModal() {
    if (!insertDataModalInstance) {
        insertDataModalInstance = document.getElementById('insertDataModal');
    }
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        
        // Chiama le funzioni specifiche dal suo file per preparare il modale
        if (window.prepareInsertDataModal) {
            window.prepareInsertDataModal();
        }
    }
}

function openChatModal() {
    if (!chatModalInstance) {
        chatModalInstance = document.getElementById('chatModal');
    }
    if (chatModalInstance) {
        chatModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openNewOrderModal() {
    if (!newOrderModalInstance) {
        newOrderModalInstance = document.getElementById('newOrderModal');
    }
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openTrainingModal() {
    if (!trainingModalInstance) {
        trainingModalInstance = document.getElementById('trainingModal');
    }
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

// --- FUNZIONI DI CHIUSURA MODALI ---

function closeInsertDataModal() {
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'none';
    }
    modalOverlay.style.display = 'none';
    
    // Chiama le funzioni specifiche dal suo file per resettare il modale
    if (window.cleanupInsertDataModal) {
        window.cleanupInsertDataModal();
    }
}

function closeChatModal() {
    if (chatModalInstance) {
        chatModalInstance.style.display = 'none';
        modalOverlay.style.display = 'none';
    }
}

function closeNewOrderModal() {
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'none';
        modalOverlay.style.display = 'none';
    }
}

function closeTrainingModal() {
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'none';
        modalOverlay.style.display = 'none';
    }
}

// --- ALTRE FUNZIONI ---

//---Caricamento latest entries
async function loadLatestEntries() {
    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/latest-entries`);

        if (!response.ok) {
            throw new Error(`Errore HTTP! Stato: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Dati ricevuti:", data);
        updateLatestEntries(data);

    } catch (error) {
        if (error.message !== "Unauthorized") {
            // Gestisci solo gli errori che non sono 401 (già gestiti da apiFetch)
            console.error('Errore durante il recupero degli ultimi inserimenti:', error);
        }
    }
}

function updateLatestEntries(data) {
    const entries = data.latest_entries; 
    const latestEntriesList = document.querySelector('.latest-entries ul');

    if (latestEntriesList) {
        latestEntriesList.innerHTML = '';

        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                const listItem = document.createElement('li');
                listItem.style.marginBottom = '15px';
                listItem.style.padding = '10px';
                listItem.style.borderBottom = '1px solid #eee';

                // Usa innerHTML per interpretare i tag HTML
                listItem.innerHTML = entry; 

                latestEntriesList.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = 'Nessun inserimento recente.';
            latestEntriesList.appendChild(listItem);
        }
    } else {
        console.error('Elemento .latest-entries ul non trovato.');
    }
}