// js/gestione.js - Versione Completa, Corretta e Ottimizzata

import { apiFetch, segnala } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';
import { viewConfig } from './gestione-viste.js';
import { getPropertyByString, formatCellValue } from './gestione-utili.js';
import { esportaInXlsx } from './gestione-esporta.js';
import { apriPopupFiltro, chiudiPopupFiltro } from './gestione-filtri.js';

const App = {

    dom: {},
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        activeFilters: {},
        searchTerm: '',
        currentView: 'registrazioni', // Imposta 'registrazioni' come vista di default
        sortBy: 'data_creazione',     // Imposta la colonna di ordinamento di default
        sortOrder: 'desc',            // Imposta l'ordine di default (desc = dal più recente)
        editingRowId: null,
        isAddingNewRow: false,
        allStatuses: [],
        allDependencies: {} // Cache per dropdown unificati
    },

    // Carica tutte le liste per i dropdown in una sola chiamata
    fetchAllDependencies: async function () {
        try {
            const res = await apiFetch('/api/gestione/init-data');
            if (res.ok) {
                this.state.allDependencies = await res.json();
                console.log("Dipendenze caricate:", Object.keys(this.state.allDependencies));
            }
        } catch (e) {
            console.error("Errore caricamento dipendenze:", e);
            segnala(e);
        }
    },
    viewConfig,   // 13 viste: vedi js/gestione-viste.js

    /**
    * Funzione di avvio: recupera gli elementi DOM e imposta gli eventi principali.
    */
    init: async function () {
        // 1. Recupera elementi DOM
        this.dom = {
            gridWrapper: document.querySelector('.grid-container'),
            toolbarArea: document.getElementById('toolbarArea'),
            viewSelector: document.getElementById('tableViewSelector')
        };

        // 2. BLOCCO DI SICUREZZA
        if (!IsAdmin) {
            window.location.replace('index.html');
            return;
        }
        // ---------------------

        // --- INIZIO MODIFICA: Leggi i parametri dall'URL ---
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');
        const filterKeyParam = urlParams.get('filterKey');
        const filterValueParam = urlParams.get('filterValue');

        // 2. Imposta lo stato INIZIALE in base ai parametri
        if (viewParam) {
            this.state.currentView = viewParam; // Sovrascrive il default 'registrazioni'
        }

        if (filterKeyParam && filterValueParam) {
            // Imposta il filtro attivo
            // Nota: il valore deve essere un array
            this.state.activeFilters = {
                [filterKeyParam]: [filterValueParam]
            };
        }
        // --- FINE MODIFICA ---

        // 3. Aggiorna l'interfaccia (ora userà lo stato modificato)
        if (this.dom.viewSelector) {
            this.dom.viewSelector.value = this.state.currentView;
        }

        // 4. Chiamiamo gli event listener e carichiamo i dati
        this.addStaticEventListeners();

        // Carichiamo le dipendenze (dropdown) in background o bloccante? 
        // Meglio quasi-bloccante o comunque prima di eventuali edit.
        await this.fetchAllDependencies();

        this.renderToolbar();
        this.loadAndRenderData(true); // Questa chiamata ora userà i filtri!
    },

    addStaticEventListeners: function () {
        if (this.dom.gridWrapper) {
            this.dom.gridWrapper.addEventListener('click', (event) => this.handleTableClick(event));
        }
        if (this.dom.viewSelector) {
            this.dom.viewSelector.addEventListener('change', () => this.handleViewChange());
        }
        window.addEventListener('scroll', () => this.handleScroll());

        if (this.dom.toolbarArea) {
            this.dom.toolbarArea.addEventListener('click', (event) => this.handleToolbarClick(event));
        }
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
    handleToolbarClick: function (event) {
        const action = event.target.closest('.button')?.id;
        if (!action) return;

        switch (action) {
            case 'addRowBtn':
                this.handleAddRow();
                break;
            case 'editRowBtn':
                if (this.state.selectedRowId) {
                    this.handleEditRow(this.state.selectedRowId);
                } else {
                    showModal({ title: 'Attenzione', message: 'Selezionare una riga da modificare.', confirmText: 'OK' });
                }
                break;
            case 'deleteRowBtn':
                if (this.state.selectedRowId) {
                    this.handleDeleteRow(); // <-- NOME CORRETTO
                } else {
                    showModal({ title: 'Attenzione', message: 'Selezionare una riga da eliminare.', confirmText: 'OK' });
                }
                break;
            case 'saveBtn':
                // --- CORREZIONE QUI ---
                if (this.state.editingRowId) {
                    // Trova l'elemento della riga che stiamo modificando...
                    const rowElement = this.dom.gridWrapper.querySelector(`.agile-table-row[data-id="${this.state.editingRowId}"]`);
                    if (rowElement) {
                        // ...e passalo alla funzione di salvataggio.
                        this.handleSaveChanges(rowElement);
                    }
                } else if (this.state.isAddingNewRow) {
                    this.handleSaveNewRow();
                }
                break;
            case 'cancelBtn':
                if (this.state.isAddingNewRow) {
                    // Se stavi aggiungendo una nuova riga, ricarica la vista per eliminarla
                    this.handleCancelEdit();
                } else if (this.state.isEditingRow) {
                    // Se stavi modificando una riga esistente, annulla le modifiche
                    this.exitEditMode(this.state.editingRowId);
                }
                break;
            case 'downloadXlsBtn':
                this.exportToXlsx();
                break;
            case 'searchBtn':
                const searchTerm = document.getElementById('filter-search-term')?.value || '';
                this.loadAndRenderData(true, searchTerm); // Passiamo il termine di ricerca direttamente
                break;
            case 'resetSearchBtn':
                const searchInput = document.getElementById('filter-search-term');
                if (searchInput) {
                    searchInput.value = ''; // Svuota il campo di testo
                }
                this.state.searchTerm = ''; // Resetta il termine di ricerca nello stato
                this.loadAndRenderData(true); // Ricarica i dati senza filtri
                break;
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
            const existingPopup = document.querySelector('.column-filter-popup');

            // Se un pop-up è già aperto per QUESTA STESSA colonna, chiudilo e fermati.
            if (existingPopup && existingPopup.dataset.column === columnKey) {
                this.closeColumnFilterPopup();
                return;
            }

            // Altrimenti, procedi ad aprire il nuovo pop-up (la funzione si occuperà
            // di chiudere eventuali altri pop-up aperti per altre colonne).
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
    async loadAndRenderData(isNewQuery = false, searchTerm = '') {
        const config = this.viewConfig[this.state.currentView];
        if (!config) return;

        if (isNewQuery) {
            this.state.currentPage = 1;
        }

        this.dom.gridWrapper.innerHTML = `<div class="loader">Caricamento...</div>`;
        const params = new URLSearchParams({
            page: this.state.currentPage,
            limit: '50',
            sortBy: this.state.sortBy || config.defaultSortBy || config.columns[0].key,
            sortOrder: this.state.sortOrder || config.defaultSortOrder || 'asc'
        });

        if (searchTerm) {
            params.append('search', searchTerm);
        }

        for (const key in this.state.activeFilters) {
            this.state.activeFilters[key].forEach(value => params.append(key, value));
        }

        const endpoint = `${config.apiEndpoint}?${params.toString()}`;

        try {
            const response = await apiFetch(endpoint);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Errore del server: ${response.status}`);
            }

            const jsonResponse = await response.json();

            this.state.tableData = jsonResponse.data;
            this.renderTable();
            this.renderPagination(jsonResponse.count);

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
            let value = input.value;
            if (value === '' && (input.type === 'date' || input.type === 'datetime-local' || input.type === 'number')) {
                value = null;
            }
            newObject[input.dataset.key] = value;
        });

        if (Object.values(newObject).every(val => !val)) {
            return showModal({ title: 'Attenzione', message: 'Compilare almeno un campo per salvare.', confirmText: 'OK', type: 'warning' });
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
            await showModal({ title: 'Successo', message: 'Nuovo elemento creato con successo.', confirmText: 'OK', type: 'success' });

            this.state.activeFilters = {};
            this.state.searchTerm = '';
            const searchInput = document.getElementById('filter-search-term');
            if (searchInput) searchInput.value = '';

            this.handleViewChange();

        } catch (error) {
            // Ora l'errore del backend verrà catturato e mostrato qui
            showModal({ title: 'Errore', message: `Errore nella creazione: ${error.message}`, confirmText: 'OK', type: 'error' });
        }
    },

    /**
        * Gestisce la logica di selezione/deselezione di una riga.
    */
    handleRowSelection(currentRadio) {
        document.querySelectorAll('.agile-table tbody tr').forEach(r => r.classList.remove('selected-row'));

        // Logica per deselezionare una riga
        if (this.state.lastSelectedRadio === currentRadio) {
            currentRadio.checked = false;
            this.state.lastSelectedRadio = null;
            this.state.selectedRowId = null; // <-- RIGA AGGIUNTA: Azzera l'ID
        } else {
            // Logica per selezionare una riga
            currentRadio.closest('tr').classList.add('selected-row');
            this.state.lastSelectedRadio = currentRadio;
            this.state.selectedRowId = currentRadio.value; // <-- RIGA AGGIUNTA: Salva l'ID
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
            showModal({ title: 'Attenzione', message: 'Nessuna riga selezionata.', confirmText: 'OK', type: 'warning' });
            return;
        }
        const id = this.state.lastSelectedRadio.value;
        const rowElement = this.state.lastSelectedRadio.closest('tr');
        const rowName = rowElement.cells[2].textContent;

        const isConfirmed = await showModal({
            title: 'Conferma Eliminazione',
            message: `Sei sicuro di voler eliminare "${rowName}"? L'azione è irreversibile.`,
            confirmText: 'Elimina',
            cancelText: 'Annulla',
            type: 'warning'
        });

        if (isConfirmed) {
            const config = this.viewConfig[this.state.currentView];
            const endpoint = `${config.apiEndpoint}/${id}`;
            try {
                await apiFetch(endpoint, { method: 'DELETE' });
                showModal({ title: 'Successo', message: 'Elemento eliminato con successo.', confirmText: 'OK', type: 'success' });
                this.handleViewChange();
            } catch (error) {
                showModal({ title: 'Errore', message: `Errore durante l'eliminazione: ${error.message}`, confirmText: 'OK' });
            }
        }
    },

    /**
        * Trasforma una riga in modalità di modifica.
    */
    async handleEditRow(id) { // <-- Ora accetta l'ID come parametro
        const config = this.viewConfig[this.state.currentView];

        // 1. Trova l'elemento della riga nel DOM usando il suo ID
        const row = this.dom.gridWrapper.querySelector(`tr[data-id="${id}"]`);
        if (!row) {
            console.error("Riga da modificare non trovata nel DOM con ID:", id);
            return;
        }

        // 2. Trova i dati corrispondenti nello stato dell'applicazione
        const rowData = this.state.tableData.find(item => String(item[config.idColumn]) === String(id));
        if (!rowData) {
            console.error("Dati per la riga da modificare non trovati nello stato con ID:", id);
            return;
        }

        this.state.isEditingRow = true;
        this.state.editingRowId = id; // Memorizza l'ID della riga in modifica
        row.classList.add('editing-row');

        // Salva il numero di riga e la checkbox prima di pulire
        const rowNumberHTML = row.cells[0].innerHTML;
        const radioHTML = row.cells[1].innerHTML;
        row.innerHTML = `<td>${rowNumberHTML}</td><td>${radioHTML}</td>`;

        // 3. Ricostruisci la riga con i campi di input
        for (const col of config.columns) {
            const cell = row.insertCell();
            if (col.editable) {
                const currentValue = this.getPropertyByString(rowData, col.key);
                const inputElement = await this.createCellInput(col, currentValue);
                inputElement.style.width = '100%';
                inputElement.style.boxSizing = 'border-box';
                cell.appendChild(inputElement);
            } else {
                cell.innerHTML = this.getPropertyByString(rowData, col.formatter ? null : (col.displayKey || col.key)) || '';
                if (col.formatter) cell.innerHTML = col.formatter(rowData);
            }
        }

        this.updateToolbarState();
    },

    selectRow: function (rowElement) {
        // Rimuovi la selezione da qualsiasi altra riga
        const currentlySelected = this.dom.gridWrapper.querySelector('.agile-table-row.selected');
        if (currentlySelected) {
            currentlySelected.classList.remove('selected');
        }

        // Se l'elemento cliccato non è una riga valida, deseleziona tutto
        if (!rowElement) {
            this.state.selectedRowId = null;
            this.updateToolbarState();
            return;
        }

        // Aggiungi la classe 'selected' alla nuova riga
        rowElement.classList.add('selected');

        // --- QUESTA È LA PARTE FONDAMENTALE MANCANTE ---
        // Salva l'ID della riga selezionata nello stato dell'applicazione
        this.state.selectedRowId = rowElement.dataset.id;

        // Aggiorna lo stato dei pulsanti della toolbar (es. abilita/disabilita Modifica)
        this.updateToolbarState();
    },

    /**
         * Salva le modifiche apportate a una riga.
         */
    async handleSaveChanges(rowElement) {
        const config = this.viewConfig[this.state.currentView];
        const rowId = rowElement.dataset.id;
        const updatedData = {};

        rowElement.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
            let value = input.value;
            if (value === '' && (input.type === 'date' || input.type === 'datetime-local' || input.type === 'number')) {
                value = null;
            }
            updatedData[input.dataset.key] = value;
        });

        try {
            const response = await apiFetch(`${config.apiEndpoint}/${rowId}`, {
                method: 'PUT',
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore del server');
            }

            const resultData = await response.json();

            // --- CHIAMATA MANCANTE AGGIUNTA QUI ---
            // Chiama la nuova funzione per aggiornare l'interfaccia e uscire dalla modalità modifica
            this.exitEditMode(rowId, resultData);

            await showModal({ title: 'Successo', message: 'Modifiche salvate con successo.', confirmText: 'OK', type: 'success' });

        } catch (error) {
            showModal({ title: 'Errore', message: `Impossibile salvare le modifiche: ${error.message}`, confirmText: 'OK' });
        }
    },

    // AGGIUNGI QUESTA NUOVA FUNZIONE (ad esempio dopo handleSaveChanges)
    exitEditMode: function (rowId, updatedRowData = null) {
        const rowElement = this.dom.gridWrapper.querySelector(`.agile-table-row[data-id="${rowId}"]`);
        if (!rowElement) return;

        const config = this.viewConfig[this.state.currentView];

        // --- INIZIO BLOCCO DI RESET COMPLETO ---
        // 1. Resetta lo stato di MODIFICA
        rowElement.classList.remove('editing');
        this.state.isEditingRow = false;
        this.state.editingRowId = null;

        // 2. Resetta lo stato di SELEZIONE
        this.state.lastSelectedRadio = null;
        this.state.selectedRowId = null;

        // 3. Resetta l'aspetto della SELEZIONE
        const radio = rowElement.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
        rowElement.classList.remove('selected-row');
        // --- FINE BLOCCO DI RESET COMPLETO ---

        if (updatedRowData) {
            // Aggiorna la copia locale dei dati
            const itemIndex = this.state.tableData.findIndex(
                item => String(item[config.idColumn]) === String(rowId)
            );
            if (itemIndex > -1) {
                this.state.tableData[itemIndex] = updatedRowData;
            }

            // Aggiorna la visualizzazione della riga
            config.columns.forEach((col, index) => {
                const cell = rowElement.cells[index + 2];
                if (cell) {
                    cell.innerHTML = this.formatCellValue(col, updatedRowData);
                }
            });
        } else {
            // In caso di annullamento, ricarica i dati per sicurezza
            this.loadAndRenderData(true);
        }

        this.updateToolbarState();
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

    renderToolbar: function () {
        const view = this.state.currentView;
        const config = this.viewConfig[view];
        const isReadOnly = config?.readOnly === true;

        if (isReadOnly) {
            // Vista read-only: solo barra ricerca + download
            this.dom.toolbarArea.innerHTML = `
                <div class="toolbar-group search-group">
                    <input type="text" id="filter-search-term" placeholder="Cerca nel registro..."/>
                    <button class="button icon-button" id="searchBtn" title="Cerca">🔎</button>
                    <button class="button icon-button" id="resetSearchBtn" title="Azzera ricerca">🧹</button>
                </div>
                <div class="toolbar-group">
                    <button class="button icon-button" id="downloadXlsBtn" title="Scarica XLS">📥</button>
                </div>
            `;
            return;
        }

        this.dom.toolbarArea.innerHTML = `
            <div class="toolbar-group">
                <button class="button icon-button button--primary" id="addRowBtn" title="Aggiungi">➕</button>
                <button class="button icon-button button--warning" id="editRowBtn" title="Modifica" disabled>✏️</button>
                <button class="button icon-button button--danger" id="deleteRowBtn" title="Cancella" disabled>🗑️</button>
                
                <button class="button icon-button button--primary" id="saveBtn" title="Salva" disabled>💾</button>
                <button class="button icon-button button--danger" id="cancelBtn" title="Annulla" disabled>❌</button>
            </div>
            
            <div class="toolbar-group search-group">
                <input type="text" id="filter-search-term" placeholder="Cerca in ${view}..."/>
                <button class="button icon-button" id="searchBtn" title="Cerca">🔎</button>
                <button class="button icon-button" id="resetSearchBtn" title="Azzera ricerca">🧹</button>
            </div>
            <div class="toolbar-group">
                <button class="button icon-button" id="downloadXlsBtn" title="Scarica XLS">📥</button>
            </div>
        `;

        // Questa logica rimane invariata
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

        // Creazione tabella (in memoria)
        const table = document.createElement('table');
        table.className = 'agile-table';
        table.dataset.view = this.state.currentView;

        // Header
        const thead = table.createTHead();
        const headerRow = thead.insertRow();

        const fixedHeaders = [{ text: '#', title: 'Numero Riga' }, { text: '☑️', title: 'Seleziona' }];

        // In vista read-only, nascondi la colonna di selezione
        const isReadOnly = config.readOnly === true;
        const headersToRender = isReadOnly 
            ? [{ text: '#', title: 'Numero Riga' }] 
            : fixedHeaders;

        headersToRender.forEach(header => {
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

            const filterIcon = `<img src="img/filter.png" class="filter-icon" data-column-key="${col.key}" alt="Filtro">`;

            thContent.innerHTML = `<span>${col.label}${sortIndicator}</span>${filterIcon}`;
            th.classList.toggle('filter-active', !!this.state.activeFilters[col.filterOptions?.key || col.key]);
            th.appendChild(thContent);
            headerRow.appendChild(th);
        });

        // Body
        const tbody = table.createTBody();

        if (data.length === 0) {
            const noDataRow = tbody.insertRow();
            const cell = noDataRow.insertCell();
            cell.colSpan = config.columns.length + (isReadOnly ? 1 : 2);
            cell.textContent = 'Nessun dato trovato. Modifica i filtri per una nuova ricerca.';
            cell.style.textAlign = 'center'; cell.style.padding = '20px';
            cell.style.fontStyle = 'italic'; cell.style.color = 'var(--col-666666)';
        } else {
            // --- APPLICAZIONE SUGGERIMENTO 4: DocumentFragment ---
            const fragment = document.createDocumentFragment();

            data.forEach((rowData, index) => {
                // Usiamo createElement invece di insertRow per lavorare in memoria
                const row = document.createElement('tr');
                row.className = 'agile-table-row';
                row.dataset.id = rowData[config.idColumn];

                const pageOffset = (this.state.currentPage - 1) * 50;

                // Cella Numero
                const cellNum = document.createElement('td');
                cellNum.textContent = pageOffset + index + 1;
                row.appendChild(cellNum);

                // Cella Radio (nascosta in read-only)
                if (!isReadOnly) {
                    const cellSelect = document.createElement('td');
                    const radio = document.createElement('input');
                    radio.type = 'radio'; radio.name = 'rowSelector';
                    radio.value = rowData[config.idColumn];
                    cellSelect.appendChild(radio);
                    row.appendChild(cellSelect);
                }

                // Celle Dati
                config.columns.forEach(col => {
                    const cell = document.createElement('td');
                    let cellValue;
                    if (col.formatter) {
                        cellValue = col.formatter(rowData);
                    } else {
                        const displayKey = col.displayKey || col.key;
                        cellValue = this.getPropertyByString(rowData, displayKey) || '';
                    }
                    cell.innerHTML = cellValue;
                    row.appendChild(cell);
                });

                // Aggiunge la riga completa al frammento
                fragment.appendChild(row);
            });

            // Inietta tutte le righe nel tbody in una sola operazione
            tbody.appendChild(fragment);
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

    // Il popup dei filtri per colonna e' in `js/gestione-filtri.js` dal
    // 19/09/2026. Qui restano due deleghe, cosi' `handleTableClick` e
    // `addStaticEventListeners` continuano a chiamare `this.closeColumnFilterPopup()`
    // e `this.openColumnFilterPopup(...)` come prima.
    //
    // `renderFilterPopup` NON ha piu' una delega: era chiamata soltanto da
    // `openColumnFilterPopup`, quindi nel modulo e' privata ed e' uscita dalla
    // superficie di `App`.
    //
    // `this.state` viene passato per INTERO e non a campi: il popup SCRIVE
    // `activeFilters`, e la scrittura deve finire sullo stesso oggetto che
    // leggono gli altri metodi. Con una copia il filtro si sarebbe applicato
    // in apparenza — popup chiuso, tabella ricaricata — senza filtrare nulla.
    closeColumnFilterPopup: function () {
        chiudiPopupFiltro();
    },

    openColumnFilterPopup(iconElement, columnKey) {
        const vista = this.state.currentView;
        return apriPopupFiltro({
            iconElement,
            columnKey,
            config: this.viewConfig[vista],
            vista,
            stato: this.state,
            ricaricaDati: () => this.loadAndRenderData(true),
        });
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

            // Helper per popolare la select
            const populateSelect = (data) => {
                select.innerHTML = `<option value="" disabled selected>Seleziona un'opzione</option>`;
                data.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt[columnConfig.options.valueField];
                    option.textContent = opt[columnConfig.options.textField];
                    if (String(option.value) === String(currentValue)) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            };

            // Tenta di usare la cache locale se possibile
            let loadedFromCache = false;
            const ep = columnConfig.options.apiEndpoint;

            // Mappatura Endpoint -> Chiave Cache
            const cacheMap = {
                '/api/simple/clienti': 'clienti',
                '/api/simple/ruoli': 'ruoli',
                '/api/simple/aziende': 'aziende',
                '/api/simple/modelli': 'modelli',
                '/api/simple/status_commessa': 'status_commessa', // o 'status'
                '/api/commesse/fasi': 'fasi',
                '/api/simple/articoli': 'articoli',
                '/api/simple/ubicazioni': 'ubicazioni',
                '/api/personale?limit=1000': 'personale' // Questo potrebbe non esserci nella cache "gestione" se non l'abbiamo aggiunto
            };

            const cacheKey = cacheMap[ep];
            if (cacheKey && this.state.allDependencies[cacheKey]) {
                populateSelect(this.state.allDependencies[cacheKey]);
                loadedFromCache = true;
            }

            // Se non è in cache, fai la fetch network (Fallback)
            if (!loadedFromCache) {
                try {
                    const response = await apiFetch(columnConfig.options.apiEndpoint);
                    const optionsData = await response.json();
                    populateSelect(optionsData);
                } catch (error) {
                    select.innerHTML = `<option value="">Errore nel caricamento</option>`;
                }
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

    // Spostate in `js/gestione-utili.js` il 19/09/2026 (task 4.4), e RIMESSE
    // QUI come proprieta' assegnate dall'import — lo stesso schema usato per
    // `viewConfig` l'08/09.
    //
    // Perche' cosi' e non riscrivendo i richiami: `getPropertyByString` e'
    // chiamata da quattro metodi e `formatCellValue` da due. Lasciandole
    // proprieta' di `App`, ogni `this.getPropertyByString(...)` continua a
    // valere e l'estrazione non tocca nessun punto d'uso. Sei righe cambiate
    // invece di sei punti da verificare.
    getPropertyByString,
    formatCellValue,

    // Il corpo (106 righe) e' in `js/gestione-esporta.js` dal 19/09/2026.
    // Qui resta un metodo di una riga: `handleToolbarClick` continua a
    // chiamare `this.exportToXlsx()` come prima, quindi l'estrazione non
    // tocca il suo unico punto d'uso.
    exportToXlsx: function () {
        const vista = this.state.currentView;
        return esportaInXlsx(vista, this.viewConfig[vista], this.state);
    },

};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Pagina gestione.js pronta. In attesa del via libera dall\'autenticazione...');
    // Potremmo usare la stessa logica a promessa, ma per ora questo è sufficiente
    // dato che auth-guard blocca il caricamento se non sei loggato.
    App.init();
});