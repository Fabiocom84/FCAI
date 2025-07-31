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

    /**
    * Connette il client al WebSocket per ricevere i log in tempo reale.
    * @param {string} processId L'ID univoco del processo di aggiornamento.
    */
    function connectWebSocketForLogs(processId) {
        if (socket) {
            console.warn("WebSocket is already connected. Disconnecting and reconnecting.");
            socket.close(1000, "Reconnecting due to a new request.");
        }

        if (!processId) {
            console.error("connectWebSocketForLogs: processId non fornito.");
            return;
        }
    
        // Costruisci l'URL del WebSocket includendo il processId nel percorso
        // L'endpoint corretto è /ws/knowledge-logs/<processId>
        const wsUrl = `${window.BACKEND_URL.replace('http', 'ws')}/ws/knowledge-logs/${processId}`;

        console.log(`Tentativo di connettersi al WebSocket per i log con URL: ${wsUrl}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = (event) => {
            console.log("WebSocket per i log connesso.", event);
            // Ora puoi usare la connessione per inviare messaggi se necessario
        };

        socket.onmessage = (event) => {
            // Gestisci i messaggi ricevuti dal server
            const logData = JSON.parse(event.data);
            console.log("Messaggio log ricevuto:", logData);
            // ... (resto della tua logica per mostrare i log)
        };

        socket.onclose = (event) => {
            console.log(`WebSocket per i log disconnesso: ${event.code} ${event.reason}`);
            if (event.code !== 1000) {
                console.error("WebSocket disconnesso con errore. Riprova più tardi.");
            }
            // Riabilita il pulsante di aggiornamento
            const updateAIDbBtn = document.getElementById('updateAIDbBtn');
            if (updateAIDbBtn) {
                updateAIDbBtn.disabled = false;
                updateAIDbBtn.querySelector('img').src = 'img/reload.png';
                updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
            }
        };

        socket.onerror = (error) => {
            console.error("Errore WebSocket per i log:", error);
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