// js/main.js (Versione Fix "Velo Scuro")

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
        // Mostra un caricamento visivo (opzionale, se vuoi l'effetto caricamento)
        // if (overlay) overlay.style.display = 'block';

        // 1. Controllo di sicurezza base
        if (!CurrentUser) {
            throw new Error("Utente non identificato. Riesegui il login.");
        }

        console.log("🚀 Avvio App. Utente:", CurrentUser.nome_cognome, "| Admin:", IsAdmin);

        // 2. Setup dell'interfaccia (Nascondi/Mostra bottoni)
        setupUI();

        // 3. (OPZIONALE) Caricamento Dati Iniziali
        // Se in futuro dovrai caricare dati all'avvio, FALLO QUI.
        // Esempio: 
        // await loadDashboardData(); 

        // ATTENZIONE: Se carichi dati ADMIN, devi proteggerli così:
        /*
        if (IsAdmin) {
            try {
                await apiFetch('/api/admin/init-data'); 
            } catch (e) {
                console.warn("Admin data error (ignorato):", e);
            }
        }
        */

    } catch (error) {
        console.error("❌ Errore critico inizializzazione:", error);
        // In caso di errore grave, slogghiamo per sicurezza
        // localStorage.clear();
        // window.location.href = 'login.html';
        alert("Errore durante il caricamento: " + error.message);
    } finally {
        // ============================================================
        // IL FIX CHE RISOLVE IL BLOCCO:
        // Qualsiasi cosa succeda (errore o successo), togliamo il velo.
        // ============================================================
        if (overlay) overlay.style.display = 'none';

        // Forziamo la visibilità del body (nel caso index.html lo nasconda)
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

        // --- CONTROLLO RUOLO ROBUSTO & CASE-INSENSITIVE ---
        let isImpiegato = false;
        let roleNameFound = "Nessuno";

        if (CurrentUser.ruoli) {
            // CASO A: Array
            if (Array.isArray(CurrentUser.ruoli) && CurrentUser.ruoli.length > 0) {
                roleNameFound = CurrentUser.ruoli[0].nome_ruolo;
            }
            // CASO B: Oggetto
            else if (typeof CurrentUser.ruoli === 'object') {
                roleNameFound = CurrentUser.ruoli.nome_ruolo;
            }
        }

        // CASO C: Fallback colonna diretta
        if (!roleNameFound || roleNameFound === "Nessuno") {
            if (CurrentUser.ruolo) roleNameFound = CurrentUser.ruolo;
        }

        // --- FIX MAIUSCOLE/MINUSCOLE ---
        // Convertiamo tutto in minuscolo prima di confrontare
        if (roleNameFound && roleNameFound.trim().toLowerCase() === 'impiegato') {
            isImpiegato = true;
        }

        console.log("🔍 DEBUG RUOLO -> Trovato:", roleNameFound, "| IsImpiegato:", isImpiegato);

        // ELENCO BOTTONI DA NASCONDERE
        const buttonsToHide = [
            'btn-inserisci-dati',
            'openChatModalBtn',
            'openDataGridBtn',
            'btn-inserimento-ordini',
            'openViewProductionOrdersBtn',
            'btn-dashboard-link',
            'btn-registro-presenze',
            'btn-dashboard-link',
            'btn-registro-presenze',
            'openConfigBtn',
            'openTrainingModalBtn',
            'btn-chat-ai'  // Added: Hide Chat AI button for non-admin
        ];

        // Se NON è Impiegato, nascondi anche il bottone Attività
        if (!isImpiegato) {
            buttonsToHide.push('btn-attivita');
        }

        buttonsToHide.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'none';
        });

        hideLegendItemsForNonAdmin();

    } else {
        // Admin vede tutto
        ['openConfigBtn', 'openTrainingModalBtn', 'openDataGridBtn', 'btn-attivita'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'flex';
        });
    }

    // CHIAMATA CHECK NOTIFICHE
    checkUnreadNotifications();

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

    document.getElementById('openPrintHoursBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showModal({ title: 'Info', message: 'Stampa report in sviluppo.', confirmText: 'OK' });
    });

    // Helper per binding
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
    };

    // Binding Apertura Modali
    bind('openInsertDataModalBtn', window.openInsertDataModal);
    bind('openChatModalBtn', window.openChatModal);
    bind('openTrainingModalBtn', window.openTrainingModal);

    // Gestione Chiusura Overlay clickando fuori
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (document.querySelector('#insertDataModal')?.style.display === 'block') window.closeInsertDataModal();
            if (document.querySelector('#chatModal')?.style.display === 'block') window.closeChatModal();
            if (document.querySelector('#trainingModal')?.style.display === 'block') window.closeTrainingModal();
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

async function checkUnreadNotifications() {
    const btnTask = document.getElementById('btn-attivita');

    // Se il bottone non esiste (es. utente non abilitato), non fare nulla
    if (!btnTask || btnTask.style.display === 'none') return;

    try {
        // Chiamata all'endpoint appena creato
        const res = await apiFetch('/api/tasks/notifiche/count');
        const data = await res.json();

        if (data.count > 0) {
            // Crea il badge
            const badge = document.createElement('div');
            badge.className = 'notification-badge';
            badge.textContent = data.count > 99 ? '99+' : data.count;

            // Rimuovi vecchi badge se ce ne sono
            const oldBadge = btnTask.querySelector('.notification-badge');
            if (oldBadge) oldBadge.remove();

            btnTask.appendChild(badge);
        }
    } catch (error) {
        console.warn("Impossibile recuperare notifiche:", error);
    }
}