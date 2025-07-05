// js/new-order-modal.js

document.addEventListener('DOMContentLoaded', () => {
    const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
    const newOrderModal = document.getElementById('newOrderModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeNewOrderModalBtn = newOrderModal.querySelector('.close-button');
    const saveNewOrderButton = document.getElementById('saveNewOrderButton');

    // Elementi dei dropdown
    const modelloSelect = document.getElementById('newOrderModello');
    const statusSelect = document.getElementById('newOrderStatus');

    // Funzione per aprire il modale
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', async (event) => { // Reso async per fetchDynamicDropdownOptions
            event.preventDefault();
            newOrderModal.style.display = 'block';
            modalOverlay.style.display = 'block';
            console.log('Modale Nuova Commessa aperto.');
            // Popola dinamicamente i dropdown Modello e Status all'apertura del modale
            await fetchDynamicDropdownOptions();
        });
    }

    // Funzione per chiudere il modale e resettare il form
    window.closeNewOrderModal = function() {
        newOrderModal.style.display = 'none';
        modalOverlay.style.display = 'none';
        // Resetta i campi del form quando il modale viene chiuso
        document.getElementById('newOrderCliente').value = '';
        document.getElementById('newOrderImpianto').value = '';
        // Resetta i dropdown alla prima opzione disabilitata
        if (modelloSelect) modelloSelect.selectedIndex = 0;
        if (statusSelect) statusSelect.selectedIndex = 0;
        document.getElementById('newOrderVO').value = '';
        document.getElementById('newOrderCommessa').value = '';
        document.getElementById('newOrderData').value = '';
        document.getElementById('newOrderProvincia').value = '';
        document.getElementById('newOrderPaese').value = '';
        document.getElementById('newOrderAnno').value = '';
        document.getElementById('newOrderMatricola').value = '';
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
            const modello = modelloSelect.value; // Ottieni il valore selezionato
            const vo = document.getElementById('newOrderVO').value;
            const commessa = document.getElementById('newOrderCommessa').value;
            const data = document.getElementById('newOrderData').value;
            const provincia = document.getElementById('newOrderProvincia').value;
            const paese = document.getElementById('newOrderPaese').value;
            const anno = document.getElementById('newOrderAnno').value;
            const matricola = document.getElementById('newOrderMatricola').value;
            const status = statusSelect.value; // Ottieni il valore selezionato
            const note = document.getElementById('newOrderNote').value;
            const immagineFile = document.getElementById('newOrderImmagine').files[0]; // Prendi il primo file selezionato

            // Validazione minima (puoi espandere questa logica)
            if (!cliente || !impianto || !modello || !commessa || !data || !status) {
                alert('Per favore, compila tutti i campi obbligatori (Cliente, Impianto, Modello, Commessa, Data, Status).');
                return;
            }

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
                // Modificato da config.backendUrl a window.BACKEND_URL
                const response = await fetch(`${window.BACKEND_URL}/api/new-commessa`, {
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

    // Funzione per caricare dinamicamente le opzioni dei dropdown
    async function fetchDynamicDropdownOptions() {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            console.warn('Nessun token di autenticazione trovato per caricare i dropdown.');
            return;
        }

        // Utilizza window.BACKEND_URL per coerenza
        const backendUrl = window.BACKEND_URL;

        try {
            // Carica i Modelli
            const modelloResponse = await fetch(`${backendUrl}/api/get-modelli`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!modelloResponse.ok) throw new Error('Errore nel recupero dei modelli.');
            const modelli = await modelloResponse.json();
            
            // Pulisci e popola il dropdown Modello
            modelloSelect.innerHTML = '<option value="" disabled selected>Seleziona un modello</option>';
            modelli.forEach(modello => {
                const option = document.createElement('option');
                option.value = modello;
                option.textContent = modello;
                modelloSelect.appendChild(option);
            });
            console.log('Dropdown Modelli popolato.');

            // Carica gli Status
            const statusResponse = await fetch(`${backendUrl}/api/get-status`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!statusResponse.ok) throw new Error('Errore nel recupero degli status.');
            const statuses = await statusResponse.json();

            // Pulisci e popola il dropdown Status
            statusSelect.innerHTML = '<option value="" disabled selected>Seleziona uno status</option>';
            statuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                statusSelect.appendChild(option);
            });
            console.log('Dropdown Status popolato.');

        } catch (error) {
            console.error('Errore nel caricamento delle opzioni dropdown:', error);
            alert('Errore nel caricamento delle opzioni per Modello e Status. Riprova più tardi.');
        }
    }
});