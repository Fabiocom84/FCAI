// js/gestione.js - Versione Completa, Corretta e Ottimizzata

import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

    /**
     * Gestore dell'intera applicazione per la Vista Agile.
     */
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
                columns: [
                    { 
                        key: 'id_cliente_fk', 
                        label: 'Cliente', 
                        editable: true,
                        type: 'foreignKey',
                        formatter: (rowData) => rowData.clienti?.ragione_sociale || 'N/A',
                        options: { apiEndpoint: '/api/clienti', valueField: 'id_cliente', textField: 'ragione_sociale' },
                        filterOptions: { key: 'clienti.ragione_sociale', apiEndpoint: '/api/clienti', textField: 'ragione_sociale' }
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
                        options: { apiEndpoint: '/api/status_commessa', valueField: 'id_status', textField: 'nome_status' },
                        filterOptions: { key: 'status_commessa.nome_status', apiEndpoint: '/api/status_commessa', textField: 'nome_status' }
                    },
                    { 
                        key: 'data_commessa', 
                        label: 'Data', 
                        editable: true, 
                        type: 'date',
                        // --- FIX: Added a formatter to display the date ---
                        formatter: (rowData) => rowData.data_commessa ? new Date(rowData.data_commessa).toLocaleDateString('it-IT') : ''
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
                    {
                        key: 'id_modello_fk',
                        label: 'Modello',
                        editable: true,
                        type: 'foreignKey',
                        formatter: (rowData) => rowData.modelli?.nome_modello || 'N/A',
                        options: { apiEndpoint: '/api/modelli', valueField: 'id_modello', textField: 'nome_modello' },
                        // --- FIX: Ensured filterOptions are correctly configured ---
                        filterOptions: { key: 'modelli.nome_modello', apiEndpoint: '/api/modelli', textField: 'nome_modello' }
                    },
                    { 
                        key: 'provincia', 
                        label: 'Provincia', 
                        editable: true 
                    },
                    { 
                        key: 'paese', 
                        label: 'Paese', 
                        editable: true 
                    },
                    { 
                        key: 'matricola', 
                        label: 'Matricola', 
                        editable: true 
                    },
                    { 
                        key: 'immagine', 
                        label: 'Immagine', 
                        editable: false,
                        formatter: (rowData) => {
                            if (!rowData.immagine) return 'No';
                            return `<a href="${rowData.immagine}" target="_blank">Apri</a>`;
                        }
                    },
                    { 
                        key: 'note', 
                        label: 'Note', 
                        editable: true, 
                        type: 'textarea' 
                    }
                ]
            },
            'registrazioni': {
                apiEndpoint: '/api/registrazioni',
                idColumn: 'id_registrazione',
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
                    // --- COLONNA DATA DI NASCITA AGGIUNTA E FORMATTATA ---
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
                        options: { apiEndpoint: '/api/ruoli', valueField: 'id_ruolo', textField: 'nome_ruolo' },
                        formatter: (rowData) => rowData.ruoli ? rowData.ruoli.nome_ruolo : 'N/A',
                        // --- FILTRO ABILITATO ---
                        filterOptions: { key: 'ruoli.nome_ruolo', apiEndpoint: '/api/ruoli', textField: 'nome_ruolo' }
                    },
                    { 
                        key: 'id_azienda_fk', 
                        label: 'Azienda', 
                        editable: true, 
                        type: 'foreignKey',
                        options: { apiEndpoint: '/api/aziende', valueField: 'id_azienda', textField: 'ragione_sociale' },
                        formatter: (rowData) => rowData.aziende?.ragione_sociale || 'N/A',
                        // --- FILTRO ABILITATO ---
                        filterOptions: { key: 'aziende.ragione_sociale', apiEndpoint: '/api/aziende', textField: 'ragione_sociale' }
                    },
                    { 
                        key: 'attivo', 
                        label: 'Attivo', 
                        editable: true, 
                        type: 'boolean',
                        formatter: (rowData) => rowData.attivo ? 'Sì' : 'No',
                        // --- FILTRO ABILITATO ---
                        filterOptions: { key: 'attivo', formatter: (val) => val ? 'Sì' : 'No' }
                    },
                    { 
                        key: 'is_admin', 
                        label: 'Admin', 
                        editable: true, 
                        type: 'boolean',
                        formatter: (rowData) => rowData.is_admin ? 'Sì' : 'No',
                        // --- FILTRO ABILITATO ---
                        filterOptions: { key: 'is_admin', formatter: (val) => val ? 'Sì' : 'No' }
                    },
                    { 
                        key: 'puo_accedere', 
                        label: 'Può Accedere', 
                        editable: true, 
                        type: 'boolean',
                        formatter: (rowData) => rowData.puo_accedere ? 'Sì' : 'No',
                        // --- FILTRO ABILITATO ---
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
            this.renderToolbar();
            // We REMOVE the call to updateToolbarState() from here...
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
            if (target.matches('.filter-icon')) {
                const columnKey = target.dataset.columnKey;
                this.openColumnFilterPopup(target, columnKey);
            }
            if (target.matches('input[name="rowSelector"]')) {
                this.handleRowSelection(target);
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
            params.append('sortBy', config.columns[0].key);
            params.append('sortOrder', 'asc');

            const searchTerm = document.getElementById('filter-search-term')?.value;
            if (searchTerm) params.append('search', searchTerm);
            
            for (const key in this.state.activeFilters) {
                this.state.activeFilters[key].forEach(value => params.append(key, value));
            }

            try {
                const endpoint = `${config.apiEndpoint}?${params.toString()}`;
                const response = await this.apiFetch(endpoint);
                
                this.state.tableData = response.data;
                this.renderTable();
                this.renderPagination(response.count);
            } catch (error) {
                this.dom.gridWrapper.innerHTML = `<div class="error-text">Impossibile caricare i dati.</div>`;
                if (document.getElementById('pagination-container')) {
                    document.getElementById('pagination-container').innerHTML = '';
                }
            } finally {
                // This is the crucial change: update the button states as the very last step.
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
            // Seleziona sia input che select
            newRow.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
                newObject[input.dataset.key] = input.value;
            });
            if (Object.values(newObject).every(val => !val)) {
                this.showModal({ title: 'Attenzione', message: 'Compilare almeno un campo per salvare.', confirmText: 'OK' });
                return;
            }
            try {
                await this.apiFetch(config.apiEndpoint, { method: 'POST', body: newObject });
                this.state.isAddingNewRow = false;
                await this.showModal({ title: 'Successo', message: 'Nuovo elemento creato con successo.', confirmText: 'OK' });
                this.handleViewChange();
            } catch (error) {
                this.showModal({ title: 'Errore', message: `Errore nella creazione: ${error.message}`, confirmText: 'OK' });
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

        /**
         * Gestisce la cancellazione di una riga selezionata.
         */
        async handleDeleteRow() {
            if (!this.state.lastSelectedRadio) {
                this.showModal({ title: 'Attenzione', message: 'Nessuna riga selezionata.', confirmText: 'OK' });
                return;
            }
            const id = this.state.lastSelectedRadio.value;
            const rowElement = this.state.lastSelectedRadio.closest('tr');
            const rowName = rowElement.cells[2].textContent;
            
            const isConfirmed = await this.showModal({
                title: 'Conferma Eliminazione',
                message: `Sei sicuro di voler eliminare "${rowName}"? L'azione è irreversibile.`,
                confirmText: 'Elimina',
                cancelText: 'Annulla'
            });

            if (isConfirmed) {
                const config = this.viewConfig[this.state.currentView];
                const endpoint = `${config.apiEndpoint}/${id}`;
                try {
                    await this.apiFetch(endpoint, { method: 'DELETE' });
                    this.showModal({ title: 'Successo', message: 'Elemento eliminato con successo.', confirmText: 'OK' });
                    this.handleViewChange();
                } catch (error) {
                    this.showModal({ title: 'Errore', message: `Errore durante l'eliminazione: ${error.message}`, confirmText: 'OK' });
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
                await this.apiFetch(endpoint, { method: 'PUT', body: updatedData });
                this.state.isEditingRow = false;
                await this.showModal({ title: 'Successo', message: 'Elemento modificato con successo.', confirmText: 'OK' });
                this.handleViewChange();
            } catch (error) {
                this.showModal({ title: 'Errore', message: `Errore durante la modifica: ${error.message}`, confirmText: 'OK' });
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
            // Render all buttons at once. Their visibility will be controlled by CSS/JS.
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
        },

        updateToolbarState() {
            const { isAddingNewRow, isEditingRow, lastSelectedRadio } = this.state;

            // Get references to all controls
            const buttons = {
                add: document.getElementById('addRowBtn'),
                edit: document.getElementById('editRowBtn'),
                del: document.getElementById('deleteRowBtn'),
                save: document.getElementById('saveBtn'),
                cancel: document.getElementById('cancelBtn'),
                search: document.getElementById('searchBtn'),
            };
            const searchInput = document.getElementById('filter-search-term');

            // --- Apply Logic Based on State ---

            // Rule: Adding or Editing
            if (isAddingNewRow || isEditingRow) {
                buttons.save.disabled = false;
                buttons.cancel.disabled = false;
                
                buttons.add.disabled = true;
                buttons.edit.disabled = true;
                buttons.del.disabled = true;
                buttons.search.disabled = true;
                searchInput.disabled = true;
                return; // Stop here
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

            // --- NEW RULE FOR 'COMMESSE' VIEW ---
            // This rule runs at the end and overrides the default state if necessary.
            if (currentView === 'commesse') {
                buttons.add.disabled = true;
            }
        },

        renderTable(data = this.state.tableData) {
            const config = this.viewConfig[this.state.currentView];
            if (!config) return;

            const table = document.createElement('table');
            table.className = 'agile-table';
            const thead = table.createTHead();
            const headerRow = thead.insertRow();

            const fixedHeaders = [{ text: '#', title: 'Numero Riga' }, { text: '☑️', title: 'Seleziona' }];
            fixedHeaders.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header.text; th.title = header.title; headerRow.appendChild(th);
            });
            config.columns.forEach(col => {
                const th = document.createElement('th');
                const thContent = document.createElement('div');
                thContent.className = 'column-header-content';
                const filterIcon = `<span class="filter-icon" data-column-key="${col.key}">🔽</span>`;
                thContent.innerHTML = `<span>${col.label}</span>${filterIcon}`;
                th.classList.toggle('filter-active', !!this.state.activeFilters[col.filterOptions ? col.filterOptions.key : col.key]);
                th.appendChild(thContent); headerRow.appendChild(th);
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
        
        async openColumnFilterPopup(iconElement, columnKey) {
            const existingPopup = document.querySelector('.filter-popup');
            if (existingPopup) existingPopup.remove();

            const config = this.viewConfig[this.state.currentView];
            const columnConfig = config.columns.find(c => c.key === columnKey);
            if (!columnConfig) return;

            const popup = document.createElement('div');
            popup.className = 'filter-popup';
            const filterKey = columnConfig.filterOptions?.key || columnConfig.key;
            popup.dataset.column = filterKey;
            
            popup.innerHTML = `<div class="loader-small" style="text-align: center; padding: 10px;">Caricamento...</div>`;
            document.body.appendChild(popup);
            
            const rect = iconElement.getBoundingClientRect();
            popup.style.top = `${rect.bottom + window.scrollY}px`;
            popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;

            try {
                let uniqueValues = [];
                let valueKey = 'value';
                let labelKey = 'value';

                // --- FIX: Check specifically for an apiEndpoint before fetching ---
                if (columnConfig.filterOptions && columnConfig.filterOptions.apiEndpoint) {
                    const items = await this.apiFetch(columnConfig.filterOptions.apiEndpoint);
                    valueKey = columnConfig.filterOptions.valueField || columnConfig.filterOptions.textField;
                    labelKey = columnConfig.filterOptions.textField;
                    uniqueValues = items.map(item => ({ value: item[valueKey], label: item[labelKey] }));
                } else {
                    // This is now the fallback for simple filters (like booleans) and standard text filters.
                    const tableName = this.state.currentView;
                    const values = await this.apiFetch(`/api/distinct/${tableName}/${columnKey}`);
                    const labelFormatter = columnConfig.filterOptions?.formatter || ((val) => val);
                    uniqueValues = values.map(val => ({ value: val, label: labelFormatter(val) }));
                }
                
                const activeColumnFilters = this.state.activeFilters[filterKey] || [];
                
                const listItems = uniqueValues.map(item => {
                    const isChecked = activeColumnFilters.includes(String(item.value)) ? 'checked' : '';
                    const sanitizedValue = String(item.value).replace(/"/g, '&quot;');
                    return `<li><label><input type="checkbox" class="filter-checkbox" value="${sanitizedValue}" ${isChecked}> <span class="filter-value">${item.label}</span></label></li>`;
                }).join('');

                popup.innerHTML = `
                    <input type="text" id="popup-search-input" placeholder="Cerca valori...">
                    <div class="filter-popup-buttons">
                        <button class="button button--primary" id="apply-filter">Applica</button>
                        <button class="button button--secondary" id="clear-filter">Pulisci</button>
                    </div>
                    <ul class="filter-popup-list">${listItems}</ul>`;
                
                popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;

                const searchInput = popup.querySelector('#popup-search-input');
                const listElements = popup.querySelectorAll('.filter-popup-list li');

                searchInput.addEventListener('input', () => {
                    const searchTerm = searchInput.value.toLowerCase();
                    listElements.forEach(li => {
                        const label = li.querySelector('.filter-value').textContent.toLowerCase();
                        if (label.includes(searchTerm)) {
                            li.style.display = '';
                        } else {
                            li.style.display = 'none';
                        }
                    });
                });

            } catch (error) {
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
                    const optionsData = await this.apiFetch(columnConfig.options.apiEndpoint);
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
        
        async apiFetch(endpoint, options = {}) {
            const url = `${API_BASE_URL}${endpoint}`;
            const mergedOptions = { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } };
            if (mergedOptions.body && typeof mergedOptions.body !== 'string') {
                mergedOptions.body = JSON.stringify(mergedOptions.body);
            }
            try {
                const response = await fetch(url, mergedOptions);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `Errore HTTP: ${response.status}` }));
                    throw new Error(errorData.error);
                }
                return response.status === 204 ? {} : await response.json();
            } catch (error) {
                console.error(`Errore nella chiamata API a ${endpoint}:`, error);
                throw error;
            }
        },

        showModal({ title, message, confirmText, cancelText }) {
            return new Promise(resolve => {
                const overlay = document.getElementById('custom-modal-overlay');
                const modalTitle = document.getElementById('custom-modal-title');
                const modalMessage = document.getElementById('custom-modal-message');
                const modalButtons = document.getElementById('custom-modal-buttons');
                modalTitle.textContent = title;
                modalMessage.textContent = message;
                modalButtons.innerHTML = ''; 
                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = confirmText;
                confirmBtn.className = 'button button--primary';
                modalButtons.appendChild(confirmBtn);
                confirmBtn.onclick = () => {
                    overlay.style.display = 'none';
                    resolve(true);
                };
                if (cancelText) {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = cancelText;
                    cancelBtn.className = 'button';
                    modalButtons.appendChild(cancelBtn);
                    cancelBtn.onclick = () => {
                        overlay.style.display = 'none';
                        resolve(false);
                    };
                }
                overlay.style.display = 'flex';
            });
        },

        getPropertyByString(obj, path) {
            return path.split('.').reduce((current, key) => current && current[key], obj);
        },
    };
    
    App.init();
});