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
        // Aggiungi l'event listener per il click
        if (this.sendMessageBtn) {
            this.sendMessageBtn.addEventListener('click', this.sendMessage.bind(this));
        }
        // Aggiungi l'event listener per il tasto Invio nell'input della chat
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Impedisce il salto di riga nel textarea
                    this.sendMessage();
                }
            });
        }
        if (this.updateAIDbBtn) {
            this.updateAIDbBtn.addEventListener('click', this.updateAIDatabase.bind(this));
        }
        if (this.stopProcessingBtn) {
            this.stopProcessingBtn.addEventListener('click', this.stopAIProcess.bind(this));
        }
    }

    open() {
        if (this.chatModal) {
            this.chatModal.style.display = 'block';
            window.showOverlay(); // Usa la funzione centralizzata
            this.chatMessages.innerHTML = ''; // Pulisci i messaggi precedenti

            // Inizializza una nuova sessione chat
            this.initChatSession();

            // Recupera e visualizza lo stato corrente del pulsante
            this.getUpdateButtonStatus();

            console.log('Modale Chat AI aperto.');
        }
    }

    async close() {
        if (this.chatModal) {
            // Se c'è una trascrizione della chat, salvala
            const chatTranscription = this.chatMessages.innerText.trim();
            if (chatTranscription) {
                await this.saveChatTranscription(chatTranscription);
            }
            this.chatModal.style.display = 'none';
            window.hideOverlay(); // Usa la funzione centralizzata
            this.disconnectWebSocket(); // Disconnetti il WebSocket quando chiudi il modale
            console.log('Modale Chat AI chiuso.');
        }
    }

    _addMessage(sender, message) {
    const messageWrapper = document.createElement('div');
    const messageContent = document.createElement('div');

    messageWrapper.classList.add('message');
    messageContent.classList.add('message-content');

    if (sender === 'ai') {
        messageWrapper.classList.add('ai-message');
        messageContent.innerHTML = message;
    } else if (sender === 'user') {
        messageWrapper.classList.add('user-message');
        messageContent.innerHTML = message;
    } else {
        // Questo blocco è per i messaggi che non sono né 'ai' né 'user',
        // come i messaggi di sistema.
        messageContent.innerHTML = message;
    }

    messageWrapper.appendChild(messageContent); // Aggiungi il contenuto della bolla al wrapper
    this.chatMessages.appendChild(messageWrapper); // Aggiungi il wrapper del messaggio al contenitore della chat
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight; // Scorri in basso
}

    _addSystemMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', 'system', type); // Queste sono le classi attuali
        messageElement.textContent = message; // Usiamo textContent per i messaggi di sistema, come prima
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async initChatSession() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Autenticazione necessaria per la chat.', 'error');
            return;
        }
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                this.currentChatSessionId = data.session_id;
                this._addSystemMessage('Sessione chat avviata. Sono Frank, il tuo assistente AI. Come posso aiutarti oggi?', 'info');
                this.connectWebSocketForChat(this.currentChatSessionId);
            } else {
                this._addSystemMessage(`Errore avvio sessione: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Errore avvio sessione chat:', error);
            this._addSystemMessage(`Errore di rete: ${error.message}`, 'error');
        }
    }

    connectWebSocketForChat(sessionId) {
        if (this.websocket) {
            this.websocket.close();
        }
        const wsProtocol = window.BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
        this.websocket = new WebSocket(`${wsProtocol}://${window.BACKEND_URL.split('://')[1]}/ws/chat/${sessionId}`);

        this.websocket.onopen = () => {
            console.log(`WebSocket Chat connesso per sessione ${sessionId}.`);
            // Se vuoi inviare un messaggio iniziale al backend, fallo qui
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'response') {
                this._addMessage('ai', data.message);
            } else if (data.type === 'error') {
                this._addSystemMessage(`Errore WebSocket: ${data.message}`, 'error');
            }
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket Chat disconnesso:', event.reason);
            this.websocket = null;
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket Chat errore:', error);
            this._addSystemMessage('Errore di connessione alla chat. Riprova.', 'error');
        };
    }

    disconnectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close(1000, "User closed chat modal"); // Codice 1000 per chiusura normale
            this.websocket = null;
        }
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (message && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this._addMessage('user', message);
            this.websocket.send(JSON.stringify({ message: message }));
            this.chatInput.value = '';
        }
    }

    async saveChatTranscription(transcription) {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.warn('Impossibile salvare la trascrizione della chat: token di autenticazione mancante.');
            return;
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/save-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ chatTranscription: transcription })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore sconosciuto nel salvataggio della chat.');
            }

            console.log('Trascrizione chat salvata con successo.');
        } catch (error) {
            console.error('Errore durante il salvataggio della trascrizione della chat:', error);
            // Non mostrare errori all'utente per il salvataggio in background
        }
    }

    async getUpdateButtonStatus() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.warn('Autenticazione necessaria per recuperare lo stato del pulsante di aggiornamento.');
            return;
        }
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/get-status`, { // Endpoint modificato
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.updateAIDbBtn.disabled = !data.knowledge_update_button_enabled;
                this.updateAIDbBtn.querySelector('img').src = data.knowledge_update_button_enabled ? 'img/reload.png' : 'img/loading.gif';
                this.updateAIDbBtn.title = data.knowledge_update_button_enabled ? 'Aggiorna Knowledge Base AI' : 'Aggiornamento in corso...';
            } else {
                console.error('Errore nel recupero dello stato del pulsante:', response.status);
            }
        } catch (error) {
            console.error('Errore di rete nel recupero stato pulsante:', error);
        }
    }

    async updateAIDatabase() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Autenticazione necessaria per aggiornare la Knowledge Base.', 'error');
            return;
        }

        // Recupera i valori da dropdowns o input, se applicabile, per l'aggiornamento
        // Assumo che tu voglia aggiornare l'intero foglio specificato dall'ID globale
        // e i nomi dei fogli. Per questo esempio, li hardcodiamo o li prendiamo da input.
        // Se hai un modo per far scegliere all'utente lo spreadsheet_id e i sheet_names,
        // dovrai recuperarli qui.
        const spreadsheetId = window.GOOGLE_SHEET_ID || 'YOUR_GOOGLE_SHEET_ID_HERE'; // Usa il tuo ID reale
        const sheetNames = 'KnowledgeBase,Riferimento_Commessa,Servizio,Registrazioni,Chat_AI'; // Adatta ai tuoi fogli

        try {
            this._addSystemMessage('Avvio aggiornamento Knowledge Base...', 'info');
            this.updateAIDbBtn.disabled = true; // Disabilita il pulsante
            this.updateAIDbBtn.querySelector('img').src = 'img/loading.gif'; // Immagine di caricamento
            this.updateAIDbBtn.title = 'Aggiornamento in corso...';

            const response = await fetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    spreadsheet_id: spreadsheetId,
                    sheet_names: sheetNames
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore sconosciuto nell\'aggiornamento della Knowledge Base.');
            }

            const result = await response.json();
            const processId = result.process_id; // Ottieni l'ID del processo dal backend

            // *** QUI È IL PUNTO CRITICO ***
            // Apri il modale dei log e connetti il WebSocket usando il processId
            if (window.openKnowledgeLogsModal && window.connectWebSocketForLogs) {
                window.openKnowledgeLogsModal(); // Apre il modale dei log
                window.connectWebSocketForLogs(processId); // Connette il WebSocket al processId
                this._addSystemMessage(`Aggiornamento avviato. ID Processo: ${processId}. Consulta il modale dei log.`, 'success');
                console.log(`Knowledge Base update triggered. Process ID: ${processId}`);
            } else {
                console.error("Funzioni per il modale dei log non disponibili globalmente.");
                this._addSystemMessage('Aggiornamento avviato, ma impossibile aprire il modale dei log. Controlla la console.', 'warning');
            }

        } catch (error) {
            console.error('Errore durante l\'aggiornamento della Knowledge Base:', error);
            this._addSystemMessage(`Errore aggiornamento Knowledge Base: ${error.message}`, 'error');
            // Riabilita il pulsante in caso di errore
            this.updateAIDbBtn.disabled = false;
            this.updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            this.updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    }

    async stopAIProcess() {
        // Implementazione provvisoria: idealmente, si dovrebbe sapere quale process_id fermare
        // Potresti voler memorizzare il process_id dell'ultima operazione di aggiornamento avviata
        // Per ora, useremo un placeholder.
        const processIdToStop = "LAST_KNOWN_PROCESS_ID_IF_STORED"; // Sostituisci con l'ID reale
        if (!processIdToStop || processIdToStop === "LAST_KNOWN_PROCESS_ID_IF_STORED") {
            this._addSystemMessage('Nessun processo attivo della chat da interrompere.', 'info');
            return;
        }

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Autenticazione necessaria per fermare i processi AI.', 'error');
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