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
    
    // *** NUOVO: Salva la cronologia della chat alla chiusura ***
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
                // Aggiungi l'autenticazione se necessaria
                // 'Authorization': `Bearer ${getAuthToken()}`
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
        // Potresti mostrare un piccolo messaggio di errore non invasivo
    }
}


// Funzione per aggiungere un messaggio alla chat UI
function addMessage(sender, text, audioBase64 = null) {
    const messageElement = document.createElement('div');
    // La classe ora è 'chat-message' più il ruolo 'user' o 'ai' per lo stile
    messageElement.classList.add('chat-message', sender);
    
    if (text) {
        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');
        messageContentDiv.textContent = text;
        messageElement.appendChild(messageContentDiv);
    }
    
    // Il resto della funzione per la gestione dell'audio rimane invariato...
    if (audioBase64) {
        const audio = new Audio();
        audio.src = `data:audio/mpeg;base64,${audioBase64}`;
        audio.controls = true;
        audio.autoplay = true;
        
        const audioContainer = document.createElement('div');
        audioContainer.classList.add('audio-playback');
        audioContainer.appendChild(audio);
        messageElement.appendChild(audioContainer);

        audio.onended = () => console.log("Riproduzione audio completata.");
        audio.onerror = (e) => console.error("Errore durante la riproduzione audio:", e);
    }

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // *** NUOVO: Aggiungi il messaggio alla cronologia interna ***
    // (L'AI aggiungerà il suo messaggio completo solo alla fine dello streaming)
    if (sender === 'user') {
        chatHistory.push({ role: 'user', content: text });
    }
    
    return messageElement; // Ritorna l'elemento per aggiornamenti futuri (streaming)
}


// *** NUOVO: Funzione di invio messaggio completamente riscritta per lo streaming ***
async function sendChatMessage(messageText) {
    if (!messageText.trim()) return;

    addMessage('user', messageText);
    chatInput.value = '';
    
    // Disabilita i controlli e mostra l'indicatore di digitazione
    sendChatMessageBtn.disabled = true;
    startChatRecordingBtn.disabled = true;
    typingIndicator.style.display = 'flex';

    let aiMessageElement;
    let fullResponseText = '';
    
    try {
        const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory }), // Invia l'intera cronologia
        });

        if (!response.ok) {
            throw new Error(`Errore del server: ${response.status}`);
        }

        typingIndicator.style.display = 'none'; // Nascondi i puntini al primo chunk

        // Crea subito il contenitore del messaggio AI, che verrà riempito in streaming
        aiMessageElement = addMessage('ai', '...');
        const aiContentDiv = aiMessageElement.querySelector('.message-content');
        aiContentDiv.textContent = ''; // Svuota i "..." iniziali

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);

            // Gestione del protocollo personalizzato: audio inviato alla fine
            if (chunk.includes('--AUDIO--')) {
                const parts = chunk.split('--AUDIO--');
                fullResponseText += parts[0];
                aiContentDiv.textContent = fullResponseText;

                const audioData = JSON.parse(parts[1]);
                if (audioData.audio) {
                    addMessage('ai', null, audioData.audio); // Aggiunge solo il player audio
                }
                break; // Lo stream è terminato
            } else {
                fullResponseText += chunk;
                aiContentDiv.textContent = fullResponseText;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
        
        // Aggiungi la risposta completa dell'AI alla cronologia
        chatHistory.push({ role: 'assistant', content: fullResponseText });

    } catch (error) {
        console.error("Errore nell'invio del messaggio alla chat AI:", error);
        if (aiMessageElement) {
            aiMessageElement.querySelector('.message-content').textContent = `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`;
        } else {
            addMessage('ai', `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`);
        }
    } finally {
        // Riabilita sempre i controlli
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