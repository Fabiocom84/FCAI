// js/chat-modal.js

import { API_BASE_URL } from './config.js';

// --- 1. ELEMENTI DOM ---
const chatModal = document.getElementById('chatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const startChatRecordingBtn = document.getElementById('startChatRecording');
const sendChatMessageBtn = document.getElementById('sendChatMessage');
const chatStatus = document.getElementById('chatStatus');
const typingIndicator = document.querySelector('.typing-indicator');

// --- 2. STATO DELLA CHAT E RICONOSCIMENTO VOCALE ---
let recognition;
let isRecording = false;
let currentTranscription = '';
let chatHistory = [];

// --- 3. FUNZIONI PRINCIPALI DEL MODALE ---

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

    if (isRecording && recognition) {
        recognition.stop();
    }
    
    if (chatHistory.length > 1) {
        await saveChatHistory();
    }
}

// Funzione per salvare la cronologia della chat
async function saveChatHistory() {
    if (chatHistory.length <= 1) return;

    const chatTranscription = chatHistory.map(msg => `${msg.role === 'user' ? 'Utente' : 'Frank'}: ${msg.content}`).join('\n\n');
    
    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/save-chat`, {
            method: 'POST',
            body: JSON.stringify({ chatTranscription: chatTranscription })
        });
        
        if (!response.ok) throw new Error(`Errore del server: ${response.status}`);
        
        const result = await response.json();
        console.log("Chat salvata:", result.message);
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error("Errore nel salvataggio della chat:", error);
        }
    }
}

// Funzione per aggiungere un messaggio alla chat UI
function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
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
    
    return messageElement;
}

// Funzione di invio messaggio (versione robusta e semplificata)
async function sendChatMessage(messageText) {
    if (!messageText.trim()) return;

    addMessage('user', messageText);
    chatInput.value = '';
    
    sendChatMessageBtn.disabled = true;
    startChatRecordingBtn.disabled = true;
    typingIndicator.style.display = 'flex';

    let aiMessageElement;
    
    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            body: JSON.stringify({ history: chatHistory }),
        });

        if (!response.ok) {
            throw new Error(`Errore del server: ${response.status}`);
        }

        typingIndicator.style.display = 'none';
        aiMessageElement = addMessage('ai', ''); // Crea un messaggio AI vuoto
        const aiContentDiv = aiMessageElement.querySelector('.message-content');

        const fullResponseData = await response.text();
        let fullResponseText = '';
        let audioData = null;

        if (fullResponseData.includes('--AUDIO--')) {
            const parts = fullResponseData.split('--AUDIO--', 2);
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
            fullResponseText = fullResponseData;
        }

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

    } catch (error) {
        // --- BLOCCO CATCH CORRETTO ---
        if (error.message !== "Unauthorized") {
            console.error("Errore nell'invio del messaggio alla chat AI:", error);
            const errorText = `Mi dispiace, si è verificato un errore: ${error.message}. Riprova più tardi.`;
            if (aiMessageElement) {
                aiMessageElement.querySelector('.message-content').textContent = errorText;
            } else {
                addMessage('ai', errorText);
            }
        }
    } finally {
        // --- BLOCCO FINALLY CORRETTO ---
        sendChatMessageBtn.disabled = false;
        startChatRecordingBtn.disabled = false;
        chatInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- 4. EVENT LISTENERS ---

// Listener per il pulsante di invio
sendChatMessageBtn.addEventListener('click', () => {
    sendChatMessage(chatInput.value);
});

// Listener per il tasto Invio nell'area di testo
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
    }
});

// Listener e logica per il riconoscimento vocale
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
            startChatRecordingBtn.innerHTML = '<img src="img/voice.png" alt="Registra">';
            startChatRecordingBtn.classList.remove('recording-active');
        };

        recognition.onend = () => {
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/voice.png" alt="Registra">';
            startChatRecordingBtn.classList.remove('recording-active');
            chatStatus.textContent = "";
            
            if (currentTranscription.trim() !== '') {
                sendChatMessage(currentTranscription);
                currentTranscription = '';
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