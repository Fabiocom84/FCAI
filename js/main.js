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

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
        logoutUser("La tua sessione è scaduta o non è valida. Per favore, effettua nuovamente il login.");
        throw new Error("Unauthorized"); 
    }
    return response;
}

window.apiFetch = apiFetch;

function showModal({ title, message, confirmText, cancelText }) {
    return new Promise(resolve => {
        const overlay = document.getElementById('custom-modal-overlay');
        const modalTitle = document.getElementById('custom-modal-title');
        const modalMessage = document.getElementById('custom-modal-message');
        const modalButtons = document.getElementById('custom-modal-buttons');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalButtons.innerHTML = '';

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
window.showModal = showModal;

let legendInstance;
let modalOverlay;

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

    // RIMOSSA la chiamata a loadLatestEntries();
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

async function openNewOrderModal() {
    if (!newOrderModalInstance) newOrderModalInstance = document.getElementById('newOrderModal');
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        
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

function closeNewOrderModal() {
    if (!newOrderModalInstance) newOrderModalInstance = document.getElementById('newOrderModal');
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'none';
    }
    modalOverlay.style.display = 'none';

    if (typeof window.cleanupNewOrderModal === 'function') {
        window.cleanupNewOrderModal();
    }
}

function closeTrainingModal() {
    if (!trainingModalInstance) trainingModalInstance = document.getElementById('trainingModal');
    if (trainingModalInstance) trainingModalInstance.style.display = 'none';
    modalOverlay.style.display = 'none';
}

window.closeInsertDataModal = closeInsertDataModal;
window.closeChatModal = closeChatModal;
window.closeNewOrderModal = closeNewOrderModal;
window.closeTrainingModal = closeTrainingModal;