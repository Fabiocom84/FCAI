// js/new-order-modal.js

class NewOrderModal {
    constructor(modalId, closeButtonSelector, openButtonSelector) {
        this.newOrderModal = document.getElementById(modalId);
        this.closeButton = this.newOrderModal ? this.newOrderModal.querySelector(closeButtonSelector) : null;
        this.openButton = document.querySelector(openButtonSelector); 
        
        // Elementi del form
        this.clienteInput = document.getElementById('newOrderCliente');
        this.impiantoInput = document.getElementById('newOrderImpianto');
        this.modelloSelect = document.getElementById('newOrderModello');
        this.voInput = document.getElementById('newOrderVO');
        this.commessaInput = document.getElementById('newOrderCommessa');
        this.dataInput = document.getElementById('newOrderData');
        this.provinciaInput = document.getElementById('newOrderProvincia');
        this.paeseInput = document.getElementById('newOrderPaese');
        this.annoInput = document.getElementById('newOrderAnno');
        this.matricolaInput = document.getElementById('newOrderMatricola');
        this.statusSelect = document.getElementById('newOrderStatus');
        this.noteTextarea = document.getElementById('newOrderNote');
        this.immagineInput = document.getElementById('newOrderImmagine');
        this.saveNewOrderButton = document.getElementById('saveNewOrderButton');

        this.isSaving = false; // Flag per prevenire doppi invii

        this.addEventListeners();
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', () => this.open());
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }
        if (this.newOrderModal) {
            // Chiudi il modale cliccando fuori dal contenuto
            this.newOrderModal.addEventListener('click', (event) => {
                if (event.target === this.newOrderModal) {
                    this.close();
                }
            });
        }
        if (this.saveNewOrderButton) {
            this.saveNewOrderButton.addEventListener('click', (event) => this.saveNewOrder(event));
        }

        // Aggiungi listener per la preview dell'immagine
        if (this.immagineInput) {
            this.immagineInput.addEventListener('change', this.previewImage.bind(this));
        }
    }

    open() {
        this.newOrderModal.style.display = 'block';
        this.resetForm(); // Resetta il form ogni volta che si apre
        this.populateDropdowns(); // Popola i dropdown all'apertura
    }

    close() {
        this.newOrderModal.style.display = 'none';
    }

    resetForm() {
        this.clienteInput.value = '';
        this.impiantoInput.value = '';
        this.modelloSelect.value = ''; // Reset della selezione
        this.voInput.value = '';
        this.commessaInput.value = '';
        this.dataInput.value = '';
        this.provinciaInput.value = '';
        this.paeseInput.value = '';
        this.annoInput.value = '';
        this.matricolaInput.value = '';
        this.statusSelect.value = ''; // Reset della selezione
        this.noteTextarea.value = '';
        this.immagineInput.value = ''; // Resetta anche il campo file
        
        const imagePreview = document.getElementById('newOrderImmaginePreview');
        if (imagePreview) {
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
        }

        this.resetSaveButton();
    }

    resetSaveButton() {
        this.isSaving = false;
        this.saveNewOrderButton.textContent = 'Salva Commessa';
        this.saveNewOrderButton.disabled = false;
        this.saveNewOrderButton.classList.remove('saving');
    }

    setSavingState() {
        this.isSaving = true;
        this.saveNewOrderButton.textContent = 'Salvataggio in corso...';
        this.saveNewOrderButton.disabled = true;
        this.saveNewOrderButton.classList.add('saving');
    }

    previewImage() {
        const file = this.immagineInput.files[0];
        const imagePreview = document.getElementById('newOrderImmaginePreview');

        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
        }
    }

    async populateDropdowns() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('Authentication token not found.');
            alert('Autenticazione richiesta. Effettua il login.');
            window.location.href = 'login.html'; // Reindirizza al login
            return;
        }

        // Popola Modello dropdown
        if (this.modelloSelect) {
            try {
                const response = await fetch(`${window.BACKEND_URL}/api/get-modelli`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const models = data.models; // Assumi che la risposta contenga un campo 'models'
                
                this.modelloSelect.innerHTML = '<option value="" disabled selected>Seleziona un modello</option>';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    this.modelloSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Errore nel recupero dei modelli:', error);
                alert('Impossibile caricare i modelli. Controlla la console per dettagli.');
            }
        }

        // Popola Status dropdown (MODIFICA QUI LA URL)
        if (this.statusSelect) {
            try {
                // *** MODIFICA QUI: Da /api/get-statuses a /api/get-all-statuses ***
                const response = await fetch(`${window.BACKEND_URL}/api/get-all-statuses`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (!response.ok) throw new Error(`HTTP error! statuses: ${response.status}`);
                const data = await response.json();
                const statuses = data.statuses; // Assumi che la risposta contenga un campo 'statuses'
                
                this.statusSelect.innerHTML = '<option value="" disabled selected>Seleziona uno status</option>';
                statuses.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    this.statusSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Errore nel recupero degli status:', error);
                alert('Impossibile caricare gli status. Controlla la console per dettagli.');
            }
        }
        
        // Popola Etichette dropdown (NUOVO)
        if (this.etichetteSelect) { // Assicurati di avere un elemento con id 'newOrderEtichette' nel tuo HTML
            try {
                const response = await fetch(`${window.BACKEND_URL}/api/get-etichette`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const etichette = data.etichette; // Assumi che la risposta contenga un campo 'etichette'
                
                this.etichetteSelect.innerHTML = '<option value="" disabled selected>Seleziona un\'etichetta</option>';
                etichette.forEach(etichetta => {
                    const option = document.createElement('option');
                    option.value = etichetta;
                    option.textContent = etichetta;
                    this.etichetteSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Errore nel recupero delle etichette:', error);
                alert('Impossibile caricare le etichette. Controlla la console per dettagli.');
            }
        }
    }


    async saveNewOrder(event) {
        event.preventDefault(); // Impedisci l'invio predefinito del form

        if (this.isSaving) return;
        this.setSavingState();

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta. Effettua il login.');
            this.resetSaveButton();
            window.location.href = 'login.html'; // Reindirizza al login
            return;
        }

        // Recupera i valori dai campi
        const cliente = this.clienteInput.value;
        const impianto = this.impiantoInput.value;
        const modello = this.modelloSelect.value;
        const vo = this.voInput.value;
        const commessa = this.commessaInput.value;
        const data = this.dataInput.value; // La data è già nel formato YYYY-MM-DD
        const provincia = this.provinciaInput.value;
        const paese = this.paeseInput.value;
        const anno = this.annoInput.value;
        const matricola = this.matricolaInput.value;
        const status = this.statusSelect.value;
        const note = this.noteTextarea.value;

        // Validazione semplice
        if (!cliente || !impianto || !modello || !vo || !commessa || !data || !provincia || !paese || !anno || !matricola || !status) {
            alert('Per favore, compila tutti i campi obbligatori.');
            this.resetSaveButton();
            return;
        }

        let immagineBase64 = null;
        const file = this.immagineInput.files[0];
        if (file) {
            // Converti l'immagine in Base64
            immagineBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]); // Prendi solo la parte Base64
                reader.readAsDataURL(file);
            });
        }

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/new-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    cliente,
                    impianto,
                    modello,
                    vo,
                    commessa,
                    data,
                    provincia,
                    paese,
                    anno,
                    matricola,
                    status,
                    note,
                    immagine: immagineBase64
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert('🎉 Nuova commessa salvata con successo!');
            console.log('Risposta salvataggio nuova commessa:', result);
            
            this.close(); // Chiudi il modale
            
            // Aggiorna la lista degli ultimi inserimenti sulla pagina principale
            if (typeof window.fetchLatestEntries === 'function') {
                window.fetchLatestEntries();
            }

        } catch (error) {
            console.error('Errore durante il salvataggio della nuova commessa:', error);
            alert('🚨 Errore durante il salvataggio della nuova commessa: ' + error.message);
        } finally {
            this.resetSaveButton(); // Riabilita il pulsante e resetta lo stato
        }
    }
}

// Inizializza il modale Nuova Commessa quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente per main.js
    window.newOrderModalInstance = new NewOrderModal('newOrderModal', '.close-button', '#openNewOrderModalBtn');
});