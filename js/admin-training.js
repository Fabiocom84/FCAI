import { apiFetch } from './api-client.js';
import { showFeedbackModal } from './shared-ui.js';

// DOM Elements
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const stepLoading = document.getElementById('step-loading');

const btnGoStep2 = document.getElementById('btn-goto-step-2');
const btnBackStep1 = document.getElementById('btn-back-step-1');
const btnStart = document.getElementById('btn-start-training');
const securityInput = document.getElementById('security-input');

// --- NAVIGAZIONE WIZARD ---

if (btnGoStep2) {
    btnGoStep2.addEventListener('click', () => {
        step1.style.display = 'none';
        step2.style.display = 'block';
        setTimeout(() => securityInput.focus(), 100);
    });
}

if (btnBackStep1) {
    btnBackStep1.addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
        securityInput.value = ''; // Reset input
        btnStart.disabled = true;
    });
}

// --- LOGICA DI SICUREZZA ---

if (securityInput) {
    securityInput.addEventListener('input', function() {
        const val = this.value.trim().toUpperCase();
        // Abilitiamo solo se scrive CONFERMA
        if (val === 'CONFERMA') {
            btnStart.disabled = false;
            btnStart.style.opacity = '1';
            btnStart.style.cursor = 'pointer';
        } else {
            btnStart.disabled = true;
            btnStart.style.opacity = '0.5';
            btnStart.style.cursor = 'not-allowed';
        }
    });
}

// --- CHIAMATA API ---

if (btnStart) {
    btnStart.addEventListener('click', async () => {
        // UI Loading State
        step2.style.display = 'none';
        stepLoading.style.display = 'block';

        try {
            const response = await apiFetch('/api/admin/retrain-knowledge', {
                method: 'POST'
            });

            if (response.ok) {
                // Successo: Mostra feedback e poi torna alla home o resetta
                showFeedbackModal(
                    "Procedura Avviata", 
                    "Il sistema sta lavorando in background. Puoi tornare alla Home.", 
                    true // true = successo (verde)
                );
                
                // Opzionale: redirect dopo chiusura modal (gestito dall'utente cliccando OK)
                document.getElementById('feedback-modal-close-btn').onclick = function() {
                    window.location.href = 'index.html';
                };

            } else {
                const errData = await response.json();
                alert("Errore avvio: " + (errData.error || "Sconosciuto"));
                // Torna allo step 2 in caso di errore
                stepLoading.style.display = 'none';
                step2.style.display = 'block';
            }
        } catch (error) {
            console.error("Training Error:", error);
            alert("Errore di comunicazione col server.");
            stepLoading.style.display = 'none';
            step2.style.display = 'block';
        }
    });
}