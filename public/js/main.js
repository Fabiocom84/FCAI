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

// Funzione per recuperare gli ultimi inserimenti dal backend
async function fetchLatestEntries() {
    try {
        // Sostituisci con il tuo endpoint reale sul backend di Google Cloud Run
        // Assicurati che il tuo backend restituisca un array di oggetti JSON
        // Esempio: [{ type: 'file', fileName: 'documento.pdf', timestamp: '2025-07-19 10:30', /* altri campi */ }, ...]
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        const response = await fetch(`${window.BACKEND_URL}/api/latest-entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            // Gestione di risposte HTTP non riuscite
            const errorText = await response.text(); // Legge il corpo della risposta per dettagli sull'errore
            throw new Error(`HTTP error! Status: ${response.status}. Details: ${errorText}`);
        }
        const data = await response.json();
        // Assumiamo che la risposta contenga un campo 'latest_entries' che è un array di stringhe
        return data.latest_entries || [];
    } catch (error) {
        console.error("Errore durante il recupero degli ultimi inserimenti:", error);
        // Puoi mostrare un messaggio all'utente qui se vuoi
        const latestEntriesList = document.getElementById('latestEntriesList');
        latestEntriesList.innerHTML = '<li class="no-entries error">Errore nel caricamento degli inserimenti recenti. Riprova più tardi.</li>';
        return []; // Restituisce un array vuoto in caso di errore
    }
}

function displayLatestEntries(entries) {
    const latestEntriesList = document.getElementById('latestEntriesList');
    latestEntriesList.innerHTML = ''; // Pulisce la lista esistente prima di aggiungere i nuovi elementi

    if (entries.length === 0) {
        latestEntriesList.innerHTML = '<li class="no-entries">Nessun inserimento recente trovato.</li>';
        return;
    }

    // Itera sulle stringhe e aggiungile direttamente alla lista
    entries.forEach(entryString => {
        const listItem = document.createElement('li');
        listItem.classList.add('latest-entry-item'); // Aggiungi una classe per styling via CSS
        
        // **MODIFICA QUESTA RIGA:** Usa innerHTML per interpretare i tag HTML
        listItem.innerHTML = entryString; // <--- CAMBIA QUI!
        latestEntriesList.appendChild(listItem);
    });
}


// Aggiungi queste chiamate all'interno del tuo evento DOMContentLoaded esistente in main.js
// o creane uno se non esiste già.
document.addEventListener('DOMContentLoaded', async () => {
    // ... il tuo codice esistente di main.js ...

    // Carica gli ultimi inserimenti all'avvio della pagina
    const latestEntries = await fetchLatestEntries();
    displayLatestEntries(latestEntries);

    // Potresti anche voler richiamare fetchLatestEntries e displayLatestEntries
    // dopo che un nuovo dato è stato salvato (ad esempio, dopo che l'utente clicca "Salva Dati"
    // nel modal "Inserisci Dati" o "Salva Nuova Commessa" nel modal "Nuova Commessa").
    // Ad esempio, nel file insert-data-modal.js o new-order-modal.js,
    // dopo una risposta di successo dal backend, potresti aggiungere:
    // await fetchAndDisplayLatestEntries(); // Dovresti incapsulare le due chiamate in una singola funzione per riusabilità.
});

// Funzione helper per riusabilità (opzionale, ma consigliato)
async function fetchAndDisplayLatestEntries() {
    const entries = await fetchLatestEntries();
    displayLatestEntries(entries);
}

// Esporta (se necessario per altri moduli) o rendi disponibile globalmente
// window.fetchAndDisplayLatestEntries = fetchAndDisplayLatestEntries; // Se devi chiamarla da altri script

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
        updateAIDbBtn.querySelector('img').src = 'img/loading.png'; // Assicurati di avere una GIF di caricamento
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