// js/knowledge-logs-modal.js

class KnowledgeLogsModal {
    constructor(modalId, closeButtonSelector) {
        this.knowledgeLogsModal = document.getElementById(modalId);
        this.knowledgeLogsList = document.getElementById('knowledgeLogsList');
        this.closeButton = this.knowledgeLogsModal ? this.knowledgeLogsModal.querySelector(closeButtonSelector) : null;
        
        this.websocket = null; // Variabile per la connessione WebSocket specifica per questo modale
        this.currentProcessId = null; // Per tenere traccia dell'ID del processo di aggiornamento
        
        this.addEventListeners();
    }

    addEventListeners() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }
    }

    open() {
        if (this.knowledgeLogsModal) {
            this.knowledgeLogsModal.style.display = 'block';
            window.showOverlay(); // Usa la funzione centralizzata
            this.clearLogs(); // Pulisci i log ogni volta che apri il modale
            console.log('Modale Knowledge Logs aperto.');
        }
    }

    close() {
        if (this.knowledgeLogsModal) {
            this.knowledgeLogsModal.style.display = 'none';
            window.hideOverlay(); // Usa la funzione centralizzata (gestisce già se altri modali sono aperti)
            
            // Chiudi il WebSocket quando il modale dei log viene chiuso
            this.disconnectWebSocket();

            // Riabilita il pulsante di aggiornamento nella chat quando il modale dei log si chiude
            const updateAIDbBtn = document.getElementById('updateAIDbBtn');
            if (updateAIDbBtn) {
                updateAIDbBtn.disabled = false;
                updateAIDbBtn.querySelector('img').src = 'img/reload.png';
                updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            }
            this.currentProcessId = null; // Resetta il process ID
            console.log('Modale Knowledge Logs chiuso.');
        }
    }

    addLogMessage(message, type = 'info') {
        const li = document.createElement('li');
        li.textContent = message;
        if (type === 'success') {
            li.classList.add('log-success');
        } else if (type === 'error') {
            li.classList.add('log-error');
        }
        this.knowledgeLogsList.appendChild(li);
        this.knowledgeLogsList.scrollTop = this.knowledgeLogsList.scrollHeight; // Scrolla in fondo
    }

    clearLogs() {
        if (this.knowledgeLogsList) {
            this.knowledgeLogsList.innerHTML = '';
        }
    }

    connectWebSocketForLogs(processId) {
        // Chiudi qualsiasi connessione precedente se presente
        this.disconnectWebSocket();

        if (!processId) {
            this.addLogMessage('Errore: ID del processo di aggiornamento non fornito per i log.', 'error');
            return;
        }
        this.currentProcessId = processId; // Salva l'ID del processo corrente

        const websocketBaseUrl = window.BACKEND_URL.replace('https://', 'wss://');
        const wsUrl = `${websocketBaseUrl}/ws/knowledge-update-logs?process_id=${processId}`;
        this.websocket = new WebSocket(wsUrl);

        this.addLogMessage('Connessione WebSocket in corso...', 'info');

        this.websocket.onopen = (event) => {
            this.addLogMessage('Connessione WebSocket stabilita. In attesa dei log...', 'success');
        };

        this.websocket.onmessage = (event) => {
            try {
                const logData = JSON.parse(event.data);
                this.addLogMessage(`[${logData.timestamp}] ${logData.message}`, 'info');
            } catch (e) {
                console.error("Errore nel parsing del messaggio WebSocket per log:", e, event.data);
                this.addLogMessage(`[ERRORE] Formato log non valido: ${event.data}`, 'error');
            }
        };

        this.websocket.onclose = (event) => {
            let reason;
            if (event.code === 1000) {
                reason = "Connessione chiusa normalmente.";
                this.addLogMessage('Aggiornamento completato o interrotto.', 'success'); // Messaggio finale
            } else if (event.code === 1001) {
                reason = "L'endpoint sta andando via.";
            } else if (event.code === 1006) {
                reason = "Connessione interrotta (nessun handshake).";
            } else {
                reason = "Codice: " + event.code + " (" + event.reason + ")";
            }
            this.addLogMessage(`Connessione WebSocket chiusa: ${reason}`, 'info');
            
            // Riabilita il pulsante di aggiornamento nella chat
            const updateAIDbBtn = document.getElementById('updateAIDbBtn');
            if (updateAIDbBtn) {
                updateAIDbBtn.disabled = false;
                updateAIDbBtn.querySelector('img').src = 'img/reload.png';
                updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            }
            this.currentProcessId = null; // Resetta il process ID
        };

        this.websocket.onerror = (error) => {
            console.error("Errore WebSocket per log:", error);
            this.addLogMessage('Errore nella connessione WebSocket per i log.', 'error');
            // Riabilita il pulsante di aggiornamento nella chat
            const updateAIDbBtn = document.getElementById('updateAIDbBtn');
            if (updateAIDbBtn) {
                updateAIDbBtn.disabled = false;
                updateAIDbBtn.querySelector('img').src = 'img/reload.png';
                updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            }
        };
    }

    disconnectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close();
            this.websocket = null;
            console.log('WebSocket Log chiuso forzatamente.');
        }
    }
}

// Inizializza il modale Knowledge Logs quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente per main.js e chat-modal.js
    window.knowledgeLogsModalInstance = new KnowledgeLogsModal('knowledgeLogsModal', '.close-button');
    // Rendi accessibile la funzione di connessione WebSocket direttamente dall'istanza
    // in modo che chat-modal.js possa chiamarla
    window.connectWebSocketForLogs = (processId) => window.knowledgeLogsModalInstance.connectWebSocketForLogs(processId);
    window.openKnowledgeLogsModal = () => window.knowledgeLogsModalInstance.open();
});