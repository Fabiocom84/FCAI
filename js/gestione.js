// js/gestione.js - Versione Completa, Corretta e Ottimizzata

import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

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

        handleViewChange() {
            this.state.currentView = this.dom.viewSelector.value;
            this.state.isAddingNewRow = false;
            this.renderToolbar();
            this.loadAndRenderData(true);
        },

        handleToolbarClick(event) {
            const button = event.target.closest('button');
            if (!button) return;

            switch (button.id) {
                case 'searchBtn': this.loadAndRenderData(false); break;
                case 'addRowBtn': this.handleAddRow(); break;
                case 'saveNewRowBtn': this.handleSaveNewRow(); break;
                case 'editRowBtn': this.handleEditRow(); break;
                case 'deleteRowBtn': this.handleDeleteRow(); break;
                case 'saveChangesBtn': this.handleSaveChanges(); break;
                case 'cancelEditBtn': this.handleCancelEdit(); break;
            }
        },
        
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

        handleDeleteRow() {
            if (!this.state.lastSelectedRadio) {
                alert("Nessuna riga selezionata.");
                return;
            }

            const id = this.state.lastSelectedRadio.value;
            const rowElement = this.state.lastSelectedRadio.closest('tr');
            const rowName = rowElement.cells[2].textContent;

            if (confirm(`Sei sicuro di voler eliminare "${rowName}"?`)) {
                const config = this.viewConfig[this.state.currentView];
                const endpoint = `${config.apiEndpoint}/${id}`;

                this.apiFetch(endpoint, { method: 'DELETE' })
                    .then(() => {
                        alert("Elemento eliminato con successo.");
                        this.loadAndRenderData(true);
                    })
                    .catch(error => {
                        alert(`Errore durante l'eliminazione: ${error.message}`);
                    });
            }
        },

        handleEditRow() {
            if (!this.state.lastSelectedRadio) {
                alert("Nessuna riga selezionata.");
                return;
            }
        
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

            // Update toolbar for editing state
            this.renderToolbarForEditing();
        },

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
                alert("Elemento modificato con successo.");
                this.state.isEditingRow = false;
                this.loadAndRenderData(true);
            } catch (error) {
                alert(`Errore durante la modifica: ${error.message}`);
            }
        },

        handleCancelEdit() {
            this.state.isEditingRow = false;
            this.loadAndRenderData(true); // Simply reload to cancel
        },


        renderToolbarForEditing() {
            const editBtn = document.getElementById('editRowBtn');
            const deleteBtn = document.getElementById('deleteRowBtn');
            const addBtn = document.getElementById('addRowBtn');
            const saveNewBtn = document.getElementById('saveNewRowBtn');
        
            // Hide standard buttons
            editBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
            addBtn.style.display = 'none';
            saveNewBtn.textContent = "Salva Modifiche";
            saveNewBtn.id = "saveChangesBtn"; // Temporarily change ID for the event handler
            saveNewBtn.disabled = false;

            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.className = 'button icon-button button--danger';
            cancelBtn.title = 'Annulla';
            cancelBtn.innerHTML = '❌';
        
            saveNewBtn.parentElement.appendChild(cancelBtn);
        },

        renderTable() {
            const data = this.state.tableData;
            const config = this.viewConfig[this.state.currentView];
            if (!data || data.length === 0) {
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
        
        openColumnFilterPopup(iconElement, columnKey) {
            const existingPopup = document.querySelector('.filter-popup');
            if (existingPopup) {
                existingPopup.remove();
                if (existingPopup.dataset.column === columnKey) return;
            }
            const uniqueValues = [...new Set(this.state.tableData.map(item => item[columnKey]))].sort();
            const popup = document.createElement('div');
            popup.className = 'filter-popup';
            popup.dataset.column = columnKey;
            const activeColumnFilters = this.state.activeFilters[columnKey] || [];
            const listItems = uniqueValues.map(value => {
                const isChecked = activeColumnFilters.includes(String(value)) ? 'checked' : '';
                return `<li><label><input type="checkbox" class="filter-checkbox" value="${value}" ${isChecked}> ${value}</label></li>`;
            }).join('');
            popup.innerHTML = `
                <input type="text" id="popup-search-input" placeholder="Cerca valori...">
                <ul class="filter-popup-list">${listItems}</ul>
                <div class="filter-popup-buttons">
                    <button class="button button--primary" id="apply-filter">Applica</button>
                    <button class="button button--secondary" id="clear-filter">Pulisci</button>
                </div>`;
            document.body.appendChild(popup);
            const rect = iconElement.getBoundingClientRect();
            popup.style.top = `${rect.bottom + window.scrollY}px`;
            popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;
            const searchInput = popup.querySelector('#popup-search-input');
            const listElements = popup.querySelectorAll('.filter-popup-list li');
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                listElements.forEach(li => {
                    const valueText = li.textContent.toLowerCase();
                    li.style.display = valueText.includes(searchTerm) ? '' : 'none';
                });
            });
        },

        handleDocumentClick(event) {
            const popup = document.querySelector('.filter-popup');
            if (!popup) return;
            const target = event.target;
            if (target.id === 'apply-filter') {
                const columnKey = popup.dataset.column;
                this.state.activeFilters[columnKey] = Array.from(popup.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
                this.loadAndRenderData(false);
                popup.remove();
            } else if (target.id === 'clear-filter') {
                const columnKey = popup.dataset.column;
                delete this.state.activeFilters[columnKey];
                this.loadAndRenderData(false);
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
        }
    };
    
    App.init();
});