// File: js/training.js (Versione Corretta)

document.addEventListener('DOMContentLoaded', () => {
    const trainingButton = document.getElementById('openTrainingModalBtn');

    if (trainingButton) {
        trainingButton.addEventListener('click', (event) => {
            event.preventDefault();

            const isConfirmed = confirm("Sei sicuro di voler avviare l'addestramento?\nL'operazione potrebbe richiedere alcuni minuti.");

            if (isConfirmed) {
                startTrainingProcess(trainingButton);
            }
        });
    }
});

async function startTrainingProcess(button) {
    const originalText = button.querySelector('span').textContent;
    // Pulisci i messaggi di stato precedenti se esistono
    let statusElement = button.parentNode.querySelector('.training-status');
    if (statusElement) {
        statusElement.remove();
    }
    
    statusElement = document.createElement('p');
    statusElement.className = 'training-status'; // Aggiungi una classe per identificarlo
    statusElement.style.marginTop = '10px';
    button.parentNode.appendChild(statusElement);

    button.disabled = true;
    statusElement.textContent = 'Avvio del processo...';

    try {
        const authToken = getAuthToken(); 
        
        if (!authToken) {
            alert("Errore: sessione non valida. Effettua nuovamente il login.");
            throw new Error("Auth token non trovato");
        }

        const response = await fetch(`${window.BACKEND_URL}/api/trigger-knowledge-update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = 'Processo accodato. Controllo lo stato...';
            pollForStatus(result.process_id, statusElement, button, originalText);
        } else {
            throw new Error(result.message || `Errore del server: ${response.status}`);
        }

    } catch (error) {
        console.error("Errore durante l'avvio dell'addestramento:", error);
        statusElement.textContent = `Errore: ${error.message}`;
        button.disabled = false;
        button.querySelector('span').textContent = originalText;
    }
}

function pollForStatus(processId, statusElement, button, originalText) {
    const intervalId = setInterval(async () => {
        try {
            const authToken = getAuthToken();
            if (!authToken) {
                throw new Error("Token sparito durante il polling, login necessario.");
            }
            
            // --- ECCO LA CORREZIONE ---
            // Rimosso il trattino da BACK-END_URL
            const response = await fetch(`${window.BACKEND_URL}/api/get-training-status?process_id=${processId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                throw new Error(`Impossibile recuperare lo stato (HTTP ${response.status})`);
            }

            const data = await response.json();
            
            statusElement.textContent = `Stato: ${data.status} - ${data.details}`;

            if (data.status === 'COMPLETATO' || data.status === 'FALLITO') {
                clearInterval(intervalId);
                button.disabled = false;
                button.querySelector('span').textContent = originalText;
                
                if(data.status === 'COMPLETATO'){
                    alert('Addestramento completato con successo!');
                } else {
                    alert('Addestramento fallito. Controlla il foglio Training_Status per i dettagli.');
                }
            }
        } catch (error) {
            console.error("Errore durante il polling dello stato:", error);
            statusElement.textContent = `Errore durante il controllo dello stato: ${error.message}`;
            clearInterval(intervalId);

            button.disabled = false;
            button.querySelector('span').textContent = originalText;
        }
    }, 7000);
}