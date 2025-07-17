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
            this.chatModal.style.display = 'block';
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

    addMessage(message, sender = 'user') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
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
            this.addMessage('Errore: Autenticazione richiesta per la chat.', 'ai');
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/chat/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Errore nell'inizializzazione della sessione chat: ${response.statusText}`);
            }

            const data = await response.json();
            this.currentChatSessionId = data.session_id;
            console.log('Sessione chat inizializzata:', this.currentChatSessionId);
            this.addMessage('Chat AI: Ciao! Sono il tuo assistente. Come posso aiutarti oggi?', 'ai');
            this.connectWebSocketForChat(); // Connetti il WebSocket per le risposte in tempo reale
        } catch (error) {
            console.error('Errore durante l\'inizializzazione della sessione chat:', error);
            this.addMessage('Errore durante l\'inizializzazione della chat. Riprova più tardi.', 'error');
        }
    }

    connectWebSocketForChat() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close();
        }

        if (!this.currentChatSessionId) {
            console.error('Impossibile connettersi al WebSocket: ID sessione chat non disponibile.');
            return;
        }

        const websocketBaseUrl = window.BACKEND_URL.replace('https://', 'wss://');
        const wsUrl = `${websocketBaseUrl}/ws/chat/${this.currentChatSessionId}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('WebSocket Chat connesso.');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'response') {
                this.addMessage(data.message, 'ai');
            } else if (data.type === 'error') {
                this.addMessage(`Errore AI: ${data.message}`, 'error');
            }
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket Chat disconnesso:', event.code, event.reason);
            this.addMessage('Chat disconnessa. Se hai bisogno, apri nuovamente il modale.', 'info');
        };

        this.websocket.onerror = (error) => {
            console.error('Errore WebSocket Chat:', error);
            this.addMessage('Errore di connessione alla chat. Riprova.', 'error');
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
            this.addMessage('Autenticazione richiesta per inviare messaggi.', 'ai');
            return;
        }
        if (!this.currentChatSessionId) {
            this.addMessage('Errore: Sessione chat non inizializzata. Prova a riaprire il modale.', 'ai');
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/chat/message`, {
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante l\'invio del messaggio.');
            }
            // Le risposte AI arriveranno via WebSocket, quindi non gestiamo qui la risposta HTTP
        } catch (error) {
            console.error('Errore nell\'invio del messaggio:', error);
            this.addMessage(`Errore: ${error.message}`, 'error');
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
            alert('Aggiornamento Knowledge Base AI avviato! Controlla i log per lo stato.');

            // Apre il modale dei log e connette il WebSocket specifico per i log
            if (window.openKnowledgeLogsModal && typeof window.connectWebSocketForLogs === 'function') {
                window.openKnowledgeLogsModal();
                window.connectWebSocketForLogs(processId); // Passa l'ID del processo ai log
            } else {
                console.warn('Funzioni per la gestione dei log della Knowledge Base non disponibili.');
            }

        } catch (error) {
            console.error('Errore nell\'avviare l\'aggiornamento della Knowledge Base:', error);
            alert('Errore nell\'avviare l\'aggiornamento della Knowledge Base: ' + error.message);
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

        // Recupera l'ID del processo corrente dalla chat o da un'altra fonte se necessario
        // Per semplicità, potremmo usare un currentProcessId qui se la chat lo genera
        // o fare in modo che il backend interrompa l'ultimo processo avviato dall'utente
        const processIdToStop = this.currentChatSessionId; // O un processId specifico di update KB

        if (!processIdToStop) {
            alert('Nessun processo attivo da interrompere.');
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
            alert(result.message || 'Comando di interruzione inviato con successo.');
            console.log('Comando di interruzione processo AI inviato:', result);
        } catch (error) {
            console.error('Errore nell\'interruzione del processo AI:', error);
            alert('Errore nell\'interruzione del processo AI: ' + error.message);
        }
    }
}

// Inizializza il modale Chat AI quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente per main.js
    window.chatModalInstance = new ChatModal('chatModal', '#openChatModalBtn');
});