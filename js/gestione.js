// js/gestione.js - Versione Riorganizzata e Ottimizzata

import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

    /**
     * Gestore dell'intera applicazione per la Vista Agile.
     * Contiene lo stato, gli elementi del DOM e tutte le funzioni logiche.
     */
    const App = {
        dom: {},
        state: {
            currentView: null,
            activeFilters: {},
            tableData: [],
            isAddingNewRow: false,
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
        },

        /**
         * Funzione di avvio: recupera gli elementi DOM e imposta gli eventi principali.
         */
        init() {
            this.dom.viewSelector = document.getElementById('tableViewSelector');
            this.dom.toolbarArea = document.getElementById('toolbarArea');
            this.dom.gridWrapper = document.getElementById('gridWrapper');
            this.dom.loader = document.querySelector('.loader');
            
            this.dom.viewSelector.addEventListener('change', this.handleViewChange.bind(this));
            this.dom.toolbarArea.addEventListener('click', this.handleToolbarClick.bind(this));
            this.dom.gridWrapper.addEventListener('click', this.handleTableClick.bind(this));
            document.addEventListener('click', this.handleDocumentClick.bind(this), true);

            this.handleViewChange();
        },

        /**
         * Gestisce il cambio di vista dal menu a tendina.
         */
        handleViewChange() {
            this.state.currentView = this.dom.viewSelector.value;
            this.state.isAddingNewRow = false; // Annulla l'aggiunta se si cambia vista
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
                case 'searchBtn':
                    this.loadAndRenderData(false);
                    break;
                case 'addRowBtn':
                    this.handleAddRow();
                    break;
                case 'saveNewRowBtn':
                    this.handleSaveNewRow();
                    break;
            }
        },
        
        /**
         * Gestisce i click all'interno della tabella (selezione e filtri).
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
        async loadAndRenderData(isInitialLoad = false) {
            const config = this.viewConfig[this.state.currentView];
            if (!config) return;

            this.dom.gridWrapper.innerHTML = `<div class="loader">Caricamento...</div>`;
            const params = new URLSearchParams();

            if (isInitialLoad) {
                this.state.activeFilters = {};
                params.append('limit', '50');
                params.append('sortBy', config.columns[0].key);
                params.append('sortOrder', 'asc');
            } else {
                const searchTerm = document.getElementById('filter-search-term')?.value;
                if (searchTerm) params.append('search', searchTerm);
                for (const key in this.state.activeFilters) {
                    this.state.activeFilters[key].forEach(value => params.append(key, value));
                }
            }

            try {
                const endpoint = `${config.apiEndpoint}?${params.toString()}`;
                this.state.tableData = await this.apiFetch(endpoint);
                this.renderTable();
            } catch (error) {
                this.dom.gridWrapper.innerHTML = `<div class="error-text">Impossibile caricare i dati.</div>`;
            }
        },
        
        /**
         * Aggiunge o rimuove una riga vuota per l'inserimento.
         */
        handleAddRow() {
            const saveBtn = document.getElementById('saveNewRowBtn');
            const existingNewRow = document.querySelector('.new-row-form');

            if (existingNewRow) {
                existingNewRow.remove();
                saveBtn.disabled = true;
                this.state.isAddingNewRow = false;
                return;
            }

            this.state.isAddingNewRow = true;
            saveBtn.disabled = false;
            document.getElementById('editRowBtn').disabled = true;
            document.getElementById('deleteRowBtn').disabled = true;
            
            const config = this.viewConfig[this.state.currentView];
            const table = this.dom.gridWrapper.querySelector('table');
            if (!table) return;

            const tbody = table.querySelector('tbody');
            const newRow = tbody.insertRow(0);
            newRow.classList.add('new-row-form', 'selected-row');
            
            newRow.insertCell().textContent = '*';
            newRow.insertCell();

            config.columns.forEach(col => {
                const cell = newRow.insertCell();
                if (col.editable) {
                    const input = document.createElement('input');
                    input.type = col.type || 'text';
                    input.placeholder = col.label;
                    input.dataset.key = col.key;
                    cell.appendChild(input);
                }
            });
        },
        
        /**
         * Salva i dati inseriti nella nuova riga.
         */
        async handleSaveNewRow() {
            const newRow = document.querySelector('.new-row-form');
            if (!newRow) return;

            const config = this.viewConfig[this.state.currentView];
            const newObject = {};
            
            newRow.querySelectorAll('input[data-key]').forEach(input => {
                newObject[input.dataset.key] = input.value;
            });

            if (Object.values(newObject).every(val => !val)) {
                alert("Compilare almeno un campo per salvare.");
                return;
            }

            try {
                await this.apiFetch(config.apiEndpoint, { method: 'POST', body: newObject });
                document.getElementById('saveNewRowBtn').disabled = true;
                this.state.isAddingNewRow = false;
                this.loadAndRenderData(true);
            } catch (error) {
                alert(`Errore nella creazione: ${error.message}`);
            }
        },
        
        /**
         * Gestisce la logica di selezione/deselezione di una riga.
         */
        handleRowSelection(currentRadio) {
            const saveBtn = document.getElementById('saveNewRowBtn');
            const editBtn = document.getElementById('editRowBtn');
            const deleteBtn = document.getElementById('deleteRowBtn');
            
            saveBtn.disabled = true;
            document.querySelectorAll('.agile-table tbody tr').forEach(r => r.classList.remove('selected-row'));

            if (this.state.lastSelectedRadio === currentRadio) {
                currentRadio.checked = false;
                this.state.lastSelectedRadio = null;
                editBtn.disabled = true;
                deleteBtn.disabled = true;
            } else {
                currentRadio.closest('tr').classList.add('selected-row');
                this.state.lastSelectedRadio = currentRadio;
                editBtn.disabled = false;
                deleteBtn.disabled = false;
            }
        },

        // --- Funzioni di Rendering e Utility ---
        
        renderToolbar() {
            // ... (codice invariato)
        },
        renderTable() {
            // ... (codice invariato)
        },
        openColumnFilterPopup(iconElement, columnKey) {
            // ... (codice invariato)
        },
        handleDocumentClick(event) {
            // ... (codice invariato)
        },
        async apiFetch(endpoint, options = {}) {
            // ... (codice invariato)
        }
    };
    
    // Inizializza l'applicazione
    App.init();
});