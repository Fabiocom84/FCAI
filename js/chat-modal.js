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
const modalOverlay = document.getElementById('modalOverlay'); // Recuperato anche overlay

// --- 2. STATO DELLA CHAT E RICONOSCIMENTO VOCALE ---
let recognition;
let isRecording = false;
let currentTranscription = '';
let chatHistory = [];

// --- 3. FUNZIONI PRINCIPALI ---

// Funzione per aprire il modale della chat
// (Esportiamo la funzione se serve chiamarla da altri file, o la lasciamo globale)
window.openChatModal = function() {
    if(chatModal) chatModal.style.display = 'flex';
    if(modalOverlay) modalOverlay.style.display = 'block';
    if(chatInput) chatInput.focus();
    
    chatHistory = [];
    if(chatMessages) {
        chatMessages.innerHTML = ''; 
        addMessage('ai', 'Ciao! Sono Frank, il tuo assistente. Come posso aiutarti oggi?');
    }
};

// Funzione per chiudere il modale
window.closeChatModal = async function() {
    if(chatModal) chatModal.style.display = 'none';
    if(modalOverlay) modalOverlay.style.display = 'none';

    if (isRecording && recognition) {
        recognition.stop();
    }
    
    if (chatHistory.length > 1) {
        await saveChatHistory();
    }
};

// Funzione per salvare la cronologia
async function saveChatHistory() {
    if (chatHistory.length <= 1) return;

    const chatTranscription = chatHistory.map(msg => `${msg.role === 'user' ? 'Utente' : 'Frank'}: ${msg.content}`).join('\n\n');
    
    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/save-chat`, {
            method: 'POST',
            body: JSON.stringify({ chatTranscription: chatTranscription })
        });
        if (!response.ok) throw new Error(`Errore server: ${response.status}`);
    } catch (error) {
        if (error.message !== "Unauthorized") console.error("Errore salvataggio chat:", error);
    }
}

// Funzione per aggiungere messaggio UI
function addMessage(sender, text) {
    if(!chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');
    if (text) messageContentDiv.textContent = text;
    
    messageElement.appendChild(messageContentDiv);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (sender === 'user') {
        chatHistory.push({ role: 'user', content: text });
    }
    return messageElement;
}

// Funzione di invio messaggio
async function sendChatMessage(messageText) {
    if (!messageText.trim()) return;

    addMessage('user', messageText);
    if(chatInput) chatInput.value = '';
    
    if(sendChatMessageBtn) sendChatMessageBtn.disabled = true;
    if(startChatRecordingBtn) startChatRecordingBtn.disabled = true;
    if(typingIndicator) typingIndicator.style.display = 'flex';

    let aiMessageElement;
    
    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            body: JSON.stringify({ history: chatHistory }),
        });

        if (!response.ok) throw new Error(`Errore: ${response.status}`);

        if(typingIndicator) typingIndicator.style.display = 'none';
        aiMessageElement = addMessage('ai', ''); 
        const aiContentDiv = aiMessageElement.querySelector('.message-content');

        const fullResponseData = await response.text();
        let fullResponseText = fullResponseData;
        let audioData = null;

        if (fullResponseData.includes('--AUDIO--')) {
            const parts = fullResponseData.split('--AUDIO--', 2);
            fullResponseText = parts[0];
            try { audioData = JSON.parse(parts[1]); } catch (e) { console.error(e); }
        }

        aiContentDiv.textContent = fullResponseText;

        if (audioData && audioData.audio) {
            const audio = new Audio(`data:audio/mpeg;base64,${audioData.audio}`);
            audio.controls = true;
            audio.autoplay = true;
            const ac = document.createElement('div');
            ac.classList.add('audio-playback');
            ac.appendChild(audio);
            aiMessageElement.appendChild(ac);
        }

        if (fullResponseText.trim()) {
            chatHistory.push({ role: 'assistant', content: fullResponseText.trim() });
        }

    } catch (error) {
        if (error.message !== "Unauthorized") {
            const errorText = `Errore: ${error.message}.`;
            if (aiMessageElement) aiMessageElement.querySelector('.message-content').textContent = errorText;
            else addMessage('ai', errorText);
        }
    } finally {
        if(sendChatMessageBtn) sendChatMessageBtn.disabled = false;
        if(startChatRecordingBtn) startChatRecordingBtn.disabled = false;
        if(chatInput) chatInput.focus();
        if(chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- 4. EVENT LISTENERS (PROTETTI) ---

// Inizializza solo se gli elementi esistono nella pagina corrente
if (sendChatMessageBtn && chatInput) {
    sendChatMessageBtn.addEventListener('click', () => {
        sendChatMessage(chatInput.value);
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage(chatInput.value);
        }
    });
}

if (startChatRecordingBtn) {
    startChatRecordingBtn.addEventListener('click', () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Riconoscimento vocale non supportato.");
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
                if(chatStatus) chatStatus.textContent = "Parla ora...";
            };

            recognition.onresult = (event) => {
                currentTranscription = event.results[0][0].transcript;
                if(chatInput) chatInput.value = currentTranscription;
            };

            recognition.onerror = (event) => {
                if(chatStatus) chatStatus.textContent = `Errore: ${event.error}`;
                resetRecBtn();
            };

            recognition.onend = () => {
                resetRecBtn();
                if(chatStatus) chatStatus.textContent = "";
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
}

function resetRecBtn() {
    isRecording = false;
    if(startChatRecordingBtn) {
        startChatRecordingBtn.innerHTML = '<img src="img/voice.png" alt="Registra">';
        startChatRecordingBtn.classList.remove('recording-active');
    }
}

// Scroll all'avvio solo se esiste la chat
document.addEventListener('DOMContentLoaded', () => {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    // Se siamo su chat.html, avvia il messaggio di benvenuto
    if (window.location.pathname.includes('chat.html') && chatMessages) {
         addMessage('ai', 'Ciao! Sono Frank. Come posso aiutarti?');
    }
});