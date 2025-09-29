// js/main.js

import { API_BASE_URL } from './config.js';
import { supabase } from './supabase-client.js';
import Legend from './legend.js';

function getAuthToken() {
    const sessionString = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!sessionString) {
        return null;
    }
    try {
        const session = JSON.parse(sessionString);
        return session.access_token; 
    } catch (e) {
        console.error("Errore nel parsing del token di sessione:", e);
        return null;
    }
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

let appInitialized = false;

supabase.auth.onAuthStateChange((event, session) => {
    // Aggiungiamo un log per vedere SEMPRE cosa succede
    console.log(`[AUTH STATE CHANGE] Evento ricevuto: ${event}, Sessione:`, session);

    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !appInitialized) {
        console.log("CONDIZIONE SODDISFATTA: Supabase ha confermato una sessione valida. Avvio l'applicazione...");
        appInitialized = true;
        initializeApp(session.user);
    } else if (event === 'SIGNED_OUT') {
        console.log("EVENTO SIGNED_OUT: L'utente si è disconnesso, reindirizzamento al login.");
        appInitialized = false;
        window.location.href = 'login.html';
    } else {
        // QUESTO BLOCCO CI DIRA' PERCHE' L'APP NON PARTE
        console.error("CONDIZIONE NON SODDISFATTA: L'app non verrà inizializzata.", {
            evento: event,
            sessione_esiste: !!session, // sarà true o false
            app_gia_inizializzata: appInitialized
        });
    }
});

// Funzione di inizializzazione principale
async function initializeApp(user) { // Aggiungiamo 'async' perché ora faremo una chiamata di rete
    console.log("Applicazione inizializzata per l'utente:", user.email);

    // --- NUOVO BLOCCO: RECUPERO E SALVATAGGIO DEL PROFILO ---
    try {
        const { data: profileData, error: profileError } = await supabase
            .from('personale')
            .select('*')
            .eq('id_auth_user', user.id)
            .single();

        if (profileError) {
            // Se non troviamo il profilo, l'app funziona lo stesso ma avvisiamo in console.
            console.warn("Profilo utente non trovato nella tabella 'personale'.", profileError);
        } else {
            // Se lo troviamo, lo salviamo per un accesso rapido da altre parti dell'app.
            localStorage.setItem('currentUserProfile', JSON.stringify(profileData));
            console.log("Profilo utente caricato e salvato:", profileData);
        }
    } catch (e) {
        console.error("Errore imprevisto durante il recupero del profilo:", e);
    }
    // --- FINE NUOVO BLOCCO ---

    // 1. Inizializza le variabili principali (codice invariato)
    legendInstance = new Legend();
    modalOverlay = document.getElementById('modalOverlay'); 
    insertDataModalInstance = document.getElementById('insertDataModal');
    chatModalInstance = document.getElementById('chatModal');
    trainingModalInstance = document.getElementById('trainingModal');

    // 2. Collega gli eventi ai pulsanti (codice invariato)
    document.getElementById('logoutBtn')?.addEventListener('click', async (event) => {
        event.preventDefault();
        localStorage.removeItem('currentUserProfile'); // Rimuoviamo il profilo al logout
        await supabase.auth.signOut();
        // onAuthStateChange gestirà il reindirizzamento
    });

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

    // --- MODIFICA CHIAVE ---
    // 3. Rendi le funzioni globali SOLO DOPO che tutto è stato inizializzato
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
}

// Funzioni di gestione dei modali (la loro definizione non cambia)
function openInsertDataModal() {
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        if (window.prepareInsertDataModal) window.prepareInsertDataModal();
    }
}

function openChatModal() {
    if (chatModalInstance) {
        chatModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openTrainingModal() {
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function closeInsertDataModal() {
    if (insertDataModalInstance) insertDataModalInstance.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
    if (window.cleanupInsertDataModal) window.cleanupInsertDataModal();
}

function closeChatModal() {
    if (chatModalInstance) chatModalInstance.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
}

function closeTrainingModal() {
    if (trainingModalInstance) trainingModalInstance.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
}

// Funzioni per il modale di feedback (la loro definizione non cambia)
let feedbackModal, countdownInterval, closeTimeout, parentModalToClose;

function showSuccessFeedbackModal(title, message, parentModalId) {
    if (!feedbackModal) {
        feedbackModal = document.getElementById('success-feedback-modal');
    }

    feedbackModal.querySelector('#feedback-modal-title').textContent = title;
    feedbackModal.querySelector('#feedback-modal-message').textContent = message;
    parentModalToClose = document.getElementById(parentModalId);

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