// js/main.js

// Assumi che window.BACKEND_URL sia definito in config.js
// Per consistenza con i modali, useremo window.BACKEND_URL.

// Contatore per tenere traccia di quanti modali sono aperti e mostrare/nascondere l'overlay di conseguenza
let openModalCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Main script: DOM completamente caricato.');
    console.log('Controllo autenticazione in main.js...');

    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (!authToken) {
        console.log('Nessun token di autenticazione trovato. Reindirizzamento a login.html');
        window.location.href = '/login.html'; // Percorso esplicito a login.html
    } else {
        console.log('Token di autenticazione trovato. Caricamento dati iniziali.');
        // Chiamata per caricare gli ultimi inserimenti una volta autenticato
        // La funzione fetchLatestEntries è resa globale più in basso nel file
        if (typeof window.fetchLatestEntries === 'function') {
            window.fetchLatestEntries();
        } else {
            console.error('La funzione window.fetchLatestEntries non è disponibile al caricamento del DOM. Potrebbe esserci un problema di ordine di caricamento degli script.');
        }
    }

    // Event listener per aprire il modale "Knowledge Logs"
    const updateAIDbBtn = document.getElementById('updateAIDbBtn');    
    if (updateAIDbBtn) {
        updateAIDbBtn.addEventListener('click', function() {
            if (window.knowledgeLogsModalInstance && typeof window.knowledgeLogsModalInstance.open === 'function') {
                window.knowledgeLogsModalInstance.open();
                // Abilita il pulsante di aggiornamento nel chat-modal quando il log è aperto
                updateAIDbBtn.disabled = true;
                updateAIDbBtn.querySelector('img').src = 'img/loading.gif'; // Immagine di caricamento
                updateAIDbBtn.title = 'Aggiornamento in corso...';
                // Avvia il processo di aggiornamento nel backend
                initiateKnowledgeBaseUpdate();
            } else {
                console.error('L\'istanza knowledgeLogsModalInstance o la sua funzione open() non è definita. Assicurati che knowledge-logs-modal.js sia caricato e istanziato correttamente.');
                // Fallback minimo in caso di errore grave (da rimuovere in produzione)
                const fallbackModal = document.getElementById('knowledgeLogsModal');
                if (fallbackModal) {
                    fallbackModal.style.display = 'block';
                    window.showOverlay();
                } else {
                    alert('Errore grave: Impossibile aprire il modale dei log.');
                }
            }
        });
    } else {
        console.warn('Pulsante #updateAIDbBtn non trovato. Assicurati che l\'HTML sia corretto.');
    }

    // --- Logout Button Listener ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            console.log('Token di autenticazione rimossi. Reindirizzamento al login.');
            window.location.href = '/login.html';
        });
    } else {
        console.warn('Pulsante #logoutBtn non trovato. Assicurati che l\'HTML sia corretto.');
    }
});

// --- Funzioni Globali per Overlay ---
// Queste funzioni sono centralizzate qui in main.js per gestire l'overlay in modo consistente
// attraverso tutti i modali (chat, insert data, knowledge logs, new order, etc.).

window.showOverlay = () => {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        openModalCount++;
        overlay.style.display = 'block';
        console.log(`Overlay mostrato. Modali aperti: ${openModalCount}`);
    } else {
        console.warn('Elemento #modalOverlay non trovato.');
    }
};

window.hideOverlay = () => {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        openModalCount--;
        if (openModalCount <= 0) { // Nascondi l'overlay solo se nessun altro modale è aperto
            overlay.style.display = 'none';
            openModalCount = 0; // Assicurati che non vada sotto zero
        }
        console.log(`Overlay nascosto. Modali aperti: ${openModalCount}`);
    } else {
        console.warn('Elemento #modalOverlay non trovato.');
    }
};

// --- Funzioni Globali per Interazioni API ---

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

    if (!window.BACKEND_URL) {
        console.error("URL del backend non definito. Impossibile recuperare gli ultimi inserimenti.");
        latestEntriesList.innerHTML = '<li>Errore: URL del backend non configurato.</li>';
        return;
    }

    try {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!token) {
            console.warn('Token di autenticazione non trovato per il recupero degli ultimi inserimenti. Reindirizzamento...');
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            window.location.href = '/login.html';
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
            const errorData = await response.json().catch(() => ({ message: 'Errore sconosciuto.' }));
            throw new Error(`HTTP error! Status: ${response.status}. Message: ${errorData.message || 'Nessun messaggio di errore dal server.'}`);
        }

        const data = await response.json();
        console.log('Dati ultimi inserimenti ricevuti:', data);

        latestEntriesList.innerHTML = ''; // Pulisce la lista esistente
        if (data && Array.isArray(data) && data.length > 0) {
            data.forEach(entry => {
                const li = document.createElement('li');
                
                // Formatta la data/ora se presente
                const dateTime = entry['data/ora'] ? new Date(entry['data/ora']).toLocaleString('it-IT') : 'Data non disponibile';
                
                // Usa la trascrizione, con fallback al riferimento o a un messaggio predefinito
                const mainContent = entry.trascrizione || entry.riferimento || 'Nessun contenuto testuale';
                
                // Aggiungi il riferimento solo se presente e diverso dalla trascrizione
                const reference = entry.riferimento && entry.riferimento !== mainContent
                                    ? ` (Rif: ${entry.riferimento})`
                                    : '';
                
                // Aggiungi un link all'URL se presente e valido
                const urlLink = entry.url && entry.url.startsWith('http')
                                    ? `<a href="${entry.url}" target="_blank" class="entry-url-link" title="Apri file/link associato">🔗</a>`
                                    : '';

                li.innerHTML = `<strong>${dateTime}:</strong> ${mainContent}${reference} ${urlLink}`;
                latestEntriesList.appendChild(li);
            });
            console.log('Ultimi inserimenti visualizzati con successo.');
        } else {
            latestEntriesList.innerHTML = '<li>Nessun dato recente disponibile.</li>';
            console.log('Nessun dato da visualizzare nella lista degli ultimi inserimenti.');
        }
    } catch (error) {
        console.error('Errore nel recupero o visualizzazione degli ultimi inserimenti:', error);
        latestEntriesList.innerHTML = `<li>Errore nel caricamento dei dati: ${error.message}.</li>`;
        alert(`Impossibile caricare gli ultimi inserimenti: ${error.message}.`);
    }
}

/**
 * Funzione per avviare il processo di aggiornamento della Knowledge Base AI.
 * Chiamata quando viene cliccato il pulsante 'Aggiorna Knowledge Base AI'.
 */
async function initiateKnowledgeBaseUpdate() {
    if (!window.BACKEND_URL) {
        console.error("URL del backend non definito. Impossibile avviare l'aggiornamento della Knowledge Base.");
        alert("Errore: URL del backend non configurato per l'aggiornamento della Knowledge Base.");
        return;
    }

    try {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!token) {
            alert('Autenticazione richiesta per aggiornare la Knowledge Base. Effettua il login.');
            console.warn('Tentativo di aggiornamento KB senza token.');
            return;
        }

        console.log('Invio richiesta di aggiornamento Knowledge Base...');
        const response = await fetch(`${window.BACKEND_URL}/api/update-knowledge-base`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            // Se non ci sono dati da inviare nel body, si può omettere o inviare un oggetto vuoto
            body: JSON.stringify({}) 
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Errore HTTP! Status: ${response.status}`);
        }

        console.log('Aggiornamento Knowledge Base avviato:', data);
        if (data.process_id) {
            // Se esiste l'istanza del modale dei log, connetti il WebSocket
            if (window.knowledgeLogsModalInstance && typeof window.knowledgeLogsModalInstance.connectWebSocketForLogs === 'function') {
                window.knowledgeLogsModalInstance.connectWebSocketForLogs(data.process_id);
            } else {
                console.error('Impossibile connettere il WebSocket per i log. knowledgeLogsModalInstance o la sua funzione connectWebSocketForLogs non definita.');
                alert('Aggiornamento avviato, ma i log non possono essere visualizzati. Controlla la console.');
            }
        } else {
            alert('Aggiornamento avviato, ma nessun ID di processo ricevuto per i log.');
        }
    } catch (error) {
        console.error("Errore nell'avvio dell'aggiornamento della Knowledge Base:", error);
        alert(`Errore nell'avvio dell'aggiornamento della Knowledge Base: ${error.message}`);
        // Riabilita il pulsante in caso di errore nell'avvio
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    }
}

// Rendi fetchLatestEntries e initiateKnowledgeBaseUpdate globali
window.fetchLatestEntries = fetchLatestEntries;
window.initiateKnowledgeBaseUpdate = initiateKnowledgeBaseUpdate;
