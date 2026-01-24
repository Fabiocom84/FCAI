import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal } from './shared-ui.js';

// DOM Elements
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const stepLoading = document.getElementById('step-loading');

const btnGoStep2 = document.getElementById('btn-goto-step-2');
const btnBackStep1 = document.getElementById('btn-back-step-1');
const btnStart = document.getElementById('btn-start-training');
const btnForceStop = document.getElementById('btn-force-stop'); // Kill switch
const securityInput = document.getElementById('security-input');
const forceResetCheckbox = document.getElementById('force-reset-checkbox');

// --- STOP FORZATO ---
if (btnForceStop) {
    btnForceStop.addEventListener('click', async () => {
        if (!confirm("SEI SICURO? Questo arresterà l'indicizzazione immediatamente. I dati potrebbero essere incompleti.")) return;

        try {
            // Chiamata all'endpoint di stop
            await apiFetch('/api/admin/stop-training', { method: 'POST' });
            alert("Segnale di STOP inviato. Il processo terminerà a breve.");

            // Ritorniamo alla home dopo un po'
            setTimeout(() => window.location.href = 'index.html', 2000);
        } catch (e) {
            alert("Errore invio stop: " + e.message);
        }
    });
}

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
    securityInput.addEventListener('input', function () {
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
        // Leggi checkbox
        const forceReset = forceResetCheckbox ? forceResetCheckbox.checked : false;

        // UI Loading State (Switch to Console)
        step2.style.display = 'none';
        stepLoading.style.display = 'block';

        const consoleEl = document.getElementById('training-console');
        const stopBtn = document.getElementById('btn-stop-monitoring');
        let monitoringInterval;

        // Funzione helper per scrivere in console
        const log = (msg) => {
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.textContent = `> ${msg}`;
            consoleEl.insertBefore(line, consoleEl.lastElementChild); // Inserisce prima del cursore
            consoleEl.scrollTop = consoleEl.scrollHeight;
        };

        if (stopBtn) {
            stopBtn.onclick = () => {
                if (monitoringInterval) clearInterval(monitoringInterval);
                window.location.href = 'index.html';
            };
        }

        try {
            log("Contatto il server...");
            const response = await apiFetch('/api/admin/retrain-knowledge', {
                method: 'POST',
                body: JSON.stringify({ force_reset: forceReset })
            });

            if (response.ok) {
                log(`Richiesta inviata. Modalità: ${forceReset ? "RESET TOTALE" : "INCREMENTALE"}`);
                log("Ricevuto 202 Accepted. Processo avviato in background.");
                log("Attendo pulizia memoria...");

                // Inizio Polling Intelligente
                let lastMsg = "";

                monitoringInterval = setInterval(async () => {
                    try {
                        const statusRes = await apiFetch('/api/admin/training-status');
                        const statusData = await statusRes.json();

                        // Gestione Errori Backend
                        if (statusData.status === "ERROR") {
                            log(`❌ ERRORE: ${statusData.error || "Errore sconosciuto"}`);
                            clearInterval(monitoringInterval);
                            return;
                        }

                        // Messaggio di Log (solo se cambia)
                        if (statusData.message && statusData.message !== lastMsg) {
                            log(statusData.message);
                            lastMsg = statusData.message;
                        }

                        // Status Line Dinamica (Sempre aggiornata)
                        const processed = statusData.processed || 0;
                        const skipped = statusData.skipped || 0;
                        const total = statusData.total_vectors || 0;
                        const dbCount = statusData.db_count || 0;

                        // Aggiorna un elemento di stato fisso se vuoi, o logga ogni tot
                        // Qui facciamo log periodico se sta lavorando
                        if (statusData.status === "RUNNING" && (processed % 50 === 0 && processed > 0)) {
                            // log(`>> Progresso: ${processed} processati, ${skipped} saltati.`);
                        }

                        if (statusData.status === "COMPLETED") {
                            log("✅ CICLO COMPLETATO.");
                            log(`Riepilogo: ${processed} nuovi vettori, ${skipped} saltati.`);
                            if (dbCount > 0) log(`Totale vettori nel DB: ${dbCount}`);
                            clearInterval(monitoringInterval);
                        }

                        if (statusData.status === "STOPPED") {
                            log("🛑 PROCESSO ARRESTATO.");
                            clearInterval(monitoringInterval);
                        }

                    } catch (e) {
                        log(`Errore monitoraggio: ${e.message}`);
                    }
                }, 1000); // Polling più frequente (1s) per feedback real-time

            } else {
                const errData = await response.json();
                log(`ERRORE AVVIO: ${errData.error || "Sconosciuto"}`);
                alert("Errore avvio: " + (errData.error || "Sconosciuto"));
                if (monitoringInterval) clearInterval(monitoringInterval);
            }
        } catch (error) {
            console.error("Training Error:", error);
            log(`ERRORE DI COMUNICAZIONE: ${error.message}`);
            alert("Errore di comunicazione col server.");
            if (monitoringInterval) clearInterval(monitoringInterval);
        }
    });
}