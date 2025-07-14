// js/script.js

document.addEventListener('DOMContentLoaded', () => {
    const updateAIDbBtn = document.getElementById('updateAIDbBtn');
    const chatStatus = document.getElementById('chatStatus'); // Usiamo lo stesso elemento di stato della chat per feedback

    if (updateAIDbBtn) {
        updateAIDbBtn.addEventListener('click', async (event) => {
            event.preventDefault(); // Impedisce il comportamento predefinito del link/button

            // URL della tua Google Cloud Function per l'aggiornamento della Knowledge Base
            // **CORREZIONE QUI:** L'URL della Cloud Function è l'URL completo della funzione.
            // Non combinare window.BACKEND_URL con l'URL completo se window.BACKEND_URL non è la base delle Cloud Functions.
            // Usiamo direttamente l'URL completo che hai fornito.
            const cloudFunctionUrl = "https://europe-west1-segretario-ai-web-app.cloudfunctions.net/ingestion-db-function";

            // NOMI DEI FOGLI DA CARICARE (MODIFICA QUI!)
            // Assicurati che questi nomi corrispondano esattamente ai nomi dei tuoi fogli su Google Sheets.
            const sheetNamesToLoad = [
                'Registrazioni',
                'Chat_AI',
                'Riferimento_Commessa'
            ];
            // Dati da inviare alla Cloud Function
            // Questi dovrebbero corrispondere ai parametri che la tua Cloud Function si aspetta
            const formData = new FormData();
            formData.append('spreadsheet_id', '1XQJ0Py2aACDtcOnc7Mi2orqaKWbNpZbpp9lAnIm1kv8'); // ID del tuo Foglio Google
            formData.append('sheet_names', sheetNamesToLoad.join(','));

            // Disabilita il pulsante e mostra un messaggio di stato
            updateAIDbBtn.disabled = true;
            if (chatStatus) {
                chatStatus.textContent = "Aggiornamento della Knowledge Base AI in corso... Potrebbe richiedere qualche minuto. ⏳";
                chatStatus.style.display = 'block'; // Assicurati che sia visibile
                chatStatus.style.color = '#333'; // Reset del colore in caso di errore precedente
            }

            try {
                const response = await fetch(cloudFunctionUrl, {
                    method: 'POST',
                    body: formData, // FormData viene inviato come multipart/form-data
                });

                if (!response.ok) {
                    const errorText = await response.text(); // Leggi la risposta come testo per gli errori
                    throw new Error(`Errore HTTP: ${response.status} - ${errorText}`);
                }

                const result = await response.json(); // La tua Cloud Function dovrebbe restituire JSON
                console.log('Risposta Cloud Function:', result);

                if (chatStatus) {
                    chatStatus.textContent = "Knowledge Base AI aggiornata con successo! ✅";
                    setTimeout(() => chatStatus.style.display = 'none', 5000); // Nascondi dopo 5 secondi
                }

            } catch (error) {
                console.error("Errore durante l'aggiornamento della Knowledge Base AI:", error);
                if (chatStatus) {
                    chatStatus.textContent = `Errore nell'aggiornamento: ${error.message}. Riprova. ❌`;
                    chatStatus.style.color = 'red'; // Rendi il messaggio di errore più visibile
                }
            } finally {
                updateAIDbBtn.disabled = false; // Riabilita il pulsante
            }
        });
    }
});