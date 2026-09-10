// js/main.js (Versione Fix "Velo Scuro")

import { IsAdmin, CurrentUser } from './core-init.js';
import { apiFetch, segnala } from './api-client.js';
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
                segnala(e);
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

    // 2. GESTIONE VISIBILITÀ BOTTONI (DEFAULT DENY LOGIC)

    // Logic: Buttons are hidden by default via CSS (.admin-only, .employee-access)
    // We reveal them based on role.

    // A. DETERMINE ROLES
    let isImpiegato = false;

    if (!IsAdmin) {
        let roleNameFound = "Nessuno";
        if (CurrentUser.ruoli) {
            if (Array.isArray(CurrentUser.ruoli) && CurrentUser.ruoli.length > 0) roleNameFound = CurrentUser.ruoli[0].nome_ruolo;
            else if (typeof CurrentUser.ruoli === 'object') roleNameFound = CurrentUser.ruoli.nome_ruolo;
        }
        if ((!roleNameFound || roleNameFound === "Nessuno") && CurrentUser.ruolo) roleNameFound = CurrentUser.ruolo;

        if (roleNameFound && roleNameFound.trim().toLowerCase() === 'impiegato') {
            isImpiegato = true;
        }
        console.log("🔍 DEBUG RUOLO -> IsImpiegato:", isImpiegato);
    }

    // B. REVEAL LOGIC
    const adminElements = document.querySelectorAll('.admin-only');
    const employeeElements = document.querySelectorAll('.employee-access');

    if (IsAdmin) {
        // ADMIN: Show EVERYTHING
        adminElements.forEach(el => {
            el.classList.remove('admin-only');
            el.style.display = ''; // Reset inline style
        });
        employeeElements.forEach(el => {
            el.classList.remove('employee-access');
            el.style.display = ''; // Reset inline style
        });
    } else {
        // NON-ADMIN

        // Hide Legend Items (keep existing logic)
        hideLegendItemsForNonAdmin();

        if (isImpiegato) {
            // IMPIEGATO: Show only Employee access items
            employeeElements.forEach(el => {
                el.classList.remove('employee-access');
                el.style.display = ''; // Reset inline style
            });
        }
        // GUEST: Sees only what is not hidden by default (Basic buttons)
    }

    // CHIAMATA CHECK NOTIFICHE
    checkUnreadNotifications();
    checkOrphanNotes();

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
    bind('openInsertDataModalBtn', openInsertDataModal);
    bind('openChatModalBtn', openChatModal);
    bind('openTrainingModalBtn', openTrainingModal);

    // Gestione Chiusura Overlay clickando fuori
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (document.querySelector('#insertDataModal')?.style.display === 'block') closeInsertDataModal();
            if (document.querySelector('#chatModal')?.style.display === 'block') closeChatModal();
            if (document.querySelector('#trainingModal')?.style.display === 'block') closeTrainingModal();
        });
    }
}

// Apertura e chiusura dei tre modali di questa pagina.
//
// NON SONO PIU' SU `window` — task 4.9, 10/09/2026.
//
// Erano globali per due ragioni, entrambe cadute. La prima era il commento che
// stava qui, e diceva il falso: sostenevo che `shared-ui.js` le chiamasse per
// un nome costruito dall'id del modale. Il meccanismo esisteva ma non e' MAI
// stato eseguito — delle sei chiamate a `showSuccessFeedbackModal`, zero
// passavano un id — ed e' stato rimosso. Avevo misurato che quel richiamo
// POTEVA raggiungerle e avevo riferito che le raggiungeva, senza guardare i
// chiamanti.
//
// La seconda era «Funzioni Globali per l'HTML (Retrocompatibilità)»: nessuna
// pagina le nomina in un attributo `onclick`, verificato su tutti i 21 file.
//
// Le chiama solo il codice di questo file: `bindGlobalEvents` qui sopra, per i
// pulsanti e per il clic sulla sovrapposizione. Dichiarate con `function` e non
// con `const` perche' `bindGlobalEvents` le nomina prima di questa riga: le
// dichiarazioni di funzione si sollevano, quindi l'ordine non e' piu' un
// vincolo da ricordare.
function openInsertDataModal() { toggleModal('insertDataModal', true); }
function closeInsertDataModal() { toggleModal('insertDataModal', false); }

function openChatModal() { toggleModal('chatModal', true); }
function closeChatModal() { toggleModal('chatModal', false); }

function openTrainingModal() { toggleModal('trainingModal', true); }
function closeTrainingModal() { toggleModal('trainingModal', false); }

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

async function checkOrphanNotes() {
    const btnInsert = document.getElementById('btn-inserisci-dati');

    // Solo admin ha questo bottone visibile
    if (!btnInsert || btnInsert.style.display === 'none') return;

    try {
        const res = await apiFetch('/api/registrazioni/orfane/count');
        const data = await res.json();

        if (data.count > 0) {
            const badge = document.createElement('div');
            badge.className = 'notification-badge';
            badge.textContent = data.count > 99 ? '99+' : data.count;

            const oldBadge = btnInsert.querySelector('.notification-badge');
            if (oldBadge) oldBadge.remove();

            btnInsert.appendChild(badge);
        }
    } catch (error) {
        console.warn("Impossibile recuperare note orfane:", error);
    }

    // Tenta sync di eventuali note offline in coda
    try {
        const { syncQueue } = await import('./offline-queue.js');
        if (navigator.onLine) syncQueue().catch(() => {});
    } catch (e) {
        // offline-queue non disponibile, ignora
    }
}