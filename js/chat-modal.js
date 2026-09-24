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

// `openChatModal` e `closeChatModal` sono state CANCELLATE il 19/09/2026.
//
// Erano annotate come irraggiungibili dal 10/09 con la decisione lasciata
// aperta — «cancellarle, o ricollegarle se il pannello tornera' un modale».
// Rivisto: `chat.html` non apre un modale, ha un `<div id="chatPanel">` che e'
// parte della pagina, e nessuno le chiamava da nessun file. Il modale della
// chat esiste su `index.html` ed e' servito dalle OMONIME funzioni in
// `main.js`, che sono vive.
//
// LE COSE CHE FACEVANO, verificate una per una prima di toglierle:
//   * `recognition.stop()` — compariva solo li'. Non serve: uscendo dalla
//     pagina il browser distrugge l'oggetto di riconoscimento vocale.
//   * `saveChatHistory()` — vedi sotto, ed e' il motivo per cui questa
//     cancellazione non e' stata muta.
//
// ┌ QUELLO CHE IL CODICE MORTO STAVA INDICANDO, e che resta aperto ─────────
// │ `saveChatHistory()` e' chiamata da DUE punti: questa funzione morta, e il
// │ pulsante Home in fondo al file. Tolta la prima, ne resta **uno solo**.
// │
// │ Quindi: **la conversazione viene salvata soltanto se si esce premendo
// │ Home.** Chi chiude la scheda, torna indietro col browser o clicca un
// │ altro collegamento la perde, senza alcun avviso.
// │
// │ Non e' un difetto introdotto qui — quella funzione non girava — ma era
// │ l'unica traccia scritta del fatto che la chiusura dovesse salvare.
// │ Cancellarla senza guardare avrebbe sepolto la domanda insieme al codice.
// │
// │ ✅ CHIUSO IL 24/09/2026 — e il blocco che era scritto qui non esisteva.
// │
// │ Diceva: «servirebbe `navigator.sendBeacon`, che cambia il percorso di
// │ salvataggio lato backend». Vero di `sendBeacon`, che non puo' mettere
// │ l'intestazione `Authorization`. Ma **`fetch` con `keepalive: true` puo'**:
// │ sopravvive alla pagina allo stesso modo e porta le intestazioni normali.
// │ `apiFetch` inoltra le opzioni a `fetch`, quindi passa senza toccare nulla
// │ lato server.
// └────────────────────────────────────────────────────────────────────────
//
// ┌ PERCHE' C'E' UN GUARDIANO, e non solo un evento in piu' ────────────────
// │ `visibilitychange` a stato `hidden` scatta a OGNI passaggio in secondo
// │ piano: cambio di scheda, telefono bloccato, app cambiata. Registrarlo e
// │ basta significherebbe un POST ogni volta che qualcuno guarda altrove, e
// │ la stessa conversazione salvata dieci volte.
// │
// │ Il rimedio non e' scegliere un evento piu' raro — sarebbe meno affidabile
// │ proprio quando serve — ma **non rispedire cio' che non e' cambiato**:
// │ `ultimaCronologiaSalvata` tiene il testo dell'ultimo invio.
// │
// │ Il segno si aggiorna PRIMA della conferma, di proposito: serve a
// │ deduplicare, non a contabilizzare la riuscita. Se un invio fallisce e la
// │ conversazione prosegue, il testo cambia e si riprova; se fallisce mentre
// │ la pagina muore si perde — che e' cio' che succede oggi in ogni caso.
// │
// │ LIMITE NOTO: `keepalive` ha un tetto di 64 KB sul corpo. Una conversazione
// │ di circa diecimila parole lo supererebbe e il browser rifiuterebbe la
// │ richiesta. Annotato, non aggirato.
// └────────────────────────────────────────────────────────────────────────

// Il testo dell'ultimo invio, per non rispedire cio' che non e' cambiato.
// Vedi il riquadro in testa: senza, ogni passaggio in secondo piano salverebbe.
let ultimaCronologiaSalvata = '';

/**
 * Salva la conversazione, se e' cambiata da quando fu salvata l'ultima volta.
 *
 * @param {object}  [o]
 * @param {boolean} [o.inChiusura]  la pagina sta per sparire: si usa
 *                                  `keepalive`, cosi' la richiesta sopravvive.
 *                                  L'esito non e' osservabile, e va bene.
 */
async function saveChatHistory({ inChiusura = false } = {}) {
    if (chatHistory.length <= 1) return;

    const chatTranscription = chatHistory.map(msg => `${msg.role === 'user' ? 'Utente' : 'Frank'}: ${msg.content}`).join('\n\n');

    if (chatTranscription === ultimaCronologiaSalvata) return;
    ultimaCronologiaSalvata = chatTranscription;

    try {
        const response = await apiFetch(`/api/save-chat`, {
            method: 'POST',
            body: JSON.stringify({ chatTranscription: chatTranscription }),
            ...(inChiusura ? { keepalive: true } : {})
        });
        if (!response.ok) throw new Error(`Errore server: ${response.status}`);
    } catch (error) {
        if (error.message !== "Unauthorized") console.error("Errore salvataggio chat:", error);
    }
}

// I DUE EVENTI INSIEME, e non uno scelto fra i due.
// `visibilitychange` copre la chiusura della scheda e il passaggio in secondo
// piano su mobile, dove `pagehide` a volte non arriva; `pagehide` copre le
// navigazioni dove il primo puo' mancare. Chiamarli entrambi e' innocuo:
// il guardiano fa uscire subito la seconda chiamata.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveChatHistory({ inChiusura: true });
});
window.addEventListener('pagehide', () => saveChatHistory({ inChiusura: true }));

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