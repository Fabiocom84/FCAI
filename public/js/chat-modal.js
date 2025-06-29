// js/chat-modal.js

// Elementi DOM
const chatModal = document.getElementById('chatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const openChatModalBtn = document.getElementById('openChatModalBtn');
const startChatRecordingBtn = document.getElementById('startChatRecording');
const sendChatMessageBtn = document.getElementById('sendChatMessage');
const modalOverlay = document.getElementById('modalOverlay');

// Setup del riconoscimento vocale
let recognition;
let isRecording = false;
let currentTranscription = ''; // Per la trascrizione continua

// Funzione per aprire il modale della chat
function openChatModal() {
    chatModal.style.display = 'flex'; // Usiamo flex per centrare il contenuto del modale
    modalOverlay.style.display = 'block';
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scorri in fondo ai messaggi esistenti
}

// Funzione per chiudere il modale della chat e salvare il contenuto
async function closeChatModal() {
    chatModal.style.display = 'none';
    modalOverlay.style.display = 'none';
    
    // Ferma la registrazione se attiva
    if (isRecording && recognition) {
        recognition.stop();
        isRecording = false;
        startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
        startChatRecordingBtn.classList.remove('recording-active');
    }

    // Raccogli tutti i messaggi della chat
    let chatTranscript = "";
    const messages = chatMessages.querySelectorAll('.message-content');
    messages.forEach(msg => {
        const senderClass = msg.closest('.message').classList.contains('user-message') ? 'Utente' : 'AI';
        chatTranscript += `${senderClass}: ${msg.innerText}\n`;
    });

    console.log("Saving chat transcript:", chatTranscript);

    // Chiama il backend per salvare la chat
    try {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            console.error('No authentication token found. Cannot save chat.');
            alert('Errore: sessione scaduta o non autenticata. Effettua nuovamente il login.');
            window.location.href = '/login.html'; // Reindirizza al login
            return;
        }

        // Assumi che API_BASE_URL sia definito in config.js
        const response = await fetch(`${API_BASE_URL}/save_chat_transcript`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ transcript: chatTranscript })
        });

        if (response.ok) {
            console.log('Chat transcript saved successfully!');
            // Opzionalmente, svuota i messaggi della chat dopo il salvataggio
            // chatMessages.innerHTML = '';
        } else {
            const errorData = await response.json();
            console.error('Failed to save chat transcript:', errorData.message);
            alert(`Errore nel salvataggio della chat: ${errorData.message || response.statusText}`);
        }
    } catch (error) {
        console.error('Network error while saving chat transcript:', error);
        alert('Errore di rete durante il salvataggio della chat. Controlla la connessione.');
    }
}

// Modifica la funzione addMessage per accettare un ID opzionale
function addMessage(sender, text, id = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
    if (id) {
        messageDiv.id = id; // Assegna l'ID se fornito
    }

    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');
    messageContentDiv.innerText = text;

    // Se l'AI è "Frank", il prefisso "Frank:" è già gestito dal CSS ::before.
    // Non aggiungiamo qui il prefisso per evitare duplicazioni.

    messageDiv.appendChild(messageContentDiv);
    chatMessages.appendChild(messageDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Event Listener per l'apertura del modale
openChatModalBtn.addEventListener('click', (event) => {
    event.preventDefault();
    openChatModal();
});

// Event Listener per l'invio del messaggio di testo
sendChatMessageBtn.addEventListener('click', async () => {
    const messageText = chatInput.value.trim();
    if (messageText) {
        addMessage('user', messageText);
        chatInput.value = ''; // Pulisci l'input

        console.log("Sending to AI:", messageText);

        // Aggiungi un messaggio "Frank sta scrivendo..."
        const typingMessageId = 'typing-' + Date.now(); // ID univoco per il messaggio
        addMessage('ai', 'Frank sta scrivendo...', typingMessageId); // Aggiungi con un ID per poterlo rimuovere/modificare

        // Simula un ritardo per la risposta dell'AI
        await new Promise(resolve => setTimeout(resolve, 1500)); // Ritardo di 1.5 secondi

        // Rimuovi il messaggio "Frank sta scrivendo..."
        const typingMessageDiv = document.getElementById(typingMessageId);
        if (typingMessageDiv) {
            chatMessages.removeChild(typingMessageDiv);
        }

        // TODO: Qui andrà la chiamata al backend per ottenere la vera risposta di Frank.
        // Per ora, non aggiungiamo nessuna risposta temporanea dopo "Frank sta scrivendo...".
        // La risposta vocale (se l'input era vocale) verrà gestita qui in futuro.
    }
});

// Permetti l'invio con Enter (e Shift+Enter per nuova riga)
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessageBtn.click();
    }
});

// Implementazione del Riconoscimento Vocale
startChatRecordingBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Spiacente, il riconoscimento vocale non è supportato dal tuo browser. Prova Chrome.");
        return;
    }

    if (!isRecording) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Per trascrizione continua
        recognition.interimResults = true; // Ottieni risultati intermedi
        recognition.lang = 'it-IT'; // Imposta la lingua in italiano
        
        currentTranscription = ''; // Resetta la trascrizione corrente

        recognition.onstart = () => {
            isRecording = true;
            startChatRecordingBtn.innerHTML = '<img src="img/stop.png" alt="Ferma Registrazione">';
            startChatRecordingBtn.classList.add('recording-active');
            console.log('Registrazione vocale avviata per la chat...');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    currentTranscription += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            chatInput.value = currentTranscription + interimTranscript; // Mostra trascrizione (finale + intermedia)
        };

        recognition.onerror = (event) => {
            console.error('Errore riconoscimento vocale:', event.error);
            if (event.error === 'no-speech') {
                // addMessage('ai', 'Nessun suono rilevato. Riprova.'); // Se necessario
            } else if (event.error === 'not-allowed') {
                alert('Permesso per il microfono negato. Abilitalo nelle impostazioni del browser.');
            } else {
                addMessage('ai', 'Errore nella registrazione vocale: ' + event.error);
            }
            isRecording = false; // Ferma lo stato di registrazione
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
        };

        recognition.onend = () => {
            console.log('Registrazione vocale terminata per la chat.');
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
            // Se c'è una trascrizione finale da inviare
            if (currentTranscription.trim() !== '') {
                chatInput.value = currentTranscription; // Assicurati che l'input abbia la trascrizione finale
                sendChatMessageBtn.click(); // Invia automaticamente il testo trascritto
                currentTranscription = ''; // Resetta per la prossima registrazione
            }
        };

        recognition.start();
    } else {
        // Ferma la registrazione
        recognition.stop();
        // onend gestirà il resto
    }
});

// Rende closeChatModal accessibile globalmente per onclick in HTML
window.closeChatModal = closeChatModal;

// Scorri in fondo ai messaggi all'avvio della pagina (se ce ne sono)
document.addEventListener('DOMContentLoaded', () => {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// Implementazione del Riconoscimento Vocale
startChatRecordingBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Spiacente, il riconoscimento vocale non è supportato dal tuo browser. Prova Chrome.");
        return;
    }

    if (!isRecording) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Per trascrizione continua
        recognition.interimResults = true; // Ottieni risultati intermedi
        recognition.lang = 'it-IT'; // Imposta la lingua in italiano
        
        currentTranscription = ''; // Resetta la trascrizione corrente

        recognition.onstart = () => {
            isRecording = true;
            startChatRecordingBtn.innerHTML = '<img src="img/stop.png" alt="Ferma Registrazione">';
            startChatRecordingBtn.classList.add('recording-active');
            console.log('Registrazione vocale avviata per la chat...');
            // addMessage('ai', 'Registrazione vocale avviata...'); // Potrebbe essere troppo invadente
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    currentTranscription += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            chatInput.value = currentTranscription + interimTranscript; // Mostra trascrizione (finale + intermedia)
        };

        recognition.onerror = (event) => {
            console.error('Errore riconoscimento vocale:', event.error);
            if (event.error === 'no-speech') {
                // addMessage('ai', 'Nessun suono rilevato. Riprova.'); // Se necessario
            } else if (event.error === 'not-allowed') {
                alert('Permesso per il microfono negato. Abilitalo nelle impostazioni del browser.');
            } else {
                addMessage('ai', 'Errore nella registrazione vocale: ' + event.error);
            }
            isRecording = false; // Ferma lo stato di registrazione
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
        };

        recognition.onend = () => {
            console.log('Registrazione vocale terminata per la chat.');
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
            // Se c'è una trascrizione finale da inviare
            if (currentTranscription.trim() !== '') {
                chatInput.value = currentTranscription; // Assicurati che l'input abbia la trascrizione finale
                sendChatMessageBtn.click(); // Invia automaticamente il testo trascritto
                currentTranscription = ''; // Resetta per la prossima registrazione
            }
        };

        recognition.start();
    } else {
        // Ferma la registrazione
        recognition.stop();
        // onend gestirà il resto
    }
});

// Rende closeChatModal accessibile globalmente per onclick in HTML
window.closeChatModal = closeChatModal;

// Scorri in fondo ai messaggi all'avvio della pagina (se ce ne sono)
document.addEventListener('DOMContentLoaded', () => {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});