// js/chat-modal.js

// Elementi DOM
const chatModal = document.getElementById('chatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const openChatModalBtn = document.getElementById('openChatModalBtn');
const startChatRecordingBtn = document.getElementById('startChatRecording');
const sendChatMessageBtn = document.getElementById('sendChatMessage');
const modalOverlay = document.getElementById('modalOverlay');
const chatStatus = document.getElementById('chatStatus'); // Importante: deve esserci l'elemento HTML con questo ID!

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

// Funzione per chiudere il modale della chat
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
    // Rimuovo la logica di salvataggio chat qui per semplicità e perché l'endpoint save_chat_transcript non è presente nel backend.
    // Puoi aggiungerla nuovamente se implementi l'endpoint sul server.
}

// Funzione per aggiungere un messaggio alla chat UI
function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    if (text) {
        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');
        messageContentDiv.textContent = text;
        messageElement.appendChild(messageContentDiv);
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

    chatStatus.textContent = "Il Segretario AI sta elaborando..."; // Feedback all'utente
    sendChatMessageBtn.disabled = true; // Disabilita il pulsante invia
    startChatRecordingBtn.disabled = true; // Disabilita il pulsante microfono

    const formData = new FormData();
    formData.append('text', messageText); // Invia il testo direttamente

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Errore del server: ${response.status} - ${errorData.error || 'Errore sconosciuto'}`);
        }

        // Il backend restituisce un file audio (MP3)
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audio.play();

        // Puoi anche aggiungere un messaggio di feedback visivo per la risposta audio
        addMessage('ai', "Ascolta la mia risposta vocale!");

    } catch (error) {
        console.error("Errore nell'invio del messaggio alla chat AI:", error);
        addMessage('ai', `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`);
    } finally {
        chatStatus.textContent = ""; // Rimuovi il feedback
        chatInput.value = ''; // Pulisci l'input
        sendChatMessageBtn.disabled = false; // Riabilita il pulsante invia
        startChatRecordingBtn.disabled = false; // Riabilita il pulsante microfono
        chatInput.focus();
    }
}

// Event listener per il pulsante "Invia" (testo digitato)
sendChatMessageBtn.addEventListener('click', () => {
    sendChatMessage(chatInput.value);
});

// Event listener per inviare con "Invio" nel campo di testo
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Aggiunto !e.shiftKey per permettere Shift+Enter per nuova riga
        e.preventDefault(); // Previeni la nuova riga di default
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
        recognition = new webkitSpeechRecognition(); // Usiamo webkitSpeechRecognition
        recognition.lang = 'it-IT';
        recognition.interimResults = false; // O true per risultati parziali in tempo reale
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('Registrazione vocale avviata per la chat...');
            isRecording = true;
            startChatRecordingBtn.innerHTML = '<img src="img/stop.png" alt="Ferma Registrazione">'; // Cambia icona a stop
            startChatRecordingBtn.classList.add('recording-active');
            chatStatus.textContent = "Registrazione in corso...";
        };

        recognition.onresult = (event) => {
            currentTranscription = event.results[0][0].transcript;
            console.log('Trascrizione parziale/finale:', currentTranscription);
            // Puoi aggiornare chatInput.value qui se interimResults è true per feedback in tempo reale
            chatInput.value = currentTranscription; 
        };

        recognition.onerror = (event) => {
            console.error('Errore di riconoscimento vocale per la chat:', event.error);
            chatStatus.textContent = `Errore registrazione: ${event.error}`;
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
        };

        recognition.onend = () => {
            console.log('Registrazione vocale terminata per la chat.');
            isRecording = false;
            startChatRecordingBtn.innerHTML = '<img src="img/mic.png" alt="Registra Vocale">';
            startChatRecordingBtn.classList.remove('recording-active');
            chatStatus.textContent = "Invio trascrizione...";
            
            // Se c'è una trascrizione finale da inviare
            if (currentTranscription.trim() !== '') {
                chatInput.value = currentTranscription; // Assicurati che l'input abbia la trascrizione finale
                sendChatMessage(currentTranscription); // Invia la trascrizione al backend
                currentTranscription = ''; // Resetta per la prossima registrazione
            } else {
                chatStatus.textContent = "Nessuna voce rilevata.";
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

// Event Listener per l'apertura del modale (già presente, ma per completezza)
openChatModalBtn.addEventListener('click', (event) => {
    event.preventDefault();
    openChatModal();
});


// Scorri in fondo ai messaggi all'avvio della pagina (se ce ne sono)
document.addEventListener('DOMContentLoaded', () => {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});