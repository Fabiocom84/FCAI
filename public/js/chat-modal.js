// js/chat-modal.js

class ChatModal {
    constructor(modalId, openButtonSelector) {
        this.chatModal = document.getElementById(modalId);
        this.openButton = document.querySelector(openButtonSelector); // Il pulsante che apre il modale
        this.closeButton = this.chatModal ? this.chatModal.querySelector('.close-button') : null;
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.updateAIDbBtn = document.getElementById('updateAIDbBtn'); // Pulsante per aggiornare Knowledge Base
        this.stopProcessingBtn = document.getElementById('stopProcessingBtn'); // Pulsante per fermare il processo AI

        this.websocket = null; // WebSocket per la chat (risposte AI)
        this.currentChatSessionId = null; // ID sessione chat per contesto

        // Binding dei metodi al contesto della classe
        this.addEventListeners();
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }
        // Aggiungi l'event listener per il click fuori dal modale
        if (this.chatModal) {
            this.chatModal.addEventListener('click', this.handleOutsideClick.bind(this));
        }
        if (this.sendMessageBtn) {
            this.sendMessageBtn.addEventListener('click', this.sendMessage.bind(this));
        }
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) { // Invia con Enter, nuova riga con Shift+Enter
                    event.preventDefault();
                    this.sendMessage();
                }
            });
        }
        if (this.updateAIDbBtn) {
            this.updateAIDbBtn.addEventListener('click', this.updateAIDb.bind(this));
        }
        if (this.stopProcessingBtn) {
            this.stopProcessingBtn.addEventListener('click', this.stopProcessing.bind(this));
        }
    }

    open() {
        if (this.chatModal) {
            this.chatModal.style.display = 'flex'; // Usiamo flex per centrare il contenuto con i nuovi stili CSS
            window.showOverlay(); // Funzione centralizzata per l'overlay
            this.clearChat(); // Pulisci la chat all'apertura
            this.initializeChatSession(); // Inizializza o recupera sessione
            console.log('Modale Chat AI aperto.');
        }
    }

    close() {
        if (this.chatModal) {
            this.chatModal.style.display = 'none';
            window.hideOverlay(); // Funzione centralizzata per l'overlay
            this.disconnectWebSocket(); // Disconnetti WebSocket della chat alla chiusura
            this.currentChatSessionId = null; // Resetta l'ID della sessione
            console.log('Modale Chat AI chiuso.');
        }
    }

    // Nuovo metodo per gestire il click esterno
    handleOutsideClick(event) {
        // Se l'elemento cliccato è il modale stesso (ovvero lo sfondo overlay)
        // e non un elemento figlio del modale, allora chiudi
        if (event.target === this.chatModal) {
            this.close();
        }
    }

    /**
     * Aggiunge un messaggio alla finestra della chat.
     * @param {string} message Il testo del messaggio.
     * @param {string} sender Il mittente del messaggio ('user', 'ai').
     */
    addMessage(message, sender = 'user') {
        const messageElement = document.createElement('div');
        // Aggiungi la classe base 'message' e una classe specifica per il mittente
        messageElement.classList.add('message', `${sender}-message`);

        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');
        contentElement.textContent = message;

        messageElement.appendChild(contentElement);
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight; // Scrolla in fondo
    }

    /**
     * Aggiunge un messaggio di sistema (informazioni, errori, avvisi) alla chat.
     * Questi messaggi sono stilizzati diversamente dai normali messaggi utente/AI.
     * @param {string} message Il testo del messaggio di sistema.
     * @param {string} type Il tipo di messaggio ('info', 'error', 'warning').
     */
    _addSystemMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('system-message', type); // Aggiungi classi CSS per stile
        messageElement.textContent = message;
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight; // Scrolla in fondo
    }

    clearChat() {
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
    }

    async initializeChatSession() {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Errore: Autenticazione richiesta per la chat.', 'error');
            return;
        }

        try {
            // L'endpoint è /api/chat
            const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                // Assicurati che il body contenga un campo 'message' per evitare il 400 Bad Request
                body: JSON.stringify({
                    session_id: null, // Il backend può ignorare o generare questo se è la prima chiamata
                    message: "Inizia la conversazione." // Un messaggio iniziale per l'AI
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Errore nell'inizializzazione della sessione chat: ${response.statusText}`);
            }

            const data = await response.json();
            // Importante: Assicurati che il tuo backend Flask restituisca `session_id`
            // altrimenti il WebSocket non si connetterà.
            this.currentChatSessionId = data.session_id;
            console.log('Sessione chat inizializzata con ID:', this.currentChatSessionId);
            this.addMessage('Ciao! Sono il tuo assistente. Come posso aiutarti oggi?', 'ai');
            this.connectWebSocketForChat(); // Connetti il WebSocket per le risposte in tempo reale
        } catch (error) {
            console.error('Errore durante l\'inizializzazione della sessione chat:', error);
            this._addSystemMessage(`Errore durante l'inizializzazione della chat: ${error.message}. Riprova più tardi.`, 'error');
        }
    }

    connectWebSocketForChat() {
        // Chiudi il WebSocket esistente se aperto
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close();
        }

        if (!this.currentChatSessionId) {
            console.error('Impossibile connettersi al WebSocket: ID sessione chat non disponibile.');
            this._addSystemMessage('Errore di connessione: ID sessione chat mancante.', 'error');
            return;
        }

        const websocketBaseUrl = window.BACKEND_URL.replace('https://', 'wss://');
        const wsUrl = `${websocketBaseUrl}/ws/chat/${this.currentChatSessionId}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('WebSocket Chat connesso per la sessione:', this.currentChatSessionId);
            this._addSystemMessage('Connessione chat stabilita.', 'info');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'response') {
                this.addMessage(data.message, 'ai');
            } else if (data.type === 'error') {
                this._addSystemMessage(`Errore AI: ${data.message}`, 'error');
            } else if (data.type === 'info') {
                this._addSystemMessage(`Info AI: ${data.message}`, 'info');
            }
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket Chat disconnesso:', event.code, event.reason);
            this._addSystemMessage('Chat disconnessa. Se hai bisogno, apri nuovamente il modale.', 'info');
        };

        this.websocket.onerror = (error) => {
            console.error('Errore WebSocket Chat:', error);
            this._addSystemMessage('Errore di connessione alla chat. Riprova.', 'error');
        };
    }

    disconnectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close();
            this.websocket = null;
            console.log('WebSocket Chat disconnesso forzatamente.');
        }
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.chatInput.value = ''; // Pulisci l'input

        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Autenticazione richiesta per inviare messaggi. Effettua il login.', 'error');
            return;
        }
        if (!this.currentChatSessionId) {
            this._addSystemMessage('Errore: Sessione chat non inizializzata. Prova a riaprire il modale.', 'error');
            return;
        }

        try {
            // Aggiungi un messaggio di "digitazione" o "processo in corso"
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('ai-message', 'typing-indicator');
            typingIndicator.innerHTML = '<div class="message-content">Frank sta digitando...</div>';
            this.chatMessages.appendChild(typingIndicator);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

            // L'endpoint è /api/chat
            const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    session_id: this.currentChatSessionId,
                    message: message
                })
            });

            // Rimuovi l'indicatore di digitazione una volta che la risposta HTTP è arrivata
            if (typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante l\'invio del messaggio.');
            }
            // Le risposte AI arriveranno via WebSocket, quindi non gestiamo qui la risposta HTTP
        } catch (error) {
            console.error('Errore nell\'invio del messaggio:', error);
            this._addSystemMessage(`Errore durante l'invio del messaggio: ${error.message}`, 'error');
        }
    }

    // Funzione per aggiornare la Knowledge Base AI
    async updateAIDb() {
        console.log('Avvio aggiornamento Knowledge Base AI...');
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta per aggiornare la Knowledge Base.');
            return;
        }

        // Disabilita il pulsante e cambia l'icona
        if (this.updateAIDbBtn) {
            this.updateAIDbBtn.disabled = true;
            this.updateAIDbBtn.querySelector('img').src = 'img/loading.gif'; // Immagine di caricamento
            this.updateAIDbBtn.title = 'Aggiornamento in corso...';
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/update-knowledge-base`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore nell\'avvio dell\'aggiornamento della Knowledge Base.');
            }

            const result = await response.json();
            const processId = result.process_id;
            console.log('Aggiornamento KB avviato. ID processo:', processId);
            this._addSystemMessage(`Aggiornamento Knowledge Base AI avviato! ID processo: ${processId}. Controlla i log per lo stato.`, 'info');

            // Apre il modale dei log e connette il WebSocket specifico per i log
            if (window.openKnowledgeLogsModal && typeof window.connectWebSocketForLogs === 'function') {
                window.openKnowledgeLogsModal();
                window.connectWebSocketForLogs(processId); // Passa l'ID del processo ai log
            } else {
                console.warn('Funzioni per la gestione dei log della Knowledge Base non disponibili.');
                this._addSystemMessage('Impossibile aprire il modale dei log. Assicurati che knowledge-logs-modal.js sia caricato.', 'warning');
            }

        } catch (error) {
            console.error('Errore nell\'avviare l\'aggiornamento della Knowledge Base:', error);
            this._addSystemMessage(`Errore nell'avviare l'aggiornamento della Knowledge Base: ${error.message}`, 'error');
        } finally {
            // Non riabilitare il pulsante qui, perché la riabilitazione è gestita dal knowledge-logs-modal.js
            // quando il processo di aggiornamento termina o fallisce.
        }
    }

    async stopProcessing() {
        console.log('Richiesta di interruzione processo AI...');
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta per interrompere il processo.');
            return;
        }

        // Si assume che l'ID del processo da interrompere sia l'ID della sessione chat
        // O che ci sia un modo per ottenere l'ID del processo di aggiornamento KB se è quello l'intento.
        // Per ora, useremo l'ID della sessione chat. Se il pulsante è nel modale KB, servirà un altro meccanismo.
        const processIdToStop = this.currentChatSessionId;

        // Se l'intento è di fermare l'aggiornamento della KB, si dovrebbe passare l'ID del processo di aggiornamento KB
        // che è stato ricevuto nel metodo `updateAIDb`. Questo richiederebbe di salvare quel `processId`
        // in una variabile di istanza (`this.currentKBProcessId` ad esempio).
        // Per semplicità, qui si assume che `stopProcessingBtn` sia per interrompere la chat attuale.

        if (!processIdToStop) {
            this._addSystemMessage('Nessun processo attivo della chat da interrompere.', 'info');
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/stop-process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ process_id: processIdToStop })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante l\'invio del comando di interruzione.');
            }

            const result = await response.json();
            this._addSystemMessage(result.message || 'Comando di interruzione inviato con successo.', 'info');
            console.log('Comando di interruzione processo AI inviato:', result);
        } catch (error) {
            console.error('Errore nell\'interruzione del processo AI:', error);
            this._addSystemMessage(`Errore nell'interruzione del processo AI: ${error.message}`, 'error');
        }
    }
}

// Inizializza il modale Chat AI quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente per main.js
    window.chatModalInstance = new ChatModal('chatModal', '#openChatModalBtn');
});