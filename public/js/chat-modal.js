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
        aiMessageElement = addMessage('ai', '');
        const aiContentDiv = aiMessageElement.querySelector('.message-content');

        // --- INIZIO NUOVA LOGICA SEMPLIFICATA ---

        // 1. Attendiamo e leggiamo l'INTERA risposta come testo.
        // Questo elimina il ciclo 'while' e i problemi di streaming frammentato.
        const fullResponseData = await response.text();

        // 2. Ora che abbiamo la stringa completa, la processiamo in sicurezza.
        let fullResponseText = '';
        let audioData = null;

        if (fullResponseData.includes('--AUDIO--')) {
            const parts = fullResponseData.split('--AUDIO--', 2); // Dividi in massimo 2 parti
            fullResponseText = parts[0];
            const jsonPart = parts[1];

            if (jsonPart) {
                try {
                    audioData = JSON.parse(jsonPart);
                } catch (e) {
                    console.error("Errore nel parsing del JSON audio:", e);
                    fullResponseText += `\n(Errore nella ricezione dei dati audio)`;
                }
            }
        } else {
            // Se non c'è il delimitatore, la risposta è solo testo.
            fullResponseText = fullResponseData;
        }

        // 3. Aggiorniamo l'interfaccia una sola volta con il contenuto finale.
        aiContentDiv.textContent = fullResponseText;

        if (audioData && audioData.audio) {
            const audio = new Audio(`data:audio/mpeg;base64,${audioData.audio}`);
            audio.controls = true;
            audio.autoplay = true;

            const audioContainer = document.createElement('div');
            audioContainer.classList.add('audio-playback');
            audioContainer.appendChild(audio);
            aiMessageElement.appendChild(audioContainer);
        }

        if (fullResponseText.trim()) {
            chatHistory.push({ role: 'assistant', content: fullResponseText.trim() });
        }

        // --- FINE NUOVA LOGICA SEMPLIFICATA ---

    } catch (error) {
        console.error("Errore nell'invio del messaggio alla chat AI:", error);
        const errorText = `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`;
        if (aiMessageElement) {
            aiMessageElement.querySelector('.message-content').textContent = errorText;
        } else {
            addMessage('ai', errorText);
        }
    } finally {
        // Questo blocco verrà ora raggiunto in modo affidabile
        sendChatMessageBtn.disabled = false;
        startChatRecordingBtn.disabled = false;
        chatInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

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