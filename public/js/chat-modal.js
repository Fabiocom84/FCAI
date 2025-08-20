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
        
        // Non usiamo più i WebSocket per la chat
        // this.websocket = null; 
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
        // Aggiungi l'event listener per il click sul pulsante "Aggiorna Knowledge Base"
        if (this.updateAIDbBtn) {
            this.updateAIDbBtn.addEventListener('click', () => this.updateAIDatabase());
        }
        if (this.sendMessageBtn) {
            this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        }
        if (this.stopProcessingBtn) {
            this.stopProcessingBtn.addEventListener('click', () => this.stopAIProcess());
        }
        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    // Metodo per aprire il modale
    open() {
        this.chatModal.style.display = 'flex';
        // Inizializza l'interfaccia utente del modale quando viene aperto
        this.resetChatUI();
    }

    // Metodo per chiudere il modale
    async close() {
        // Chiudi il modale
        this.chatModal.style.display = 'none';
        // Salva la trascrizione della chat al momento della chiusura
        await this.saveChatTranscription();
    }

    // Aggiungi un messaggio alla chatbox
    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', `${sender}-message`);
        messageDiv.innerHTML = `<p>${text}</p>`;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // Reimposta l'interfaccia utente della chat
    resetChatUI() {
        this.chatMessages.innerHTML = '';
        this.chatInput.value = '';
    }

    async sendMessage() {
        const userMessage = this.chatInput.value.trim();
        if (userMessage === '') return;

        this.addMessage(userMessage, 'user');
        this.chatInput.value = '';
        
        try {
            const authToken = window.authManagerInstance.getToken(); // Ottieni il token
            const response = await fetch('http://127.0.0.1:8080/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ query: userMessage })
            });

            const data = await response.json();

            if (response.ok) {
                this.addMessage(data.response, 'ai');
            } else {
                this.addMessage(`Errore: ${data.error || 'Risposta non valida dal server'}`, 'ai');
            }
        } catch (error) {
            console.error("Errore durante la comunicazione con l'API:", error);
            this.addMessage("Si è verificato un errore di rete. Riprova più tardi.", 'ai');
        }
    }

    async saveChatTranscription() {
        const chatTranscription = this.chatMessages.innerText;
        if (!chatTranscription) return;

        try {
            const authToken = window.authManagerInstance.getToken(); // Ottieni il token
            const response = await fetch('http://127.0.0.1:8080/api/save-chat-transcription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ chatTranscription: chatTranscription })
            });

            const data = await response.json();

            if (response.ok) {
                console.log("Trascrizione chat salvata con successo:", data.message);
            } else {
                console.error("Errore nel salvataggio della chat:", data.message);
            }
        } catch (error) {
            console.error("Errore di rete durante il salvataggio della chat:", error);
        }
    }

    async updateAIDatabase() {
        const authToken = window.authManagerInstance.getToken(); // Ottieni il token
        
        // Disabilita il pulsante per evitare clic multipli
        this.updateAIDbBtn.disabled = true;
        this.updateAIDbBtn.textContent = 'Aggiornamento in corso...';

        // Mostra un messaggio all'utente per comunicare l'avvio del processo
        this.addMessage('Avvio aggiornamento Knowledge Base...', 'ai');

        try {
            const response = await fetch('http://127.0.0.1:8080/api/trigger-knowledge-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                this.addMessage(`Aggiornamento avviato. ID Processo: ${data.process_id}.`, 'ai');
            } else {
                this.addMessage(`Errore di aggiornamento: ${data.message}`, 'ai');
            }

        } catch (error) {
            this.addMessage('Errore di rete: Impossibile avviare l\'aggiornamento.', 'ai');
            console.error("Errore di rete durante l'aggiornamento della Knowledge Base:", error);
        } finally {
            // Abilita il pulsante dopo la richiesta
            this.updateAIDbBtn.disabled = false;
            this.updateAIDbBtn.textContent = 'Aggiorna Knowledge Base';
        }
    }

    // Metodo mock per fermare il processo AI (non usato attualmente)
    stopAIProcess() {
        console.log("Processo AI interrotto.");
        this.addMessage("Processo AI interrotto.", 'ai');
        // Logica per fermare il processo, se implementata nel backend
    }

    // Metodo mock per la sintesi vocale (non usato attualmente)
    async synthesizeAndPlaySpeech(text) {
        console.log("Sintesi vocale del testo:", text);
    }
}

// Inizializza il modale Chat AI quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente per main.js
    window.chatModalInstance = new ChatModal('chatModal', '#openChatModalBtn');
});