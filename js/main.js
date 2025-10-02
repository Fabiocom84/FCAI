// js/main.js

import { API_BASE_URL } from './config.js';

import { supabase } from './supabase-client.js';

// Variabile di stato per assicurarsi che l'app venga inizializzata una sola volta.
let appInitialized = false;

// Oggetto globale che conterrà i dati dell'utente e il suo profilo una volta loggato.
// Sarà accessibile da altri script come `window.currentUser`.
window.currentUser = null;

// --- NUOVA FUNZIONE APIFETCH SICURA ---
/**
 * Esegue una chiamata fetch sicura verso il backend, includendo automaticamente
 * il token di autenticazione di Supabase.
 * @param {string} url - L'endpoint dell'API da chiamare (es. '/api/registrazioni').
 * @param {object} options - Le opzioni standard della funzione fetch (method, body, etc.).
 * @returns {Promise<Response>} La risposta dalla fetch.
 */
async function apiFetch(url, options = {}) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.error("Sessione non valida o scaduta. Rilevato da apiFetch.");
        await supabase.auth.signOut();
        throw new Error("La tua sessione non è valida. Effettua nuovamente il login.");
    }

    const headers = { ...options.headers };
    headers['Authorization'] = `Bearer ${session.access_token}`;

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // --- MODIFICA CHIAVE QUI ---
    // Combiniamo l'URL base dal config con l'endpoint specifico della chiamata
    const fullUrl = `${API_BASE_URL}${url}`;
    
    // Usiamo fullUrl per la chiamata fetch
    const response = await fetch(fullUrl, { ...options, headers });
    // -------------------------

    if (response.status === 401) {
        await supabase.auth.signOut();
    }

    return response;
}
window.apiFetch = apiFetch;


// Il listener `onAuthStateChange` è l'UNICO punto di ingresso dell'applicazione.
// Gestisce login, logout e il caricamento della sessione iniziale.
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`[AUTH STATE CHANGE] Evento: ${event}`, session);

    // CASO 1: L'utente è loggato (nuovo login o sessione esistente) e l'app non è ancora partita.
    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !appInitialized) {
        appInitialized = true; // Blocchiamo future inizializzazioni
        await initializeApp(session.user); // Avviamo l'inizializzazione sicura
    } 
    // CASO 2: L'utente si è disconnesso.
    else if (event === 'SIGNED_OUT') {
        appInitialized = false;
        window.currentUser = null;
        localStorage.removeItem('currentUserProfile'); // Pulizia extra per sicurezza
        // Il reindirizzamento avviene qui, in un unico posto affidabile.
        window.location.href = 'login.html';
    }
    // CASO 3 (DEBUG): L'app non parte, logghiamo il perché.
    else if (!session && (event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
        console.log("Nessuna sessione valida trovata. L'utente deve effettuare il login.");
        window.location.href = 'login.html';
    }
});


/**
 * Funzione di inizializzazione principale e sicura.
 * Viene eseguita SOLO DOPO che onAuthStateChange ha confermato una sessione valida.
 * Il suo scopo è caricare i dati essenziali dell'utente (profilo e ruolo).
 * @param {object} user - L'oggetto utente fornito da Supabase.
 */
async function initializeApp(user) {
    console.log("Fase 1: Inizializzazione per l'utente:", user.email);

    try {
        // Chiamata CRITICA: recuperiamo il profilo dell'utente dalla tabella 'personale'.
        // Questa è la chiamata che ora dovrebbe funzionare grazie alla policy RLS.
        const { data: profile, error } = await supabase
            .from('personale')
            .select('*') // Seleziona tutte le colonne del profilo
            .eq('id_auth_user', user.id) // La chiave di join è l'ID utente di Supabase
            .single(); // Ci aspettiamo un solo risultato

        // Se c'è un errore (es. la policy blocca) o il profilo non esiste, fermati.
        if (error || !profile) {
            console.error("ERRORE durante la chiamata a Supabase:", error);
            throw new Error("Profilo utente non trovato o illeggibile. Controlla le policy RLS sulla tabella 'personale'.");
        }

        // SUCCESSO: Salviamo l'utente e il suo profilo.
        window.currentUser = { ...user, profile };
        console.log("Fase 2: Profilo utente caricato con successo:", window.currentUser);

        // Ora che abbiamo il profilo, possiamo avviare l'interfaccia utente.
        setupUI();

    } catch (error) {
        console.error("ERRORE CRITICO in initializeApp:", error.message);
        alert("Si è verificato un errore critico nel caricamento del tuo profilo. Verrai disconnesso per sicurezza.");
        // Forziamo il logout per evitare che l'utente usi l'app in uno stato inconsistente.
        await supabase.auth.signOut();
    }
}


/**
 * Imposta tutti gli elementi dell'interfaccia utente.
 * Viene eseguita SOLO DOPO che initializeApp ha caricato con successo il profilo utente.
 * Questo garantisce che qualsiasi logica sui permessi funzionerà correttamente.
 */
function setupUI() {
    console.log("Fase 3: Avvio del setup dell'interfaccia utente.");

    // Esempio di gestione permessi: nascondiamo un pulsante se l'utente non è admin.
    // Assumiamo che nel tuo profilo ci sia una colonna booleana 'is_admin' o una colonna 'ruolo'.
    const isAdmin = window.currentUser?.profile?.is_admin === true; // Adatta 'is_admin' al nome della tua colonna
    const trainingButton = document.getElementById('openTrainingModalBtn');
    
    if (trainingButton && !isAdmin) {
        console.log("Permessi: l'utente non è admin, nascondo il pulsante 'Addestramento'.");
        trainingButton.style.display = 'none';
    }
    
    // -----------------------------------------------------------------------------
    // Inizializzazione di tutti i componenti e gli event listener dell'interfaccia.
    // Questo codice è in gran parte quello che avevi prima.
    // -----------------------------------------------------------------------------
    
    const legendInstance = new Legend();
    const modalOverlay = document.getElementById('modalOverlay'); 
    const insertDataModalInstance = document.getElementById('insertDataModal');
    const chatModalInstance = document.getElementById('chatModal');
    const trainingModalInstance = document.getElementById('trainingModal');

    // Logout Button
    document.getElementById('logoutBtn')?.addEventListener('click', async (event) => {
        event.preventDefault();
        // Svuotiamo l'oggetto utente prima di chiamare il logout.
        window.currentUser = null; 
        await supabase.auth.signOut();
        // Il reindirizzamento verrà gestito dal listener onAuthStateChange.
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