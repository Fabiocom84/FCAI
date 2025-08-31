// js/chat-modal.js

// Elementi DOM
const chatModal = document.getElementById('chatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const startChatRecordingBtn = document.getElementById('startChatRecording');
const sendChatMessageBtn = document.getElementById('sendChatMessage');
const chatStatus = document.getElementById('chatStatus');
const typingIndicator = document.querySelector('.typing-indicator'); // Seleziona il nuovo indicatore

// Setup del riconoscimento vocale
let recognition;
let isRecording = false;
let currentTranscription = '';

// *** NUOVO: Array per la cronologia della chat ***
let chatHistory = [];

// Funzione per aprire il modale della chat
function openChatModal() {
    chatModal.style.display = 'flex';
    modalOverlay.style.display = 'block';
    chatInput.focus();
    // Pulisci la cronologia e l'interfaccia all'apertura per una nuova sessione
    chatHistory = [];
    chatMessages.innerHTML = ''; 
    addMessage('ai', 'Ciao! Sono Frank, il tuo assistente. Come posso aiutarti oggi?');
}

// Funzione per chiudere il modale della chat
async function closeChatModal() {
    chatModal.style.display = 'none';
    modalOverlay.style.display = 'none';

    // Ferma la registrazione se attiva
    if (isRecording && recognition) {
        recognition.stop();
    }
    
    // Salva la cronologia della chat alla chiusura
    if (chatHistory.length > 1) { // Salva solo se c'è stata una conversazione
        await saveChatHistory();
    }
}

// Funzione per salvare la cronologia della chat
async function saveChatHistory() {
    console.log("Salvataggio della cronologia della chat...");
    const chatTranscription = chatHistory.map(msg => `${msg.role === 'user' ? 'Utente' : 'Frank'}: ${msg.content}`).join('\n\n');

    try {
        const response = await fetch(`${window.BACKEND_URL}/save-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ chatTranscription: chatTranscription })
        });

        if (!response.ok) {
            throw new Error(`Errore del server durante il salvataggio: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("Chat salvata con successo:", result.message);

    } catch (error) {
        console.error("Errore nel salvataggio della chat:", error);
    }
}

// Funzione per aggiungere un messaggio alla chat UI
function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    // Crea sempre il contenitore per il testo, anche se vuoto, per consistenza
    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');
    if (text) {
        messageContentDiv.textContent = text;
    }
    messageElement.appendChild(messageContentDiv);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (sender === 'user') {
        chatHistory.push({ role: 'user', content: text });
    }
    
    return messageElement; // Ritorna l'elemento per aggiornamenti futuri
}

// Funzione di invio messaggio riscritta per lo streaming
async function sendChatMessage(messageText) {
    if (!messageText.trim()) return;

    addMessage('user', messageText);
    chatInput.value = '';
    
    sendChatMessageBtn.disabled = true;
    startChatRecordingBtn.disabled = true;
    typingIndicator.style.display = 'flex';

    let aiMessageElement;
    let fullResponseText = '';
    
    try {
        const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory }),
        });

        if (!response.ok) {
            throw new Error(`Errore del server: ${response.status}`);
        }

        typingIndicator.style.display = 'none';

        aiMessageElement = addMessage('ai', ''); // Crea un messaggio AI vuoto
        const aiContentDiv = aiMessageElement.querySelector('.message-content');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });

            if (chunk.includes('--AUDIO--')) {
                const parts = chunk.split('--AUDIO--');
                fullResponseText += parts[0];
                aiContentDiv.textContent = fullResponseText;

                const audioData = JSON.parse(parts[1]);
                if (audioData.audio) {
                    // --- INIZIO DELLA CORREZIONE ---
                    // Non chiamare addMessage di nuovo. Aggiungi l'audio all'elemento esistente.
                    const audio = new Audio();
                    audio.src = `data:audio/mpeg;base64,${audioData.audio}`;
                    audio.controls = true;
                    audio.autoplay = true;

                    const audioContainer = document.createElement('div');
                    audioContainer.classList.add('audio-playback');
                    audioContainer.appendChild(audio);

                    // Aggiungi il player audio allo stesso elemento del messaggio
                    aiMessageElement.appendChild(audioContainer);
                    // --- FINE DELLA CORREZIONE ---
                }
                break; 
            } else {
                fullResponseText += chunk;
                aiContentDiv.textContent = fullResponseText;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
        
        if (fullResponseText) {
            chatHistory.push({ role: 'assistant', content: fullResponseText });
        }

    } catch (error) {
        console.error("Errore nell'invio del messaggio alla chat AI:", error);
        const errorText = `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`;
        if (aiMessageElement) {
            aiMessageElement.querySelector('.message-content').textContent = errorText;
        } else {
            addMessage('ai', errorText);
        }
    } finally {
        sendChatMessageBtn.disabled = false;
        startChatRecordingBtn.disabled = false;
        chatInput.focus();
    }
}

// Event listener (rimangono per lo più invariati)
sendChatMessageBtn.addEventListener('click', () => sendChatMessage(chatInput.value));

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
    }
});

// Logica per il riconoscimento vocale (invariata)
startChatRecordingBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Spiacente, il riconoscimento vocale non è supportato. Prova Chrome.");
        return;
    }

    if (!isRecording) {
        recognition = new webkitSpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isRecording = true;
            startChatRecordingBtn.innerHTML = '<img src="img/stop.png" alt="Ferma">';
            startChatRecordingBtn.classList.add('recording-active');
            chatStatus.textContent = "Registrazione in corso...";
        };

        recognition.onresult = (event) => {
            currentTranscription = event.results[0][0].transcript;
            chatInput.value = currentTranscription;
        };

        recognition.onerror = (event) => {
            chatStatus.textContent = `Errore registrazione: ${event.error}`;
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra">';
            startChatRecordingBtn.classList.remove('recording-active');
        };

        recognition.onend = () => {
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra">';
            startChatRecordingBtn.classList.remove('recording-active');
            chatStatus.textContent = "";
            
            if (currentTranscription.trim() !== '') {
                sendChatMessage(currentTranscription);
                currentTranscription = '';
            } else {
                chatStatus.textContent = "Nessuna voce rilevata.";
            }
        };

        recognition.start();
    } else {
        recognition.stop();
    }
});

// Scorri in fondo all'avvio
document.addEventListener('DOMContentLoaded', () => {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});