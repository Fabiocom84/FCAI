// js/gestione-viste.js
//
// Configurazione delle 13 viste della pagina Gestione, estratta da
// `gestione.js` l'08/09/2026. Per ogni vista: endpoint, colonne, colonna
// identificativa, e i formattatori con cui ogni valore viene mostrato.
//
// PERCHE' QUI E NON IN gestione.js
// Non per lunghezza — anche se erano 447 righe su 1665 — ma perche' misurando
// non tocca niente del file che la conteneva: zero `this`, zero chiamate ad
// API, zero accesso al DOM, zero uso degli import di `gestione.js`. Le 32
// funzioni a freccia sono pure: prendono `rowData` (o `r`, o `val`) e
// restituiscono una stringa. Non e' codice con dentro dei dati, sono dati con
// dentro qualche formattatore.
//
// GLI UNDICI PUNTI D'USO NON SONO CAMBIATI. In `gestione.js` questo oggetto
// resta una proprieta' di `App`, solo assegnata da un import invece che scritta
// in linea, quindi tutti i `this.viewConfig[...]` continuano a valere. E' la
// differenza rispetto all'estrazione di `commesse-geo.js`, dove le chiamate
// erano state riscritte: qui il rischio di una svista sta solo nello
// spostamento delle righe, non nel loro uso.
//
// Aggiungere una vista si fa qui, e solo qui.

export const viewConfig = {
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
                key: 'id_ubicazione_fk',
                label: '📁 Ubicazione',
                editable: true,
                type: 'foreignKey',
                formatter: (rowData) => rowData.ubicazioni?.nome_ubicazione || 'N/A',
                options: { apiEndpoint: '/api/simple/ubicazioni', valueField: 'id_ubicazione', textField: 'nome_ubicazione' },
                filterOptions: {
                    key: 'id_ubicazione_fk',
                    apiEndpoint: '/api/simple/ubicazioni',
                    valueField: 'id_ubicazione',
                    textField: 'nome_ubicazione'
                }
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

    'ubicazioni': {
        apiEndpoint: '/api/ubicazioni',
        idColumn: 'id_ubicazione',
        columns: [
            { key: 'nome_ubicazione', label: 'Nome Ubicazione', editable: true },
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
    },

    'audit_log': {
        apiEndpoint: '/api/admin/audit-log',
        idColumn: 'id_log',
        defaultSortBy: 'timestamp',
        defaultSortOrder: 'desc',
        readOnly: true,
        columns: [
            {
                key: 'timestamp',
                label: 'Data/Ora',
                editable: false,
                formatter: (r) => {
                    if (!r.timestamp) return '';
                    return new Date(r.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            },
            {
                key: 'nome_utente',
                label: 'Utente',
                editable: false
            },
            {
                key: 'azione',
                label: 'Azione',
                editable: false,
                formatter: (r) => {
                    const badges = {
                        'DELETE': '<span style="background:var(--col-e74c3c);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">DELETE</span>',
                        'CREATE': '<span style="background:var(--col-27ae60);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">CREATE</span>',
                        'UPDATE': '<span style="background:var(--col-3498db);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">UPDATE</span>',
                        'STATUS_CHANGE': '<span style="background:var(--col-8e44ad);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">STATUS</span>',
                        'ADMIN_OVERRIDE': '<span style="background:var(--col-e67e22);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">OVERRIDE</span>',
                        'ADMIN_ACTION': '<span style="background:var(--col-e67e22);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">ADMIN</span>',
                        'LOGIN': '<span style="background:var(--col-95a5a6);color:var(--col-ffffff);padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600">LOGIN</span>'
                    };
                    return badges[r.azione] || `<span style="background:var(--col-bdc3c7);padding:2px 8px;border-radius:4px;font-size:0.8em">${r.azione}</span>`;
                }
            },
            {
                key: 'entita',
                label: 'Entit\u00e0',
                editable: false
            },
            {
                key: 'id_entita',
                label: 'ID',
                editable: false,
                formatter: (r) => r.id_entita || '-'
            },
            {
                key: 'dettagli',
                label: 'Dettagli',
                editable: false,
                formatter: (r) => {
                    if (!r.dettagli || Object.keys(r.dettagli).length === 0) return '-';
                    const entries = Object.entries(r.dettagli)
                        .map(([k, v]) => `<b>${k}</b>: ${v}`)
                        .join(', ');
                    return `<span style="font-size:0.85em;color:var(--col-555555)">${entries}</span>`;
                }
            },
            {
                key: 'ip_address',
                label: 'IP',
                editable: false,
                formatter: (r) => r.ip_address || '-'
            }
        ]
    }
};
