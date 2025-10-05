// js/main.js (Versione Definitiva)

import { apiFetch } from './api-client.js';
import Legend from './legend.js';

let appInitialized = false;
window.currentUserProfile = null;

// La guardia ha già fatto il suo lavoro. Partiamo appena la pagina è pronta.
document.addEventListener('DOMContentLoaded', () => {
    if (!appInitialized) {
        appInitialized = true;
        initializeApp();
    }
});

async function initializeApp() {
    console.log("Fase 1: Inizializzazione basata su profilo locale.");
    try {
        // LEGGE IL PROFILO DIRETTAMENTE DALLO STORAGE
        const profileString = localStorage.getItem('user_profile');
        if (!profileString) {
            throw new Error("Profilo utente non trovato nella sessione locale.");
        }
        
        const profile = JSON.parse(profileString);
        window.currentUserProfile = profile;
        console.log("Fase 2: Profilo utente caricato con successo:", profile);
        setupUI();

    } catch (error) {
        console.error("ERRORE CRITICO in initializeApp:", error.message);
        alert("La tua sessione non è valida o è scaduta. Verrai disconnesso.");
        localStorage.removeItem('custom_session_token');
        localStorage.removeItem('user_profile');
        window.location.href = 'login.html';
    }
}


/**
 * Imposta tutti gli elementi dell'interfaccia utente.
 * Viene eseguita SOLO DOPO che initializeApp ha caricato con successo il profilo utente.
 * Questo garantisce che qualsiasi logica sui permessi funzionerà correttamente.
 */
function setupUI() {
    console.log("Fase 3: Avvio del setup dell'interfaccia utente.");

    const legendInstance = new Legend();
    const modalOverlay = document.getElementById('modalOverlay'); 
    const insertDataModalInstance = document.getElementById('insertDataModal');
    const chatModalInstance = document.getElementById('chatModal');
    const trainingModalInstance = document.getElementById('trainingModal');

    // Ora i controlli sui permessi usano il nostro profilo salvato.
    const isAdmin = window.currentUserProfile?.is_admin === true;
    const trainingButton = document.getElementById('openTrainingModalBtn');
    if (trainingButton && !isAdmin) {
        trainingButton.style.display = 'none';
    }

    // Il logout ora deve cancellare la nostra chiave.
    document.getElementById('logoutBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('custom_session_token');
        window.location.href = 'login.html';
    });

    // Modal Buttons
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

    // Rendiamo le funzioni e le istanze accessibili globalmente se necessario da altri script.
    window.legendInstance = legendInstance;
    window.modalOverlay = modalOverlay;
    
    window.openInsertDataModal = openInsertDataModal;
    window.openChatModal = openChatModal;
    window.openTrainingModal = openTrainingModal;

    window.closeInsertDataModal = closeInsertDataModal;
    window.closeChatModal = closeChatModal;
    window.closeTrainingModal = closeTrainingModal;
    
    window.showSuccessFeedbackModal = showSuccessFeedbackModal;
    window.closeSuccessFeedbackModal = closeSuccessFeedbackModal;

    console.log("Fase 4: Interfaccia utente pronta e operativa.");
}


// ---------------------------------------------------------------------------
// FUNZIONI HELPER (Gestione Modali)
// La loro logica interna non cambia.
// ---------------------------------------------------------------------------

function openInsertDataModal() {
    const insertDataModalInstance = document.getElementById('insertDataModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        if (window.prepareInsertDataModal) window.prepareInsertDataModal();
    }
}

function openChatModal() {
    const chatModalInstance = document.getElementById('chatModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (chatModalInstance) {
        chatModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openTrainingModal() {
    const trainingModalInstance = document.getElementById('trainingModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function closeInsertDataModal() {
    const insertDataModalInstance = document.getElementById('insertDataModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (insertDataModalInstance) insertDataModalInstance.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
    if (window.cleanupInsertDataModal) window.cleanupInsertDataModal();
}

function closeChatModal() {
    const chatModalInstance = document.getElementById('chatModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (chatModalInstance) chatModalInstance.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
}

function closeTrainingModal() {
    const trainingModalInstance = document.getElementById('trainingModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (trainingModalInstance) trainingModalInstance.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
}


// --- Funzioni per il modale di feedback (invariate) ---
let feedbackModal, countdownInterval, closeTimeout, parentModalToClose;

function showSuccessFeedbackModal(title, message, parentModalId) {
    if (!feedbackModal) {
        feedbackModal = document.getElementById('success-feedback-modal');
    }

    feedbackModal.querySelector('#feedback-modal-title').textContent = title;
    feedbackModal.querySelector('#feedback-modal-message').textContent = message;
    parentModalToClose = document.getElementById(parentModalId);

    const modalOverlay = document.getElementById('modalOverlay');
    feedbackModal.style.display = 'block';
    if (modalOverlay) modalOverlay.style.display = 'block';

    let seconds = 2; 
    const countdownElement = feedbackModal.querySelector('#feedback-modal-countdown');
    countdownElement.textContent = `Questo messaggio si chiuderà tra ${seconds} secondi...`;

    countdownInterval = setInterval(() => {
        seconds--;
        countdownElement.textContent = seconds > 0 ? `Questo messaggio si chiuderà tra ${seconds} secondi...` : '';
        if (seconds <= 0) clearInterval(countdownInterval);
    }, 1000);

    closeTimeout = setTimeout(closeSuccessFeedbackModal, 2000);

    feedbackModal.querySelector('#feedback-modal-close-btn').onclick = closeSuccessFeedbackModal;
    feedbackModal.querySelector('[data-close-feedback]').onclick = closeSuccessFeedbackModal;
}

function closeSuccessFeedbackModal() {
    clearInterval(countdownInterval);
    clearTimeout(closeTimeout);

    if (feedbackModal) feedbackModal.style.display = 'none';

    const modalOverlay = document.getElementById('modalOverlay');

    if (parentModalToClose) {
        const closeFunctionName = `close${parentModalToClose.id.charAt(0).toUpperCase() + parentModalToClose.id.slice(1)}`;
        if (window[closeFunctionName]) {
            window[closeFunctionName]();
        } else {
            parentModalToClose.style.display = 'none';
            if (modalOverlay) modalOverlay.style.display = 'none';
        }
    } else {
        if (modalOverlay) modalOverlay.style.display = 'none';
    }
}