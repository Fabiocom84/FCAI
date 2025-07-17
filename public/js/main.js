// js/main.js

// Assumi che window.BACKEND_URL sia definito in config.js
// Se config.js non lo rende globale, potresti doverlo importare o definire qui se è solo per questo file.
// Per consistenza con i modali, useremo window.BACKEND_URL.

document.addEventListener('DOMContentLoaded', () => {
    console.log('Controllo autenticazione in main.js...');

    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (!authToken) {
        console.log('Nessun token trovato, reindirizzamento a login.html');
        window.location.href = '/login.html'; // Percorso esplicito a login.html
    } else {
        console.log('Token trovato. Caricamento dati iniziali.');
        // Chiamata per caricare gli ultimi inserimenti una volta autenticato
        // Assicurati che fetchLatestEntries sia definito globalmente (es. in script.js)
        if (typeof fetchLatestEntries === 'function') {
            fetchLatestEntries();
        } else {
            console.error('La funzione fetchLatestEntries non è disponibile.');
        }
    }

    // --- Inizializzazione Event Listeners per l'apertura dei Modali ---

    // Event listener per aprire il modale "Nuova Commessa"
    const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', function(event) {
            event.preventDefault();
            // Chiama la funzione globale definita in new-order-modal.js
            if (typeof openNewOrderModal === 'function') {
                openNewOrderModal();
            } else {
                console.error('La funzione openNewOrderModal non è definita.');
                // Fallback (solo per debug, dovrebbe essere rimosso in produzione se la modularizzazione è completa)
                document.getElementById('newOrderModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // Event listener per aprire il modale "Inserisci Dati"
    const openInsertDataModalBtn = document.getElementById('openInsertDataModalBtn');
    if (openInsertDataModalBtn) {
        openInsertDataModalBtn.addEventListener('click', function(event) {
            event.preventDefault();
            // Chiama la funzione globale definita in insert-data-modal.js (se esposta)
            // Se usi una classe, dovresti chiamare window.insertModalInstance.open()
            if (window.insertModalInstance && typeof window.insertModalInstance.open === 'function') {
                window.insertModalInstance.open();
            } else {
                console.error('L\'istanza insertModalInstance o la sua funzione open() non è definita.');
                 // Fallback
                document.getElementById('insertDataModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // Event listener per aprire il modale "Chat AI"
    const openChatModalBtn = document.getElementById('openChatModalBtn');
    if (openChatModalBtn) {
        openChatModalBtn.addEventListener('click', function(event) {
            event.preventDefault();
            // Chiama la funzione globale definita in chat-modal.js
            if (typeof openChatModal === 'function') {
                openChatModal();
            } else {
                console.error('La funzione openChatModal non è definita.');
                // Fallback
                document.getElementById('chatModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // Event listener per aprire il modale "Knowledge Logs"
    // Questo pulsante si trova solitamente nel chat-modal, ma se è anche qui, lo gestiamo.
    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    if (updateAIDbBtn) {
        updateAIDbBtn.addEventListener('click', function() {
            // Chiama la funzione globale definita in knowledge-logs-modal.js
            if (typeof openKnowledgeLogsModal === 'function') {
                openKnowledgeLogsModal();
            } else {
                console.error('La funzione openKnowledgeLogsModal non è definita.');
                // Fallback
                document.getElementById('knowledgeLogsModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // --- Logout Button Listener ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            window.location.href = '/login.html';
        });
    }

});

// --- Funzioni Globali (se definite altrove, rimuovere da qui) ---
// Rimuovi tutte queste funzioni closeXModal() se sono già definite nei rispettivi file dei modali
// e sono rese globali tramite window.closeXModal = closeXModal;
// Dovrebbero essere gestite dai singoli file dei modali.

/*
// Esempio:
// function closeNewOrderModal() {
//     document.getElementById('newOrderModal').style.display = 'none';
//     window.hideOverlay();
// }
// window.closeNewOrderModal = closeNewOrderModal;

// ... e così via per closeInsertModal, closeChatModal, closeKnowledgeLogsModal
*/

// La funzione fetchLatestEntries dovrebbe essere definita in script.js e resa globale lì.
// La mantengo qui solo come promemoria, ma idealmente la sua definizione non dovrebbe essere in main.js.
async function fetchLatestEntries() {
    const latestEntriesList = document.getElementById('latestEntriesList');
    if (!latestEntriesList) {
        console.warn('Elemento #latestEntriesList non trovato.');
        return;
    }

    try {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!token) {
            console.warn('Token di autenticazione non trovato per il recupero degli ultimi inserimenti.');
            // Già reindirizzato all'inizio di main.js, ma una doppia verifica non fa male.
            return;
        }

        // Usa window.BACKEND_URL per coerenza con gli altri file dei modali
        const response = await fetch(`${window.BACKEND_URL}/api/latest-entries`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error('Autenticazione fallita o non autorizzato per gli ultimi inserimenti. Reindirizzamento al login.');
                localStorage.removeItem('authToken'); // Pulisci token non validi
                sessionStorage.removeItem('authToken');
                window.location.href = '/login.html';
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        latestEntriesList.innerHTML = ''; // Pulisce la lista esistente
        if (data && Array.isArray(data)) {
            data.forEach(entry => {
                const li = document.createElement('li');
                // Assumi che 'entry' sia un oggetto e tu voglia visualizzare una proprietà, es. entry.name o entry.commessa
                // Se 'entry' è già una stringa, allora li.textContent = entry; va bene.
                // Altrimenti, adatta a come i dati JSON sono strutturati.
                li.textContent = entry.commessa ? `Commessa: ${entry.commessa} - Cliente: ${entry.cliente}` : entry; 
                latestEntriesList.appendChild(li);
            });
            console.log('Dati ultimi inserimenti ricevuti:', data);
        } else {
            latestEntriesList.innerHTML = '<li>Nessun dato recente disponibile.</li>';
        }
    } catch (error) {
        console.error('Errore nel recupero degli ultimi inserimenti:', error);
        latestEntriesList.innerHTML = '<li>Errore nel caricamento dei dati.</li>';
    }
}


console.log('Main script loaded.');