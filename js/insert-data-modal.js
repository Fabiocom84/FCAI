// js/insert-data-modal.js
import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

// Variabili di stato interne al modulo
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioBlob = null;
let recognition = null; // Per SpeechRecognition

export function initInsertDataModal() {
    const btn = document.getElementById('btn-inserisci-dati');
    if (btn) {
        // Rimuoviamo il link diretto e apriamo il modale
        btn.removeAttribute('href');
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openInsertModal();
        });
    }
}

function openInsertModal() {
    // 1. Crea l'HTML del modale dinamicamente
    const modalHtml = `
    <div id="quick-insert-modal" class="modal active" style="display: flex;">
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>Inserimento Rapido</h2>
                <span class="close-button" id="closeQuickInsert">&times;</span>
            </div>
            <div class="modal-body">
                
                <!-- SEZIONE VOCALE -->
                <div class="form-group" style="text-align: center; margin-bottom: 20px;">
                    <label style="margin-bottom: 10px; display: block;">Registrazione o Dettatura</label>
                    
                    <div id="visualizer-quick" class="audio-visualizer" style="margin-bottom: 15px;">
                        <div class="bar"></div><div class="bar"></div><div class="bar"></div>
                        <div class="bar"></div><div class="bar"></div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <!-- NUOVI BOTTONI STANDARD .std-btn -->
                        <button type="button" id="btn-quick-record" class="std-btn std-btn--primary">
                            <span>🎤 Avvia</span>
                        </button>
                        <button type="button" id="btn-quick-stop" class="std-btn std-btn--danger" disabled>
                            <span>⏹ Stop</span>
                        </button>
                    </div>
                    <p id="quick-status-text" class="status-text" style="margin-top: 10px;">Pronto.</p>
                </div>

                <!-- AREA TESTO -->
                <div class="form-group">
                    <label>Note / Trascrizione</label>
                    <textarea id="quick-note-text" rows="5" placeholder="Parla o scrivi qui..." style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid #ccc;"></textarea>
                </div>

            </div>
            <div class="modal-footer">
                <!-- NUOVI BOTTONI STANDARD .std-btn -->
                <button id="btn-quick-save" class="std-btn std-btn--blue" style="width: 100%;">
                    <span>💾 Salva nei Dati</span>
                </button>
            </div>
        </div>
    </div>
    `;

    // 2. Inserisci nel DOM
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div);

    // 3. Event Listeners
    document.getElementById('closeQuickInsert').addEventListener('click', closeQuickModal);
    document.getElementById('btn-quick-record').addEventListener('click', startQuickRecording);
    document.getElementById('btn-quick-stop').addEventListener('click', stopQuickRecording);
    document.getElementById('btn-quick-save').addEventListener('click', saveQuickData);

    // Chiudi cliccando fuori
    const modalEl = document.getElementById('quick-insert-modal');
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeQuickModal();
    });
}

function closeQuickModal() {
    const el = document.getElementById('quick-insert-modal');
    if (el) el.parentElement.remove(); // Rimuove il wrapper div creato
    resetRecordingState();
}

function resetRecordingState() {
    isRecording = false;
    audioChunks = [];
    audioBlob = null;
    if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

// --- LOGICA REGISTRAZIONE (Semplificata) ---
async function startQuickRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        
        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            // Qui potremmo inviare a OpenAI Whisper se configurato
        };

        mediaRecorder.start();
        isRecording = true;
        
        // UI Updates
        document.getElementById('btn-quick-record').disabled = true;
        document.getElementById('btn-quick-stop').disabled = false;
        document.getElementById('quick-status-text').innerText = "Registrazione in corso...";
        document.getElementById('visualizer-quick').classList.add('active');

        // Avvia anche SpeechRecognition per trascrizione live (opzionale, fallback)
        setupSpeechRecognition();

    } catch (err) {
        console.error("Errore microfono:", err);
        alert("Impossibile accedere al microfono.");
    }
}

function stopQuickRecording() {
    if (mediaRecorder) mediaRecorder.stop();
    if (recognition) recognition.stop();
    
    isRecording = false;
    
    // UI Updates
    document.getElementById('btn-quick-record').disabled = false;
    document.getElementById('btn-quick-stop').disabled = true;
    document.getElementById('quick-status-text').innerText = "Registrazione terminata.";
    document.getElementById('visualizer-quick').classList.remove('active');
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // Append al testo esistente o sostituisci? Per ora appendiamo solo il finale
            const textArea = document.getElementById('quick-note-text');
            if (finalTranscript) {
                textArea.value += (textArea.value ? ' ' : '') + finalTranscript;
            }
        };
        recognition.start();
    }
}

async function saveQuickData() {
    const text = document.getElementById('quick-note-text').value;
    
    if (!text && !audioBlob) {
        alert("Inserisci del testo o registra un audio.");
        return;
    }

    const btn = document.getElementById('btn-quick-save');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Salvataggio...</span>';

    try {
        // Simulazione salvataggio (o chiamata reale API se hai l'endpoint pronto)
        // Qui dovresti chiamare apiFetch('/api/process-data', ...)
        
        // Costruiamo un FormData come in inserisci-dati.js
        const formData = new FormData();
        formData.append('transcription', text);
        // formData.append('riferimento', ...); // Se volessimo mettere una commessa
        if (audioBlob) {
            formData.append('fileUpload', audioBlob, 'quick-recording.webm');
        }

        const response = await apiFetch('/api/process-data', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Errore salvataggio");

        closeQuickModal();
        showModal({ title: "Successo", message: "Nota salvata correttamente." });

    } catch (error) {
        console.error(error);
        alert("Errore durante il salvataggio.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}