// js/new-order-modal.js

document.addEventListener('DOMContentLoaded', () => {
    const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
    const newOrderModal = document.getElementById('newOrderModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeNewOrderModalBtn = newOrderModal.querySelector('.close-button');
    const saveNewOrderButton = document.getElementById('saveNewOrderButton');

    // Funzione per aprire il modale
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', (event) => {
            event.preventDefault();
            newOrderModal.style.display = 'block';
            modalOverlay.style.display = 'block';
            console.log('Modale Nuova Commessa aperto.');
            // Qui potresti voler popolare dinamicamente i dropdown Modello e Status se la logica è già pronta
            // fetchDynamicDropdownOptions(); 
        });
    }

    // Funzione per chiudere il modale e resettare il form
    window.closeNewOrderModal = function() {
        newOrderModal.style.display = 'none';
        modalOverlay.style.display = 'none';
        // Resetta i campi del form quando il modale viene chiuso
        document.getElementById('newOrderCliente').value = '';
        document.getElementById('newOrderImpianto').value = '';
        document.getElementById('newOrderModello').value = ''; // o resetta alla prima opzione
        document.getElementById('newOrderVO').value = '';
        document.getElementById('newOrderCommessa').value = '';
        document.getElementById('newOrderData').value = '';
        document.getElementById('newOrderProvincia').value = '';
        document.getElementById('newOrderPaese').value = '';
        document.getElementById('newOrderAnno').value = '';
        document.getElementById('newOrderMatricola').value = '';
        document.getElementById('newOrderStatus').value = ''; // o resetta alla prima opzione
        document.getElementById('newOrderNote').value = '';
        document.getElementById('newOrderImmagine').value = ''; // Resetta il campo file
        console.log('Modale Nuova Commessa chiuso e form resettato.');
    };

    // Event listener per il pulsante di chiusura (X)
    if (closeNewOrderModalBtn) {
        closeNewOrderModalBtn.addEventListener('click', () => {
            closeNewOrderModal();
        });
    }

    // Chiudi il modale cliccando sull'overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                closeNewOrderModal();
            }
        });
    }

    // Gestione del salvataggio dei dati
    if (saveNewOrderButton) {
        saveNewOrderButton.addEventListener('click', async () => {
            console.log('Pulsante "Salva Nuova Commessa" cliccato.');

            const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            if (!authToken) {
                alert('Autenticazione richiesta. Effettua il login.');
                window.location.href = '/login.html';
                return;
            }

            // Raccogli i dati dal form
            const cliente = document.getElementById('newOrderCliente').value;
            const impianto = document.getElementById('newOrderImpianto').value;
            const modello = document.getElementById('newOrderModello').value;
            const vo = document.getElementById('newOrderVO').value;
            const commessa = document.getElementById('newOrderCommessa').value;
            const data = document.getElementById('newOrderData').value;
            const provincia = document.getElementById('newOrderProvincia').value;
            const paese = document.getElementById('newOrderPaese').value;
            const anno = document.getElementById('newOrderAnno').value;
            const matricola = document.getElementById('newOrderMatricola').value;
            const status = document.getElementById('newOrderStatus').value;
            const note = document.getElementById('newOrderNote').value;
            const immagineFile = document.getElementById('newOrderImmagine').files[0]; // Prendi il primo file selezionato

            // Crea un oggetto FormData per inviare sia i dati di testo che il file
            const formData = new FormData();
            formData.append('cliente', cliente);
            formData.append('impianto', impianto);
            formData.append('modello', modello);
            formData.append('vo', vo);
            formData.append('commessa', commessa);
            formData.append('data', data);
            formData.append('provincia', provincia);
            formData.append('paese', paese);
            formData.append('anno', anno);
            formData.append('matricola', matricola);
            formData.append('status', status);
            formData.append('note', note);
            if (immagineFile) {
                formData.append('immagine', immagineFile); // Allega il file immagine
            }

            try {
                // Invia i dati al backend
                const response = await fetch(`${config.backendUrl}/api/new-commessa`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                        // Non impostare 'Content-Type': 'multipart/form-data' qui, 
                        // fetch lo imposta automaticamente con FormData e il boundary corretto.
                    },
                    body: formData // Invia il FormData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Errore durante il salvataggio della commessa.');
                }

                const result = await response.json();
                console.log('Commessa salvata con successo:', result);
                alert('Nuova commessa aggiunta con successo!');
                closeNewOrderModal(); // Chiudi il modale dopo il successo

                // Qui potresti voler aggiornare la lista degli "Ultimi Inserimenti" se pertinente
                // O triggerare un refresh dei dati principali
            } catch (error) {
                console.error('Errore nel salvataggio della nuova commessa:', error);
                alert('Errore nel salvataggio della nuova commessa: ' + error.message);
            }
        });
    }
});

// Funzione (placeholder) per caricare dinamicamente le opzioni dei dropdown
// Questa funzione dovrà fare una chiamata al backend per recuperare i dati
// e poi popolare gli elementi <select> corrispondenti.
// Sarà implementata quando decideremo di rendere i dropdown dinamici.
/*
async function fetchDynamicDropdownOptions() {
    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!authToken) return;

    try {
        // Esempio per Modello:
        const modelloResponse = await fetch(`${config.backendUrl}/api/get-modelli`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const modelli = await modelloResponse.json();
        const modelloSelect = document.getElementById('newOrderModello');
        modelloSelect.innerHTML = '<option value="" disabled selected>Seleziona un modello</option>';
        modelli.forEach(modello => {
            const option = document.createElement('option');
            option.value = modello.value; // Assumi che il backend restituisca { value: '...', text: '...' }
            option.textContent = modello.text;
            modelloSelect.appendChild(option);
        });

        // Esempio per Status:
        const statusResponse = await fetch(`${config.backendUrl}/api/get-status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const statuses = await statusResponse.json();
        const statusSelect = document.getElementById('newOrderStatus');
        statusSelect.innerHTML = '<option value="" disabled selected>Seleziona uno status</option>';
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            option.textContent = status.text;
            statusSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Errore nel caricamento delle opzioni dropdown:', error);
    }
}
*/