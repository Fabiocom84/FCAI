// js/knowledge-logs-modal.js

class KnowledgeLogsModal {
    constructor(modalId, closeButtonSelector) {
        this.knowledgeLogsModal = document.getElementById(modalId);
        this.knowledgeLogsList = document.getElementById('knowledgeLogsList');
        this.closeButton = this.knowledgeLogsModal ? this.knowledgeLogsModal.querySelector(closeButtonSelector) : null;
        
        this.websocket = null;
        this.currentProcessId = null;
        
        this.addEventListeners();
    }

    addEventListeners() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }
        if (this.knowledgeLogsModal) {
            this.knowledgeLogsModal.addEventListener('click', this.handleOutsideClick.bind(this));
        }
    }

    open() {
        if (this.knowledgeLogsModal) {
            this.knowledgeLogsModal.style.display = 'block';
            window.showOverlay();
            this.clearLogs();
            console.log('Modale Knowledge Logs aperto.');
        }
    }

    close() {
        if (this.knowledgeLogsModal) {
            this.knowledgeLogsModal.style.display = 'none';
            window.hideOverlay();
            
            this.disconnectWebSocket();
            this.resetUpdateButtonState();
            this.currentProcessId = null;
            console.log('Modale Knowledge Logs chiuso.');
        }
    }

    handleOutsideClick(event) {
        if (event.target === this.knowledgeLogsModal) {
            this.close();
        }
    }

    addLogMessage(message, type = 'info') {
        const li = document.createElement('li');
        li.textContent = message;
        li.classList.add(`log-${type}`);
        this.knowledgeLogsList.appendChild(li);
        this.knowledgeLogsList.scrollTop = this.knowledgeLogsList.scrollHeight;
    }

    clearLogs() {
        if (this.knowledgeLogsList) {
            this.knowledgeLogsList.innerHTML = '';
        }
    }

    /**
     * Connette il client al WebSocket per ricevere i log in tempo reale.
     * @param {string} processId L'ID univoco del processo di aggiornamento.
     */
    connectWebSocketForLogs(processId) {
        if (this.websocket) {
            console.warn("WebSocket is already connected. Disconnecting and reconnecting.");
            this.websocket.close(1000, "Reconnecting due to a new request.");
        }

        if (!processId) {
            console.error("connectWebSocketForLogs: processId non fornito.");
            return;
        }
    
        const wsUrl = `${window.BACKEND_URL.replace('http', 'ws')}/ws/knowledge-logs/${processId}`;

        console.log(`Tentativo di connettersi al WebSocket per i log con URL: ${wsUrl}`);
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = (event) => {
          console.log("WebSocket per i log connesso.", event);
        };

        this.websocket.onmessage = (event) => {
            const logData = JSON.parse(event.data);
            console.log("Messaggio log ricevuto:", logData);
            // ... (logica per mostrare i log)
        };

        this.websocket.onclose = (event) => {
            console.log(`WebSocket per i log disconnesso: ${event.code} ${event.reason}`);
            if (event.code !== 1000) {
                console.error("WebSocket disconnesso con errore. Riprova più tardi.");
            }
            this.resetUpdateButtonState();
        };

        this.websocket.onerror = (error) => {
          console.error("Errore WebSocket per i log:", error);
        };
    }

    disconnectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close(1000, "Modal logs closed by user.");
            this.websocket = null;
            console.log('WebSocket Log chiuso forzatamente.');
        }
    }

    resetUpdateButtonState() {
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.disabled = false;
            updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            console.log('Pulsante Aggiorna Knowledge Base riabilitato.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeLogsModalInstance = new KnowledgeLogsModal('knowledgeLogsModal', '.close-button');
    window.openKnowledgeLogsModal = () => window.knowledgeLogsModalInstance.open();
});