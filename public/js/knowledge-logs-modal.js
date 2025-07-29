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
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null; // <-- ASSICURATI DI AVERE QUESTA RIGA
        }
        this.currentProcessId = processId; // Memorizza l'ID del processo

        this.clearLogs(); // Pulisci i log precedenti

        // --- INIZIO MODIFICA QUI ---
        if (this.currentProcessId) { // <-- CONTROLLO AGGIUNTO
            this.addLogMessage(`Connessione stabilita per il processo di aggiornamento ID: ${this.currentProcessId}`, 'info');
        } else {
            this.addLogMessage('Connessione stabilita al servizio di monitoraggio log. In attesa dell\'ID del processo...', 'info');
            console.warn("processId non fornito a connectWebSocketForLogs. Il modale potrebbe visualizzare tutti i log o potrebbe non filtrare correttamente.");
        }
        // --- FINE MODIFICA QUI ---

        const wsProtocol = window.BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
        this.websocket = new WebSocket(`${wsProtocol}://${window.BACKEND_URL.split('//')[1]}/ws/knowledge-update-status`);

        this.websocket.onopen = () => {
            console.log('WebSocket Log connesso.');
            this.addLogMessage('Connesso con successo al servizio di monitoraggio log.', 'success');
        };

        this.websocket.onmessage = (event) => {
            try {
                const logData = JSON.parse(event.data);
                // Filtra i log per ID del processo corrente
                if (logData.process_id && logData.process_id === this.currentProcessId) {
                    this.addLogMessage(`${logData.timestamp} [${logData.level ? logData.level.toUpperCase() : 'INFO'}] ${logData.message}`, logData.level);
                }
                // --- INIZIO MODIFICA QUI (NUOVA CONDIZIONE) ---
                else if (logData.process_id && !this.currentProcessId) {
                    // Se arriva un log con process_id ma il nostro currentProcessId non è ancora impostato
                    console.warn(`Ricevuto log con process_id ${logData.process_id} prima che l'ID del processo corrente fosse impostato. Potrebbe non essere visualizzato o visualizzare log non pertinenti.`);
                    // Puoi decidere se mostrare questi log comunque (scommentando la riga sotto)
                    // this.addLogMessage(`${logData.timestamp} [${logData.level ? logData.level.toUpperCase() : 'INFO'}] ${logData.message}`, logData.level);
                }
                // --- FINE MODIFICA QUI ---
                // Ignora i log con process_id diverso o senza process_id se currentProcessId è impostato.
            } catch (error) {
                console.error("Errore nella parsificazione del messaggio log dal WebSocket:", error, event.data);
                this.addLogMessage('Errore nella ricezione di un messaggio log. Controlla la console del browser.', 'error');
            }
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket Log disconnesso:', event.code, event.reason);
            this.addLogMessage(`Disconnesso dal servizio di monitoraggio log. Codice: ${event.code}. Ragione: ${event.reason || 'Nessuna.'}`, 'info');
            this.resetUpdateButtonState();
        };

        this.websocket.onerror = (error) => {
            console.error('Errore WebSocket Log:', error);
            this.addLogMessage('Errore di connessione al servizio di monitoraggio log. Controlla la console.', 'error');
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