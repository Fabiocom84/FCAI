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
            // Modificato per chiamare un wrapper asincrono che gestisce il salvataggio
            this.closeButton.addEventListener('click', async () => {
                await this.close();
            });
        }
        // Aggiungi l'event listener per il click fuori dal modale
        if (this.chatModal) {
            // Modificato per chiamare un wrapper asincrono che gestisce il salvataggio
            this.chatModal.addEventListener('click', async (event) => {
                if (event.target === this.chatModal) {
                    await this.close();
                }
            });
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

    async close() {
        if (this.chatModal) {
            const transcription = this.getChatTranscription();
            if (transcription) { // Salva solo se c'è qualcosa da salvare
                await this.saveChatToGoogleSheet(transcription);
            }
            this.chatModal.style.display = 'none';
            window.hideOverlay(); // Funzione centralizzata per l'overlay
            this.disconnectWebSocket(); // Disconnetti WebSocket della chat alla chiusura
            this.currentChatSessionId = null; // Resetta l'ID della sessione
            console.log('Modale Chat AI chiuso.');
        }
    }

    /**
     * Estrae l'intera trascrizione della conversazione dalla chat.
     * @returns {string} La trascrizione formattata della chat.
     */
    getChatTranscription() {
        let transcription = '';
        const messages = this.chatMessages.querySelectorAll('.message');
        messages.forEach(message => {
            // Evita di includere messaggi di sistema o indicatori di digitazione nella trascrizione principale
            if (message.classList.contains('system-message') || message.classList.contains('typing-indicator')) {
                return;
            }

            const sender = message.classList.contains('user-message') ? 'Utente' : 'Frank';
            const content = message.querySelector('.message-content').innerText;
            transcription += `${sender}: ${content}\n`;
        });
        return transcription.trim(); // Rimuovi eventuali spazi bianchi all'inizio/fine
    }

    /**
     * Invia la trascrizione della chat al backend per essere salvata sul Google Sheet.
     * @param {string} transcription Il testo della conversazione da salvare.
     */
    async saveChatToGoogleSheet(transcription) {
        if (!transcription) {
            console.warn("Nessuna trascrizione da salvare.");
            return;
        }

        try {
            const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            if (!authToken) {
                console.error('Token di autenticazione non trovato. Impossibile salvare la chat.');
                // Non mostrare alert qui, per non bloccare la chiusura del modal.
                this._addSystemMessage('Impossibile salvare la chat: autenticazione necessaria.', 'error');
                return;
            }

            console.log('Tentativo di salvare la chat sul Google Sheet...');
            const response = await fetch(`${window.BACKEND_URL}/save-chat`, { // Assicurati che l'endpoint sia corretto
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ chatTranscription: transcription })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Errore HTTP: ${response.status}`);
            }

            console.log('Chat salvata con successo sul Google Sheet.');
            this._addSystemMessage('Chat salvata sul Google Sheet.', 'info');
        } catch (error) {
            console.error('Errore durante il salvataggio della chat:', error);
            this._addSystemMessage(`Errore nel salvataggio della chat: ${error.message}`, 'error');
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
            // Rimuovi l'indicatore di digitazione quando ricevi un messaggio
            const typingIndicator = this.chatMessages.querySelector('.typing-indicator');
            if (typingIndicator && typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }

            if (data.type === 'response') {
                this.addMessage(data.message, 'ai');
                // Se la risposta include audio, riproduci
                if (data.audio) {
                    const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                    audio.play().catch(e => console.error("Errore riproduzione audio:", e));
                }
            } else if (data.type === 'error') {
                this._addSystemMessage(`Errore AI: ${data.message}`, 'error');
            } else if (data.type === 'info') {
                this._addSystemMessage(`Info AI: ${data.message}`, 'info');
            }
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket Chat disconnesso:', event.code, event.reason);
            this._addSystemMessage('Chat disconnessa. Se hai bisogno, apri nuovamente il modale.', 'info');
            // Assicurati che l'indicatore di digitazione venga rimosso anche alla disconnessione
            const typingIndicator = this.chatMessages.querySelector('.typing-indicator');
            if (typingIndicator && typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }
        };

        this.websocket.onerror = (error) => {
            console.error('Errore WebSocket Chat:', error);
            this._addSystemMessage('Errore di connessione alla chat. Riprova.', 'error');
            // Assicurati che l'indicatore di digitazione venga rimosso anche in caso di errore
            const typingIndicator = this.chatMessages.querySelector('.typing-indicator');
            if (typingIndicator && typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }
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

            // Invia il messaggio tramite WebSocket invece di HTTP POST
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                const messagePayload = {
                    session_id: this.currentChatSessionId,
                    message: message
                };
                this.websocket.send(JSON.stringify(messagePayload));
                console.log('Messaggio inviato via WebSocket:', messagePayload);
            } else {
                this._addSystemMessage('Errore: Connessione WebSocket non attiva. Riprova ad aprire la chat.', 'error');
                // Rimuovi l'indicatore di digitazione se il WebSocket non è attivo
                if (typingIndicator.parentNode) {
                    typingIndicator.parentNode.removeChild(typingIndicator);
                }
            }

            // L'indicatore di digitazione verrà rimosso quando arriva la risposta via WebSocket
            // Se non dovesse arrivare una risposta, un meccanismo di timeout o di stato del WS dovrebbe rimuoverlo.
            // Il setTimeout qui è stato rimosso, poiché la rimozione è ora gestita nell'onmessage e onerror del WS.
        } catch (error) {
            console.error('Errore nell\'invio del messaggio:', error);
            this._addSystemMessage(`Errore durante l'invio del messaggio: ${error.message}`, 'error');
            // Rimuovi l'indicatore di digitazione in caso di errore
            const typingIndicator = this.chatMessages.querySelector('.typing-indicator');
            if (typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }
        }
    }

    // Funzione per aggiornare la Knowledge Base AI
    async updateAIDb() {
        console.log('Avvio aggiornamento Knowledge Base AI...');
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Autenticazione richiesta per aggiornare la Knowledge Base.', 'error');
            return;
        }

        // Disabilita il pulsante e cambia l'icona
        if (this.updateAIDbBtn) {
            this.updateAIDbBtn.disabled = true;
            this.updateAIDbBtn.querySelector('img').src = 'img/loading.png'; // Immagine di caricamento
            this.updateAIDbBtn.title = 'Aggiornamento in corso...';
        }

        try {
            // URL CORRETTO per l'endpoint di trigger della Knowledge Base
            const response = await fetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json' // Il backend si aspetta JSON
                },
                // Invia i parametri necessari per la Cloud Function tramite il backend
                body: JSON.stringify({
                    // Questi valori devono corrispondere a quelli che la tua Cloud Function si aspetta
                    spreadsheet_id: "1XQJ0Py2aACDtcOnc7Mi2orqaKWbNpZbpp9lAnIm1kv8", // ID del tuo Google Sheet
                    // AGGIORNATO: Nomi dei fogli corretti per la Knowledge Base
                    sheet_names: "Registrazioni,Chat_AI,Riferimento_Commessa"
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Errore nell'avvio dell'aggiornamento della Knowledge Base: ${response.statusText}`);
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
            this._addSystemMessage('Autenticazione richiesta per interrompere il processo.', 'error');
            return;
        }

        const processIdToStop = this.currentChatSessionId; // Assumiamo che si voglia fermare la sessione chat corrente

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