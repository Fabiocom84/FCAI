// js/main.js

import { apiFetch } from './api-client.js';
import Legend from './legend.js';
import { showModal } from './shared-ui.js'; 

let appInitialized = false;
window.currentUserProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!appInitialized) {
        appInitialized = true;
        initializeApp();
    }
});

async function initializeApp() {
    console.log("Fase 1: Inizializzazione basata su profilo locale.");
    try {
        const profileString = localStorage.getItem('user_profile');
        if (!profileString) throw new Error("Profilo utente non trovato.");
        
        const profile = JSON.parse(profileString);
        window.currentUserProfile = profile;
        console.log("Fase 2: Profilo caricato:", profile);
        setupUI();

    } catch (error) {
        console.error("ERRORE CRITICO:", error.message);
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

function setupUI() {
    console.log("Fase 3: Setup UI.");

    const legendInstance = new Legend();
    const modalOverlay = document.getElementById('modalOverlay'); 
    
    // Controllo permessi Admin
    const isAdmin = window.currentUserProfile?.is_admin === true;
    
    // Gestione visibilità pulsanti protetti
    const trainingButton = document.getElementById('openTrainingModalBtn');
    if (trainingButton && !isAdmin) trainingButton.style.display = 'none';

    // --- NUOVO: Gestione pulsante Configurazione Logica ---
    const configButton = document.getElementById('openConfigBtn');
    if (configButton && !isAdmin) {
        configButton.style.display = 'none';
    }

    // Gestione click Dashboard (Placeholder Analisi)
    const dashboardBtn = document.getElementById('openDashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showModal({ 
                title: 'In Sviluppo', 
                message: 'La Dashboard Analisi dei Dati sarà disponibile prossimamente.', 
                confirmText: 'OK' 
            });
        });
    }

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('session_token'); 
        localStorage.removeItem('user_profile');
        window.location.href = 'login.html';
    });

    // Binding Modali Esistenti
    document.getElementById('openInsertDataModalBtn')?.addEventListener('click', openInsertDataModal);
    document.getElementById('openChatModalBtn')?.addEventListener('click', openChatModal);   
    document.getElementById('openTrainingModalBtn')?.addEventListener('click', openTrainingModal);

    // Overlay Close
    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            const openModal = document.querySelector('.modal[style*="display: block"]');
            if (openModal) {
                if (openModal.id === 'insertDataModal') closeInsertDataModal();
                else if (openModal.id === 'chatModal') closeChatModal();
                else if (openModal.id === 'trainingModal') closeTrainingModal();
            }
        });
    }

    // Export globale funzioni modali
    window.openInsertDataModal = openInsertDataModal;
    window.openChatModal = openChatModal;
    window.openTrainingModal = openTrainingModal;
    window.closeInsertDataModal = closeInsertDataModal;
    window.closeChatModal = closeChatModal;
    window.closeTrainingModal = closeTrainingModal;
}

// Funzioni Helper per i Modali
function openInsertDataModal() {
    const m = document.getElementById('insertDataModal');
    const o = document.getElementById('modalOverlay');
    if(m) { m.style.display = 'block'; o.style.display = 'block'; if(window.prepareInsertDataModal) window.prepareInsertDataModal(); }
}
function closeInsertDataModal() {
    const m = document.getElementById('insertDataModal');
    const o = document.getElementById('modalOverlay');
    if(m) m.style.display = 'none'; if(o) o.style.display = 'none'; if(window.cleanupInsertDataModal) window.cleanupInsertDataModal();
}
function openChatModal() { document.getElementById('chatModal').style.display = 'block'; document.getElementById('modalOverlay').style.display = 'block'; }
function closeChatModal() { document.getElementById('chatModal').style.display = 'none'; document.getElementById('modalOverlay').style.display = 'none'; }
function openTrainingModal() { document.getElementById('trainingModal').style.display = 'block'; document.getElementById('modalOverlay').style.display = 'block'; }
function closeTrainingModal() { document.getElementById('trainingModal').style.display = 'none'; document.getElementById('modalOverlay').style.display = 'none'; }