// js/main.js

// Assumi che window.BACKEND_URL sia definito in config.js
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
        if (typeof fetchLatestEntries === 'function') {
            fetchLatestEntries();
        } else {
            console.error('La funzione fetchLatestEntries non è disponibile.');
        }
    }

    // --- Inizializzazione Event Listeners per l'apertura dei Modali ---

    // Event listener per aprire il modale "Nuova Commessa"
    // Questo pulsante ora attiva il metodo 'open' dell'istanza della classe NewOrderModal
    const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', function(event) {
            event.preventDefault();
            if (window.newOrderModalInstance && typeof window.newOrderModalInstance.open === 'function') {
                window.newOrderModalInstance.open(event);
            } else {
                console.error('L\'istanza newOrderModalInstance o la sua funzione open() non è definita. Assicurati che new-order-modal.js sia caricato e istanziato correttamente.');
                // Fallback (da rimuovere in produzione)
                document.getElementById('newOrderModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // Event listener per aprire il modale "Inserisci Dati"
    // Questo pulsante attiva il metodo 'open' dell'istanza della classe InsertDataModal
    const openInsertDataModalBtn = document.getElementById('openInsertDataModalBtn');
    if (openInsertDataModalBtn) {
        openInsertDataModalBtn.addEventListener('click', function(event) {
            event.preventDefault();
            if (window.insertModalInstance && typeof window.insertModalInstance.open === 'function') {
                window.insertModalInstance.open();
            } else {
                console.error('L\'istanza insertModalInstance o la sua funzione open() non è definita. Assicurati che insert-data-modal.js sia caricato e istanziato correttamente.');
                // Fallback (da rimuovere in produzione)
                document.getElementById('insertDataModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // Event listener per aprire il modale "Chat AI"
    // Questo pulsante attiva il metodo 'open' dell'istanza della classe ChatModal
    const openChatModalBtn = document.getElementById('openChatModalBtn');
    if (openChatModalBtn) {
        openChatModalBtn.addEventListener('click', function(event) {
            event.preventDefault();
            if (window.chatModalInstance && typeof window.chatModalInstance.open === 'function') {
                window.chatModalInstance.open();
            } else {
                console.error('L\'istanza chatModalInstance o la sua funzione open() non è definita. Assicurati che chat-modal.js sia caricato e istanziato correttamente.');
                // Fallback (da rimuovere in produzione)
                document.getElementById('chatModal').style.display = 'block';
                window.showOverlay();
            }
        });
    }

    // Event listener per aprire il modale "Knowledge Logs"
    // Questo pulsante ora attiva il metodo 'open' dell'istanza della classe KnowledgeLogsModal
    const updateAIDbBtn = document.getElementById('updateAIDbBtn'); // Questo pulsante potrebbe essere nel chat-modal o nella pagina principale
    if (updateAIDbBtn) {
        updateAIDbBtn.addEventListener('click', function() {
            if (window.knowledgeLogsModalInstance && typeof window.knowledgeLogsModalInstance.open === 'function') {
                window.knowledgeLogsModalInstance.open();
            } else {
                console.error('L\'istanza knowledgeLogsModalInstance o la sua funzione open() non è definita. Assicurati che knowledge-logs-modal.js sia caricato e istanziato correttamente.');
                // Fallback (da rimuovere in produzione)
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

// --- Funzioni Globali Necessarie ---

/**
 * Funzione per recuperare e visualizzare gli ultimi inserimenti dalla tabella principale.
 * Questa funzione è resa globale per essere accessibile da altre parti dell'applicazione (es. dopo un salvataggio).
 */
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
            return;
        }

        const response = await fetch(`${window.BACKEND_URL}/api/latest-entries`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error('Autenticazione fallita o non autorizzato per gli ultimi inserimenti. Reindirizzamento al login.');
                localStorage.removeItem('authToken');
                sessionStorage.removeItem('authToken');
                window.location.href = '/login.html';
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Dati ultimi inserimenti ricevuti e pronti per la visualizzazione:', data); // Log per debug

        latestEntriesList.innerHTML = ''; // Pulisce la lista esistente
        if (data && Array.isArray(data) && data.length > 0) {
            data.forEach(entry => {
                const li = document.createElement('li');
                
                // Formatta la data/ora se presente
                const dateTime = entry['data/ora'] ? new Date(entry['data/ora']).toLocaleString() : 'Data non disponibile';
                
                // Usa la trascrizione, con fallback al riferimento se la trascrizione è vuota
                const mainContent = entry.trascrizione || entry.riferimento || 'Nessun contenuto';
                
                // Aggiungi il riferimento solo se presente e diverso dalla trascrizione
                const reference = entry.riferimento && entry.riferimento !== mainContent
                                ? ` (Rif: ${entry.riferimento})`
                                : '';
                
                // Aggiungi un link all'URL se presente
                const urlLink = entry.url && entry.url !== ''
                                ? `<a href="${entry.url}" target="_blank" class="entry-url-link">🔗</a>`
                                : '';

                li.innerHTML = `<strong>${dateTime}:</strong> ${mainContent}${reference} ${urlLink}`;
                latestEntriesList.appendChild(li);
            });
            console.log('Ultimi inserimenti visualizzati con successo.');
        } else {
            latestEntriesList.innerHTML = '<li>Nessun dato recente disponibile.</li>';
            console.log('Nessun dato da visualizzare.');
        }
    } catch (error) {
        console.error('Errore nel recupero o visualizzazione degli ultimi inserimenti:', error);
        latestEntriesList.innerHTML = '<li>Errore nel caricamento dei dati.</li>';
    }
}

// Rendi fetchLatestEntries globale, dato che è usata anche da insert-data-modal.js
window.fetchLatestEntries = fetchLatestEntries;

console.log('Main script loaded.');