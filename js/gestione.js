// js/gestione.js

document.addEventListener('DOMContentLoaded', () => {
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
        const config = viewConfig[selectedView];

        if (!config) {
            console.error(`Configurazione non trovata per la vista: ${selectedView}`);
            return;
        }

        renderFilters(config.filters);
        renderActions(config.actions, selectedView);
        
        // Aggiungi event listener al pulsante 'Carica Dati'
        const loadDataBtn = document.getElementById('loadDataBtn');
        if(loadDataBtn) {
            loadDataBtn.addEventListener('click', () => loadAndRenderData(selectedView));
        }
    }

    // === FUNZIONI DI RENDERING DINAMICO ===
    async function renderFilters(filters) {
        filterArea.innerHTML = ''; // Pulisce i filtri precedenti
        let filterHtml = '';

        if (filters.includes('dateRange')) {
            filterHtml += `
                <div class="form-group">
                    <label>Data Inizio:</label>
                    <input type="date" id="filter-start-date">
                </div>
                <div class="form-group">
                    <label>Data Fine:</label>
                    <input type="date" id="filter-end-date">
                </div>`;
        }
        if (filters.includes('operatore')) {
             if (!selectDataCache.operatori) {
                const res = await apiFetch('/api/operatori');
                selectDataCache.operatori = await res.json();
             }
            filterHtml += createSelectHtml('operatore', 'Operatore', selectDataCache.operatori, 'operatore_id', 'nome', 'cognome');
        }
        if (filters.includes('commessa')) {
             if (!selectDataCache.commesse) {
                const res = await apiFetch('/api/commesse');
                selectDataCache.commesse = await res.json();
             }
            filterHtml += createSelectHtml('commessa', 'Commessa', selectDataCache.commesse, 'commessa_id', 'nome_commessa');
        }
        if (filters.includes('search')) {
            filterHtml += `<div class="form-group"><label>Cerca:</label><input type="text" id="filter-search-term" placeholder="Scrivi per cercare..."></div>`;
        }

        filterHtml += `<button class="button" id="loadDataBtn"><img src="img/search.png" alt="Cerca"><span>Carica Dati</span></button>`;
        filterArea.innerHTML = filterHtml;
    }
    
    function createSelectHtml(id, label, data, valueKey, textKey, textKey2 = '') {
        let options = '<option value="">Tutti</option>';
        data.forEach(item => {
            options += `<option value="${item[valueKey]}">${item[textKey] + (textKey2 ? ` ${item[textKey2]}` : '')}</option>`;
        });
        return `<div class="form-group"><label>${label}:</label><select id="filter-${id}">${options}</select></div>`;
    }

    function renderActions(actions, view) {
        actionBar.innerHTML = ''; // Pulisce le azioni precedenti
        let actionsHtml = '';
        if (actions.includes('updateStatus')) {
            actionsHtml += `<button class="button" id="updateStatusBtn">Aggiorna Stato Selezionati</button>`;
        }
        if (actions.includes('addRow')) {
            const label = view === 'operatori' ? '+ Aggiungi Operatore' : '+ Aggiungi';
            actionsHtml += `<button class="button save-button" id="addRowBtn">${label}</button>`;
        }
        actionBar.innerHTML = actionsHtml;
    }


    // === FUNZIONI DI CARICAMENTO E VISUALIZZAZIONE DATI ===
    async function loadAndRenderData(view) {
        const config = viewConfig[view];
        if (!config) return;

        gridWrapper.innerHTML = ''; // Pulisce la griglia
        loader.style.display = 'block';
        placeholderText.style.display = 'none';

        // Costruisce l'URL con i parametri di filtro
        const params = new URLSearchParams();
        // (Logica per leggere i valori dai filtri e aggiungerli a 'params')
        // Esempio:
        const startDate = document.getElementById('filter-start-date')?.value;
        if (startDate) params.append('start_date', startDate);
        // ... e così via per gli altri filtri ...

        const fullUrl = `${config.apiEndpoint}?${params.toString()}`;

        try {
            const response = await apiFetch(fullUrl);
            if (!response.ok) throw new Error(`Errore API: ${response.statusText}`);
            
            const data = await response.json();
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
            gridWrapper.innerHTML = `<div class="placeholder-text">Nessun dato trovato per i filtri selezionati.</div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'agile-table'; // Aggiungi una classe per lo stile

        // Crea l'intestazione
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            headerRow.appendChild(th);
        });

        // Crea il corpo della tabella
        const tbody = table.createTBody();
        data.forEach(rowData => {
            const row = tbody.insertRow();
            columns.forEach(col => {
                const cell = row.insertCell();
                cell.textContent = rowData[col.key] || '';
                if (col.editable) {
                    cell.classList.add('editable');
                    // Aggiungere qui la logica per la modifica inline
                }
            });
        });

        gridWrapper.appendChild(table);
    }

    // === EVENT LISTENERS ===
    viewSelector.addEventListener('change', initializeView);

    // === INIZIALIZZAZIONE AL CARICAMENTO DELLA PAGINA ===
    initializeView(); 
});