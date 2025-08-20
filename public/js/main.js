// js/main.js

let isUpdating = false; // Aggiungi questa variabile di stato all'inizio del tuo file

document.addEventListener('DOMContentLoaded', async () => {
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

        const latestEntries = await fetchLatestEntries();

        displayLatestEntries(latestEntries);
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
window.initiateKnowledgeBaseUpdate = async function() {
    console.log('Funzione initiateKnowledgeBaseUpdate avviata.');
    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    
    // Disabilita il pulsante per prevenire clic multipli
    if (updateAIDbBtn) {
        updateAIDbBtn.disabled = true;
        updateAIDbBtn.title = 'Aggiornamento in corso...';
        const img = updateAIDbBtn.querySelector('img');
        if (img) {
            img.src = 'img/loading.gif';
            img.classList.add('loading');
        }
    }

    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!authToken) {
        console.error('Nessun token di autenticazione disponibile. Reindirizzamento.');
        alert('Sessione scaduta. Effettua nuovamente il login.');
        window.location.href = '/login.html';
        // Riabilita il pulsante in caso di errore
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            const img = updateAIDbBtn.querySelector('img');
            if (img) {
                img.src = 'img/reload.png';
                img.classList.remove('loading');
            }
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
        return;
    }

    try {
        const response = await fetch('/api/trigger-knowledge-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        });

        const data = await response.json();

        // Controllo se il process_id è presente nella risposta
        if (data && data.process_id) {
            const processId = data.process_id;
            console.log('Aggiornamento avviato con successo. ID Processo:', processId);

            // Controlla l'esistenza delle funzioni del modale prima di chiamarle
            if (window.openKnowledgeLogsModal && typeof window.openKnowledgeLogsModal === 'function') {
                window.openKnowledgeLogsModal();
                if (window.knowledgeLogsModalInstance && typeof window.knowledgeLogsModalInstance.connectWebSocketForLogs === 'function') {
                    window.knowledgeLogsModalInstance.connectWebSocketForLogs(processId);
                } else {
                    console.error('Impossibile connettere il WebSocket per i log. knowledgeLogsModalInstance o la sua funzione connectWebSocketForLogs non definita.');
                    // Utilizza un modale personalizzato al posto di alert()
                    alert('Aggiornamento avviato, ma i log non possono essere visualizzati. Controlla la console.');
                }
            } else {
                console.error('Impossibile aprire il modale dei log. openKnowledgeLogsModal non definita.');
                // Utilizza un modale personalizzato al posto di alert()
                alert('Aggiornamento avviato, ma i log non possono essere visualizzati. Controlla la console.');
            }
        } else {
            console.error("Errore interno: l'ID del processo di aggiornamento non è stato fornito dal server.");
            // Utilizza un modale personalizzato al posto di alert()
            alert(data.message || "Errore interno: l'ID del processo di aggiornamento non è stato fornito dal server.");
            
            // Riabilita il pulsante in caso di errore
            if (updateAIDbBtn) {
                updateAIDbBtn.disabled = false;
                const img = updateAIDbBtn.querySelector('img');
                if (img) {
                    img.src = 'img/reload.png';
                    img.classList.remove('loading');
                }
                updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            }
        }

    } catch (error) {
        console.error("Errore nell'avvio dell'aggiornamento della Knowledge Base:", error);
        // Utilizza un modale personalizzato al posto di alert()
        alert(`Errore nell'avvio dell'aggiornamento della Knowledge Base: ${error.message}`);

        // Riabilita il pulsante in caso di errore
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            const img = updateAIDbBtn.querySelector('img');
            if (img) {
                img.src = 'img/reload.png';
                img.classList.remove('loading');
            }
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    }
}