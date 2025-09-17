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

    // === FUNZIONE DI INIZIALIZZAZIONE ===
    
    function initializeView() {
        const selectedView = viewSelector.value;
    
        // Chiama la nuova funzione unificata per la toolbar
        renderToolbar(selectedView);
    
        // Collega l'evento al nuovo pulsante 'Cerca'
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => loadAndRenderData(selectedView, false));
        }

        // Carica i dati di default all'inizializzazione
        loadAndRenderData(selectedView, true);
    }

    // === FUNZIONI DI RENDERING DINAMICO ===

    function renderToolbar(view) {
        const config = viewConfig[view];
        if (!config) return;

        // Svuotiamo entrambe le vecchie aree (ora sono dentro .agile-toolbar)
        filterArea.innerHTML = '';
        actionBar.innerHTML = '';

        // Creiamo il gruppo di ricerca
        let searchGroupHtml = `
            <div class="form-group">
                <label>Cerca in ${view}:</label>
                <input type="text" id="filter-search-term" placeholder="Scrivi e premi Cerca...">
            </div>
            <button class="button" id="searchBtn">Cerca</button>
        `;
        filterArea.innerHTML = searchGroupHtml;

        // Creiamo i pulsanti di azione
        let actionsHtml = `
            <button class="button save-button" id="addRowBtn">+ Aggiungi</button>
            <button class="button" id="editRowBtn" disabled>Modifica</button>
        `;
        actionBar.innerHTML = actionsHtml;
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
        const radioButtons = document.querySelectorAll('input[name="rowSelector"]');
    
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                if (editBtn) {
                    // Abilita il pulsante 'Modifica' se un radio è selezionato
                    editBtn.disabled = false;
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
            // Per il caricamento iniziale, impostiamo un limite e un ordinamento di default
            params.append('limit', '50');
            params.append('sortBy', config.columns[0].key); // Ordina per la prima colonna
            params.append('sortOrder', 'asc'); // Ordine ascendente
        } else {
            // Per il caricamento manuale, leggiamo i filtri
            const searchTerm = document.getElementById('filter-search-term')?.value;
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            // ... (qui in futuro aggiungeremo gli altri filtri come la data) ...
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
    
        // Aggiungi le nuove intestazioni fisse
        const thNum = document.createElement('th');
        thNum.textContent = '#';
        headerRow.appendChild(thNum);

        const thSelect = document.createElement('th');
        thSelect.textContent = 'Seleziona';
        headerRow.appendChild(thSelect);

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            headerRow.appendChild(th);
        });

        // Crea il corpo della tabella
        const tbody = table.createTBody();
        data.forEach((rowData, index) => {
            const row = tbody.insertRow();
        
            // Aggiungi le nuove celle fisse
            // Cella per il numero di riga
            const cellNum = row.insertCell();
            cellNum.textContent = index + 1;

            // Cella per il radio button di selezione
            const cellSelect = row.insertCell();
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'rowSelector'; // Lo stesso 'name' per tutti li rende un gruppo unico
            radio.value = rowData.id_cliente; // O un altro ID univoco della riga
            cellSelect.appendChild(radio);

            columns.forEach(col => {
                const cell = row.insertCell();
                cell.textContent = rowData[col.key] || '';
                if (col.editable) {
                    cell.classList.add('editable');
                }
            });
        });

        gridWrapper.innerHTML = ''; // Pulisce il wrapper prima di aggiungere la nuova tabella
        gridWrapper.appendChild(table);

        // Collega la logica di selezione alla tabella appena creata
        handleRowSelection();
    }
});