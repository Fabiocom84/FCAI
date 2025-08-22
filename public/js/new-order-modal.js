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

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    // Elementi per l'animazione di caricamento
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'newOrderLoadingIndicator';
    loadingIndicator.style.display = 'none'; // Inizialmente nascosto
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.borderRadius = '8px';
    loadingIndicator.style.zIndex = '1000';
    loadingIndicator.style.textAlign = 'center';
    loadingIndicator.innerHTML = `
        <div class="spinner" style="
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #007bff;
            animation: spin 1s ease infinite;
            margin: 0 auto 10px;
        "></div>
        <p>Salvataggio in corso...</p>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    newOrderModal.appendChild(loadingIndicator); // Aggiungi l'indicatore al modale

    // Funzione per mostrare l'indicatore di caricamento
    function showLoading() {
        loadingIndicator.style.display = 'block';
        saveNewOrderButton.disabled = true; // Disabilita il pulsante durante il caricamento
        saveNewOrderButton.style.opacity = '0.7';
        saveNewOrderButton.style.cursor = 'not-allowed';
    }

    // Funzione per nascondere l'indicatore di caricamento
    function hideLoading() {
        loadingIndicator.style.display = 'none';
        saveNewOrderButton.disabled = false; // Riabilita il pulsante
        saveNewOrderButton.style.opacity = '1';
        saveNewOrderButton.style.cursor = 'pointer';
    }


    // Funzione per aprire il modale
    if (openNewOrderModalBtn) {
        openNewOrderModalBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            newOrderModal.style.display = 'block';
            modalOverlay.style.display = 'block';
            console.log('Modale Nuova Commessa aperto.');
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
        document.getElementById('newOrderImmagine').value = '';
        hideLoading(); // Assicurati che l'indicatore sia nascosto alla chiusura
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

            const cliente = document.getElementById('newOrderCliente').value;
            const impianto = document.getElementById('newOrderImpianto').value;
            const modello = modelloSelect.value;
            const vo = document.getElementById('newOrderVO').value;
            const commessa = document.getElementById('newOrderCommessa').value;
            const data = document.getElementById('newOrderData').value;
            const provincia = document.getElementById('newOrderProvincia').value;
            const paese = document.getElementById('newOrderPaese').value;
            const anno = document.getElementById('newOrderAnno').value;
            const matricola = document.getElementById('newOrderMatricola').value;
            const status = statusSelect.value;
            const note = document.getElementById('newOrderNote').value;
            const immagineFile = document.getElementById('newOrderImmagine').files[0];

            if (!cliente || !impianto || !modello || !commessa || !data || !status) {
                alert('Per favor, compila tutti i campi obbligatori (Cliente, Impianto, Modello, Commessa, Data, Status).');
                return;
            }

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
                formData.append('immagine', immagineFile);
            }

            showLoading(); // Mostra l'indicatore di caricamento

            try {
                const response = await fetch(`${window.BACKEND_URL}/api/new-commessa`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Errore durante il salvataggio della commessa.');
                }

                const result = await response.json();
                console.log('Commessa salvata con successo:', result);
                alert('Nuova commessa aggiunta con successo!');
                closeNewOrderModal();

            } catch (error) {
                console.error('Errore nel salvataggio della nuova commessa:', error);
                alert('Errore nel salvataggio della nuova commessa: ' + error.message);
            } finally {
                hideLoading(); // Nascondi l'indicatore di caricamento in ogni caso
            }
        });
    }

    // Funzione per mostrare l'indicatore di caricamento
    function showLoadingIndicator() {
        const loadingIndicator = document.getElementById('newOrderLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
    }

    // Funzione per nascondere l'indicatore di caricamento
    function hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('newOrderLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    async function fetchDynamicDropdownOptions() {
    console.log('Avvio del caricamento delle opzioni per i dropdown...');
    showLoadingIndicator();

    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('Token di autenticazione non trovato.');
            hideLoadingIndicator();
            return;
        }

        // --- Gestione Dropdown Modelli ---
        const modelliResponse = await fetch(`${backendUrl}/api/get-modelli`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!modelliResponse.ok) {
            throw new Error('Errore nel recupero dei modelli.');
        }

        const modelliData = await modelliResponse.json();
        const modelli = modelliData.modelli || [];

        console.log('Dati Modelli ricevuti:', modelli);

        // Assicurati che l'elemento esista prima di manipolarlo
        if (modelloSelect) {
            // Svuota il dropdown e aggiungi l'opzione di default
            modelloSelect.innerHTML = '<option value="" disabled selected>Seleziona un modello</option>';
            if (modelli.length > 0) {
                modelli.forEach(modello => {
                    const option = document.createElement('option');
                    option.value = modello;
                    option.textContent = modello;
                    modelloSelect.appendChild(option);
                });
                console.log('Dropdown Modelli popolato.');
            } else {
                console.warn('L\'array dei modelli è vuoto. Nessuna opzione aggiunta.');
            }
        }

        // --- Gestione Dropdown Status ---
        const statusResponse = await fetch(`${backendUrl}/api/get-all-statuses`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!statusResponse.ok) {
            throw new Error('Errore nel recupero degli status.');
        }

        const statusData = await statusResponse.json();
        const statuses = statusData.statuses || [];
        
        console.log('Dati Status ricevuti:', statuses);

        if (statusSelect) {
            statusSelect.innerHTML = '<option value="" disabled selected>Seleziona uno status</option>';
            if (statuses.length > 0) {
                statuses.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    statusSelect.appendChild(option);
                });
                console.log('Dropdown Status popolato.');
            } else {
                console.warn('L\'array degli status è vuoto. Nessuna opzione aggiunta.');
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle opzioni dropdown:', error);
    } finally {
        hideLoadingIndicator();
    }
}
});