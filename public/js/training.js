// File: js/training.js (Versione Finale)

// Variabili globali per tracciare lo stato
let isTrainingRunning = false;
let currentProcessId = null;
let pollingIntervalId = null;

document.addEventListener('DOMContentLoaded', () => {
    const trainingButton = document.getElementById('openTrainingModalBtn');
    if (trainingButton) {
        trainingButton.addEventListener('click', handleTrainingButtonClick);
    }
});

function handleTrainingButtonClick(event) {
    event.preventDefault();
    
    if (!isTrainingRunning) {
        // --- AVVIA PROCESSO ---
        const isConfirmed = confirm("Sei sicuro di voler avviare l'addestramento?\nL'operazione potrebbe richiedere alcuni minuti.");
        if (isConfirmed) {
            startTrainingProcess(event.currentTarget);
        }
    } else {
        // --- FERMA PROCESSO ---
        const isStopConfirmed = confirm("Un addestramento è già in esecuzione.\nSei sicuro di volerlo interrompere?");
        if (isStopConfirmed) {
            stopTrainingProcess(event.currentTarget);
        }
    }
}

async function startTrainingProcess(button) {
    isTrainingRunning = true;
    const originalText = button.querySelector('span').textContent;
    let statusElement = button.parentNode.querySelector('.training-status');
    if (statusElement) statusElement.remove();
    
    statusElement = document.createElement('p');
    statusElement.className = 'training-status';
    statusElement.style.marginTop = '10px';
    button.parentNode.appendChild(statusElement);

    button.disabled = true;
    button.querySelector('span').textContent = 'In esecuzione...';
    statusElement.textContent = 'Avvio del processo...';

    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
            method: 'POST'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Errore del server: ${response.status}`);

        if (response.ok) {
            currentProcessId = result.process_id;
            button.disabled = false; // Riattiva il pulsante per permettere lo stop
            button.querySelector('span').textContent = 'Ferma Addestramento';
            statusElement.textContent = 'Processo accodato. Controllo lo stato...';
            pollForStatus(currentProcessId, statusElement, button, originalText);
        } else {
            throw new Error(result.message || `Errore del server: ${response.status}`);
        }
    } catch (error) {
        if (error.message !== "Unauthorized") {
            statusElement.textContent = `Errore: ${error.message}`;
            isTrainingRunning = false;
            button.disabled = false;
            button.querySelector('span').textContent = originalText;
        }
    }
}

async function stopTrainingProcess(button) {
    statusElement = button.parentNode.querySelector('.training-status');
    statusElement.textContent = 'Invio richiesta di interruzione...';
    button.disabled = true;

    try {
        const response = await apiFetch(`${window.BACKEND_URL}/api/stop-training`, {
            method: 'POST',
            body: JSON.stringify({ process_id: currentProcessId })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        statusElement.textContent = `Richiesta di interruzione inviata. Attendo la conferma...`;
    } catch (error) {
        if (error.message !== "Unauthorized") {
            alert(`Errore durante la richiesta di stop: ${error.message}`);
            button.disabled = false;
        }
    }
}

function pollForStatus(processId, statusElement, button, originalText) {
    let heartbeatChars = [' ', '.', '..', '...'];
    let heartbeatIndex = 0;

    // Pulisce eventuali polling precedenti per sicurezza
    if (pollingIntervalId) clearInterval(pollingIntervalId);

    pollingIntervalId = setInterval(async () => {
        try {
            const response = await apiFetch(`${window.BACKEND_URL}/api/get-training-status?process_id=${processId}`);
            
            if (!response.ok) throw new Error(`Impossibile recuperare lo stato (HTTP ${response.status})`);
            
            // --- ECCO LA CORREZIONE FONDAMENTALE ---
            // Aggiungiamo la riga per leggere e interpretare la risposta JSON
            const data = await response.json();
            
            // Incrementa l'heartbeat visivo
            heartbeatIndex = (heartbeatIndex + 1) % heartbeatChars.length;
            const heartbeat = heartbeatChars[heartbeatIndex];

            // Aggiungiamo anche la formattazione dell'orario per il "battito cardiaco"
            let formattedTimestamp = '';
            if (data.last_updated) {
                try {
                    const date = new Date(data.last_updated);
                    formattedTimestamp = `(ultimo aggiornamento: ${date.toLocaleTimeString()})`;
                } catch (e) {}
            }

            statusElement.textContent = `Stato: ${data.status} ${formattedTimestamp} - ${data.details}${heartbeat}`;

            const terminalStates = ['COMPLETATO', 'FALLITO', 'ANNULLATO'];
            if (terminalStates.includes(data.status)) {
                clearInterval(pollingIntervalId);
                isTrainingRunning = false;
                currentProcessId = null;
                button.disabled = false;
                button.querySelector('span').textContent = originalText;
                
                alert(`Addestramento terminato con stato: ${data.status}`);
            }
        } catch (error) {
            if (error.message !== "Unauthorized") {
                statusElement.textContent = `Errore durante il controllo dello stato: ${error.message}`;
                clearInterval(pollingIntervalId);
                isTrainingRunning = false;
                currentProcessId = null;
                button.disabled = false;
                button.querySelector('span').textContent = originalText;
            }
        }
    }, 7000); 
}