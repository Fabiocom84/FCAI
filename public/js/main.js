// js/main.js

// Assumi che window.BACKEND_URL sia definito in config.js
// Per consistenza con i modali, useremo window.BACKEND_URL.

document.addEventListener('DOMContentLoaded', () => {
    console.log('Main script: DOM completamente caricato.');
    console.log('Controllo autenticazione in main.js...');

    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (!authToken) {
        console.log('Nessun token di autenticazione trovato. Reindirizzamento a login.html');
        window.location.href = '/login.html';
    } else {
        console.log('Token di autenticazione trovato. Caricamento dati iniziali e visualizzazione pagina.');
        
        // Mostra il contenuto principale della pagina
        const mainContent = document.querySelector('.main-content-wrapper');
        if (mainContent) {
            mainContent.style.display = 'flex'; // O 'block', a seconda di come vuoi che si comporti
            mainContent.style.visibility = 'visible';
            mainContent.style.opacity = '1';
            mainContent.classList.remove('hidden', 'd-none'); // Rimuovi classi che potrebbero nasconderlo
            console.log('main-content-wrapper reso visibile.');
        } else {
            console.error('Elemento .main-content-wrapper non trovato.');
        }

        // Chiamata per caricare gli ultimi inserimenti una volta autenticato
        fetchLatestEntries(); // Chiama la funzione qui
    }

    // Gestione del logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            window.location.href = '/login.html';
        });
    }

    // Inizializza il pulsante per l'aggiornamento della Knowledge Base
    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    if (updateAIDbBtn) {
        updateAIDbBtn.addEventListener('click', initiateKnowledgeBaseUpdate);
    }
});

// Funzione per recuperare e visualizzare gli ultimi inserimenti
async function fetchLatestEntries() {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.warn('Authentication token not found. Cannot fetch latest entries.');
        return;
    }

    const latestEntriesList = document.getElementById('latestEntriesList');
    // Pulisci la lista esistente prima di caricare nuovi dati o mostrare il messaggio
    if (latestEntriesList) {
        latestEntriesList.innerHTML = ''; 
    } else {
        console.error("Elemento 'latestEntriesList' non trovato nel DOM.");
        return;
    }

    try {
        // Ho corretto l'endpoint da /api/latest-entries a /api/latest_entries
        // per essere consistente con la definizione in app.py
        const response = await fetch(`${window.BACKEND_URL}/api/latest_entries`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}: ${errorData.message}`);
        }

        const data = await response.json();
        console.log("Dati ricevuti per latest_entries:", data); 
        
        // Correzione: il backend restituisce 'entries', non 'latest_entries'
        const entries = data.entries; 
        console.log("Array 'entries' estratto:", entries); 

        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                console.log("Aggiungendo voce:", entry); 
                const listItem = document.createElement('li');
                listItem.classList.add('entry-item');

                const dateTimeSpan = document.createElement('span');
                dateTimeSpan.classList.add('entry-date-time');
                dateTimeSpan.textContent = entry.dateTime; // Usa la chiave 'dateTime'

                const textSpan = document.createElement('span');
                textSpan.classList.add('entry-text');
                textSpan.textContent = entry.text; // Usa la chiave 'text'

                const riferimentoSpan = document.createElement('span');
                riferimentoSpan.classList.add('entry-riferimento');
                riferimentoSpan.textContent = entry.riferimento; // Usa la chiave 'riferimento'

                listItem.appendChild(dateTimeSpan);
                listItem.appendChild(textSpan);
                listItem.appendChild(riferimentoSpan);
                latestEntriesList.appendChild(listItem);
            });
        } else {
            // Implementazione esatta del messaggio "nessun inserimento" come richiesto
            const noEntriesMessage = document.createElement('p');
            noEntriesMessage.classList.add('no-entries-message');
            noEntriesMessage.textContent = 'Nessun inserimento recente disponibile.';
            latestEntriesList.appendChild(noEntriesMessage); // Aggiunto direttamente alla UL
            console.log("Nessun inserimento recente disponibile.");
        }

    } catch (error) {
        console.error('Errore nel recupero degli ultimi inserimenti:', error);
        if (latestEntriesList) {
            // Mostra un messaggio di errore in caso di fallimento della fetch
            latestEntriesList.innerHTML = ''; // Assicurati che sia vuota
            const errorMessage = document.createElement('p');
            errorMessage.classList.add('error-message'); // Aggiungi una classe per stilizzare l'errore
            errorMessage.textContent = 'Errore nel caricamento dei dati: impossibile recuperare gli inserimenti.';
            latestEntriesList.appendChild(errorMessage);
        }
    }
}

// Funzione per avviare l'aggiornamento della Knowledge Base AI
async function initiateKnowledgeBaseUpdate() {
    console.log("Avvio aggiornamento Knowledge Base AI...");
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        alert('Autenticazione richiesta per aggiornare la Knowledge Base. Effettua il login.');
        window.location.href = 'login.html';
        return;
    }

    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    if (updateAIDbBtn) {
        updateAIDbBtn.disabled = true; // Disabilita il pulsante
        // Cambia l'icona o il testo per indicare il caricamento
        updateAIDbBtn.querySelector('img').src = 'img/loading.gif'; // Assicurati di avere una GIF di caricamento
        updateAIDbBtn.title = 'Aggiornamento in corso...';
    }

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/update-knowledge-base`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({}) // Il corpo può essere vuoto o contenere parametri futuri
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        alert('Aggiornamento Knowledge Base avviato con successo! Controlla i log per lo stato.');
        
        // Collega il WebSocket per ricevere i log dell'aggiornamento
        if (window.knowledgeLogsModalInstance && typeof window.knowledgeLogsModalInstance.connectWebSocketForLogs === 'function') {
            window.knowledgeLogsModalInstance.connectWebSocketForLogs(data.process_id);
        } else {
            console.error('Impossibile connettere il WebSocket per i log. knowledgeLogsModalInstance o la sua funzione connectWebSocketForLogs non definita.');
            alert('Aggiornamento avviato, ma i log non possono essere visualizzati. Controlla la console.');
        }
    } catch (error) {
        console.error("Errore nell'avvio dell'aggiornamento della Knowledge Base:", error);
        alert(`Errore nell'avvio dell'aggiornamento della Knowledge Base: ${error.message}`);
        // Riabilita il pulsante in caso di errore nell'avvio
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            // Assicurati che 'img/reload.png' esista o usa un'alternativa CSS
            updateAIDbBtn.querySelector('img').src = 'img/reload.png'; 
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    }
}

// Rendi fetchLatestEntries e initiateKnowledgeBaseUpdate globali
window.fetchLatestEntries = fetchLatestEntries;
window.initiateKnowledgeBaseUpdate = initiateKnowledgeBaseUpdate;