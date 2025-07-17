// js/knowledge-logs-modal.js

const knowledgeLogsModal = document.getElementById('knowledgeLogsModal');
const knowledgeLogsList = document.getElementById('knowledgeLogsList');
// Rimosso: const modalOverlay = document.getElementById('modalOverlay'); // Gestito da modal-manager.js

let websocket = null; // Variabile per la connessione WebSocket specifica per questo modale
let currentProcessId = null; // Per tenere traccia dell'ID del processo di aggiornamento

// Utilizza window.BACKEND_URL per coerenza se possibile
const websocketBaseUrl = window.BACKEND_URL ? window.BACKEND_URL.replace('https://', 'wss://') : 'wss://segretario-ai-backend-service-980771764885.europe-west1.run.app';

function openKnowledgeLogsModal() {
    knowledgeLogsModal.style.display = 'block';
    window.showOverlay(); // Usa la funzione centralizzata
    clearLogs(); // Pulisci i log ogni volta che apri il modale
}

function closeKnowledgeLogsModal() {
    knowledgeLogsModal.style.display = 'none';
    window.hideOverlay(); // Usa la funzione centralizzata (gestisce già se altri modali sono aperti)
    
    // Chiudi il WebSocket quando il modale dei log viene chiuso
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
        console.log('WebSocket chiuso perché il modale dei log è stato chiuso.');
    }
    // Riabilita il pulsante di aggiornamento nella chat quando il modale dei log si chiude
    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    if (updateAIDbBtn) {
        updateAIDbBtn.disabled = false;
        updateAIDbBtn.querySelector('img').src = 'img/reload.png';
        updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
    }
    currentProcessId = null; // Resetta il process ID
}

// Funzione per aggiungere un messaggio ai log di aggiornamento KB
function addLogMessage(message, type = 'info') {
    const li = document.createElement('li');
    li.textContent = message;
    if (type === 'success') {
        li.classList.add('log-success');
    } else if (type === 'error') {
        li.classList.add('log-error');
    }
    knowledgeLogsList.appendChild(li);
    knowledgeLogsList.scrollTop = knowledgeLogsList.scrollHeight; // Scrolla in fondo
}

// Funzione per pulire i log di aggiornamento KB
function clearLogs() {
    knowledgeLogsList.innerHTML = '';
}

// Funzione per connettersi al WebSocket per i log
function connectWebSocketForLogs(processId) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close(); // Chiudi qualsiasi connessione precedente
    }

    const wsUrl = `${websocketBaseUrl}/ws/knowledge-update-logs?process_id=${processId}`;
    websocket = new WebSocket(wsUrl);

    addLogMessage('Connessione WebSocket in corso...', 'info');

    websocket.onopen = (event) => {
        addLogMessage('Connessione WebSocket stabilita. In attesa dei log...', 'success');
    };

    websocket.onmessage = (event) => {
        try {
            const logData = JSON.parse(event.data);
            addLogMessage(`[${logData.timestamp}] ${logData.message}`, 'info');
        } catch (e) {
            console.error("Errore nel parsing del messaggio WebSocket per log:", e, event.data);
            addLogMessage(`[ERRORE] Formato log non valido: ${event.data}`, 'error');
        }
    };

    websocket.onclose = (event) => {
        let reason;
        if (event.code === 1000) {
            reason = "Connessione chiusa normalmente.";
            addLogMessage('Aggiornamento completato o interrotto.', 'success'); // Messaggio finale
        } else if (event.code === 1001) {
            reason = "L'endpoint sta andando via.";
        } else if (event.code === 1006) {
            reason = "Connessione interrotta (nessun handshake).";
        } else {
            reason = "Codice: " + event.code + " (" + event.reason + ")";
        }
        addLogMessage(`Connessione WebSocket chiusa: ${reason}`, 'info');
        
        // Riabilita il pulsante di aggiornamento nella chat
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
        currentProcessId = null; // Resetta il process ID
    };

    websocket.onerror = (error) => {
        console.error("Errore WebSocket per log:", error);
        addLogMessage('Errore nella connessione WebSocket per i log.', 'error');
        // Riabilita il pulsante di aggiornamento nella chat
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    };
}

// Rendi le funzioni disponibili globalmente se necessarie (es. per essere chiamate da main.js)
window.openKnowledgeLogsModal = openKnowledgeLogsModal;
window.closeKnowledgeLogsModal = closeKnowledgeLogsModal;
window.connectWebSocketForLogs = connectWebSocketForLogs; // Per la chat per avviare il processo

// Event listener per il pulsante di chiusura del modale
document.addEventListener('DOMContentLoaded', () => {
    const closeLogsBtn = knowledgeLogsModal.querySelector('.close-button');
    if (closeLogsBtn) {
        closeLogsBtn.addEventListener('click', closeKnowledgeLogsModal);
    }
});