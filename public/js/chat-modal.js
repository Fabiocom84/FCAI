// js/chat-modal.js

class ChatModal {
    constructor(modalId, openButtonSelector) {
        this.chatModal = document.getElementById(modalId);
        this.openButton = document.querySelector(openButtonSelector);
        this.closeButton = this.chatModal ? this.chatModal.querySelector('.close-button') : null;
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.updateAIDbBtn = document.getElementById('updateAIDbBtn');
        this.stopProcessingBtn = document.getElementById('stopProcessingBtn');

        this.websocket = null;
        this.currentChatSessionId = null;

        this.addEventListeners();
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', async () => {
                await this.close();
            });
        }
        if (this.sendMessageBtn) {
            this.sendMessageBtn.addEventListener('click', this.sendMessage.bind(this));
        }
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.sendMessage();
                }
            });
        }
        if (this.stopProcessingBtn) {
            this.stopProcessingBtn.addEventListener('click', this.stopAIProcess.bind(this));
        }
        // Aggiunto il listener per il pulsante di aggiornamento
        if (this.updateAIDbBtn) {
            this.updateAIDbBtn.addEventListener('click', this.updateAIDatabase.bind(this));
        }
    }

    open() {
        if (this.chatModal) {
            this.chatModal.style.display = 'block';
            window.showOverlay();
            this.chatMessages.innerHTML = '';

            this.initChatSession();

            this.getUpdateButtonStatus();

            console.log('Modale Chat AI aperto.');
        }
    }

    async close() {
        if (this.chatModal) {
            const chatTranscription = this.chatMessages.innerText.trim();
            if (chatTranscription) {
                await this.saveChatTranscription(chatTranscription);
            }
            this.chatModal.style.display = 'none';
            window.hideOverlay();
            this.disconnectWebSocket();
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
            messageContent.innerHTML = `<strong>Fabio:</strong> ${message}`;
        } else {
            messageContent.innerHTML = message;
        }

        messageWrapper.appendChild(messageContent);
        this.chatMessages.appendChild(messageWrapper);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    _addSystemMessage(message, type = 'info') {
        const messageWrapper = document.createElement('div');
        const messageContent = document.createElement('div');

        messageWrapper.classList.add('message', 'system-message');
        messageContent.classList.add('message-content');
        messageContent.textContent = message;

        if (type === 'error') {
            messageWrapper.classList.add('error');
        } else if (type === 'info') {
            messageWrapper.classList.add('info');
        } else if (type === 'success') {
            messageWrapper.classList.add('success');
        }

        messageWrapper.appendChild(messageContent);
        this.chatMessages.appendChild(messageWrapper);
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
                this._addMessage('ai', 'Sono Frank, il tuo assistente AI. Come posso aiutarti oggi?');
                // La connessione WebSocket per la chat non è stata rimossa,
                // poiché è essenziale per le risposte AI in streaming.
                // Viene rimossa solo la logica dei log di aggiornamento.
                this.connectWebSocketForChat(this.currentChatSessionId);
            } else {
                this._addSystemMessage(`Errore avvio sessione: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Errore avvio sessione chat:', error);
            this._addSystemMessage(`Errore di rete: ${error.message}`, 'error');
        }
    }

    async sendMessage() {
        // Logica per inviare i messaggi della chat
    }

    async saveChatTranscription(transcription) {
        // Logica per salvare la trascrizione della chat
    }

    async getUpdateButtonStatus() {
        // Logica per recuperare lo stato del pulsante
    }

    async updateAIDatabase() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            this._addSystemMessage('Autenticazione necessaria per aggiornare la Knowledge Base.', 'error');
            return;
        }

        const spreadsheetId = window.GOOGLE_SHEET_ID || '1XQJ0Py2aACDtcOnc7Mi2orqaKWbNpZbpp9lAnIm1kv8';
        const sheetNames = 'Registrazioni,Chat_AI,Riferimento_Commessa';

        try {
            this._addSystemMessage('Avvio aggiornamento Knowledge Base...', 'info');
            this.updateAIDbBtn.disabled = true;
            this.updateAIDbBtn.querySelector('img').src = 'img/loading.png';
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
            const processId = result.process_id;

            // Logica semplificata: notifica l'utente senza WebSocket
            this._addSystemMessage(`Aggiornamento avviato. ID Processo: ${processId}.`, 'success');
            console.log(`Knowledge Base update triggered. Process ID: ${processId}`);

        } catch (error) {
            console.error('Errore durante l\'aggiornamento della Knowledge Base:', error);
            this._addSystemMessage(`Errore aggiornamento Knowledge Base: ${error.message}`, 'error');
        } finally {
            // Riabilita il pulsante a prescindere dall'esito
            this.updateAIDbBtn.disabled = false;
            this.updateAIDbBtn.querySelector('img').src = 'img/reload.png';
            this.updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
        }
    }

    async stopAIProcess() {
        // Logica per fermare il processo AI
    }
    
    async synthesizeAndPlaySpeech(text) {
        // Logica per la sintesi vocale
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chatModalInstance = new ChatModal('chatModal', '#openChatModalBtn');
});