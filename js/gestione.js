// js/gestione.js - Versione Completa, Corretta e Ottimizzata

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

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
        selectedRowId: null,
        editingRowId: null,
        isAddingNewRow: false,
        allStatuses: []
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
                        //key: 'commesse.id_commessa', // La chiave da usare per il filtro nel backend
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
        'anagrafica_articoli': {
            apiEndpoint: '/api/articoli',
            idColumn: 'id',
            defaultSortBy: 'codice_articolo',
            columns: [
                { key: 'codice_articolo', label: 'Codice Articolo', editable: true, filterOptions: { key: 'codice_articolo' } },
                { key: 'descrizione', label: 'Descrizione', editable: true, type: 'textarea', filterOptions: { key: 'descrizione' } },
                {
                    key: 'id_fase_default',
                    label: 'Fase Default',
                    editable: true,
                    type: 'foreignKey',
                    options: { apiEndpoint: '/api/commesse/fasi', valueField: 'id_fase', textField: 'nome_fase' },
                    formatter: (rowData) => rowData.fasi_produzione?.nome_fase || 'Nessuna',
                    filterOptions: { key: 'id_fase_default', apiEndpoint: '/api/commesse/fasi', valueField: 'id_fase', textField: 'nome_fase' }
                }
            ]
        },

        'fasi_produzione': {
            apiEndpoint: '/api/fasi',
            idColumn: 'id_fase',
            columns: [
                { key: 'nome_fase', label: 'Nome Fase', editable: true },
                { key: 'descrizione', label: 'Descrizione', editable: true, type: 'textarea' }
            ]
        },

        'ore_lavorate': {
            apiEndpoint: '/api/ore',
            idColumn: 'id_registrazione',
            defaultSortBy: 'data_lavoro',
            defaultSortOrder: 'desc',
            columns: [
                {
                    key: 'data_lavoro', label: 'Data', editable: true, type: 'date',
                    formatter: (rowData) => new Date(rowData.data_lavoro).toLocaleDateString('it-IT'),
                    filterOptions: { apiEndpoint: '/api/distinct-dates/ore_lavorate/data_lavoro' }
                },
                {
                    key: 'id_personale_fk', label: 'Dipendente', editable: true, type: 'foreignKey',
                    options: { apiEndpoint: '/api/personale?limit=1000', valueField: 'id_personale', textField: 'nome_cognome' },
                    formatter: (rowData) => rowData.personale?.nome_cognome || 'N/A',
                    filterOptions: { key: 'id_personale_fk', apiEndpoint: '/api/personale?limit=1000', valueField: 'id_personale', textField: 'nome_cognome' }
                },
                {
                    key: 'id_commessa_fk', label: 'Commessa', editable: true, type: 'foreignKey',
                    options: { apiEndpoint: '/api/get-etichette', valueField: 'id', textField: 'label' },
                    formatter: (rowData) => rowData.commesse?.vo || rowData.commesse?.impianto || 'N/A'
                },
                { key: 'ore', label: 'Ore', editable: true, type: 'text' }, // type text per permettere float
                { key: 'note', label: 'Note', editable: true, type: 'textarea' },
                {
                    key: 'stato', label: 'Stato', editable: true, type: 'boolean',
                    // Simuliamo boolean per 0/1: False=Da Validare, True=Contabilizzato
                    options: null,
                    formatter: (r) => r.stato === 1 ? '✅ Contabilizzato' : '⏳ Da Validare'
                }
            ]
        },

        'registro_produzione': {
            apiEndpoint: '/api/produzione/registro_crud',
            idColumn: 'id',
            defaultSortBy: 'data_ricezione',
            defaultSortOrder: 'desc',
            columns: [
                { key: 'numero_op', label: 'OP', editable: true, filterOptions: { key: 'numero_op' } },
                {
                    key: 'id_commessa', label: 'Commessa', editable: true, type: 'foreignKey',
                    options: { apiEndpoint: '/api/get-etichette', valueField: 'id', textField: 'label' },
                    formatter: (rowData) => rowData.commesse?.vo || 'N/A'
                },
                {
                    key: 'id_articolo', label: 'Articolo', editable: true, type: 'foreignKey',
                    // Qui usiamo un endpoint per lista semplice articoli se esiste, altrimenti lista paginata potrebbe essere pesante
                    options: { apiEndpoint: '/api/simple/articoli', valueField: 'id', textField: 'codice_articolo' },
                    formatter: (rowData) => rowData.anagrafica_articoli?.codice_articolo || 'N/A'
                },
                { key: 'qta_richiesta', label: 'Q.tà Richiesta', editable: true },
                { key: 'qta_prodotta', label: 'Q.tà Fatta', editable: true },
                { key: 'tempo_impiegato', label: 'Tempo (min)', editable: true },
                {
                    key: 'data_ricezione', label: 'Ricezione', editable: true, type: 'date',
                    formatter: (r) => r.data_ricezione ? new Date(r.data_ricezione).toLocaleDateString('it-IT') : ''
                },
                {
                    key: 'data_invio', label: 'Chiuso il', editable: true, type: 'date',
                    formatter: (r) => r.data_invio ? new Date(r.data_invio).toLocaleDateString('it-IT') : '-'
                }
            ]
        }
    },

    /**
    * Funzione di avvio: recupera gli elementi DOM e imposta gli eventi principali.
    */
    init: function () {
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
            cell.colSpan = config.columns.length + 2;
            cell.textContent = 'Nessun dato trovato. Modifica i filtri per una nuova ricerca.';
            cell.style.textAlign = 'center'; cell.style.padding = '20px';
            cell.style.fontStyle = 'italic'; cell.style.color = '#666';
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

                // Cella Radio
                const cellSelect = document.createElement('td');
                const radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'rowSelector';
                radio.value = rowData[config.idColumn];
                cellSelect.appendChild(radio);
                row.appendChild(cellSelect);

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

    closeColumnFilterPopup: function () {
        const existingPopup = document.querySelector('.column-filter-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
    },

    async openColumnFilterPopup(iconElement, columnKey) {
        this.closeColumnFilterPopup();

        const config = this.viewConfig[this.state.currentView];
        const columnConfig = config.columns.find(c => c.key === columnKey);
        const filterOptions = columnConfig.filterOptions;

        const popup = document.createElement('div');
        popup.className = 'column-filter-popup';
        popup.dataset.column = columnKey; // Memorizza la colonna a cui si riferisce
        document.body.appendChild(popup);

        const rect = iconElement.getBoundingClientRect();
        popup.style.top = `${rect.bottom + 5 + window.scrollY}px`;
        popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;
        popup.style.visibility = 'visible';
        popup.innerHTML = `<div class="loader-small"></div>`;

        try {
            let optionsData;
            // SE la colonna ha una configurazione di filtro avanzata, usala.
            if (filterOptions && filterOptions.apiEndpoint) {
                const response = await apiFetch(filterOptions.apiEndpoint);
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                optionsData = await response.json();
            }
            // ALTRIMENTI, usa il vecchio metodo generico.
            else {
                const filterKey = filterOptions?.key || columnKey;
                const tableNameForApi = config.tableName || this.state.currentView;
                const response = await apiFetch(`/api/distinct/${tableNameForApi}/${filterKey}`);
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                optionsData = await response.json();
            }

            this.renderFilterPopup(popup, optionsData, columnKey, filterOptions);

        } catch (error) {
            console.error("Errore durante il recupero delle opzioni di filtro:", error);
            popup.innerHTML = `<div class="error-text">Errore filtri</div>`;
        }
    },

    renderFilterPopup: function (popupElement, options, columnKey, filterOptions) {
        const searchFilter = document.createElement('input');
        searchFilter.type = 'text';
        searchFilter.placeholder = 'Filtra opzioni...';
        searchFilter.className = 'filter-search-input';

        const optionsList = document.createElement('div');
        optionsList.className = 'filter-options-list';

        const filterKey = filterOptions?.key || columnKey;
        const activeFilterValues = (this.state.activeFilters[filterKey] || []).map(String);

        options.forEach(option => {
            let value, text;

            // SE abbiamo opzioni complesse (ID + Testo), estrai i valori corretti.
            if (filterOptions && filterOptions.valueField && filterOptions.textField) {
                value = option[filterOptions.valueField];
                text = option[filterOptions.textField];
            }
            // ALTRIMENTI, valore e testo sono la stessa cosa.
            else {
                value = option;
                text = option;
            }

            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'filter-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `filter-${columnKey}-${value}`;
            checkbox.value = value;
            checkbox.checked = activeFilterValues.includes(String(value));

            const label = document.createElement('label');
            label.setAttribute('for', checkbox.id);
            label.textContent = text;

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(label);
            optionsList.appendChild(checkboxWrapper);
        });

        // La logica per la ricerca interna, i pulsanti e gli eventi rimane invariata...
        let searchTimeout;
        searchFilter.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase();
                optionsList.querySelectorAll('.filter-option').forEach(opt => {
                    const label = opt.querySelector('label').textContent.toLowerCase();
                    opt.style.display = label.includes(searchTerm) ? 'flex' : 'none';
                });
            }, 300);
        });

        const footer = document.createElement('div');
        footer.className = 'filter-popup-footer';

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Applica';
        applyBtn.className = 'button button--primary';

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Pulisci';
        clearBtn.className = 'button';

        applyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const selectedOptions = Array.from(optionsList.querySelectorAll('input:checked')).map(cb => cb.value);

            if (selectedOptions.length > 0) {
                this.state.activeFilters[filterKey] = selectedOptions;
            } else {
                delete this.state.activeFilters[filterKey];
            }

            this.loadAndRenderData(true);
            this.closeColumnFilterPopup();
        });

        clearBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            delete this.state.activeFilters[filterKey];
            this.loadAndRenderData(true);
            this.closeColumnFilterPopup();
        });

        footer.appendChild(clearBtn);
        footer.appendChild(applyBtn);

        popupElement.innerHTML = '';
        popupElement.appendChild(searchFilter);
        popupElement.appendChild(optionsList);
        popupElement.appendChild(footer);
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

    formatCellValue: function (col, rowData) {
        // Se la colonna ha un formattatore personalizzato, usalo
        if (col.formatter) {
            return col.formatter(rowData);
        }
        // Altrimenti, prendi il valore della proprietà
        const displayKey = col.displayKey || col.key;
        return this.getPropertyByString(rowData, displayKey) || '';
    },
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Pagina gestione.js pronta. In attesa del via libera dall\'autenticazione...');
    // Potremmo usare la stessa logica a promessa, ma per ora questo è sufficiente
    // dato che auth-guard blocca il caricamento se non sei loggato.
    App.init();
});