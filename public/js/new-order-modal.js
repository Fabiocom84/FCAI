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
        this.populateDropdowns(); // Popola i dropdown all'inizializzazione
    }

    addEventListeners() {
        if (this.openButton) {
            this.openButton.addEventListener('click', this.open.bind(this));
        }
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.close.bind(this));
        }
        // Event listener per chiudere il modale cliccando fuori
        if (this.newOrderModal) {
            this.newOrderModal.addEventListener('click', this.handleOutsideClick.bind(this));
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
            this.resetSaveButton(); // Assicurati che il pulsante sia resettato
            console.log('Modale Nuova Commessa aperto.');
        }
    }

    close() {
        if (this.newOrderModal) {
            this.newOrderModal.style.display = 'none';
            window.hideOverlay(); // Funzione centralizzata per l'overlay
            this.clearForm(); // Pulisci il form alla chiusura
            this.resetSaveButton(); // Resetta lo stato del pulsante
            console.log('Modale Nuova Commessa chiuso.');
        }
    }

    // Metodo per gestire il click esterno
    handleOutsideClick(event) {
        // Se l'elemento cliccato è il modale stesso (ovvero lo sfondo overlay che il modale occupa)
        // e non un elemento figlio del modale, allora chiudi
        if (event.target === this.newOrderModal) {
            this.close();
        }
    }

    clearForm() {
        if (this.clienteInput) this.clienteInput.value = '';
        if (this.impiantoInput) this.impiantoInput.value = '';
        if (this.modelloSelect) this.modelloSelect.selectedIndex = 0;
        if (this.voInput) this.voInput.value = '';
        if (this.commessaInput) this.commessaInput.value = '';
        if (this.dataInput) {
            // Imposta la data corrente come valore predefinito
            const today = new Date();
            this.dataInput.value = today.toISOString().split('T')[0];
        }
        if (this.provinciaInput) this.provinciaInput.value = '';
        if (this.paeseInput) this.paeseInput.value = '';
        if (this.annoInput) this.annoInput.value = new Date().getFullYear(); // Imposta l'anno corrente
        if (this.matricolaInput) this.matricolaInput.value = '';
        if (this.statusSelect) this.statusSelect.selectedIndex = 0;
        if (this.noteTextarea) this.noteTextarea.value = '';
        if (this.immagineInput) this.immagineInput.value = ''; // Resetta il campo file
    }

    resetSaveButton() {
        if (this.saveNewOrderButton) {
            this.saveNewOrderButton.disabled = false;
            this.saveNewOrderButton.textContent = 'Salva Nuova Commessa';
            this.isSaving = false;
        }
    }

    async populateDropdowns() {
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            console.warn('Autenticazione richiesta per popolare i dropdown. Skipping.');
            return;
        }
        if (!window.BACKEND_URL) {
            console.error("URL del backend non definito per popolare i dropdown.");
            return;
        }

        // Popola Modello dropdown
        if (this.modelloSelect) {
            try {
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
                alert('Impossibile caricare i modelli. Controlla la console per dettagli.');
            }
        }

        // Popola Status dropdown
        if (this.statusSelect) {
            try {
                const response = await fetch(`${window.BACKEND_URL}/api/get-statuses`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (!response.ok) throw new Error(`HTTP error! statuses: ${response.status}`);
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
                alert('Impossibile caricare gli status. Controlla la console per dettagli.');
            }
        }
    }

    validateForm(data) {
        // Esempio di validazione minima per alcuni campi obbligatori
        const requiredFields = ['cliente', 'impianto', 'modello', 'commessa', 'data', 'provincia', 'paese', 'anno', 'matricola', 'status'];
        for (const field of requiredFields) {
            if (!data[field] || String(data[field]).trim() === '' || data[field] === 'Seleziona un modello' || data[field] === 'Seleziona uno status') {
                alert(`Il campo '${field}' è obbligatorio.`);
                return false;
            }
        }
        if (isNaN(data.anno) || data.anno < 1900 || data.anno > new Date().getFullYear() + 5) { // Esempio di validazione per anno
            alert('L\'anno deve essere un numero valido.');
            return false;
        }
        // Puoi aggiungere qui altre logiche di validazione (es. formati email, numeri, lunghezze min/max)
        return true;
    }

    async saveNewOrder() {
        if (this.isSaving) {
            console.log("Salvataggio già in corso, ignorando click.");
            return;
        }

        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (!authToken) {
            alert('Autenticazione richiesta per salvare una nuova commessa. Effettua il login.');
            return;
        }
        if (!window.BACKEND_URL) {
            alert('Errore: URL del backend non configurato. Impossibile salvare la commessa.');
            console.error("URL del backend non definito.");
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
            anno: parseInt(this.annoInput.value), // Assicurati che sia un numero
            matricola: this.matricolaInput.value,
            status: this.statusSelect.value,
            note: this.noteTextarea.value
        };

        if (!this.validateForm(newOrderData)) {
            return; // Ferma il salvataggio se la validazione fallisce
        }

        // Gestione dell'immagine (se presente)
        const imageData = this.immagineInput.files[0];
        const formData = new FormData();

        for (const key in newOrderData) {
            formData.append(key, newOrderData[key]);
        }
        if (imageData) {
            formData.append('immagine', imageData);
        }

        this.isSaving = true;
        this.saveNewOrderButton.disabled = true;
        this.saveNewOrderButton.textContent = 'Salvataggio in corso...';

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/new-commessa`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                    // 'Content-Type': 'multipart/form-data' NON IMPOSTARE, FormData lo gestisce automaticamente
                },
                body: formData
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