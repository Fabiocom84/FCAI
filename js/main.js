// js/main.js - Logica Esclusiva per index.html

import { supabase } from './supabase-client.js';
import { apiFetch } from './api-client.js'; // Importiamo la funzione condivisa

// Variabili di stato
let appInitialized = false;
window.currentUser = null;

window.authReady.then(user => {
    // La guardia ha già verificato l'utente, possiamo partire subito.
    if (!window.appInitialized) {
        window.appInitialized = true;
        initializeApp(user);
    }
});

// Inizializzazione dell'app: recupera il profilo e avvia l'UI
async function initializeApp(user) {
    console.log("Fase 1: Inizializzazione per l'utente:", user.email);
    try {
        // WORKAROUND per il bug di Supabase: usiamo fetch manuale
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessione non trovata per il recupero del profilo.");

        const response = await fetch(
            `${supabase.supabaseUrl}/rest/v1/personale?select=*&id_auth_user=eq.${user.id}`, 
            { headers: { 'apikey': supabase.supabaseKey, 'Authorization': `Bearer ${session.access_token}` } }
        );
        const profiles = await response.json();
        if (!response.ok || !profiles || profiles.length === 0) throw new Error("Profilo non trovato.");
        
        const profile = profiles[0];
        window.currentUser = { ...user, profile };
        console.log("Fase 2: Profilo utente caricato con successo.");
        setupUI();

    } catch (error) {
        console.error("ERRORE CRITICO in initializeApp:", error.message);
        alert("Errore nel caricamento del profilo. Verrai disconnesso.");
        await supabase.auth.signOut();
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