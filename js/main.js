// js/main.js (Logica DB-Centric)

import { IsAdmin } from './core-init.js';
import { apiFetch } from './api-client.js';
import Legend from './legend.js';
import { showModal } from './shared-ui.js'; 

let appInitialized = false;
window.currentUserProfile = null; // Qui salviamo la "verità" che arriva dal DB

document.addEventListener('DOMContentLoaded', () => {
    if (!appInitialized) {
        appInitialized = true;
        initializeApp();
    }
});

async function initializeApp() {
    try {
        // 1. Recuperiamo quello che il DB ci ha dato al momento del Login
        const profileString = localStorage.getItem('user_profile');
        
        if (!profileString) {
            throw new Error("Nessun profilo trovato. Login necessario.");
        }
        
        // 2. Parsiamo i dati grezzi dal DB
        let rawProfile = JSON.parse(profileString);
        
        // 3. NORMALIZZAZIONE CRUCIALE (Il fix al tuo problema)
        // Il DB Supabase a volte manda true, a volte "true", a volte 1.
        // Noi uniformiamo tutto qui, così la logica a valle non fallisce mai.
        rawProfile.is_admin = normalizeAdminFlag(rawProfile.is_admin);
        
        window.currentUserProfile = rawProfile;
        
        console.log("Profilo utente caricato (Auth DB):", window.currentUserProfile);
        
        // 4. Avviamo l'interfaccia con i permessi calcolati
        setupUI();
        
        // Rendiamo la pagina visibile solo ora che sappiamo chi sei
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';

    } catch (error) {
        console.error("Errore inizializzazione:", error);
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

/**
 * Funzione che traduce il "dialetto" del database in vero Booleano JS.
 * Risolve il problema "Sono admin ma non vedo i tasti".
 */
function normalizeAdminFlag(val) {
    if (val === true) return true;       // Booleano puro
    if (val === "true") return true;     // Stringa dal JSON
    if (val === 1) return true;          // Intero da PostgreSQL
    if (val === "1") return true;        // Stringa numerica
    return false;
}

function setupUI() {
    console.log("🛠️ Setup UI...");

    // Definiamo gli ID dei bottoni solo per Admin
    const adminOnlyButtons = [
        'openConfigBtn', 
        'openTrainingModalBtn', 
        'openDataGridBtn'
    ];

    adminOnlyButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            // USIAMO LA COSTANTE IMPORTATA (Niente più check complessi qui)
            if (IsAdmin) {
                btn.style.display = 'flex'; 
                btn.classList.remove('disabled');
            } else {
                btn.style.display = 'none';
            }
        }
    });

    // --- BINDING EVENTI STANDARD (Chat, Modali, etc.) ---
    bindGlobalEvents();
}

function bindGlobalEvents() {
    // Gestione Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Modali Placeholder (Dashboard, etc.)
    document.getElementById('openDashboardBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showModal({ title: 'Info', message: 'Dashboard in arrivo.', confirmText: 'OK' });
    });
    
    document.getElementById('openPrintHoursBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showModal({ title: 'Info', message: 'Stampa report in sviluppo.', confirmText: 'OK' });
    });

    // Binding Apertura Modali Reali
    const bind = (id, fn) => { 
        const el = document.getElementById(id); 
        if(el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
    };

    bind('openInsertDataModalBtn', window.openInsertDataModal);
    bind('openChatModalBtn', window.openChatModal);
    bind('openTrainingModalBtn', window.openTrainingModal);
    
    // Gestione Chiusura Overlay
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if(document.querySelector('#insertDataModal')?.style.display === 'block') window.closeInsertDataModal();
            if(document.querySelector('#chatModal')?.style.display === 'block') window.closeChatModal();
            if(document.querySelector('#trainingModal')?.style.display === 'block') window.closeTrainingModal();
        });
    }
}

// Funzioni export per onclick nell'HTML (retrocompatibilità)
window.openInsertDataModal = () => { toggleModal('insertDataModal', true); };
window.closeInsertDataModal = () => { toggleModal('insertDataModal', false); };

window.openChatModal = () => { toggleModal('chatModal', true); };
window.closeChatModal = () => { toggleModal('chatModal', false); };

window.openTrainingModal = () => { toggleModal('trainingModal', true); };
window.closeTrainingModal = () => { toggleModal('trainingModal', false); };

// Helper unico per i modali
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