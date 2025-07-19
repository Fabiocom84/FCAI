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

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/latest-entries`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}: ${errorData.message}`);
        }

        const data = await response.json();
        console.log("Dati ricevuti per latest_entries:", data); // PRIMO CHECK: l'oggetto data è qui?
        const latestEntries = data.latest_entries;
        console.log("Array latest_entries estratto:", latestEntries); // SECONDO CHECK: l'array è estratto correttamente?

        const latestEntriesList = document.getElementById('latestEntriesList');
        if (latestEntriesList) {
            latestEntriesList.innerHTML = ''; // Pulisce la lista esistente
            
            if (latestEntries && latestEntries.length > 0) {
                latestEntries.forEach(entry => {
                    console.log("Aggiungendo voce:", entry); // TERZO CHECK: ogni singola voce viene processata?
                    const li = document.createElement('li');
                    li.textContent = entry; // Assegna la stringa al contenuto del <li>
                    latestEntriesList.appendChild(li);
                });
            } else {
                latestEntriesList.innerHTML = '<li>Nessun dato da visualizzare nella lista degli ultimi inserimenti.</li>';
                console.log("Nessun dato da visualizzare nella lista degli ultimi inserimenti.");
            }
        } else {
            console.error("Elemento 'latestEntriesList' non trovato nel DOM.");
        }

    } catch (error) {
        console.error('Errore nel recupero degli ultimi inserimenti:', error);
        const latestEntriesList = document.getElementById('latestEntriesList');
        if (latestEntriesList) {
            latestEntriesList.innerHTML = '<li>Errore nel caricamento dei dati.</li>';
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
