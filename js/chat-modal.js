// js/chat-modal.js

import { API_BASE_URL } from './config.js';
import { apiFetch } from './api-client.js';

// --- 1. ELEMENTI DOM ---
const chatModal = document.getElementById('chatPanel'); // Renamed from chatModal
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

// ⚠ QUESTA FUNZIONE E `closeChatModal` NON SONO RAGGIUNGIBILI — 10/09/2026.
//
// Erano su `window` e sono state rese locali col task 4.9, ma erano gia' morte
// prima: nessuno le chiama, ne' qui, ne' da un altro modulo, ne' da un attributo
// `onclick` (verificato su tutti i 21 file). `chat.html` non apre un modale —
// ha un `<div id="chatPanel">` che fa parte della pagina.
//
// NON sono state cancellate perche' `closeChatModal` descrive cosa dovrebbe
// succedere alla chiusura: fermare il riconoscimento vocale e salvare la
// cronologia. Il salvataggio pero' avviene per un'altra via, dal pulsante Home
// in fondo a questo file — quindi non si sta perdendo nulla oggi.
//
// Da decidere: cancellarle, o ricollegarle se il pannello tornera' un modale.
function openChatModal() {
    if (chatModal) chatModal.style.display = 'flex';
    if (modalOverlay) modalOverlay.style.display = 'block';
    if (chatInput) chatInput.focus();

    chatHistory = [];
    if (chatMessages) {
        chatMessages.innerHTML = '';
        addMessage('ai', 'Ciao! Sono Frank, il tuo assistente. Come posso aiutarti oggi?');
    }
};

// Funzione per chiudere il modale
// CORREZIONE DEL 10/09/2026: il commento che stava qui diceva che il nome di
// questa funzione non fosse libero, perche' `shared-ui.js` la cercava come
// `window['close' + id]`. Il meccanismo c'era ma non e' mai stato eseguito —
// nessuna chiamata passava un id — ed e' stato rimosso. Il nome e' libero.
//
// Resta vero il resto: `main.js` definisce una PROPRIA `window.closeChatModal`.
// Le due non si incontrano, perche' nessuna pagina carica entrambi i file
// (verificato), ma sono due implementazioni dello stesso nome ed e' un debito
// a parte.
async function closeChatModal() {
    if (chatModal) chatModal.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';

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
        const response = await apiFetch(`/api/save-chat`, {
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
    if (!chatMessages) return;

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
    if (chatInput) chatInput.value = '';

    if (sendChatMessageBtn) sendChatMessageBtn.disabled = true;
    if (startChatRecordingBtn) startChatRecordingBtn.disabled = true;
    if (typingIndicator) typingIndicator.style.display = 'flex';

    let aiMessageElement;

    try {
        const response = await apiFetch(`/api/chat`, {
            method: 'POST',
            body: JSON.stringify({ history: chatHistory }),
        });

        if (!response.ok) throw new Error(`Errore: ${response.status}`);

        if (typingIndicator) typingIndicator.style.display = 'none';
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
        if (sendChatMessageBtn) sendChatMessageBtn.disabled = false;
        if (startChatRecordingBtn) startChatRecordingBtn.disabled = false;
        if (chatInput) chatInput.focus();
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
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
    let mediaRecorder;
    let audioChunks = [];

    startChatRecordingBtn.addEventListener('click', async () => {
        if (!isRecording) {
            // AVVIO REGISTRAZIONE
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.start();
                isRecording = true;

                // UI Update
                startChatRecordingBtn.innerHTML = '<img src="img/stop.png" alt="Ferma" style="width: 20px; height: 20px;">';
                startChatRecordingBtn.classList.add('recording-active');
                if (chatStatus) chatStatus.textContent = "Ascolto... (Whisper)";

                mediaRecorder.addEventListener("dataavailable", event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener("stop", async () => {
                    // STOP & SEND
                    const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' }); // o webm
                    const file = new File([audioBlob], "voice_msg.mp3", { type: "audio/mp3" });

                    if (chatStatus) chatStatus.textContent = "Trascrizione in corso...";

                    const formData = new FormData();
                    formData.append("audio", file);

                    try {
                        const response = await apiFetch(`/api/transcribe-voice`, {
                            method: "POST",
                            body: formData, // No JSON.stringify per FormData
                            // headers: Content-Type lo gestisce il browser col boundary
                        }, true); // true = skip default JSON headers se apiFetch lo supporta

                        // Handle result
                        const data = await response.json();
                        if (data.transcription) {
                            currentTranscription = data.transcription;
                            if (chatInput) chatInput.value = currentTranscription;
                            sendChatMessage(currentTranscription);
                        }

                    } catch (err) {
                        console.error("Errore Whisper:", err);
                        if (chatStatus) chatStatus.textContent = "Errore trascrizione.";
                    } finally {
                        if (chatStatus && chatStatus.textContent.includes("Trascrizione")) chatStatus.textContent = "";
                        resetRecBtn();

                        // Stop tracks
                        stream.getTracks().forEach(track => track.stop());
                    }
                });

            } catch (err) {
                console.error("Errore Microfono:", err);
                alert("Impossibile accedere al microfono.");
            }
        } else {
            // STOP REGISTRAZIONE
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            }
        }
    });
}

function resetRecBtn() {
    isRecording = false;
    if (startChatRecordingBtn) {
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

// Intercettazione Tasto Home per salvataggio
const btnHome = document.getElementById('btnHome');
if (btnHome) {
    btnHome.addEventListener('click', async (e) => {
        e.preventDefault(); // Blocca navigazione immediata

        // Se c'è una chat, salvala
        if (chatHistory.length > 1) {
            btnHome.style.pointerEvents = 'none'; // Evita doppi click
            btnHome.innerHTML = '<span>Salvataggio...</span>';
            await saveChatHistory();
        }

        // Procedi alla home
        window.location.href = 'index.html';
    });
}