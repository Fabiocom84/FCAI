// js/chat-modal.js

// Elementi DOM
const chatModal = document.getElementById('chatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const startChatRecordingBtn = document.getElementById('startChatRecording');
const sendChatMessageBtn = document.getElementById('sendChatMessage');
const chatStatus = document.getElementById('chatStatus');
const updateAIDbBtn = document.getElementById('updateAIDbBtn'); // Pulsante di aggiornamento DB AI

// Setup del riconoscimento vocale
let recognition;
let isRecording = false;
let currentTranscription = ''; // Per la trascrizione continua

// Funzione per aprire il modale della chat
function openChatModal() {
    chatModal.style.display = 'flex'; // Usiamo flex per centrare il contenuto del modale
    window.showOverlay(); // Usa la funzione centralizzata del modal-manager
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scorri in fondo ai messaggi esistenti
}
window.openChatModal = openChatModal; // Rendi openChatModal accessibile globalmente

// Funzione per chiudere il modale della chat
async function closeChatModal() {
    chatModal.style.display = 'none';
    window.hideOverlay(); // Usa la funzione centralizzata del modal-manager
    
    // Ferma la registrazione se attiva
    if (isRecording && recognition) {
        recognition.stop();
        isRecording = false;
        startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
        startChatRecordingBtn.classList.remove('recording-active');
    }
    // Assicurati che lo stato della chat sia pulito alla chiusura
    if (chatStatus) {
        chatStatus.textContent = "";
        chatStatus.style.display = 'none';
        chatStatus.style.color = '#333'; // Reset del colore
    }
}
// window.closeChatModal = closeChatModal; // Non più strettamente necessario se usiamo addEventListener

// Funzione per aggiungere un messaggio alla chat UI
function addMessage(sender, text, audioBase64 = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    if (text) {
        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');
        messageContentDiv.textContent = text;
        messageElement.appendChild(messageContentDiv);
    }

    if (audioBase64) {
        const audio = new Audio();
        audio.src = `data:audio/mpeg;base64,${audioBase64}`;
        audio.controls = true;
        audio.autoplay = true; 
        
        const audioContainer = document.createElement('div');
        audioContainer.classList.add('audio-playback');
        audioContainer.appendChild(audio);
        messageElement.appendChild(audioContainer);

        audio.onended = () => {
            console.log("Riproduzione audio completata.");
        };
        audio.onerror = (e) => {
            console.error("Errore durante la riproduzione audio:", e);
        };
    }

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scorri in fondo
}

// Funzione per inviare il messaggio alla rotta /api/chat del backend
async function sendChatMessage(messageText) {
    if (!messageText.trim()) {
        console.log("Messaggio vuoto, non invio.");
        return;
    }

    addMessage('user', messageText); // Mostra subito il messaggio dell'utente

    chatStatus.textContent = "Il Segretario AI sta elaborando...";
    chatStatus.style.display = 'block';
    sendChatMessageBtn.disabled = true;
    startChatRecordingBtn.disabled = true;
    updateAIDbBtn.disabled = true;

    const formData = new FormData();
    formData.append('text', messageText);

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            body: formData,
        });

        const responseData = await response.json(); 

        if (!response.ok) {
            throw new Error(`Errore del server: ${response.status} - ${responseData.error || 'Errore sconosciuto'}`);
        }

        const aiResponseText = responseData.response;
        const audioBase64 = responseData.audio;      

        if (audioBase64) {
            addMessage('ai', aiResponseText, audioBase64); 
        } else {
            addMessage('ai', aiResponseText + " (Audio non disponibile)");
        }

    } catch (error) {
        console.error("Errore nell'invio del messaggio alla chat AI:", error);
        addMessage('ai', `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`);
    } finally {
        chatStatus.textContent = "";
        chatStatus.style.display = 'none';
        chatInput.value = '';
        sendChatMessageBtn.disabled = false;
        startChatRecordingBtn.disabled = false;
        updateAIDbBtn.disabled = false;
        chatInput.focus();
    }
}

// Funzione per aggiornare la Knowledge Base AI
async function updateAIDB() {
    const confirmation = confirm("Sei sicuro di voler procedere con l'aggiornamento della knowledge base AI? Questa operazione potrebbe richiedere qualche minuto.");
    if (!confirmation) {
        return;
    }

    chatStatus.textContent = "Aggiornamento Knowledge Base in corso... Potrebbe richiedere qualche minuto. ⏳";
    chatStatus.style.display = 'block';
    chatStatus.style.color = '#333';
    updateAIDbBtn.disabled = true;
    sendChatMessageBtn.disabled = true;
    startChatRecordingBtn.disabled = true;

    try {
        const spreadsheetId = "1XQJ0Py2aACDtcOnc7Mi2orqaKWbNpZbpp9lAnIm1kv8"; 
        const sheetNamesToLoad = [
            'Registrazioni',
            'Chat_AI',
            'Riferimento_Commessa'
        ];

        const formData = new FormData();
        formData.append('spreadsheet_id', spreadsheetId);
        formData.append('sheet_names', sheetNamesToLoad.join(','));

        const ingestionFunctionUrl = "https://europe-west1-segretario-ai-web-app.cloudfunctions.net/ingestion-db-function";

        const response = await fetch(ingestionFunctionUrl, {
            method: 'POST',
            body: formData,
        });

        let responseText = await response.text(); 
        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = { message: responseText };
        }

        if (!response.ok) {
            throw new Error(`Errore durante l'aggiornamento: ${response.status} - ${responseData.message || responseData.error || responseText || 'Errore sconosciuto'}`);
        }

        console.log('Risposta Cloud Function:', responseData);

        chatStatus.textContent = "Knowledge Base AI aggiornata con successo! ✅";
        
        alert("Knowledge Base AI aggiornata e pronta all'uso! 🎉");

    } catch (error) {
        console.error("Errore nell'aggiornamento della Knowledge Base AI:", error);
        chatStatus.textContent = `Errore aggiornamento: ${error.message}. Riprova. ❌`;
        chatStatus.style.color = 'red';
        alert(`Errore nell'aggiornamento della Knowledge Base AI: ${error.message}`);
    } finally {
        updateAIDbBtn.disabled = false;
        sendChatMessageBtn.disabled = false;
        startChatRecordingBtn.disabled = false;
        setTimeout(() => {
            chatStatus.textContent = "";
            chatStatus.style.display = 'none';
            chatStatus.style.color = '#333';
        }, 5000);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Aggiungo event listener per il pulsante di chiusura del modale
    const closeChatBtn = chatModal.querySelector('.close-button');
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', closeChatModal);
    }
});


// Event listener per il pulsante "Invia" (testo digitato)
sendChatMessageBtn.addEventListener('click', () => {
    sendChatMessage(chatInput.value);
});

// Event listener per inviare con "Invio" nel campo di testo
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
    }
});

// Event listener per il pulsante "Registra Vocale" (nuova logica per chat AI)
startChatRecordingBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Spiacente, il riconoscimento vocale non è supportato dal tuo browser. Prova Chrome.");
        return;
    }

    if (!isRecording) {
        recognition = new webkitSpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('Registrazione vocale avviata per la chat...');
            isRecording = true;
            startChatRecordingBtn.innerHTML = '<img src="img/stop.png" alt="Ferma Registrazione">';
            startChatRecordingBtn.classList.add('recording-active');
            chatStatus.textContent = "Registrazione in corso...";
            chatStatus.style.display = 'block';
            chatStatus.style.color = '#333';
        };

        recognition.onresult = (event) => {
            currentTranscription = event.results[0][0].transcript;
            console.log('Trascrizione parziale/finale:', currentTranscription);
            chatInput.value = currentTranscription; 
        };

        recognition.onerror = (event) => {
            console.error('Errore di riconoscimento vocale per la chat:', event.error);
            chatStatus.textContent = `Errore registrazione: ${event.error}`;
            chatStatus.style.color = 'red';
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
            setTimeout(() => {
                chatStatus.textContent = "";
                chatStatus.style.display = 'none';
                chatStatus.style.color = '#333';
            }, 5000);
        };

        recognition.onend = () => {
            console.log('Registrazione vocale terminata per la chat.');
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
            
            if (currentTranscription.trim() !== '') {
                chatInput.value = currentTranscription;
                sendChatMessage(currentTranscription);
                currentTranscription = '';
            } else {
                chatStatus.textContent = "Nessuna voce rilevata.";
                chatStatus.style.color = '#333';
                setTimeout(() => {
                    chatStatus.textContent = "";
                    chatStatus.style.display = 'none';
                    chatStatus.style.color = '#333';
                }, 3000);
            }
        };

        recognition.start();
    } else {
        recognition.stop();
    }
});

// Event listener per il pulsante di aggiornamento DB AI
if (updateAIDbBtn) {
    updateAIDbBtn.addEventListener('click', updateAIDB);
}