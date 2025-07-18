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
        // Event listener per chiudere il modale cliccando fuori
        if (this.knowledgeLogsModal) {
            this.knowledgeLogsModal.addEventListener('click', this.handleOutsideClick.bind(this));
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
            this.resetUpdateButtonState();
            this.currentProcessId = null; // Resetta il process ID
            console.log('Modale Knowledge Logs chiuso.');
        }
    }

    // Metodo per gestire il click esterno
    handleOutsideClick(event) {
        // Se l'elemento cliccato è il modale stesso (ovvero lo sfondo overlay)
        // e non un elemento figlio del modale, allora chiudi
        if (event.target === this.knowledgeLogsModal) {
            this.close();
        }
    }

    /**
     * Aggiunge un messaggio di log alla lista.
     * @param {string} message Il testo del messaggio di log.
     * @param {string} type Il tipo di log ('info', 'success', 'error', 'warning').
     */
    addLogMessage(message, type = 'info') {
        const li = document.createElement('li');
        li.textContent = message;
        // Aggiungi classi CSS per lo styling
        li.classList.add(`log-${type}`);
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
        if (!window.BACKEND_URL) {
            this.addLogMessage('Errore: URL del backend non definito. Impossibile connettersi ai log.', 'error');
            return;
        }

        this.currentProcessId = processId; // Salva l'ID del processo corrente

        const websocketBaseUrl = window.BACKEND_URL.replace('https://', 'wss://');
        const wsUrl = `${websocketBaseUrl}/ws/knowledge-update-logs?process_id=${processId}`;
        this.websocket = new WebSocket(wsUrl);

        this.addLogMessage('Tentativo di connessione WebSocket per i log in corso...', 'info');

        this.websocket.onopen = (event) => {
            this.addLogMessage('Connessione WebSocket stabilita. In attesa dei log di aggiornamento...', 'success');
        };

        this.websocket.onmessage = (event) => {
            try {
                const logData = JSON.parse(event.data);
                // Assicurati che il backend invii un campo 'type' o deduci il tipo dal messaggio
                const type = logData.type || (logData.message.toLowerCase().includes('errore') ? 'error' : 'info');
                this.addLogMessage(`[${logData.timestamp}] ${logData.message}`, type);
            } catch (e) {
                console.error("Errore nel parsing del messaggio WebSocket per log:", e, event.data);
                this.addLogMessage(`[ERRORE] Formato log non valido ricevuto: ${event.data}`, 'error');
            }
        };

        this.websocket.onclose = (event) => {
            let reason;
            let logType = 'info';
            if (event.code === 1000) {
                reason = "Connessione chiusa normalmente (completata o interrotta).";
                logType = 'success';
            } else if (event.code === 1001) {
                reason = "L'endpoint sta andando via.";
            } else if (event.code === 1006) {
                reason = "Connessione interrotta inaspettatamente (es. server offline).";
                logType = 'error';
            } else {
                reason = `Codice: ${event.code} (${event.reason || 'Nessuna ragione fornita'})`;
                logType = 'warning';
            }
            this.addLogMessage(`WebSocket Log disconnesso: ${reason}`, logType);
            
            // Riabilita il pulsante di aggiornamento nella chat
            this.resetUpdateButtonState();
            this.currentProcessId = null; // Resetta il process ID
        };

        this.websocket.onerror = (error) => {
            console.error("Errore WebSocket per log:", error);
            this.addLogMessage('Errore nella connessione WebSocket per i log. Si prega di riprovare.', 'error');
            // Riabilita il pulsante di aggiornamento nella chat
            this.resetUpdateButtonState();
        };
    }

    disconnectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close(1000, "Modal logs closed by user."); // Codice 1000 per chiusura normale
            this.websocket = null;
            console.log('WebSocket Log chiuso forzatamente.');
        }
    }

    /**
     * Resetta lo stato del pulsante di aggiornamento della Knowledge Base nella chat-modal.
     * Questa funzione viene chiamata quando il modale dei log si chiude o la connessione WebSocket si interrompe.
     */
    resetUpdateButtonState() {
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            updateAIDbBtn.querySelector('img').src = 'img/reload.png'; // Immagine di default
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            console.log('Pulsante Aggiorna Knowledge Base riabilitato.');
        }
    }
}

// Inizializza il modale Knowledge Logs quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente
    window.knowledgeLogsModalInstance = new KnowledgeLogsModal('knowledgeLogsModal', '.close-button');
    
    // Rendi le funzioni open e connectWebSocketForLogs accessibili globalmente
    // in modo che chat-modal.js possa chiamarle per il progetto "Segretario AI".
    window.openKnowledgeLogsModal = () => window.knowledgeLogsModalInstance.open();
    window.connectWebSocketForLogs = (processId) => window.knowledgeLogsModalInstance.connectWebSocketForLogs(processId);
});