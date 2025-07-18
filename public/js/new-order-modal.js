// js/new-order-modal.js

class NewOrderModal {
    constructor(modalId, closeButtonSelector, openButtonSelector) {
        this.newOrderModal = document.getElementById(modalId);
        this.closeButton = this.newOrderModal ? this.newOrderModal.querySelector(closeButtonSelector) : null;
        this.openButton = document.querySelector(openButtonSelector); // Se c'è un pulsante dedicato all'apertura del modale
        
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

        this.addEventListeners();
        this.populateDropdowns(); // Popola i dropdown all'inizializzazione
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }
        if (this.saveNewOrderButton) {
            this.saveNewOrderButton.addEventListener('click', this.saveNewOrder.bind(this));
        }
    }

    open() {
        if (this.newOrderModal) {
            this.newOrderModal.style.display = 'block';
            window.showOverlay(); // Funzione centralizzata per l'overlay
            this.clearForm(); // Pulisci il form ogni volta che apri il modale
            console.log('Modale Nuova Commessa aperto.');
        }
    }

    close() {
        if (this.newOrderModal) {
            this.newOrderModal.style.display = 'none';
            window.hideOverlay(); // Funzione centralizzata per l'overlay
            console.log('Modale Nuova Commessa chiuso.');
        }
    }

    clearForm() {
        if (this.clienteInput) this.clienteInput.value = '';
        if (this.impiantoInput) this.impiantoInput.value = '';
        if (this.modelloSelect) this.modelloSelect.selectedIndex = 0; // Seleziona la prima opzione (disabilitata)
        if (this.voInput) this.voInput.value = '';
        if (this.commessaInput) this.commessaInput.value = '';
        if (this.dataInput) this.dataInput.value = '';
        if (this.provinciaInput) this.provinciaInput.value = '';
        if (this.paeseInput) this.paeseInput.value = '';
        if (this.annoInput) this.annoInput.value = '';
        if (this.matricolaInput) this.matricolaInput.value = '';
        if (this.statusSelect) this.statusSelect.selectedIndex = 0; // Seleziona la prima opzione (disabilitata)
        if (this.noteTextarea) this.noteTextarea.value = '';
        if (this.immagineInput) this.immagineInput.value = ''; // Resetta il campo file
    }

    async populateDropdowns() {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            console.error('Autenticazione richiesta per popolare i dropdown.');
            return;
        }

        // Popola Modello dropdown
        if (this.modelloSelect) {
            try {
                // MODIFICA QUI: Cambia da /api/models a /api/get-modelli
                const response = await fetch(`${window.BACKEND_URL}/api/get-modelli`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const models = await response.json();
                this.modelloSelect.innerHTML = '<option value="" disabled selected>Seleziona un modello</option>';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    this.modelloSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Errore nel recupero dei modelli:', error);
            }
        }

        // Popola Status dropdown
        if (this.statusSelect) {
            try {
                // MODIFICA QUI: Cambia da /api/statuses a /api/get-status
                const response = await fetch(`${window.BACKEND_URL}/api/get-status`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const statuses = await response.json();
                this.statusSelect.innerHTML = '<option value="" disabled selected>Seleziona uno status</option>';
                statuses.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    this.statusSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Errore nel recupero degli status:', error);
            }
        }
    }

    async saveNewOrder() {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta per salvare una nuova commessa.');
            return;
        }

        const newOrderData = {
            cliente: this.clienteInput.value,
            impianto: this.impiantoInput.value,
            modello: this.modelloSelect.value,
            vo: this.voInput.value,
            commessa: this.commessaInput.value,
            data: this.dataInput.value,
            provincia: this.provinciaInput.value,
            paese: this.paeseInput.value,
            anno: parseInt(this.annoInput.value),
            matricola: this.matricolaInput.value,
            status: this.statusSelect.value,
            note: this.noteTextarea.value
        };

        // Gestione dell'immagine (se presente)
        const imageData = this.immagineInput.files[0];
        const formData = new FormData();

        for (const key in newOrderData) {
            formData.append(key, newOrderData[key]);
        }
        if (imageData) {
            formData.append('immagine', imageData);
        }

        this.saveNewOrderButton.disabled = true; // Disabilita il pulsante durante il salvataggio

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/new-commessa`, { // Ho corretto anche questo endpoint
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                    // Non impostare 'Content-Type' per FormData, il browser lo fa automaticamente
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert('Nuova commessa salvata con successo!');
            console.log('Risposta salvataggio nuova commessa:', result);
            this.clearForm(); // Pulisci il form dopo il successo
            this.close(); // Chiudi il modale
            
            // Aggiorna la lista degli ultimi inserimenti sulla pagina principale
            if (typeof window.fetchLatestEntries === 'function') {
                window.fetchLatestEntries();
            }

        } catch (error) {
            console.error('Errore durante il salvataggio della nuova commessa:', error);
            alert('Errore durante il salvataggio della nuova commessa: ' + error.message);
        } finally {
            this.saveNewOrderButton.disabled = false; // Riabilita il pulsante
        }
    }
}

// Inizializza il modale Nuova Commessa quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Istanzia la classe e la rende disponibile globalmente per main.js
    window.newOrderModalInstance = new NewOrderModal('newOrderModal', '.close-button', '#openNewOrderModalBtn');
});