// js/main.js (Versione Fix "Velo Scuro" & ID Match)

import { IsAdmin, CurrentUser } from './core-init.js';
import { apiFetch } from './api-client.js';
import Legend from './legend.js';
import { showModal } from './shared-ui.js'; 

let appInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!appInitialized) {
        appInitialized = true;
        initializeApp();
    }
});

async function initializeApp() {
    const overlay = document.getElementById('modalOverlay');
    
    try {
        // 1. Controllo di sicurezza base
        if (!CurrentUser) {
            throw new Error("Utente non identificato. Riesegui il login.");
        }
        
        console.log("🚀 Avvio App. Utente:", CurrentUser.nome_cognome, "| Admin:", IsAdmin);
        
        // 2. Setup dell'interfaccia (Nascondi/Mostra bottoni)
        setupUI();
        
    } catch (error) {
        console.error("❌ Errore critico inizializzazione:", error);
        alert("Errore durante il caricamento: " + error.message);
    } finally {
        // ============================================================
        // FIX VISIBILITÀ: Rimuoviamo sempre overlay e velo body
        // ============================================================
        if (overlay) overlay.style.display = 'none';
        
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
        document.body.classList.remove('modal-open');
    }
}

function setupUI() {
    console.log("🛠️ Setup UI...");

    // 1. VISUALIZZA NOME UTENTE
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl && CurrentUser) {
        greetingEl.innerHTML = `Ciao, <strong>${CurrentUser.nome_cognome}</strong>`;
    }

    // 2. GESTIONE VISIBILITÀ BOTTONI
    if (!IsAdmin) {
        const buttonsToHide = [
            'btn-inserisci-dati',        
            'openChatModalBtn',          
            'openDataGridBtn',           
            'openInsertProductionOrderBtn', 
            'openViewProductionOrdersBtn',
            'openDashboardBtn',          
            'btn-registro-presenze',     
            'openConfigBtn',             
            'btn-attivita',              
            'openTrainingModalBtn'       
        ];

        buttonsToHide.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'none';
        });
        
        hideLegendItemsForNonAdmin();

    } else {
        ['openConfigBtn', 'openTrainingModalBtn', 'openDataGridBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'flex';
        });
    }

    if (!window.uiEventsBound) {
        bindGlobalEvents();
        window.uiEventsBound = true;
    }
    
    new Legend();
}

function hideLegendItemsForNonAdmin() {
    const legendSelectors = [
        '.insert-data-button',
        '.chat-ai-button',
        '.agile-view-button',
        '.dashboard-button',
        '.attendance-button',
        '.config-button'
    ];

    legendSelectors.forEach(selector => {
        const iconInLegend = document.querySelector(`#mainPageLegend .legend-icon${selector}`);
        if (iconInLegend) {
            const legendItem = iconInLegend.closest('.legend-item');
            if (legendItem) legendItem.style.display = 'none';
        }
    });
}

function bindGlobalEvents() {
    // Gestione Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Modali Placeholder
    document.getElementById('openDashboardBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showModal({ title: 'Info', message: 'Dashboard in arrivo.', confirmText: 'OK' });
    });
    
    // FIX: ID aggiornato per corrispondere a index.html (btn-stampa-ore)
    const printBtn = document.getElementById('btn-stampa-ore') || document.getElementById('openPrintHoursBtn');
    printBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        showModal({ title: 'Info', message: 'Stampa report in sviluppo.', confirmText: 'OK' });
    });

    // Helper per binding
    const bind = (id, fn) => { 
        const el = document.getElementById(id); 
        if(el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
    };

    // Binding Apertura Modali
    bind('openInsertDataModalBtn', window.openInsertDataModal);
    bind('openChatModalBtn', window.openChatModal);
    bind('openTrainingModalBtn', window.openTrainingModal);
    
    // Gestione Chiusura Overlay clickando fuori
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if(document.querySelector('#insertDataModal')?.style.display === 'block') window.closeInsertDataModal();
            if(document.querySelector('#chatModal')?.style.display === 'block') window.closeChatModal();
            if(document.querySelector('#trainingModal')?.style.display === 'block') window.closeTrainingModal();
        });
    }
}

// Funzioni Globali per l'HTML (Retrocompatibilità)
window.openInsertDataModal = () => { toggleModal('insertDataModal', true); };
window.closeInsertDataModal = () => { toggleModal('insertDataModal', false); };

window.openChatModal = () => { toggleModal('chatModal', true); };
window.closeChatModal = () => { toggleModal('chatModal', false); };

window.openTrainingModal = () => { toggleModal('trainingModal', true); };
window.closeTrainingModal = () => { toggleModal('trainingModal', false); };

function toggleModal(modalId, show) {
    const m = document.getElementById(modalId);
    const o = document.getElementById('modalOverlay');
    if (!m || !o) return;

    if (show) {
        m.style.display = 'block';
        o.style.display = 'block';
        document.body.classList.add('modal-open');
    } else {
        m.style.display = 'none';
        o.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}