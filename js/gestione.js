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
            document.addEventListener('click', this.handleDocumentClick.bind(this), true);

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
            // Resetta lo stato e carica la prima pagina della nuova vista
            this.loadAndRenderData(true); 
        },

        /**
         * Gestisce i click sui pulsanti della toolbar.
         */
        handleToolbarClick(event) {
            const button = event.target.closest('button');
            if (!button) return;

            switch (button.id) {
                // When searching, it's a new query
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

            // If it's a new search or a new filter, always reset to page 1
            if (isNewQuery) {
                this.state.currentPage = 1;
            }

            this.dom.gridWrapper.innerHTML = `<div class="loader">Caricamento...</div>`;
            const params = new URLSearchParams();
            
            // Always include all current state parameters in the request
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
                document.getElementById('pagination-container').innerHTML = '';
            }
        },
        
        /**
         * Aggiunge o rimuove una riga vuota per l'inserimento.
         */
        handleAddRow() {
            const existingNewRow = document.querySelector('.new-row-form');

            if (existingNewRow) {
                existingNewRow.remove();
                this.state.isAddingNewRow = false;
            } else {
                this.state.isAddingNewRow = true;

                const config = this.viewConfig[this.state.currentView];
                let table = this.dom.gridWrapper.querySelector('table');
                if (!table) {
                    this.renderTable([]); 
                    table = this.dom.gridWrapper.querySelector('table');
                }
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
            newRow.querySelectorAll('input[data-key]').forEach(input => {
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
        handleEditRow() {
            if (!this.state.lastSelectedRadio) return;
            this.state.isEditingRow = true;
            const row = this.state.lastSelectedRadio.closest('tr');
            row.classList.add('editing-row');
            const config = this.viewConfig[this.state.currentView];
            config.columns.forEach((col, index) => {
                if (col.editable) {
                    const cell = row.cells[index + 2];
                    const currentValue = cell.textContent;
                    cell.innerHTML = `<input type="text" value="${currentValue}" data-key="${col.key}" style="width: 100%; box-sizing: border-box;">`;
                }
            });
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
            editingRow.querySelectorAll('input[data-key]').forEach(input => {
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
            this.loadAndRenderData(true).then(() => this.updateToolbarState());
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
                
                buttons.add.disabled = true; // Can't add when a row is selected
                buttons.save.disabled = true;
                buttons.cancel.disabled = true;
                buttons.search.disabled = false;
                searchInput.disabled = false;
                return; // Stop here
            }

            // Rule: Default state (no row selected, not adding/editing)
            buttons.add.disabled = false;
            buttons.search.disabled = false;
            searchInput.disabled = false;

            buttons.edit.disabled = true;
            buttons.del.disabled = true;
            buttons.save.disabled = true;
            buttons.cancel.disabled = true;
        },


        renderTable(data = this.state.tableData) {
            const config = this.viewConfig[this.state.currentView];
            if (!config) return;
            if (data.length === 0 && this.state.isAddingNewRow) {
                // If adding and table is empty, still show structure
            } else if (!data || data.length === 0) {
                 this.dom.gridWrapper.innerHTML = `<div class="placeholder-text">Nessun dato trovato.</div>`;
                 return;
            }
            const table = document.createElement('table');
            table.className = 'agile-table';
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
                const thContent = document.createElement('div');
                thContent.className = 'column-header-content';
                const filterIcon = `<span class="filter-icon" data-column-key="${col.key}">🔽</span>`;
                thContent.innerHTML = `<span>${col.label}</span>${filterIcon}`;
                th.classList.toggle('filter-active', this.state.activeFilters[col.key]?.length > 0);
                th.appendChild(thContent);
                headerRow.appendChild(th);
            });
            const tbody = table.createTBody();
            data.forEach((rowData, index) => {
                const row = tbody.insertRow();
                row.insertCell().textContent = index + 1;
                const cellSelect = row.insertCell();
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'rowSelector';
                radio.value = rowData[config.idColumn];
                cellSelect.appendChild(radio);
                config.columns.forEach(col => {
                    row.insertCell().textContent = rowData[col.key] || '';
                });
            });
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
                paginationHTML += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Precedente</button>`;
                for (let i = 1; i <= totalPages; i++) {
                    paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                }
                paginationHTML += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Successivo &raquo;</button>`;
                container.innerHTML = paginationHTML;

                // Correctly add event listeners for page changes
                container.querySelectorAll('.page-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const page = parseInt(e.currentTarget.dataset.page, 10);
                        this.state.currentPage = page;
                        // A page click is NOT a new query, so we pass false
                        this.loadAndRenderData(false); 
                    });
                });
            },
        
        async openColumnFilterPopup(iconElement, columnKey) { // Function is now async
            const existingPopup = document.querySelector('.filter-popup');
            if (existingPopup) {
                existingPopup.remove();
                if (existingPopup.dataset.column === columnKey) return;
            }

            const popup = document.createElement('div');
            popup.className = 'filter-popup';
            popup.dataset.column = columnKey;
            // Show a loading message initially
            popup.innerHTML = `<div class="loader-small" style="text-align: center; padding: 10px;">Caricamento...</div>`;
            
            document.body.appendChild(popup);
            const rect = iconElement.getBoundingClientRect();
            popup.style.top = `${rect.bottom + window.scrollY}px`;
            popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;

            try {
                // --- START OF NEW LOGIC ---
                // Call the new API to get ALL unique values
                const tableName = this.state.currentView;
                const uniqueValues = await this.apiFetch(`/api/distinct/${tableName}/${columnKey}`);
                // --- END OF NEW LOGIC ---

                const activeColumnFilters = this.state.activeFilters[columnKey] || [];
                const listItems = uniqueValues.map(value => {
                    const isChecked = activeColumnFilters.includes(String(value)) ? 'checked' : '';
                    return `<li><label><input type="checkbox" class="filter-checkbox" value="${value}" ${isChecked}> <span class="filter-value">${value}</span></label></li>`;
                }).join('');

                // Replace loading message with the full filter UI
                popup.innerHTML = `
                    <div class="filter-popup-buttons">
                        <button class="button button--primary" id="apply-filter">Applica</button>
                        <button class="button button--secondary" id="clear-filter">Pulisci</button>
                    </div>
                    <input type="text" id="popup-search-input" placeholder="Cerca valori...">
                    <ul class="filter-popup-list">${listItems}</ul>
                `;
                
                // Reposition after content is loaded, as width may have changed
                popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;

                // Add live search functionality
                const searchInput = popup.querySelector('#popup-search-input');
                const listElements = popup.querySelectorAll('.filter-popup-list li');
                searchInput.addEventListener('input', () => {
                    const searchTerm = searchInput.value.toLowerCase();
                    listElements.forEach(li => {
                        const valueText = li.querySelector('.filter-value').textContent.toLowerCase();
                        li.style.display = valueText.includes(searchTerm) ? '' : 'none';
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
                this.state.activeFilters[columnKey] = Array.from(popup.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
                // Applying a filter IS a new query
                this.loadAndRenderData(true); 
                popup.remove();
            } else if (target.id === 'clear-filter') {
                const columnKey = popup.dataset.column;
                delete this.state.activeFilters[columnKey];
                // Clearing a filter IS a new query
                this.loadAndRenderData(true); 
                popup.remove();
            } else if (!target.closest('.filter-popup') && !target.classList.contains('filter-icon')) {
                popup.remove();
            }
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
    };
    
    App.init();
});