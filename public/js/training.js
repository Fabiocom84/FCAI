// File: js/training.js

document.addEventListener('DOMContentLoaded', () => {
    // Nota: l'ID del pulsante in index.html è 'openTrainingModalBtn'.
    // Sarebbe meglio rinominarlo in 'startTrainingBtn', ma per ora usiamo quello esistente.
    const trainingButton = document.getElementById('openTrainingModalBtn');

    if (trainingButton) {
        trainingButton.addEventListener('click', (event) => {
            event.preventDefault(); // Previene il comportamento di default del link '#'

            // 1. Chiedi conferma all'utente
            const isConfirmed = confirm("Sei sicuro di voler avviare l'addestramento?\nL'operazione potrebbe richiedere alcuni minuti.");

            if (isConfirmed) {
                // 2. Avvia il processo
                startTrainingProcess(trainingButton);
            }
        });
    }
});

async function startTrainingProcess(button) {
    // 3. Fornisci un feedback visivo immediato
    const originalText = button.querySelector('span').textContent;
    button.disabled = true;
    button.querySelector('span').textContent = 'In esecuzione...';

    try {
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) {
            alert("Errore: sessione non valida. Effettua nuovamente il login.");
            throw new Error("Auth token non trovato");
        }

        // 4. Esegui la chiamata all'API del backend
        const response = await fetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();

        if (response.status === 202) { // 202 Accepted
            // 5. Gestisci la risposta di successo
            alert(`Successo: ${result.message}`);
        } else {
            // 6. Gestisci la risposta di errore
            throw new Error(result.message || `Errore del server: ${response.status}`);
        }

    } catch (error) {
        console.error("Errore durante l'avvio dell'addestramento:", error);
        alert(`Si è verificato un errore: ${error.message}`);
    } finally {
        // 7. Ripristina lo stato del pulsante in ogni caso
        button.disabled = false;
        button.querySelector('span').textContent = originalText;
    }
}

async function startTrainingProcess(button) {
    const originalText = button.querySelector('span').textContent;
    const statusElement = document.createElement('p');
    statusElement.style.marginTop = '10px';
    button.parentNode.appendChild(statusElement);

    button.disabled = true;
    statusElement.textContent = 'Avvio del processo...';

    try {
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) throw new Error("Auth token non trovato");

        const response = await fetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = 'Processo accodato. Controllo lo stato...';
            // Avvia il polling
            pollForStatus(result.process_id, statusElement, button, originalText);
        } else {
            throw new Error(result.message || `Errore del server: ${response.status}`);
        }

    } catch (error) {
        console.error("Errore durante l'avvio dell'addestramento:", error);
        statusElement.textContent = `Errore: ${error.message}`;
        button.disabled = false; // Riattiva il pulsante in caso di errore iniziale
    }
}

function pollForStatus(processId, statusElement, button, originalText) {
    const intervalId = setInterval(async () => {
        try {
            const authToken = sessionStorage.getItem('authToken');
            const response = await fetch(`${window.BACKEND_URL}/api/get-training-status?process_id=${processId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                throw new Error(`Impossibile recuperare lo stato (HTTP ${response.status})`);
            }

            const data = await response.json();
            
            // Aggiorna l'UI con i dettagli ricevuti
            statusElement.textContent = `Stato: ${data.status} - ${data.details}`;

            // Controlla se il processo è terminato
            if (data.status === 'COMPLETATO' || data.status === 'FALLITO') {
                clearInterval(intervalId); // Ferma il polling
                button.disabled = false;   // Riattiva il pulsante
                button.querySelector('span').textContent = originalText;
                
                if(data.status === 'COMPLETATO'){
                    alert('Addestramento completato con successo!');
                } else {
                    alert('Addestramento fallito. Controlla i log per i dettagli.');
                }
            }
        } catch (error) {
            console.error("Errore durante il polling dello stato:", error);
            statusElement.textContent = `Errore durante il controllo dello stato.`;
            clearInterval(intervalId); // Ferma il polling anche in caso di errore
            button.disabled = false;
            button.querySelector('span').textContent = originalText;
        }
    }, 7000); // Controlla ogni 7 secondi
}