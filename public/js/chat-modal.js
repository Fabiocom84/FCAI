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

// NUOVO: Elemento DOM per il pulsante di aggiornamento DB
const updateAIDbBtn = document.getElementById('updateAIDbBtn');

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
}

// Funzione per aggiungere un messaggio alla chat UI
function addMessage(sender, text, audioBase64 = null) { // Aggiungi audioBase64 come parametro opzionale
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    if (text) {
        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');
        messageContentDiv.textContent = text;
        messageElement.appendChild(messageContentDiv);
    }

    if (audioBase64) {
        // Se c'è audio, crea un elemento audio
        const audio = new Audio();
        audio.src = `data:audio/mpeg;base64,${audioBase64}`; // mp3 è il formato più comune per Eleven Labs
        audio.controls = true; // Mostra i controlli per debug/interazione
        audio.autoplay = true; // Riproduci automaticamente
        
        const audioContainer = document.createElement('div');
        audioContainer.classList.add('audio-playback');
        audioContainer.appendChild(audio);
        messageElement.appendChild(audioContainer);

        // Aggiungi un listener per sapere quando l'audio finisce (per futuri sviluppi)
        audio.onended = () => {
            console.log("Riproduzione audio completata.");
            // Potresti voler riabilitare qualche UI qui
        };
        audio.onerror = (e) => {
            console.error("Errore durante la riproduzione audio:", e);
            // Potresti aggiungere un messaggio di errore nell'UI
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

    chatStatus.textContent = "Il Segretario AI sta elaborando..."; // Feedback all'utente
    sendChatMessageBtn.disabled = true; // Disabilita il pulsante invia
    startChatRecordingBtn.disabled = true; // Disabilita il pulsante microfono
    updateAIDbBtn.disabled = true; // NUOVO: Disabilita il pulsante di aggiornamento DB durante l'elaborazione della chat

    const formData = new FormData();
    formData.append('text', messageText); // Invia il testo direttamente

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/chat`, {
            method: 'POST',
            body: formData,
        });

        // Modifica qui: il backend ora restituisce JSON, non un blob audio
        const responseData = await response.json(); 

        if (!response.ok) {
            throw new Error(`Errore del server: ${response.status} - ${responseData.error || 'Errore sconosciuto'}`);
        }

        const aiResponseText = responseData.response; // Estrai il testo della risposta
        const audioBase64 = responseData.audio;     // Estrai l'audio Base64

        if (audioBase64) {
            // Riproduci e mostra il messaggio AI con audio
            addMessage('ai', aiResponseText, audioBase64); 
        } else {
            // Se non c'è audio, mostra solo il messaggio AI testuale
            addMessage('ai', aiResponseText + " (Audio non disponibile)"); // Feedback per l'utente
        }

    } catch (error) {
        console.error("Errore nell'invio del messaggio alla chat AI:", error);
        addMessage('ai', `Mi dispiace, c'è stato un errore: ${error.message}. Riprova più tardi.`);
    } finally {
        chatStatus.textContent = ""; // Rimuovi il feedback
        chatInput.value = ''; // Pulisci l'input
        sendChatMessageBtn.disabled = false; // Riabilita il pulsante invia
        startChatRecordingBtn.disabled = false; // Riabilita il pulsante microfono
        updateAIDbBtn.disabled = false; // NUOVO: Riabilita il pulsante di aggiornamento DB
        chatInput.focus();
    }
}

// NUOVO: Funzione per aggiornare la Knowledge Base AI
async function updateAIDB() {
    // 1. Doppia conferma
    const confirmation = confirm("Sei sicuro di voler procedere con l'aggiornamento della knowledge base AI? Questa operazione potrebbe richiedere qualche minuto.");
    if (!confirmation) {
        return; // L'utente ha annullato
    }

    chatStatus.textContent = "Aggiornamento Knowledge Base in corso...";
    updateAIDbBtn.disabled = true; // Disabilita il pulsante durante l'aggiornamento
    sendChatMessageBtn.disabled = true; // Disabilita anche gli altri pulsanti
    startChatRecordingBtn.disabled = true;

    try {
        // Questi valori dovranno essere specifici per il tuo progetto e Google Sheet.
        // Potresti doverli passare come variabili globali o da una configurazione frontend.
        const spreadsheetId = "YOUR_SPREADSHEET_ID_HERE"; // SOSTITUISCI CON L'ID DEL TUO GOOGLE SHEET
        const sheetName = "YOUR_SHEET_NAME_HERE";       // SOSTITUISCI CON IL NOME DEL FOGLIO

        const response = await fetch(`${window.BACKEND_URL}/ingestion-db-function`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                spreadsheet_id: spreadsheetId,
                sheet_name: sheetName
            }),
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(`Errore durante l'aggiornamento: ${response.status} - ${responseData.message || responseData.error || 'Errore sconosciuto'}`);
        }

        chatStatus.textContent = "Knowledge Base aggiornata con successo! Ricaricamento del database locale...";

        // *** IMPORTANTE: QUI DEVI AGGIUNGERE LA LOGICA PER RICARICARE IL DATABASE LOCALE DEL FRONTEBD ***
        // Se il tuo frontend carica una copia locale del DB (es. un client ChromaDB in-browser),
        // devi chiamare qui la funzione che scarica la versione aggiornata da GCS e la ricarica.
        // Esempio (potrebbe essere una funzione definita altrove nel tuo codice frontend):
        // await reloadLocalKnowledgeBase(); // <--- DA IMPLEMENTARE NEL TUO PROGETTO
        
        chatStatus.textContent = "Knowledge Base AI aggiornata e pronta all'uso! 🎉";
        alert("Knowledge Base AI aggiornata e pronta all'uso!");

    } catch (error) {
        console.error("Errore nell'aggiornamento della Knowledge Base AI:", error);
        chatStatus.textContent = `Errore aggiornamento: ${error.message}.`;
        alert(`Errore nell'aggiornamento della Knowledge Base AI: ${error.message}`);
    } finally {
        updateAIDbBtn.disabled = false; // Riabilita il pulsante
        sendChatMessageBtn.disabled = false;
        startChatRecordingBtn.disabled = false;
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

// NUOVO: Event listener per il pulsante di aggiornamento DB
if (updateAIDbBtn) { // Controlla se l'elemento esiste prima di aggiungere l'event listener
    updateAIDbBtn.addEventListener('click', updateAIDB);
}

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