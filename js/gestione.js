// js/gestione.js

import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

    async function apiFetch(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${localStorage.getItem('user-token')}`
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        mergedOptions.headers = { ...defaultOptions.headers, ...options.headers };

        if (mergedOptions.body) {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }

        try {
            const response = await fetch(url, mergedOptions);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
            }
            if (response.status === 204) {
                 return {};
            }
            return await response.json();

        } catch (error) {
            console.error(`Errore nella chiamata API a ${endpoint}:`, error);
            throw error; 
        }
    }

    // === SELEZIONE ELEMENTI DOM ===
    const viewSelector = document.getElementById('tableViewSelector');
    const filterArea = document.getElementById('filterArea');
    const actionBar = document.getElementById('actionBar');
    const gridWrapper = document.getElementById('gridWrapper');
    const placeholderText = document.querySelector('.placeholder-text');
    const loader = document.querySelector('.loader');

    // === CONFIGURAZIONE DELLE VISTE ===
    // Un oggetto di configurazione per rendere il codice più pulito e manutenibile
    const viewConfig = {
        'registrazioni_ore': {
            apiEndpoint: '/api/registrazioni',
            columns: [
                { key: 'data_lavoro', label: 'Data', type: 'date' },
                { key: 'operatore_nome', label: 'Operatore' },
                { key: 'commessa_nome', label: 'Commessa' },
                { key: 'lavorazione_nome', label: 'Lavorazione' },
                { key: 'ore', label: 'Ore', editable: true, type: 'number' },
                { key: 'descrizione_dettaglio', label: 'Descrizione', editable: true },
                { key: 'stato_nome', label: 'Stato' }
            ],
            filters: ['dateRange', 'operatore', 'commessa'],
            actions: ['updateStatus']
        },
        'operatori': {
            apiEndpoint: '/api/operatori',
            columns: [
                { key: 'nome', label: 'Nome', editable: true },
                { key: 'cognome', label: 'Cognome', editable: true },
                { key: 'ruolo', label: 'Ruolo', editable: true },
                { key: 'attivo', label: 'Attivo', type: 'boolean' }
            ],
            filters: ['search'],
            actions: ['addRow']
        },
        'clienti': {
            apiEndpoint: '/api/clienti',
            columns: [
                // Corrisponde alla colonna 'ragione_sociale' in Supabase
                { key: 'ragione_sociale', label: 'Ragione Sociale', editable: true },
                // Corrisponde alla colonna 'codice_cliente' in Supabase
                { key: 'codice_cliente', label: 'Codice Cliente', editable: true, type: 'text' } // Usiamo 'text' ma possiamo aggiungere validazione numerica se serve
            ],
            filters: ['search'],
            actions: ['addRow']
        },
        // Aggiungere qui le configurazioni per 'tipologie_lavorazioni', 'stati_registrazione', 'commesse'
        // ...
    };

    let selectDataCache = {}; // Cache per i dati dei menu a tendina
    let activeFilters = {};

    // === FUNZIONE DI INIZIALIZZAZIONE ===
    
    function initializeView() {
        const selectedView = viewSelector.value;
    
        renderToolbar(selectedView);
    
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => loadAndRenderData(selectedView, false));
        }
    
        // --- NUOVA RIGA ---
        // Collega l'evento al pulsante Aggiungi
        const addRowBtn = document.getElementById('addRowBtn');
        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => handleAddRow(selectedView));
        }
        // --- FINE NUOVA RIGA ---

        loadAndRenderData(selectedView, true);
    }


    // === FUNZIONI DI RENDERING DINAMICO ===

    function renderToolbar(view) {
        const toolbar = document.getElementById('toolbarArea');
        if (!toolbar) return;

        // Usiamo simboli Unicode per le icone: ➕ ✏️ 🗑️ 🔍
        toolbar.innerHTML = `
            <div class="toolbar-group">
                <button class="button icon-button" id="addRowBtn" title="Aggiungi Nuova Voce">➕</button>
                <button class="button icon-button" id="editRowBtn" title="Modifica Riga Selezionata" disabled>✏️</button>
                <button class="button icon-button" id="deleteRowBtn" title="Cancella Riga Selezionata" disabled>🗑️</button>
                <button class="button" id="saveNewRowBtn" title="Salva Nuova Riga" style="display: none;">Salva</button>
            </div>
            <div class="toolbar-group search-group">
                <input type="text" id="filter-search-term" placeholder="Cerca in ${view}...">
                <button class="button icon-button" id="searchBtn" title="Cerca">🔍</button>
            </div>
        `;
    }

    function handleAddRow(view) {
        const existingNewRow = document.querySelector('.new-row-form');
            if (existingNewRow) {
            existingNewRow.remove();
            document.getElementById('saveNewRowBtn').style.display = 'none'; // Nasconde il pulsante Salva
            return;
        }

        document.getElementById('saveNewRowBtn').style.display = 'inline-flex';

        const config = viewConfig[view];
        const table = gridWrapper.querySelector('table');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const newRow = tbody.insertRow(0);
        newRow.classList.add('new-row-form', 'selected-row');

        // # e Seleziona (celle vuote)
        newRow.insertCell().textContent = '*';
        newRow.insertCell();

        // Colonne editabili come input
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

        // Cella per il pulsante Salva
        const actionCell = newRow.insertCell();
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salva';
        saveBtn.className = 'button';
        saveBtn.className = 'button save-button-dynamic';
        saveBtn.onclick = () => saveNewRow(view, newRow);
        actionCell.appendChild(saveBtn);
    }

    async function saveNewRow(view, row) {
        const config = viewConfig[view];
        const newObject = {};
    
        row.querySelectorAll('input[data-key]').forEach(input => {
            newObject[input.dataset.key] = input.value;
        });

        // Validazione semplice: controlla che almeno un campo sia stato riempito
        if (Object.values(newObject).every(val => !val)) {
            alert("Compilare almeno un campo per salvare.");
            return;
        }

        try {
            await apiFetch(config.apiEndpoint, {
                method: 'POST',
                body: newObject
            });
        
            // Ricarica i dati per mostrare la nuova riga
            loadAndRenderData(view, true); 

        } catch (error) {
            alert(`Errore nella creazione: ${error.message}`);
        }
    }

    function createSelectHtml(id, label, data, valueKey, textKey, textKey2 = '') {
        let options = '<option value="">Tutti</option>';
        data.forEach(item => {
            options += `<option value="${item[valueKey]}">${item[textKey] + (textKey2 ? ` ${item[textKey2]}` : '')}</option>`;
        });
        return `<div class="form-group"><label>${label}:</label><select id="filter-${id}">${options}</select></div>`;
    }

    // === FUNZIONI DI CARICAMENTO E VISUALIZZAZIONE DATI ===
    
    function handleRowSelection() {
        const editBtn = document.getElementById('editRowBtn');
        const deleteBtn = document.getElementById('deleteRowBtn'); // Nuovo pulsante
        const radioButtons = document.querySelectorAll('input[name="rowSelector"]');
        let lastSelected = null;

        radioButtons.forEach(radio => {
            radio.addEventListener('click', (event) => {
                document.getElementById('saveNewRowBtn').style.display = 'none';
                const currentRadio = event.currentTarget;
                const currentRow = currentRadio.closest('tr');

                document.querySelectorAll('.agile-table tbody tr').forEach(r => r.classList.remove('selected-row'));
            
                if (lastSelected === currentRadio) {
                    currentRadio.checked = false;
                    lastSelected = null;
                    if (editBtn) editBtn.disabled = true;
                    if (deleteBtn) deleteBtn.disabled = true; // Disabilita anche cancella
                } else {
                    currentRow.classList.add('selected-row');
                    lastSelected = currentRadio;
                    if (editBtn) editBtn.disabled = false;
                    if (deleteBtn) deleteBtn.disabled = false; // Abilita anche cancella
                }
            });
        });
    }

    async function loadAndRenderData(view, isInitialLoad = false) {
        const config = viewConfig[view];
        if (!config) return;

        gridWrapper.innerHTML = '';
        if(placeholderText) placeholderText.style.display = 'none';
        loader.style.display = 'block';

        const params = new URLSearchParams();

        if (isInitialLoad) {
            activeFilters = {}; // Resetta i filtri quando si cambia vista
            params.append('limit', '50');
            params.append('sortBy', config.columns[0].key);
            params.append('sortOrder', 'asc');
        } else {
            // Filtro dalla barra di ricerca generica
            const searchTerm = document.getElementById('filter-search-term')?.value;
            if (searchTerm) {
                params.append('search', searchTerm);
            }
        
            // --- NUOVA LOGICA: Aggiungi i filtri di colonna attivi ---
            for (const columnKey in activeFilters) {
                if (activeFilters[columnKey].length > 0) {
                    activeFilters[columnKey].forEach(value => {
                        params.append(columnKey, value);
                    });
                }
            }
        }

        const endpointWithParams = `${config.apiEndpoint}?${params.toString()}`;

        try {
            const data = await apiFetch(endpointWithParams);
            renderTable(data, config.columns);
        } catch (error) {
            console.error(`Errore nel caricamento dati per ${view}:`, error);
            gridWrapper.innerHTML = `<div class="error-text">Impossibile caricare i dati.</div>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderTable(data, columns) {
        if (!data || data.length === 0) {
            gridWrapper.innerHTML = `<div class="placeholder-text">Nessun dato trovato.</div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'agile-table';

        // Crea l'intestazione
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
    
        // Aggiungi le intestazioni fisse '#' e 'Seleziona'
        ['#', 'Seleziona'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
    
        // --- INIZIO CORREZIONE ---
        // Aggiungi le intestazioni dinamiche con la logica dei filtri
        columns.forEach(col => {
            const th = document.createElement('th'); // <-- QUESTA RIGA MANCAVA
        
            // Contenitore per testo e icona
            const headerContent = document.createElement('div');
            headerContent.className = 'column-header-content';
        
            const label = document.createElement('span');
            label.textContent = col.label;
        
            const filterIcon = document.createElement('span');
            filterIcon.className = 'filter-icon';
            filterIcon.textContent = '🔽';
            filterIcon.dataset.columnKey = col.key;
        
            headerContent.appendChild(label);
            headerContent.appendChild(filterIcon);
            th.appendChild(headerContent);
            headerRow.appendChild(th);
        });
        // --- FINE CORREZIONE ---

        // Crea il corpo della tabella
        const tbody = table.createTBody();
        data.forEach((rowData, index) => {
            const row = tbody.insertRow();
        
            const cellNum = row.insertCell();
            cellNum.textContent = index + 1;

            const cellSelect = row.insertCell();
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'rowSelector';
            radio.value = rowData.id_cliente; // O un altro ID univoco
            cellSelect.appendChild(radio);

            columns.forEach(col => {
                const cell = row.insertCell();
                cell.textContent = rowData[col.key] || '';
                if (col.editable) {
                    cell.classList.add('editable');
                }
            });
        });

        gridWrapper.innerHTML = '';
        gridWrapper.appendChild(table);

        handleRowSelection();
    
        // Collega gli eventi ai nuovi pulsanti filtro
        attachFilterEventListeners(data);
    }

    // AGGIUNGI QUESTA NUOVA FUNZIONE in gestione.js
    function attachFilterEventListeners(tableData) {
        const selectedView = viewSelector.value;

        document.querySelectorAll('.filter-icon').forEach(icon => {
            const columnKey = icon.dataset.columnKey;
            const th = icon.closest('th'); // Selezioniamo l'intera cella di intestazione

            // Applica/rimuove lo stile all'avvio
            if (activeFilters[columnKey] && activeFilters[columnKey].length > 0) {
                th.classList.add('filter-active');
            } else {
                th.classList.remove('filter-active');
            }

            icon.addEventListener('click', event => {
                event.stopPropagation();
                const existingPopup = document.querySelector('.filter-popup');

                // Se clicco sull'icona e il popup esiste già, lo chiudo
                if (existingPopup) {
                    existingPopup.remove();
                    return;
                }

                const currentColumnKey = event.currentTarget.dataset.columnKey;
                const uniqueValues = [...new Set(tableData.map(item => item[currentColumnKey]))].sort();
            
                document.querySelectorAll('.filter-popup').forEach(p => p.remove());

                const popup = document.createElement('div');
                popup.className = 'filter-popup';
            
                // Ricostruisce le checkbox, preselezionando quelle già attive
                let listItems = uniqueValues.map(value => {
                    const isChecked = activeFilters[currentColumnKey]?.includes(String(value)) ? 'checked' : '';
                    return `<li><label><input type="checkbox" class="filter-checkbox" value="${value}" ${isChecked}> ${value}</label></li>`;
                }).join('');

                popup.innerHTML = `
                    <ul class="filter-popup-list">${listItems}</ul>
                    <div class="filter-popup-buttons">
                        <button class="button icon-button" id="apply-filter">Applica</button>
                        <button class="button icon-button" id="clear-filter">Pulisci</button>
                    </div>
                `;
            
                document.body.appendChild(popup);
                const rect = icon.getBoundingClientRect();
                popup.style.top = `${rect.bottom + window.scrollY}px`;
                popup.style.left = `${rect.left + window.scrollX}px`;

                // Logica per APPLICA
                popup.querySelector('#apply-filter').addEventListener('click', () => {
                    const selectedValues = Array.from(popup.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
                    activeFilters[currentColumnKey] = selectedValues;
                    loadAndRenderData(selectedView, false);
                    popup.remove();
                });
            
                // Logica per PULISCI
                popup.querySelector('#clear-filter').addEventListener('click', () => {
                    delete activeFilters[currentColumnKey];
                    loadAndRenderData(selectedView, false);
                    popup.remove();
                });
            });
        });
    
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-popup') && !e.target.classList.contains('filter-icon')) {
                document.querySelectorAll('.filter-popup').forEach(p => p.remove());
            }
        }, true);
    }

    // === EVENT LISTENER E AVVIO INIZIALE ===
    viewSelector.addEventListener('change', initializeView);
    initializeView();
});