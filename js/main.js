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
    document.getElementById('openTrainingModalBtn')?.addEventListener('click', openTrainingModal);

    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            const openModal = document.querySelector('.modal[style*="display: block"]');
            if (openModal) {
                switch (openModal.id) {
                    case 'insertDataModal': closeInsertDataModal(); break;
                    case 'chatModal': closeChatModal(); break;
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

function closeTrainingModal() {
    if (!trainingModalInstance) trainingModalInstance = document.getElementById('trainingModal');
    if (trainingModalInstance) trainingModalInstance.style.display = 'none';
    modalOverlay.style.display = 'none';
}

window.closeInsertDataModal = closeInsertDataModal;
window.closeChatModal = closeChatModal;
window.closeTrainingModal = closeTrainingModal;

// Variabili globali per il nuovo modale di feedback
let feedbackModal, feedbackOverlay, countdownInterval, closeTimeout, parentModalToClose;

function showSuccessFeedbackModal(title, message, parentModalId) {
    if (!feedbackModal) {
        feedbackModal = document.getElementById('success-feedback-modal');
        feedbackOverlay = document.getElementById('modalOverlay');
    }

    feedbackModal.querySelector('#feedback-modal-title').textContent = title;
    feedbackModal.querySelector('#feedback-modal-message').textContent = message;
    parentModalToClose = document.getElementById(parentModalId);

    feedbackModal.style.display = 'block';
    feedbackOverlay.style.display = 'block';

    // MODIFICATO: Durata ridotta a 2 secondi
    let seconds = 2; 
    const countdownElement = feedbackModal.querySelector('#feedback-modal-countdown');
    countdownElement.textContent = `Questo messaggio si chiuderà tra ${seconds} secondi...`;

    countdownInterval = setInterval(() => {
        seconds--;
        if (seconds > 0) {
            countdownElement.textContent = `Questo messaggio si chiuderà tra ${seconds} secondi...`;
        } else {
            // Nascondi il countdown quando arriva a zero
            countdownElement.textContent = ''; 
            clearInterval(countdownInterval);
        }
    }, 1000);

    // MODIFICATO: Timeout impostato a 2000ms (2 secondi)
    closeTimeout = setTimeout(closeSuccessFeedbackModal, 2000);

    feedbackModal.querySelector('#feedback-modal-close-btn').onclick = closeSuccessFeedbackModal;
    feedbackModal.querySelector('[data-close-feedback]').onclick = closeSuccessFeedbackModal;
}

function closeSuccessFeedbackModal() {
    // Pulisci i timer per evitare esecuzioni multiple
    clearInterval(countdownInterval);
    clearTimeout(closeTimeout);

    // Nascondi il modale di feedback
    if (feedbackModal) feedbackModal.style.display = 'none';
    if (feedbackOverlay) feedbackOverlay.style.display = 'none';

    // Chiudi il modale genitore (es. newOrderModal)
    if (parentModalToClose) {
        // Usiamo la funzione di chiusura globale se esiste, altrimenti lo nascondiamo
        const closeFunctionName = `close${parentModalToClose.id.charAt(0).toUpperCase() + parentModalToClose.id.slice(1)}`;
        if (window[closeFunctionName]) {
            window[closeFunctionName]();
        } else {
            parentModalToClose.style.display = 'none';
        }
    }
}

// Rendi le funzioni disponibili globalmente
window.showSuccessFeedbackModal = showSuccessFeedbackModal;
window.closeSuccessFeedbackModal = closeSuccessFeedbackModal;