// js/gestione.js - Versione Completa, Corretta e Ottimizzata

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const App = {

    dom: {},
    state: {
        currentView: null,
        activeFilters: {},
        tableData: [],
        currentPage: 1,
        isAddingNewRow: false,
        isEditingRow: false,
        lastSelectedRadio: null,
    },
    viewConfig: {
        'clienti': {
            apiEndpoint: '/api/clienti',
            columns: [
                { key: 'ragione_sociale', label: 'Ragione Sociale', editable: true },
                { key: 'codice_cliente', label: 'Codice Cliente', editable: true }
            ],
            idColumn: 'id_cliente'    
            },
        'ruoli': {
            apiEndpoint: '/api/ruoli',
            columns: [
                { key: 'nome_ruolo', label: 'Nome Ruolo', editable: true },
                { key: 'descrizione_ruolo', label: 'Descrizione', editable: true }
            ],
            idColumn: 'id_ruolo'
        },
        'aziende': {
            apiEndpoint: '/api/aziende',
            columns: [
                { key: 'ragione_sociale', label: 'Ragione Sociale', editable: true },
                { key: 'sede', label: 'Sede', editable: true }
            ],
            idColumn: 'id_azienda'
        },
        'modelli': {
            apiEndpoint: '/api/modelli',
            columns: [
                { key: 'nome_modello', label: 'Nome Modello', editable: true },
                { key: 'descrizione_modello', label: 'Descrizione', editable: true }
            ],
            idColumn: 'id_modello'
        },
        'commesse': {
            apiEndpoint: '/api/commesse',
            idColumn: 'id_commessa',
            defaultSortBy: 'data_commessa',
            defaultSortOrder: 'desc',
            columns: [
                { 
                    key: 'id_cliente_fk', 
                    label: 'Cliente', 
                    editable: true,
                    type: 'foreignKey',
                    formatter: (rowData) => rowData.clienti?.ragione_sociale || 'N/A',
                    options: { apiEndpoint: '/api/simple/clienti', valueField: 'id_cliente', textField: 'ragione_sociale' },
                    // --- FIX: Tell the filter to use the ID ---
                    filterOptions: { 
                        key: 'id_cliente_fk', // Use the ID column for filtering
                        apiEndpoint: '/api/simple/clienti', 
                        valueField: 'id_cliente', // The value of the checkbox
                        textField: 'ragione_sociale' // The text shown to the user
                    }
                },
                { 
                    key: 'impianto', 
                    label: 'Impianto', 
                    editable: true, 
                    filterOptions: { key: 'impianto' }
                },
                { 
                    key: 'id_status_fk', 
                    label: 'Stato', 
                    editable: true,
                    type: 'foreignKey',
                    formatter: (rowData) => rowData.status_commessa?.nome_status || 'N/A',
                    options: { apiEndpoint: '/api/simple/status_commessa', valueField: 'id_status', textField: 'nome_status' },
                    // --- FIX: Tell the filter to use the ID ---
                    filterOptions: { 
                        key: 'id_status_fk',
                        apiEndpoint: '/api/simple/status_commessa', 
                        valueField: 'id_status', 
                        textField: 'nome_status' 
                    }
                },
                {
                    key: 'id_modello_fk',
                    label: 'Modello',
                    editable: true,
                    type: 'foreignKey',
                    formatter: (rowData) => rowData.modelli?.nome_modello || 'N/A',
                    options: { apiEndpoint: '/api/simple/modelli', valueField: 'id_modello', textField: 'nome_modello' },
                    // --- FIX: Tell the filter to use the ID ---
                    filterOptions: { 
                        key: 'id_modello_fk',
                        apiEndpoint: '/api/simple/modelli', 
                        valueField: 'id_modello', 
                        textField: 'nome_modello' 
                    }
                },
                { 
                    key: 'data_commessa', 
                    label: 'Data', 
                    editable: true, 
                    type: 'date',
                    formatter: (rowData) => rowData.data_commessa ? new Date(rowData.data_commessa).toLocaleDateString('it-IT') : '',
                    filterOptions: { key: 'data_commessa' }
                },
                { 
                    key: 'anno', 
                    label: 'Anno', 
                    editable: true,
                    filterOptions: { key: 'anno' }
                },
                { 
                    key: 'vo', 
                    label: 'VO', 
                    editable: true,
                    filterOptions: { key: 'vo' }
                },
                { 
                    key: 'riferimento_tecnico', 
                    label: 'Rif. Tecnico', 
                    editable: true,
                    filterOptions: { key: 'riferimento_tecnico' }
                },
                { key: 'provincia', label: 'Provincia', editable: true },
                { key: 'paese', label: 'Paese', editable: true },
                { key: 'matricola', label: 'Matricola', editable: true },
                { 
                    key: 'immagine', 
                    label: 'Immagine', 
                    editable: false,
                    formatter: (rowData) => {
                        if (!rowData.immagine) return 'No';
                        return `<a href="${rowData.immagine}" target="_blank">Apri</a>`;
                    }
                },
                { key: 'note', label: 'Note', editable: true, type: 'textarea' }
            ]
        },
        'registrazioni': {
            apiEndpoint: '/api/registrazioni',
            idColumn: 'id_registrazione',
            defaultSortBy: 'data_creazione',
            defaultSortOrder: 'desc', 
            columns: [
                { 
                    key: 'data_creazione', 
                    label: 'Data', 
                    editable: true, 
                    type: 'datetime-local',
                    formatter: (rowData) => new Date(rowData.data_creazione).toLocaleString('it-IT'),
                    // --- NUOVA CONFIGURAZIONE FILTRO DATA ---
                    filterOptions: {
                        apiEndpoint: '/api/distinct-dates/registrazioni/data_creazione',
                        // Poiché l'API restituisce una lista semplice, non servono textField/valueField
                    }
                },
                { 
                    key: 'id_commessa_fk', 
                    label: 'Commessa', 
                    editable: true,
                    type: 'foreignKey',
                    formatter: (rowData) => {
                        if (!rowData.commesse) return 'N/A';
                        const cliente = rowData.commesse.clienti?.ragione_sociale;
                        const impianto = rowData.commesse.impianto;
                        const vo = rowData.commesse.vo;
                        const riferimento = rowData.commesse.riferimento_tecnico;
                
                        // Filtra le parti non definite e le unisce
                        const parts = [cliente, impianto, vo, riferimento].filter(Boolean);
                        return parts.join(' | ');
                    },
                    options: { apiEndpoint: '/api/get-etichette', valueField: 'id', textField: 'label' },
                    // --- NUOVA CONFIGURAZIONE FILTRO COMMESSA ---
                    filterOptions: {
                        key: 'commesse.id_commessa', // La chiave da usare per il filtro nel backend
                        apiEndpoint: '/api/get-etichette', // L'API da cui prendere le opzioni
                        valueField: 'id',        // La proprietà da usare come valore del filtro
                        textField: 'label'       // La proprietà da mostrare nella lista
                    }
                },
                { key: 'contenuto_testo', label: 'Testo', editable: true, type: 'textarea' },
                { 
                    key: 'url_allegato', 
                    label: 'Allegato', 
                    editable: false,
                    formatter: (rowData) => {
                        if (!rowData.url_allegato) return 'Nessuno';
                        return `<a href="${rowData.url_allegato}" target="_blank">Apri file</a>`;
                    }
                }
            ]
        },
        'personale': {
            apiEndpoint: '/api/personale',
            idColumn: 'id_personale',
            columns: [
                { key: 'nome_cognome', label: 'Nome Cognome', editable: true, type: 'text', filterOptions: { key: 'nome_cognome' } },
                { 
                    key: 'data_nascita', 
                    label: 'Data di Nascita', 
                    editable: true, 
                    type: 'date',
                    formatter: (rowData) => rowData.data_nascita ? new Date(rowData.data_nascita).toLocaleDateString('it-IT') : ''
                },
                { key: 'email', label: 'Email', editable: true, type: 'text', filterOptions: { key: 'email' } },
                { 
                    key: 'id_ruolo_fk', 
                    label: 'Ruolo', 
                    editable: true, 
                    type: 'foreignKey',
                    options: { apiEndpoint: '/api/simple/ruoli', valueField: 'id_ruolo', textField: 'nome_ruolo' },
                    formatter: (rowData) => rowData.ruoli?.nome_ruolo || 'N/A',
                    // --- FIX: Point the filter to the correct simple API ---
                    filterOptions: { 
                        key: 'id_ruolo_fk',
                        apiEndpoint: '/api/simple/ruoli', 
                        valueField: 'id_ruolo', 
                        textField: 'nome_ruolo' 
                    }
                },
                { 
                    key: 'id_azienda_fk', 
                    label: 'Azienda', 
                    editable: true, 
                    type: 'foreignKey',
                    // --- FIX: Use new simple endpoint for editing options ---
                    options: { apiEndpoint: '/api/simple/aziende', valueField: 'id_azienda', textField: 'ragione_sociale_sede' },
                    // --- FIX: Update formatter to show "Ragione Sociale - Sede" ---
                    formatter: (rowData) => {
                        if (!rowData.aziende) return 'N/A';
                        const parts = [rowData.aziende.ragione_sociale, rowData.aziende.sede].filter(Boolean);
                        return parts.join(' - ');
                    },
                    // --- FIX: Point the filter to the correct simple API ---
                    filterOptions: { 
                        key: 'id_azienda_fk',
                        apiEndpoint: '/api/simple/aziende', 
                        valueField: 'id_azienda', 
                        textField: 'ragione_sociale_sede' 
                    }
                },
                { 
                    key: 'attivo', 
                    label: 'Attivo', 
                    editable: true, 
                    type: 'boolean',
                    formatter: (rowData) => rowData.attivo ? 'Sì' : 'No',
                    filterOptions: { key: 'attivo', formatter: (val) => val ? 'Sì' : 'No' }
                },
                { 
                    key: 'is_admin', 
                    label: 'Admin', 
                    editable: true, 
                    type: 'boolean',
                    formatter: (rowData) => rowData.is_admin ? 'Sì' : 'No',
                    filterOptions: { key: 'is_admin', formatter: (val) => val ? 'Sì' : 'No' }
                },
                { 
                    key: 'puo_accedere', 
                    label: 'Può Accedere', 
                    editable: true, 
                    type: 'boolean',
                    formatter: (rowData) => rowData.puo_accedere ? 'Sì' : 'No',
                    filterOptions: { key: 'puo_accedere', formatter: (val) => val ? 'Sì' : 'No' }
                }
            ]
        },
    },

    /**
    * Funzione di avvio: recupera gli elementi DOM e imposta gli eventi principali.
    */
    init() {
        this.dom.viewSelector = document.getElementById('tableViewSelector');
        this.dom.toolbarArea = document.getElementById('toolbarArea');
        this.dom.gridWrapper = document.getElementById('gridWrapper');
            
        this.dom.viewSelector.addEventListener('change', this.handleViewChange.bind(this));
        this.dom.toolbarArea.addEventListener('click', this.handleToolbarClick.bind(this));
        this.dom.gridWrapper.addEventListener('click', this.handleTableClick.bind(this));
        document.addEventListener('click', this.handleDocumentClick.bind(this));

        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');
        const filterKey = urlParams.get('filterKey'); // e.g., 'id_commessa_fk'
        const filterValue = urlParams.get('filterValue'); // e.g., '123'

        if (viewParam) {
                this.dom.viewSelector.value = viewParam;
        }
        if (filterKey && filterValue) {
            this.state.activeFilters[filterKey] = [filterValue];
        }

        this.handleViewChange();
    },

    /**
        * Gestisce il cambio di vista dal menu a tendina.
    */
    handleViewChange() {
        this.state.currentView = this.dom.viewSelector.value;
        this.state.isAddingNewRow = false;
        this.state.isEditingRow = false;
        this.state.lastSelectedRadio = null;

        // --- FIX: Resetta lo stato di ordinamento quando si cambia vista ---
        this.state.sortBy = null;
        this.state.sortOrder = null;
        // --- FINE FIX ---

        this.renderToolbar();
        this.loadAndRenderData(true);
    },

    /**
        * Gestisce i click sui pulsanti della toolbar.
    */
    handleToolbarClick(event) {
        const button = event.target.closest('button');
        if (!button) return;

        switch (button.id) {
            case 'searchBtn': this.loadAndRenderData(true); break;
            case 'addRowBtn': this.handleAddRow(); break;
            case 'editRowBtn': this.handleEditRow(); break;
            case 'deleteRowBtn': this.handleDeleteRow(); break;
            case 'saveBtn': 
                if (this.state.isAddingNewRow) this.handleSaveNewRow();
                if (this.state.isEditingRow) this.handleSaveChanges();
                break;
            case 'cancelBtn': this.handleCancelEdit(); break;
        }
    },
        
    /**
        * Gestisce i click all'interno della griglia (selezione righe e icone filtro).
    */
    handleTableClick(event) {
        const target = event.target;
            
        const filterIcon = target.closest('.filter-icon');
        if (filterIcon) {
            const columnKey = filterIcon.dataset.columnKey;
            const existingPopup = document.querySelector('.filter-popup');

            // --- NEW: Toggle Logic ---
            // If a popup for this exact column is already open, close it and stop.
            if (existingPopup && existingPopup.dataset.column === columnKey) {
                existingPopup.remove();
                return;
            }
            // --- END: Toggle Logic ---

            // If no popup was open for this column, open a new one.
            this.openColumnFilterPopup(filterIcon, columnKey);
            return;
        }

        // Logic for sorting and row selection remains unchanged
        const header = target.closest('th[data-sortable="true"]');
        if (header) {
            this.handleHeaderClick(header.dataset.columnKey);
            return;
        }

        const radio = target.closest('input[name="rowSelector"]');
        if (radio) {
            this.handleRowSelection(radio);
        }
    },

    /**
        * Carica i dati dal backend e avvia il rendering della tabella.
    */
    async loadAndRenderData(isNewQuery = false) {
        const config = this.viewConfig[this.state.currentView];
        if (!config) return;

        if (isNewQuery) {
            this.state.currentPage = 1;
        }

        this.dom.gridWrapper.innerHTML = `<div class="loader">Caricamento...</div>`;
        const params = new URLSearchParams();
            
        params.append('page', this.state.currentPage);
        params.append('limit', '50');
            
        const sortBy = this.state.sortBy || config.defaultSortBy || config.columns[0].key;
        const sortOrder = this.state.sortOrder || config.defaultSortOrder || 'asc';
        params.append('sortBy', sortBy);
        params.append('sortOrder', sortOrder);

        const searchTerm = document.getElementById('filter-search-term')?.value;
        if (searchTerm) params.append('search', searchTerm);
            
        for (const key in this.state.activeFilters) {
                this.state.activeFilters[key].forEach(value => params.append(key, value));
        }

        try {
            const endpoint = `${config.apiEndpoint}?${params.toString()}`;
            
            // --- CORREZIONE CHIAVE QUI ---
            const response = await apiFetch(endpoint);
            const jsonResponse = await response.json(); // <-- Riga mancante
                
            this.state.tableData = jsonResponse.data; // Usa jsonResponse.data
            this.renderTable();
            this.renderPagination(jsonResponse.count); // Usa jsonResponse.count
            
        } catch (error) {
            this.dom.gridWrapper.innerHTML = `<div class="error-text">Impossibile caricare i dati.</div>`;
            if (document.getElementById('pagination-container')) {
                document.getElementById('pagination-container').innerHTML = '';
            }
        } finally {
            this.updateToolbarState();
        }
    },
        
    /**
        * Aggiunge o rimuove una riga vuota per l'inserimento.
    */
    async handleAddRow() { // <-- Ora è ASYNC
        this.state.isAddingNewRow = true;

        const config = this.viewConfig[this.state.currentView];
        const table = this.dom.gridWrapper.querySelector('table');
        const tbody = table.querySelector('tbody');

        const newRow = tbody.insertRow(0);
        newRow.classList.add('new-row-form', 'selected-row');
            
        newRow.insertCell().textContent = '*';
        newRow.insertCell();

        for (const col of config.columns) { // Usiamo un ciclo for...of per gestire await
            const cell = newRow.insertCell();
            if (col.editable) {
                const inputElement = await this.createCellInput(col); // <-- USA LA NUOVA FUNZIONE
                inputElement.style.width = '100%';
                inputElement.style.boxSizing = 'border-box';
                cell.appendChild(inputElement);
            }
        }
            
        this.updateToolbarState();
    },

    /**
        * Salva i dati inseriti nella nuova riga (chiamato da handleSaveChanges).
    */
    async handleSaveNewRow() {
        const newRow = document.querySelector('.new-row-form');
        if (!newRow) return;
        const config = this.viewConfig[this.state.currentView];
        const newObject = {};
        newRow.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
            newObject[input.dataset.key] = input.value;
        });

        if (Object.values(newObject).every(val => !val)) {
            return showModal({ title: 'Attenzione', message: 'Compilare almeno un campo per salvare.', confirmText: 'OK' });
        }

        try {
            // Esegui la chiamata POST
            const response = await apiFetch(config.apiEndpoint, {
                method: 'POST',
                body: JSON.stringify(newObject) // È buona norma usare JSON.stringify per il body
            });

            // --- CONTROLLO FONDAMENTALE AGGIUNTO QUI ---
            if (!response.ok) {
                // Se la risposta NON è positiva (es. 400, 404, 500), leggi l'errore e lancialo.
                const errorData = await response.json();
                throw new Error(errorData.error || `Errore del server: ${response.status}`);
            }

            // Questo codice viene eseguito solo se response.ok è true
            this.state.isAddingNewRow = false;
            await showModal({ title: 'Successo', message: 'Nuovo elemento creato con successo.', confirmText: 'OK' });

            this.state.activeFilters = {};
            this.state.searchTerm = '';
            const searchInput = document.getElementById('filter-search-term');
            if (searchInput) searchInput.value = '';

            this.handleViewChange();

        } catch (error) {
            // Ora l'errore del backend verrà catturato e mostrato qui
            showModal({ title: 'Errore', message: `Errore nella creazione: ${error.message}`, confirmText: 'OK' });
        }
    },
        
    /**
        * Gestisce la logica di selezione/deselezione di una riga.
    */
    handleRowSelection(currentRadio) {
        document.querySelectorAll('.agile-table tbody tr').forEach(r => r.classList.remove('selected-row'));
        if (this.state.lastSelectedRadio === currentRadio) {
            currentRadio.checked = false;
            this.state.lastSelectedRadio = null;
        } else {
            currentRadio.closest('tr').classList.add('selected-row');
            this.state.lastSelectedRadio = currentRadio;
        }
        this.updateToolbarState();
    },

    handleHeaderClick(columnKey) {
        let newSortOrder = 'asc';
            
        // If we're already sorting by this column, reverse the order
        if (this.state.sortBy === columnKey) {
            newSortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        }

        this.state.sortBy = columnKey;
        this.state.sortOrder = newSortOrder;

        // Fetch the newly sorted data from the backend
        this.loadAndRenderData(true);
    },

    /**
        * Gestisce la cancellazione di una riga selezionata.
    */
    async handleDeleteRow() {
        if (!this.state.lastSelectedRadio) {
            showModal({ title: 'Attenzione', message: 'Nessuna riga selezionata.', confirmText: 'OK' });
            return;
        }
        const id = this.state.lastSelectedRadio.value;
        const rowElement = this.state.lastSelectedRadio.closest('tr');
        const rowName = rowElement.cells[2].textContent;
            
        const isConfirmed = await showModal({
            title: 'Conferma Eliminazione',
            message: `Sei sicuro di voler eliminare "${rowName}"? L'azione è irreversibile.`,
            confirmText: 'Elimina',
            cancelText: 'Annulla'
        });

        if (isConfirmed) {
            const config = this.viewConfig[this.state.currentView];
            const endpoint = `${config.apiEndpoint}/${id}`;
            try {
                await apiFetch(endpoint, { method: 'DELETE' });
                showModal({ title: 'Successo', message: 'Elemento eliminato con successo.', confirmText: 'OK' });
                this.handleViewChange();
            } catch (error) {
                showModal({ title: 'Errore', message: `Errore durante l'eliminazione: ${error.message}`, confirmText: 'OK' });
            }
        }
    },

    /**
        * Trasforma una riga in modalità di modifica.
    */
    async handleEditRow() { // <-- Ora è ASYNC
        if (!this.state.lastSelectedRadio) return;

        const config = this.viewConfig[this.state.currentView];
        const id = this.state.lastSelectedRadio.value;
        const rowData = this.state.tableData.find(item => String(item[config.idColumn]) === String(id));
        if (!rowData) return;

        this.state.isEditingRow = true;
        const row = this.state.lastSelectedRadio.closest('tr');
        row.classList.add('editing-row');

        const originalCells = Array.from(row.cells).slice(2); // Copia le celle originali
        row.innerHTML = `<td>${row.cells[0].innerHTML}</td><td>${row.cells[1].innerHTML}</td>`; // Pulisce la riga mantenendo # e radio

        for (const col of config.columns) { // Usiamo un ciclo for...of
            const cell = row.insertCell();
            if (col.editable) {
                const currentValue = rowData[col.key]; // Prende l'ID della FK
                const inputElement = await this.createCellInput(col, currentValue); // <-- USA LA NUOVA FUNZIONE
                inputElement.style.width = '100%';
                inputElement.style.boxSizing = 'border-box';
                cell.appendChild(inputElement);
            } else {
                    // Se non è modificabile, rimetti il valore originale
                const displayValue = this.getPropertyByString(rowData, col.displayKey || col.key) || '';
                cell.textContent = displayValue;
            }
        }

        this.updateToolbarState();
    },

    /**
         * Salva le modifiche apportate a una riga.
         */
    async handleSaveChanges() {
        const editingRow = document.querySelector('.editing-row');
        if (!editingRow) return;
        const config = this.viewConfig[this.state.currentView];
        const updatedData = {};
        // Seleziona sia input che select
        editingRow.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
            updatedData[input.dataset.key] = input.value;
        });
        const id = this.state.lastSelectedRadio.value;
        const endpoint = `${config.apiEndpoint}/${id}`;
        try {
            await apiFetch(endpoint, { method: 'PUT', body: updatedData });
            this.state.isEditingRow = false;
            await showModal({ title: 'Successo', message: 'Elemento modificato con successo.', confirmText: 'OK' });
            this.handleViewChange();
        } catch (error) {
            showModal({ title: 'Errore', message: `Errore durante la modifica: ${error.message}`, confirmText: 'OK' });
        }
    },

    /**
         * Annulla la modalità di modifica.
    */
    handleCancelEdit() {
        this.state.isAddingNewRow = false;
        this.state.isEditingRow = false;
        this.state.lastSelectedRadio = null;

        this.loadAndRenderData(true);
    },
        
    // --- Funzioni di Rendering e Utility ---
        
    renderToolbar() {
        const view = this.state.currentView;
        this.dom.toolbarArea.innerHTML = `
            <div class="toolbar-group">
                <button class="button icon-button button--primary" id="addRowBtn" title="Aggiungi">➕</button>
                <button class="button icon-button button--warning" id="editRowBtn" title="Modifica">✏️</button>
                <button class="button icon-button button--danger" id="deleteRowBtn" title="Cancella">🗑️</button>
                <button class="button icon-button button--primary" id="saveBtn" title="Salva">💾</button>
                <button class="button icon-button button--danger" id="cancelBtn" title="Annulla">❌</button>
            </div>
            <div class="toolbar-group search-group">
                <input type="text" id="filter-search-term" placeholder="Cerca in ${view}..."/>
                <button class="button icon-button button--secondary" id="searchBtn" title="Cerca">🔍</button>
            </div>`;
        
        // --- RIGA AGGIUNTA PER CORREZIONE ---
        // Disabilita subito il pulsante "Aggiungi" se siamo nella vista 'commesse'
        if (view === 'commesse' && document.getElementById('addRowBtn')) {
            document.getElementById('addRowBtn').disabled = true;
        }
    },

    updateToolbarState() {
        // --- FIX: Add 'currentView' to the list of variables from the state ---
        const { isAddingNewRow, isEditingRow, lastSelectedRadio, currentView } = this.state;

        const buttons = {
            add: document.getElementById('addRowBtn'),
            edit: document.getElementById('editRowBtn'),
            del: document.getElementById('deleteRowBtn'),
            save: document.getElementById('saveBtn'),
            cancel: document.getElementById('cancelBtn'),
            search: document.getElementById('searchBtn'),
        };
        const searchInput = document.getElementById('filter-search-term');

        // Check if buttons exist before proceeding
        if (!buttons.add) return;

        // Rule: Adding or Editing
        if (isAddingNewRow || isEditingRow) {
            buttons.save.disabled = false;
            buttons.cancel.disabled = false;
            buttons.add.disabled = true;
            buttons.edit.disabled = true;
            buttons.del.disabled = true;
            buttons.search.disabled = true;
            searchInput.disabled = true;
            return;
        }

        // Rule: A row is selected
        if (lastSelectedRadio) {
            buttons.edit.disabled = false;
            buttons.del.disabled = false;
            buttons.add.disabled = true;
            buttons.save.disabled = true;
            buttons.cancel.disabled = true;
            buttons.search.disabled = false;
            searchInput.disabled = false;
        } else {
            // Rule: Default state (no row selected, not adding/editing)
            buttons.add.disabled = false;
            buttons.search.disabled = false;
            searchInput.disabled = false;
            buttons.edit.disabled = true;
            buttons.del.disabled = true;
            buttons.save.disabled = true;
            buttons.cancel.disabled = true;
        }

        // New rule for 'commesse' view
        if (currentView === 'commesse') {
            buttons.add.disabled = true;
        }
    },

    renderTable(data = this.state.tableData) {
        const config = this.viewConfig[this.state.currentView];
        if (!config) return;

        const table = document.createElement('table');
        table.className = 'agile-table';
        table.dataset.view = this.state.currentView;
        const thead = table.createTHead();
        const headerRow = thead.insertRow();

        const fixedHeaders = [{ text: '#', title: 'Numero Riga' }, { text: '☑️', title: 'Seleziona' }];
        fixedHeaders.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.text;
            th.title = header.title;
            headerRow.appendChild(th);
        });

        config.columns.forEach(col => {
            const th = document.createElement('th');
            th.dataset.sortable = true;
            th.dataset.columnKey = col.key;
                
            const thContent = document.createElement('div');
            thContent.className = 'column-header-content';
                
            let sortIndicator = '';
            if (this.state.sortBy === col.key) {
                sortIndicator = this.state.sortOrder === 'asc' ? ' 🔼' : ' 🔽';
            }
                
            // --- FIX: Use an <img> tag for the filter icon ---
            const filterIcon = `<img src="img/filter.png" class="filter-icon" data-column-key="${col.key}" alt="Filtro">`;

            thContent.innerHTML = `<span>${col.label}${sortIndicator}</span>${filterIcon}`;
            th.classList.toggle('filter-active', !!this.state.activeFilters[col.filterOptions?.key || col.key]);
            th.appendChild(thContent);
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();

        if (data.length === 0) {
            const noDataRow = tbody.insertRow();
            const cell = noDataRow.insertCell();
            cell.colSpan = config.columns.length + 2;
            cell.textContent = 'Nessun dato trovato. Modifica i filtri per una nuova ricerca.';
            cell.style.textAlign = 'center'; cell.style.padding = '20px';
            cell.style.fontStyle = 'italic'; cell.style.color = '#666';
        } else {
            data.forEach((rowData, index) => {
                const row = tbody.insertRow();
                const pageOffset = (this.state.currentPage - 1) * 50;
                row.insertCell().textContent = pageOffset + index + 1;

                const cellSelect = row.insertCell();
                const radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'rowSelector';
                radio.value = rowData[config.idColumn]; cellSelect.appendChild(radio);
                    
                config.columns.forEach(col => {
                    let cellValue;
                    if (col.formatter) {
                        cellValue = col.formatter(rowData);
                    } else {
                        const displayKey = col.displayKey || col.key;
                        cellValue = this.getPropertyByString(rowData, displayKey) || '';
                    }
                    // --- FIX: Use .innerHTML instead of .textContent ---
                    // This tells the browser to render the HTML link correctly.
                    row.insertCell().innerHTML = cellValue;
                });
            });
        }

        this.dom.gridWrapper.innerHTML = '';
        this.dom.gridWrapper.appendChild(table);
    },

    renderPagination(totalItems) {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        const pageSize = 50;
        const totalPages = Math.ceil(totalItems / pageSize);
        const currentPage = this.state.currentPage;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        paginationHTML += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Precedente</button>`;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        // Next button
        paginationHTML += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Successivo &raquo;</button>`;

        container.innerHTML = paginationHTML;

        // Add event listeners to the new buttons
        container.querySelectorAll('.page-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.dataset.page, 10);
                this.state.currentPage = page;
                this.loadAndRenderData(false);
            });
        });
    },
    
    closeColumnFilterPopup: function() {
        const existingPopup = document.querySelector('.column-filter-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
    },

    async openColumnFilterPopup(iconElement, columnKey) {
        this.closeColumnFilterPopup();
        const columnConfig = this.viewConfig[this.state.currentView].columns.find(c => c.key === columnKey);
        const filterKey = columnConfig.filterOptions?.key || column_key;

        const popup = document.createElement('div');
        popup.className = 'column-filter-popup';
        document.body.appendChild(popup);
        const rect = iconElement.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 5}px`;
        popup.innerHTML = `<div class="loader-small"></div>`;

        try {
            const viewConfig = this.viewConfig[this.state.currentView];
            const tableNameForApi = viewConfig.tableName || this.state.currentView;
            
            console.log(`Sto chiamando /api/distinct/${tableNameForApi}/${filterKey}`); // DEBUG
            
            const response = await apiFetch(`/api/distinct/${tableNameForApi}/${filterKey}`);
            
            if (!response.ok) throw new Error(`Risposta API non valida: ${response.status}`);
            
            const optionsData = await response.json();
            
            console.log('Dati per il filtro ricevuti:', optionsData); // DEBUG

            this.renderFilterPopup(popup, optionsData, columnKey);

        } catch (error) {
            // --- QUESTO È IL PUNTO CHIAVE ---
            // Stampa l'errore completo e dettagliato nella console.
            console.error("--- ERRORE DETTAGLIATO CATTURATO ---", error); 
            popup.innerHTML = `<div class="error-text">Errore filtri</div>`;
        }
    },

    handleDocumentClick(event) {
        const popup = document.querySelector('.filter-popup');
        if (!popup) return;

        const target = event.target;
        if (target.id === 'apply-filter') {
            const columnKey = popup.dataset.column;
            // Questa versione è più esplicita per evitare possibili problemi di stato del DOM.
            const selectedValues = [];
            const allCheckboxes = popup.querySelectorAll('.filter-checkbox');

            allCheckboxes.forEach(checkbox => {
                // Controlliamo la proprietà .checked direttamente, che è il metodo più affidabile.
                if (checkbox.checked) {
                    selectedValues.push(checkbox.value);
                }
            });
            this.state.activeFilters[columnKey] = selectedValues;
            this.loadAndRenderData(true); // Esegui come nuova query
            popup.remove();
        } else if (target.id === 'clear-filter') {
            const columnKey = popup.dataset.column;
            delete this.state.activeFilters[columnKey];
            this.loadAndRenderData(true); // Esegui come nuova query
            popup.remove();
        } else if (!target.closest('.filter-popup') && !target.classList.contains('filter-icon')) {
            popup.remove();
        }
    },

    async createCellInput(columnConfig, currentValue = '') {
        const key = columnConfig.key;

        // --- NUOVO: Caso per il tipo 'date' ---
        if (columnConfig.type === 'date') {
            const input = document.createElement('input');
            input.type = 'date';
            input.dataset.key = key;
            // Formatta la data per il campo input (es. da ISO a YYYY-MM-DD)
            if (currentValue) {
                try {
                    input.value = new Date(currentValue).toISOString().split('T')[0];
                } catch (e) {
                    input.value = '';
                }
            }
            return input;
        }

        // Caso 1: Valore Booleano
        if (columnConfig.type === 'boolean') {
            const select = document.createElement('select');
            select.dataset.key = key;
            select.innerHTML = `
                <option value="true" ${currentValue === true ? 'selected' : ''}>Vero</option>
                <option value="false" ${currentValue === false || currentValue === '' ? 'selected' : ''}>Falso</option>
            `;
            return select;
        }

        // Caso 2: Chiave Esterna (Foreign Key)
        if (columnConfig.type === 'foreignKey') {
            const select = document.createElement('select');
            select.dataset.key = key;
            select.innerHTML = `<option value="">Caricamento...</option>`;

            try {
                const response = await apiFetch(columnConfig.options.apiEndpoint);
                const optionsData = await response.json(); // <-- RIGA MANCANTE AGGIUNTA QUI

                select.innerHTML = `<option value="" disabled selected>Seleziona un'opzione</option>`;
                optionsData.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt[columnConfig.options.valueField];
                    option.textContent = opt[columnConfig.options.textField];
                    if (String(option.value) === String(currentValue)) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            } catch (error) {
                select.innerHTML = `<option value="">Errore nel caricamento</option>`;
            }
            return select;
        }

        // Caso 3 (Default): Campo di Testo
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.dataset.key = key;
        return input;
    },
        
    getPropertyByString(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    },
};  
    
document.addEventListener('DOMContentLoaded', () => {
    console.log('Pagina gestione.js pronta. In attesa del via libera dall\'autenticazione...');
    // Potremmo usare la stessa logica a promessa, ma per ora questo è sufficiente
    // dato che auth-guard blocca il caricamento se non sei loggato.
    App.init();
});