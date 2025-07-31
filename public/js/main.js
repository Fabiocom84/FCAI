// js/main.js

let isUpdating = false; // Aggiungi questa variabile di stato all'inizio del tuo file

document.addEventListener('DOMContentLoaded', () => {
    console.log('Main script: DOM completamente caricato.');
    console.log('Controllo autenticazione in main.js...');

    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (!authToken) {
        console.log('Nessun token di autenticazione trovato. Reindirizzamento a login.html');
        window.location.href = '/login.html';
    } else {
        console.log('Token di autenticazione trovato. Caricamento dati iniziali e visualizzazione pagina.');
        
        const mainContent = document.querySelector('.main-content-wrapper');
        if (mainContent) {
            mainContent.style.display = 'flex';
            mainContent.style.visibility = 'visible';
            mainContent.style.opacity = '1';
            mainContent.classList.remove('hidden', 'd-none');
            console.log('main-content-wrapper reso visibile.');
        } else {
            console.error('Elemento .main-content-wrapper non trovato.');
        }

        // Chiamata per caricare gli ultimi inserimenti una volta autenticato
        fetchLatestEntries();
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            window.location.href = '/login.html';
        });
    }

    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    if (updateAIDbBtn) {
        updateAIDbBtn.addEventListener('click', initiateKnowledgeBaseUpdate);
    }
});

// Le funzioni vengono definite qui, fuori dal blocco DOMContentLoaded, per renderle più leggibili e riutilizzabili.

async function fetchLatestEntries() {
    try {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        const response = await fetch(`${window.BACKEND_URL}/api/latest-entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}. Details: ${errorText}`);
        }
        const data = await response.json();
        return data.latest_entries || [];
    } catch (error) {
        console.error("Errore durante il recupero degli ultimi inserimenti:", error);
        const latestEntriesList = document.getElementById('latestEntriesList');
        if (latestEntriesList) {
            latestEntriesList.innerHTML = '<li class="no-entries error">Errore nel caricamento degli inserimenti recenti. Riprova più tardi.</li>';
        }
        return [];
    }
}

function displayLatestEntries(entries) {
    const latestEntriesList = document.getElementById('latestEntriesList');
    if (!latestEntriesList) return;
    
    latestEntriesList.innerHTML = '';
    if (entries.length === 0) {
        latestEntriesList.innerHTML = '<li class="no-entries">Nessun inserimento recente trovato.</li>';
        return;
    }

    entries.forEach(entryString => {
        const listItem = document.createElement('li');
        listItem.classList.add('latest-entry-item');
        listItem.innerHTML = entryString;
        latestEntriesList.appendChild(listItem);
    });
}

// Rendi fetchLatestEntries e initiateKnowledgeBaseUpdate globali
window.fetchLatestEntries = fetchLatestEntries;
window.initiateKnowledgeBaseUpdate = initiateKnowledgeBaseUpdate;


// Il codice di initiateKnowledgeBaseUpdate che avevi già è corretto e non ho dovuto modificarlo
async function initiateKnowledgeBaseUpdate() {
    if (isUpdating) {
        console.log("Aggiornamento già in corso. Ignorando la richiesta.");
        return;
    }
    
    isUpdating = true; // Imposta lo stato su true all'inizio
    console.log("Avvio aggiornamento Knowledge Base AI...");
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        alert('Autenticazione richiesta per aggiornare la Knowledge Base. Effettua il login.');
        window.location.href = 'login.html';
        return;
    }

    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    if (updateAIDbBtn) {
        // Disabilita il pulsante non appena la funzione viene avviata
        updateAIDbBtn.disabled = true;
        updateAIDbBtn.querySelector('img').src = 'img/loading.png';
        updateAIDbBtn.title = 'Aggiornamento in corso...';
    }

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
      
        const data = await response.json();

        console.log("Dati di risposta completi dall'API backend:", data);

        const processId = data.function_response?.process_id;

        if (!processId || typeof processId !== 'string') {
            console.error("ERRORE CRITICO: 'process_id' è null, undefined o non è una stringa dalla risposta backend.");
            alert("Errore interno: l'ID del processo di aggiornamento non è stato fornito dal server. Si prega di riprovare o contattare il supporto tecnico.");
            
            // Riabilita il pulsante anche in caso di errore di process_id
            if (updateAIDbBtn) {
                updateAIDbBtn.disabled = false;
                updateAIDbBtn.querySelector('img').src = 'img/reload.png';
                updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            }
            return;
        }

        console.log(`Aggiornamento avviato con Process ID: ${processId}`);
        alert('Aggiornamento Knowledge Base avviato con successo! Controlla i log per lo stato.');

        // Aggiungi un piccolo ritardo per dare tempo al backend di inizializzare il WebSocket
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Controlla l'esistenza delle funzioni del modale prima di chiamarle
        if (window.openKnowledgeLogsModal && typeof window.openKnowledgeLogsModal === 'function') {
            window.openKnowledgeLogsModal();
            if (window.knowledgeLogsModalInstance && typeof window.knowledgeLogsModalInstance.connectWebSocketForLogs === 'function') {
                window.knowledgeLogsModalInstance.connectWebSocketForLogs(processId);
            } else {
                console.error('Impossibile connettere il WebSocket per i log. knowledgeLogsModalInstance o la sua funzione connectWebSocketForLogs non definita.');
                alert('Aggiornamento avviato, ma i log non possono essere visualizzati. Controlla la console.');
            }
        } else {
            console.error('Impossibile aprire il modale dei log. openKnowledgeLogsModal non definita.');
            alert('Aggiornamento avviato, ma i log non possono essere visualizzati. Controlla la console.');
        }

    } catch (error) {
        console.error("Errore nell'avvio dell'aggiornamento della Knowledge Base:", error);
        alert(`Errore nell'avvio dell'aggiornamento della Knowledge Base: ${error.message}`);

        // Riabilita il pulsante in caso di errore
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    }
}