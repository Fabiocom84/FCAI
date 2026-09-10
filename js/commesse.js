// js/commesse.js

import { apiFetch, segnala } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin, CurrentUser, IsImpiegato } from './core-init.js';
import { setupGeoMapControls, openGeoMap } from './commesse-geo.js';

const App = {
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        hasMore: true,
        activeStatus: 'In Lavorazione',
        activeTipo: 'ALL',  // Filtro tipo: ALL | COMPLETA | MANUTENZIONE
        searchTerm: '',
        sortBy: 'data_commessa',
        sortOrder: 'desc',
        allStatuses: [],
        allPhases: [],
        allMacros: [] // Cache delle macro categorie
    },

    dom: {},

    init: async function () {


        // 1. Mappatura DOM
        this.dom = {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),         // Loader Iniziale
            scrollLoader: document.getElementById('infinite-scroll-loader'), // Loader Scroll
            wrapper: document.querySelector('.std-app-content'), // Container scrollabile

            // Controlli
            statusFilters: document.querySelectorAll('.filter-btn:not(.filter-tipo)'),
            tipoFilters: document.querySelectorAll('.filter-tipo'),
            tipoFiltersGroup: document.getElementById('tipoFiltersGroup'),
            searchInput: document.getElementById('search-input'),
            deepSearchCheckbox: document.getElementById('search-deep'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn')
        };

        // 2. Controllo Permessi Admin (Mostra tasto aggiungi solo se Admin)
        if (IsAdmin) {
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'flex';
            // Mostra filtro tipo per admin
            if (this.dom.tipoFiltersGroup) this.dom.tipoFiltersGroup.style.display = 'flex';
        } else {
            // Impiegato: mostra filtro tipo ma non il bottone +Aggiungi
            // (ruolo derivato una sola volta in core-init.js — la versione
            // precedente leggeva `ruoli[0]` e non riconosceva mai l'impiegato)
            if (IsImpiegato && this.dom.tipoFiltersGroup) {
                this.dom.tipoFiltersGroup.style.display = 'flex';
            }
            // Nascondi deep search per non-admin
            const deepWrapper = document.getElementById('deep-search-wrapper');
            if (deepWrapper) deepWrapper.style.display = 'none';
        }

        // 3. Event Listeners
        this.addEventListeners();

        // 4. Caricamento Dati Unificato (Metadata + Card)
        try {
            await this.loadUnifiedData();
        } catch (e) {
            console.warn("Errore caricamento dati unificati", e);
        }

        // Fetch iniziale gestita da loadUnifiedData
    },

    loadUnifiedData: async function () {
        // SWR: i metadati (status, fasi, macros) vivono in localStorage con TTL 1h.
        // Le card commesse vengono sempre ricaricate da server (dati live).
        const cachedInit = localStorage.getItem('commesse_init_v3');
        const cacheTimestamp = localStorage.getItem('commesse_cache_ts');
        const now = Date.now();
        const MAX_AGE = 3600 * 1000;

        // Pulizia versioni obsolete della cache
        ['commesse_init_v2', 'commesse_init_v1', 'commesse_list_cache'].forEach(k => localStorage.removeItem(k));

        // 1. Applica cache metadati se valida (render immediato dei select/fasi)
        if (cachedInit && cacheTimestamp && (now - parseInt(cacheTimestamp) < MAX_AGE)) {
            try {
                const initData = JSON.parse(cachedInit);
                this._applyMetadata(initData);
            } catch (e) {
                localStorage.removeItem('commesse_init_v3');
            }
        }

        // 2. Fetch metadati freschi in background (non bloccante).
        // Non si usa await: se Cloud Run è in cold start, questa richiesta
        // non congela il caricamento delle card che hanno il proprio loader visibile.
        apiFetch('/api/commesse/init-data')
            .then(res => res.json())
            .then(data => {
                this._applyMetadata(data);
                localStorage.setItem('commesse_init_v3', JSON.stringify({
                    status: data.status, macros: data.macros,
                    fasi: data.fasi, clienti: data.clienti,
                    modelli: data.modelli, ubicazioni: data.ubicazioni
                }));
                localStorage.setItem('commesse_cache_ts', now.toString());
            })
            .catch(e => console.warn('Fetch metadati fallita (non bloccante):', e));

        // 3. Carica le card: questa è l'unica fetch bloccante, gestisce il loader visibile.
        await this.fetchCommesse(true);
    },

    // Applica i metadati allo state e inizializza i componenti dipendenti
    _applyMetadata: function (data) {
        this.state.allStatuses  = data.status    || [];
        this.state.allMacros    = data.macros    || [];
        this.state.allPhases    = data.fasi      || [];
        // Lookup Map O(1) per risolvere ID macro → nome nel render delle card
        this.state.macroMap = new Map(
            (data.macros || []).map(m => [m.id_macro_categoria, m.nome || m.nome_macro || String(m.id_macro_categoria)])
        );
    },

    addEventListeners: function () {
        // Scroll Infinito
        if (this.dom.wrapper) {
            this.dom.wrapper.addEventListener('scroll', () => this.handleScroll());
        }

        // Filtri Stato (usa selector specifico per non includere i tipo-btn)
        this.dom.statusFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                this.dom.statusFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.activeStatus = btn.dataset.filter;
                this.fetchCommesse(true);
            });
        });

        // Filtri Tipo (solo per admin/impiegato)
        if (this.dom.tipoFilters) {
            this.dom.tipoFilters.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.dom.tipoFilters.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.state.activeTipo = btn.dataset.tipo;
                    this.fetchCommesse(true);
                });
            });
        }

        // Search Input (Debounce)
        let timeout;
        this.dom.searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.state.searchTerm = this.dom.searchInput.value;
                this.fetchCommesse(true);
            }, 500);
        });

        // Sort Select
        this.dom.sortSelect.addEventListener('change', (e) => {
            const [field, order] = e.target.value.split(':');
            this.state.sortBy = field;
            this.state.sortOrder = order;
            this.fetchCommesse(true);
        });

        // Il modale di creazione/modifica in pagina e' stato rimosso il 06/09/2026:
        // era gia' sostituito da nuova-commessa.html, che riceve tipo e mode dalla
        // query string. Con lui sono spariti i suoi gestori (invio del form,
        // upload immagine, drag&drop) e la geocodifica, che agiva sui campi
        // lat/lon di QUEL form. La mappa globale qui sotto e' un'altra cosa e resta.
        setupGeoMapControls();
    },

    // --- LOGICA DATI & SCROLL ---

    fetchCommesse: async function (reset = false) {
        if (this.state.isLoading) return;

        if (reset) {
            this.state.currentPage = 1;
            this.state.hasMore = true;
            this.dom.grid.innerHTML = ''; // Pulisci griglia
            if (this.dom.loader) this.dom.loader.style.display = 'flex'; // Mostra loader iniziale
        } else {
            // Se non è reset e non c'è altro da caricare, esci
            if (!this.state.hasMore) return;
            if (this.dom.scrollLoader) this.dom.scrollLoader.style.display = 'block'; // Loader sotto
        }

        this.state.isLoading = true;

        try {
            // Costruzione Query Params
            const params = new URLSearchParams({
                page: this.state.currentPage,
                limit: 12,
                status: this.state.activeStatus,
                search: this.state.searchTerm,
                deep_search: this.dom.deepSearchCheckbox?.checked || false,
                sortBy: this.state.sortBy,
                sortOrder: this.state.sortOrder,
                tipo: this.state.activeTipo || 'ALL'
            });

            const res = await apiFetch(`/api/commesse/view?${params.toString()}`);
            const data = await res.json();

            // Nascondi loaders
            if (reset && this.dom.loader) this.dom.loader.style.display = 'none';
            if (this.dom.scrollLoader) this.dom.scrollLoader.style.display = 'none';

            // Gestione "Nessun Risultato"
            if (!data.data || data.data.length === 0) {
                this.state.hasMore = false;
                if (reset) {
                    this.dom.grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--col-888888);">Nessuna commessa trovata.</div>';
                }
                return;
            }

            // Renderizza le card
            this.renderCards(data.data);

            // Verifica se ci sono altre pagine
            if (data.data.length < 12) {
                this.state.hasMore = false;
            } else {
                this.state.currentPage++;
            }

        } catch (e) {
            console.error("Errore fetch commesse:", e);
            this.state.hasMore = false;
            if (reset) this.dom.grid.innerHTML = '<div class="error-text">Errore caricamento dati.</div>';
        } finally {
            this.state.isLoading = false;
        }
    },

    handleScroll: function () {
        const { scrollTop, scrollHeight, clientHeight } = this.dom.wrapper;
        // Triggera quando siamo a 100px dal fondo
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.fetchCommesse(false);
        }
    },

    renderCards: function (commesse) {
        const loader = document.getElementById('loader');
        if (loader) loader.remove();

        const fragment = document.createDocumentFragment();

        commesse.forEach(c => {
            // \u2500\u2500\u2500\u2500 CARD MANUTENZIONE \u2500\u2500\u2500\u2500 (struttura identica alle commesse, immagine default)
            if (c.tipo_commessa === 'MANUTENZIONE') {
                const card = document.createElement('div');
                card.className = 'commesse-card commesse-card--manutenzione';

                const isDone = c.status_commessa?.nome_status?.toLowerCase().includes('complet')
                            || c.status_commessa?.nome_status?.toLowerCase().includes('annullat');

                let mannAdminActions = ''; // Edit/Delete ora integrati nella riga 3 del footer

                // Stato admin: select dropdown (coerente con COMPLETA)
                const mannStatusBadge = IsAdmin
                    ? `<select class="status-select-badge" data-commessa="${c.id_commessa}" onclick="event.stopPropagation()" style="max-width:130px;">
                            ${(this.state.allStatuses.length > 0 ? this.state.allStatuses : [
                                { id_status: 1, nome_status: 'Preventivo' },
                                { id_status: 2, nome_status: 'In Lavorazione' },
                                { id_status: 3, nome_status: 'Completato' },
                            ]).map(s => `<option value="${s.id_status}" ${c.id_status_fk == s.id_status ? 'selected' : ''}>${s.nome_status}</option>`).join('')}
                       </select>`
                    : `<span class="card-mann-status-badge${isDone ? ' done' : ''}">${c.status_commessa?.nome_status || 'In Lavorazione'}</span>`;

                card.innerHTML = `
                    <div class="card-image card-mann-img-wrapper" style="cursor:pointer;" title="Apri dettaglio manutenzione">
                        <img src="img/maintenance-default.png" alt="Manutenzione" loading="lazy">
                        <div class="card-mann-img-overlay">
                            <span class="card-mann-tipo-badge">🔧 MANUTENZIONE</span>
                        </div>
                    </div>
                    <div class="card-details">
                        <div class="card-header">
                            <div style="display:flex;justify-content:space-between;align-items:start;gap:6px;">
                                <h3 style="margin:0;flex:1;">${c.clienti?.ragione_sociale || 'Cliente ???'}</h3>
                                ${mannStatusBadge}
                            </div>
                            <span style="color:var(--col-666666);font-size:0.88rem;">${c.impianto || '—'}</span>
                        </div>

                        <div class="card-info-grid">
                            <div class="info-item">
                                <span class="info-label">Ordine (VO)</span>
                                <span class="info-value">${c.vo || '—'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Anno</span>
                                <span class="info-value">${c.anno || (c.data_commessa ? new Date(c.data_commessa).getFullYear() : '—')}</span>
                            </div>
                        </div>

                        ${c.note ? `<div class="commessa-note" style="margin:8px 0;padding:7px 10px;background:var(--col-fff3e0);border-left:3px solid var(--col-e67e22);font-size:0.79em;color:var(--col-666666);border-radius:0 4px 4px 0;"><strong>Note:</strong> ${c.note}</div>` : ''}

                        <div class="card-footer-actions">

                            <!-- RIGA 1: DETTAGLIO + ORE -->
                            <div style="display:flex;gap:8px;margin-bottom:8px;">
                                <a href="manutenzioni.html?selected=${c.id_commessa}" class="std-btn std-btn--secondary" style="flex:1;padding:8px;font-size:0.85em;text-decoration:none;text-align:center;" onclick="event.stopPropagation()">
                                    🔧 Dettaglio
                                </a>
                                <a href="inserimento-ore.html?commessaId=${c.id_commessa}" class="std-btn std-btn--primary" style="flex:1;padding:8px;font-size:0.85em;text-decoration:none;text-align:center;" onclick="event.stopPropagation()">
                                    ⏱️ Ore
                                </a>
                            </div>

                            <!-- RIGA 2: OP BADGE - piena larghezza (admin + impiegato) -->
                            ${(IsAdmin || (() => {
                                if (!CurrentUser || IsAdmin) return false;
                                let r = '';
                                if (CurrentUser.ruoli) {
                                    if (Array.isArray(CurrentUser.ruoli) && CurrentUser.ruoli.length > 0) r = CurrentUser.ruoli[0].nome_ruolo;
                                    else if (typeof CurrentUser.ruoli === 'object') r = CurrentUser.ruoli.nome_ruolo;
                                }
                                if ((!r || r === 'Nessuno') && CurrentUser.ruolo) r = CurrentUser.ruolo;
                                return r && r.trim().toLowerCase() === 'impiegato';
                            })()) ? `
                            <div style="margin-bottom:8px; width:100%;">
                                <span class="op-badge-placeholder" data-op-commessa="${c.id_commessa}" style="display:block; width:100%;">
                                    <a href="registro-ordini.html?commessa_id=${c.id_commessa}" class="std-btn" style="display:flex; width:100%; box-sizing:border-box; justify-content:center; align-items:center; gap:6px; background:var(--col-ecf0f1); color:var(--col-95a5a6); font-size:0.82em; padding:6px 8px; border-radius:4px; border:1px solid var(--col-bdc3c7); text-decoration:none;" onclick="event.stopPropagation()">
                                        ⚙️ <span style="display:inline-block;width:8px;height:8px;border:2px solid var(--col-bdc3c7);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;"></span> OP
                                    </a>
                                </span>
                            </div>` : ''}

                            <!-- RIGA 3: 4 bottoni uguali (solo admin) -->
                            ${IsAdmin ? `
                            <div style="display:flex;gap:6px;width:100%;">
                                <a href="gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${c.id_commessa}" class="btn-registrazioni" style="flex:1;text-align:center;padding:6px 4px;font-size:0.8em;" onclick="event.stopPropagation()">
                                    <img src="img/table.png" style="width:14px;opacity:0.8;vertical-align:middle;"> Reg.
                                </a>
                                <a href="attivita.html?commessa_id=${c.id_commessa}" class="btn-registrazioni" style="flex:1;text-align:center;background:#eef2ff;padding:6px 4px;font-size:0.8em;" onclick="event.stopPropagation()" title="Gestione Attività di questa manutenzione">
                                    📋 Attività
                                </a>
                                <button class="std-btn std-btn--warning mann-edit-btn" data-id="${c.id_commessa}" style="flex:1;padding:6px 4px;font-size:0.8em;" onclick="event.stopPropagation()">✏️</button>
                                <button class="std-btn std-btn--danger del-btn" data-id="${c.id_commessa}" style="flex:1;padding:6px 4px;font-size:0.8em;" onclick="event.stopPropagation()">🗑️</button>
                            </div>` : ''}

                        </div>
                    </div>`;

                // Click immagine \u2192 apri manutenzioni.html
                const cardImg = card.querySelector('.card-mann-img-wrapper');
                if (cardImg) {
                    cardImg.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.location.href = `manutenzioni.html?selected=${c.id_commessa}`;
                    });
                }

                // Status select (coerente con COMPLETA)
                const mannStatusSel = card.querySelector('.status-select-badge');
                if (mannStatusSel) {
                    mannStatusSel.addEventListener('change', (e) => {
                        e.stopPropagation();
                        this.updateStatusCommesse(c.id_commessa, e.target.value);
                    });
                    this.styleStatusSelect(mannStatusSel);
                }

                // Admin: edit \u2192 nuova-commessa (tipo MANUTENZIONE), delete
                if (IsAdmin) {
                    const mannEdit = card.querySelector('.mann-edit-btn');
                    const mannDel  = card.querySelector('.del-btn');
                    if (mannEdit) mannEdit.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.location.href = `nuova-commessa.html?id=${c.id_commessa}&tipo=MANUTENZIONE&mode=edit&from=commesse`;
                    });
                    if (mannDel) mannDel.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handleDelete(c.id_commessa);
                    });
                }

                fragment.appendChild(card);
                return;
            }

            // ──── CARD COMMESSA COMPLETA ────
            const card = document.createElement('div');
            card.className = 'commesse-card';

            // Header Image
            // [OPTIMIZATION] Usa <img> tag per lazy loading + Supabase resize
            let imgContent = '';
            if (!c.immagine) {
                imgContent = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--col-cccccc);font-weight:500;">NO FOTO</div>';
            } else {
                // Richiedi thumbnail piccola (400px width)
                const optimizedUrl = this.getOptimizedImageUrl(c.immagine, 400);
                imgContent = `<img src="${optimizedUrl}" loading="lazy" alt="${c.impianto || 'Commessa'}" data-full-img="${c.immagine}">`;
            }

            // --- 1. TOGGLE STATO RAPIDO ---
            const statuses = this.state.allStatuses.length > 0 ? this.state.allStatuses : [
                { id_status: 1, nome_status: 'Preventivo' },
                { id_status: 2, nome_status: 'In Lavorazione' },
                { id_status: 3, nome_status: 'Completato' },
                { id_status: 4, nome_status: 'Annullato' }
            ];

            const statusOptions = statuses.map(s =>
                `<option value="${s.id_status}" ${c.id_status_fk == s.id_status ? 'selected' : ''}>${s.nome_status}</option>`
            ).join('');

            // ... (Fasi Logic Omitted for brevity, kept structure implicitly correct by context matching if needed, but here we just focus on the start of loop) ...

            // NOTE: The user instruction was just to update logic. I will target the specific block for Badge OP.

            // ... (rest of imports not needed to repeat here, just Context)

            // ... (rest of imports not needed to repeat here, just Context)

            // [NEW] Badge OP Aperti/Chiusi
            let opBadge = '';

            // CONDIZIONE VISIBILITÀ:
            // 1. Admin
            // 2. Ruolo Impiegato (Check nome ruolo robusto)
            let isImpiegatoRole = false;
            if (CurrentUser && !IsAdmin) {
                let rIdx = "Nessuno";
                // Estrae nome ruolo come in main.js
                if (CurrentUser.ruoli) {
                    if (Array.isArray(CurrentUser.ruoli) && CurrentUser.ruoli.length > 0) rIdx = CurrentUser.ruoli[0].nome_ruolo;
                    else if (typeof CurrentUser.ruoli === 'object') rIdx = CurrentUser.ruoli.nome_ruolo;
                }
                if ((!rIdx || rIdx === "Nessuno") && CurrentUser.ruolo) rIdx = CurrentUser.ruolo;

                if (rIdx && rIdx.trim().toLowerCase() === 'impiegato') isImpiegatoRole = true;
            }

            const canViewBadge = IsAdmin || isImpiegatoRole;

            // Se l'utente può vedere il badge, mostriamo placeholder (dati caricati async)
            if (canViewBadge) {
                // Placeholder grigio con data attribute — verrà aggiornato da loadOpStatsBatch
                opBadge = `<span class="op-badge-placeholder" data-op-commessa="${c.id_commessa}">
                    <a href="registro-ordini.html?commessa_id=${c.id_commessa}" class="std-btn" style="background:var(--col-ecf0f1); color:var(--col-95a5a6); font-size:0.8em; padding:5px 8px; border-radius:4px; border:1px solid var(--col-bdc3c7); display:flex; align-items:center; gap:5px; text-decoration:none;" onclick="event.stopPropagation()">
                        ⚙️ <span style="display:inline-block;width:8px;height:8px;border:2px solid var(--col-bdc3c7);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;"></span> OP
                    </a>
                </span>`;
            }

            // --- 2. FASI AVANZAMENTO ---
            const targetPhases = ['Ufficio', 'Carpenteria', 'Assemblaggio', 'Preparazione'];
            let displayPhases = [];

            if (this.state.allPhases.length > 0) {
                displayPhases = this.state.allPhases.filter(p => targetPhases.some(tp => p.nome_fase.toLowerCase().includes(tp.toLowerCase())));
                if (displayPhases.length === 0) displayPhases = this.state.allPhases.slice(0, 4);
            } else {
                displayPhases = [
                    { id_fase: 1, nome_fase: 'Ufficio' },
                    { id_fase: 2, nome_fase: 'Carpenteria' },
                    { id_fase: 7, nome_fase: 'Assemblaggio' },
                    { id_fase: 4, nome_fase: 'Preparazione' }
                ];
            }

            const sortOrder = ['Ufficio', 'Carpenteria', 'Assemblaggio', 'Preparazione'];
            displayPhases.sort((a, b) => {
                const ia = sortOrder.findIndex(s => a.nome_fase.toLowerCase().includes(s.toLowerCase()));
                const ib = sortOrder.findIndex(s => a.nome_fase.toLowerCase().includes(s.toLowerCase()));
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });

            const activePhases = c.ids_fasi_attive || [];

            // Generazione HTML Pills (rimuoviamo onclick inline per pulizia e usiamo addEventListener)
            const phasesHtml = displayPhases.map(phase => {
                const isActive = activePhases.includes(phase.id_fase);
                return `<div class="phase-pill ${isActive ? 'active' : ''}" data-commessa="${c.id_commessa}" data-fase="${phase.id_fase}">${phase.nome_fase}</div>`;
            }).join('');

            // --- 3. BARRA AVANZAMENTO (NUOVA LOGICA UTENTE) ---
            // Ufficio 25%, Carpenteria 50%, Assemblaggio 50%, Preparazione 75%
            // Se status == Completato -> 100%
            let progressPct = 0;
            if (c.status_commessa?.nome_status === 'Completato') {
                progressPct = 100;
            } else {
                // Calcola il massimo milestone raggiunto
                let currentMax = 0;

                // Mappa Pesi
                const weights = {
                    'ufficio': 25,
                    'carpenteria': 50,
                    'assemblaggio': 50,
                    'preparazione': 75
                };

                displayPhases.forEach(p => {
                    if (activePhases.includes(p.id_fase)) {
                        // Cerca peso matchando nome
                        const nameKey = Object.keys(weights).find(k => p.nome_fase.toLowerCase().includes(k));
                        if (nameKey) {
                            const w = weights[nameKey];
                            if (w > currentMax) currentMax = w;
                        }
                    }
                });
                progressPct = currentMax;
            }

            // Link Registrazioni
            const regCount = c.registrazioni ? c.registrazioni.length : 0;
            const linkReg = `gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${c.id_commessa}`;

            // NOTE: opBadge logic moved to top of loop. Removed duplicate block here.

            // Azioni Admin
            let adminActions = '';
            if (IsAdmin) {
                adminActions = `
                    <div class="admin-actions">
                        <button class="std-btn std-btn--warning edit-btn" data-id="${c.id_commessa}" style="padding: 5px 10px; font-size: 0.8em;">✏️</button>
                        <button class="std-btn std-btn--danger del-btn" data-id="${c.id_commessa}" style="padding: 5px 10px; font-size: 0.8em;">🗑️</button>
                    </div>
                `;
            }

            // HTML Card
            card.innerHTML = `
                <div class="card-image" style="cursor: pointer;">
                    ${imgContent}
                </div>
                <div class="card-details">
                    <div class="card-header">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                            <h3>${c.clienti?.ragione_sociale || 'Cliente ???'}</h3>
                            ${IsAdmin ?
                    `<select class="status-select-badge" data-commessa="${c.id_commessa}" onclick="event.stopPropagation()">
                                    ${statusOptions}
                                </select>`
                    :
                    `<span class="status-badge" style="background:${c.status_commessa?.colore || 'var(--col-cccccc)'}; color:white; padding:4px 8px; border-radius:12px; font-size:0.8em;">
                                    ${c.status_commessa?.nome_status || 'Status ???'}
                                </span>`
                }
                        </div>
                        <span>${c.impianto || 'Impianto Generico'}</span>
                    </div>
                    
                    <div class="card-info-grid">
                        <div class="info-item"><span class="info-label">Rif. Tecnico</span><span class="info-value">${c.riferimento_tecnico || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Ordine (VO)</span><span class="info-value">${c.vo || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Matricola</span><span class="info-value">${c.matricola || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Luogo</span><span class="info-value">${c.paese || '-'} (${c.provincia || ''})</span></div>
                        <div class="info-item" style="grid-column: 1 / -1;"><span class="info-label">📁 Ubicazione</span><span class="info-value" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(c.ubicazioni?.nome_ubicazione || 'ARMADIO') + (c.modelli?.nome_modello ? ' - ' + c.modelli.nome_modello : '')}">${(c.ubicazioni?.nome_ubicazione || 'ARMADIO') + (c.modelli?.nome_modello ? ' - ' + c.modelli.nome_modello : '')}</span></div>
                    </div>

                    ${(() => {
                    // Risoluzione macro O(1) via Map pre-computata in _applyMetadata
                    let macrosToDisplay = [];
                    if (c.macro_categorie && c.macro_categorie.length) {
                        macrosToDisplay = c.macro_categorie.map(m => m.nome || m.nome_macro || m);
                    } else if (c.ids_macro_categorie_attive && this.state.macroMap?.size) {
                        const ids = Array.isArray(c.ids_macro_categorie_attive)
                            ? c.ids_macro_categorie_attive : [c.ids_macro_categorie_attive];
                        macrosToDisplay = ids.map(id => this.state.macroMap.get(id) ?? String(id));
                    }
                    if (macrosToDisplay.length === 0) return '';
                    return `<div class="card-macro-list" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px; margin-bottom: 8px;">
                            ${macrosToDisplay.map(n => `<span style="background:#eef2f3; color:var(--col-555555); padding:2px 6px; border-radius:10px; font-size:0.75em; border:1px solid var(--col-dddddd);">${n}</span>`).join('')}
                        </div>`;
                })()}

                    <!-- NOTE COMMESSA (Se presenti) -->
                    ${c.note ? `<div class="commessa-note" style="margin: 10px 0; padding: 8px; background: #fffde7; border-left: 3px solid var(--col-f1c40f); font-size: 0.8em; color: var(--col-555555);"><strong>Note:</strong> ${c.note}</div>` : ''}

                    ${IsAdmin ? `
                    <div class="phase-toggles-container">
                        <span class="info-label" style="display:block; margin-bottom:5px;">Fasi Attive</span>
                        <div class="phase-pills-wrapper">
                            ${phasesHtml}
                        </div>
                    </div>` : ''}

                    <div class="progress-container">
                    <div class="progress-labels">
                        <span>AVANZAMENTO</span>
                        <div class="hours-container">
                            <span class="progress-pct-text">${progressPct}%</span>
                        </div>
                    </div>
                    <div class="progress-track">
                            <div class="progress-fill" style="width:${progressPct}%;"></div>
                        </div>
                    </div>

                    <div class="card-footer-actions">
                        
                        <!-- RIGA 1: MAPPA + ORE -->
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                             <button class="std-btn btn-geomap ${c.posizione_esatta ? 'std-btn--blue' : 'std-btn--orange'}" style="flex:1; padding:8px; font-size:0.85em;" title="${c.posizione_esatta ? 'Posizione Esatta' : 'Posizione Approssimativa'}">
                                 ${c.posizione_esatta ? '🗺️ Mappa' : '⚠️ Mappa'}
                             </button>
                             <a href="inserimento-ore.html?commessaId=${c.id_commessa}" class="std-btn std-btn--primary" style="flex:1; padding:8px; font-size:0.85em; text-decoration:none; text-align:center;">
                                ⏱️ Ore
                             </a>
                        </div>
                        
                        <!-- RIGA 2: OP BADGE - piena larghezza -->
                        ${canViewBadge ? `
                        <div style="margin-bottom:8px; width:100%;" id="op-row-${c.id_commessa}">
                            <span class="op-badge-placeholder" data-op-commessa="${c.id_commessa}" style="display:block; width:100%;">
                                <a href="registro-ordini.html?commessa_id=${c.id_commessa}" class="std-btn" style="display:flex; width:100%; box-sizing:border-box; justify-content:center; align-items:center; gap:6px; background:var(--col-ecf0f1); color:var(--col-95a5a6); font-size:0.8em; padding:6px 8px; border-radius:4px; border:1px solid var(--col-bdc3c7); text-decoration:none;" onclick="event.stopPropagation()">
                                    ⚙️ <span style="display:inline-block;width:8px;height:8px;border:2px solid var(--col-bdc3c7);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;"></span> OP
                                </a>
                            </span>
                        </div>` : ''}

                        <!-- RIGA 3: 4 bottoni uguali (solo admin) -->
                        ${IsAdmin ? `
                        <div style="display:flex; gap:6px; width:100%;">
                            <a href="${linkReg}" class="btn-registrazioni" style="flex:1; text-align:center; padding:6px 4px; font-size:0.8em;" onclick="event.stopPropagation()">
                                <img src="img/table.png" style="width:14px; opacity:0.8; vertical-align:middle;"> Reg.
                            </a>
                            <a href="attivita.html?commessa_id=${c.id_commessa}" class="btn-registrazioni" style="flex:1; text-align:center; background:#eef2ff; padding:6px 4px; font-size:0.8em;" onclick="event.stopPropagation()" title="Gestione Attività di questa commessa">
                                📋 Attività
                            </a>
                            <button class="std-btn std-btn--warning edit-btn" data-id="${c.id_commessa}" style="flex:1; padding:6px 4px; font-size:0.8em;" onclick="event.stopPropagation()">✏️</button>
                            <button class="std-btn std-btn--danger del-btn" data-id="${c.id_commessa}" style="flex:1; padding:6px 4px; font-size:0.8em;" onclick="event.stopPropagation()">🗑️</button>
                        </div>` : ''}

                    </div>
                </div>
            `;

            // --- BINDING EVENTI (Con stopPropagation per evitare click su card non voluti) ---

            // 0. Pulsante Mappa — legato qui dal 10/09/2026 (task 4.9, punto 2).
            //
            // Era un `onclick` scritto dentro la stringa template, e per
            // funzionare da li' obbligava `openGeoMap` a stare su `window`:
            // un attributo HTML non vede gli import di un modulo. Togliendo
            // l'attributo cade anche il globale.
            //
            // Gli argomenti restano codificati con `encodeURIComponent` perche'
            // `openGeoMap` li decodifica al proprio interno. Ora che non
            // attraversano piu' un attributo la codifica e' un residuo, ma
            // toglierla vuol dire cambiare anche `openGeoMap`: due modifiche
            // insieme sono due modi di sbagliare.
            const btnGeoMap = card.querySelector('.btn-geomap');
            if (btnGeoMap) {
                btnGeoMap.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openGeoMap(
                        c.id_commessa,
                        c.latitudine ?? null,
                        c.longitudine ?? null,
                        encodeURIComponent(c.impianto || 'Impianto'),
                        encodeURIComponent(c.clienti?.ragione_sociale || '')
                    );
                });
            }

            // 1. Status Change (Solo Admin)
            const statusSelect = card.querySelector('.status-select-badge');
            if (statusSelect) {
                // Click gestito inline per stopPropagation
                statusSelect.addEventListener('change', (e) => {
                    e.stopPropagation(); // Per sicurezza
                    this.updateStatusCommesse(c.id_commessa, e.target.value);
                });
                // Styling custom (colorazione in base al valore)
                this.styleStatusSelect(statusSelect);
            }

            // 2. Phase Toggle — solo admin (task 0.5: l'endpoint ora risponde 403
            // agli altri ruoli, e un click che non produce effetti è peggio di un
            // controllo assente)
            card.querySelectorAll('.phase-pill').forEach(pill => {
                if (!IsAdmin) {
                    pill.classList.add('phase-pill--readonly');
                    return;
                }
                pill.addEventListener('click', (e) => {
                    e.stopPropagation(); // BLOCCA PROPAGAZIONE
                    e.preventDefault();

                    const commId = pill.dataset.commessa;
                    const faseId = parseInt(pill.dataset.fase);
                    // Usa contains per determinare lo stato attuale nel DOM
                    const isCurrentlyActive = pill.classList.contains('active');

                    // OMISITIC UI UPDATE
                    if (isCurrentlyActive) {
                        pill.classList.remove('active');
                    } else {
                        pill.classList.add('active');
                    }

                    // Ricalcola Progress Bar locale
                    this.updateLocalProgressBar(card, c.status_commessa?.nome_status === 'Completato');



                    // Il pill è già stato aggiornato in modo ottimistico: se la
                    // chiamata falla va rimesso com'era, altrimenti l'interfaccia
                    // mostra uno stato che il database non ha.
                    this.togglePhase(commId, faseId, !isCurrentlyActive, pill, card, c);
                });
            });

            // 3. Image Lightbox Trigger
            const cardImg = card.querySelector('.card-image');
            if (cardImg && c.immagine) {
                cardImg.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openImageModal(c.immagine);
                });
            }

            // 4. Admin Buttons
            if (IsAdmin) {
                const edit = card.querySelector('.edit-btn');
                const del = card.querySelector('.del-btn');

                if (edit) edit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleEdit(c.id_commessa);
                });
                if (del) del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleDelete(c.id_commessa);
                });
            }

            fragment.appendChild(card);
        });

        this.dom.grid.appendChild(fragment);

        // Carica OP stats in modo asincrono (post-render, non bloccante)
        this.loadOpStatsBatch();
    },

    // --- OP STATS ASYNC LOADING ---
    // Set degli ID già caricati: evita chiamate duplicate sullo scroll infinito
    _opStatsLoaded: new Set(),

    loadOpStatsBatch: async function () {
        const placeholders = this.dom.grid.querySelectorAll('.op-badge-placeholder[data-op-commessa]');
        if (!placeholders.length) return;

        // Filtra solo i placeholder non ancora risolti
        const ids = Array.from(placeholders)
            .map(el => parseInt(el.dataset.opCommessa))
            .filter(id => !isNaN(id) && !this._opStatsLoaded.has(id));
        if (!ids.length) return;

        ids.forEach(id => this._opStatsLoaded.add(id));

        try {
            const res = await apiFetch('/api/commesse/op-stats', {
                method: 'POST',
                body: JSON.stringify({ ids })
            });
            if (!res.ok) return;

            const statsMap = await res.json();

            placeholders.forEach(el => {
                const cId = parseInt(el.dataset.opCommessa);
                if (!ids.includes(cId)) return; // Salta quelli non in questo batch
                const stats = statsMap[cId] || { open: 0, closed: 0 };
                const { open, closed } = stats;
                const total = open + closed;

                let badgeHtml;
                const FULL_W = 'display:flex; width:100%; box-sizing:border-box; justify-content:center; align-items:center; gap:6px; font-size:0.82em; padding:6px 8px; border-radius:4px; text-decoration:none;';
                if (open > 0) {
                    badgeHtml = `<a href="registro-ordini.html?commessa_id=${cId}" class="std-btn" style="${FULL_W} background:var(--col-e67e22); color:white;" onclick="event.stopPropagation()">⚙️ <b>${open}</b> / ${total} OP</a>`;
                } else if (closed > 0) {
                    badgeHtml = `<a href="registro-ordini.html?commessa_id=${cId}" class="std-btn" style="${FULL_W} background:#e8f8f5; color:var(--col-27ae60); border:1px solid var(--col-27ae60);" onclick="event.stopPropagation()">✅ ${closed} OP chiusi</a>`;
                } else {
                    badgeHtml = `<a href="registro-ordini.html?commessa_id=${cId}" class="std-btn" style="${FULL_W} background:var(--col-ecf0f1); color:var(--col-95a5a6); border:1px solid var(--col-bdc3c7);" onclick="event.stopPropagation()">⚙️ 0 OP</a>`;
                }
                el.innerHTML = badgeHtml;
            });
        } catch (e) {
            console.warn('OP Stats load fallito (non bloccante):', e.message);
        }
    },



    updateLocalProgressBar: function (cardElement, isCompleted) {
        if (isCompleted) return; // Se completato, rimane 100%

        const activePills = cardElement.querySelectorAll('.phase-pill.active');
        let currentMax = 0;
        const weights = {
            'ufficio': 25,
            'carpenteria': 50,
            'assemblaggio': 50,
            'preparazione': 75
        };

        activePills.forEach(pill => {
            const txt = pill.textContent.toLowerCase();
            const nameKey = Object.keys(weights).find(k => txt.includes(k));
            if (nameKey) {
                const w = weights[nameKey];
                if (w > currentMax) currentMax = w;
            }
        });

        const fill = cardElement.querySelector('.progress-fill');
        const pctText = cardElement.querySelector('.progress-pct-text');

        if (fill) fill.style.width = `${currentMax}%`;
        if (pctText) pctText.textContent = `${currentMax}%`;
    },

    styleStatusSelect: function (select) {
        // Logica colori semplice
        const txt = select.options[select.selectedIndex].text;
        select.className = 'status-select-badge'; // reset
        if (txt === 'Completato') select.classList.add('status-done');
        else if (txt === 'In Lavorazione') select.classList.add('status-wip');
        else if (txt === 'Annullato') select.classList.add('status-cancel');
        else select.classList.add('status-new');
    },

    updateStatusCommesse: async function (id, newStatusId) {
        try {
            await apiFetch(`/api/commesse/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ id_status_fk: newStatusId })
            });
            // Ricarica soft (o aggiorna UI locali)
            // Per semplicità ricarichiamo per aggiornare filtri e barre
            this.fetchCommesse(false);
        } catch (e) {
            console.error("Errore update status", e);
            showModal({ title: "Errore", message: "Aggiornamento stato fallito" });
        }
    },

    togglePhase: async function (commessaId, faseId, setActive, pill = null, card = null, commessaCard = null) {
        // Trova la commessa nello stato attuale (per avere l'array fasi corrente)
        // Nota: state.data non è salvato globalmente in raw, ma i dati sono renderizzati.
        // Tuttavia, per fare toggle dobbiamo sapere lo stato attuale completo o fidarci del parametro.
        // Faremo una chiamata ottimistica: GET commessa -> Update -> Refresh UI

        // Fix: Per essere reattivi, dovremmo avere la lista commesse in memory. 
        // Ma fetchCommesse renderizza direttamente. 
        // Recuperiamo la commessa facendo una chiamata rapida o leggendo dal DOM?
        // Facciamo flow robusto: GET -> Modify -> PUT.

        try {
            const res = await apiFetch(`/api/commesse/${commessaId}`);
            const commessa = await res.json();

            let currentFasi = commessa.ids_fasi_attive || [];

            if (setActive) {
                if (!currentFasi.includes(faseId)) currentFasi.push(faseId);
            } else {
                currentFasi = currentFasi.filter(id => id !== faseId);
            }

            // Update Backend
            const putRes = await apiFetch(`/api/commesse/${commessaId}/fasi`, {
                method: 'PUT',
                body: JSON.stringify({ ids_fasi_attive: currentFasi })
            });
            if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);

        } catch (e) {
            console.error("Errore toggle fase", e);
            segnala(e);

            // Annulla l'aggiornamento ottimistico: senza questo l'interfaccia
            // resterebbe a mostrare una fase attiva che il database non ha, e
            // l'utente lo scoprirebbe solo ricaricando la pagina.
            if (pill) {
                pill.classList.toggle('active', !setActive);
                if (card) {
                    this.updateLocalProgressBar(
                        card,
                        commessaCard?.status_commessa?.nome_status === 'Completato'
                    );
                }
            }
            showModal({
                title: "Modifica non applicata",
                message: "Non è stato possibile aggiornare le fasi di produzione."
            });
        }
    },

    // --- LIGHTBOX METHODS ---
    initImageModal: function () {
        this.dom.imageModal = document.getElementById('imageViewerModal');
        this.dom.fullImage = document.getElementById('fullImage');
        const closeBtn = document.querySelector('.close-viewer');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeImageModal());
        }
        if (this.dom.imageModal) {
            this.dom.imageModal.addEventListener('click', (e) => {
                if (e.target === this.dom.imageModal) this.closeImageModal();
            });
        }
    },

    openImageModal: function (src) {
        if (!this.dom.imageModal || !this.dom.fullImage) {
            // Lazy binding if not called
            this.initImageModal();
        }
        if (this.dom.imageModal && this.dom.fullImage) {
            this.dom.fullImage.src = src;
            this.dom.imageModal.style.display = "flex";
        }
    },

    closeImageModal: function () {
        if (this.dom.imageModal) {
            this.dom.imageModal.style.display = "none";
            this.dom.fullImage.src = "";
        }
    },

    // --- CREAZIONE / MODIFICA: avviene in nuova-commessa.html ---

    handleEdit: function (id) {
        // Redirige alla pagina standalone nuova-commessa in modalità modifica
        window.location.href = `nuova-commessa.html?id=${id}&tipo=COMPLETA&mode=edit&from=commesse`;
    },

    handleDelete: async function (id) {
        const confirmDelete = await showModal({
            title: "Elimina Commessa",
            message: "Sei sicuro? L'operazione è irreversibile.",
            confirmText: "ELIMINA",
            cancelText: "Annulla"
        });

        if (!confirmDelete) return;

        try {
            // `apiFetch` NON solleva sui 4xx: restituisce la risposta. Senza
            // questo controllo il ramo `catch` non scattava mai e la griglia si
            // ricaricava come se la cancellazione fosse riuscita — la commessa
            // restava al suo posto e l'utente non vedeva nulla. Il backend
            // risponde 409 con il motivo (es. "sono collegate 12 ore
            // registrate"), che è proprio l'informazione che serve.
            const res = await apiFetch(`/api/commesse/${id}`, { method: 'DELETE' });

            if (!res.ok) {
                const corpo = await res.json().catch(() => ({}));
                showModal({
                    title: "Impossibile eliminare",
                    message: corpo.error || `La cancellazione è stata rifiutata (HTTP ${res.status}).`
                });
                return;
            }

            this.fetchCommesse(true);
        } catch (e) {
            showModal({ title: "Errore", message: "Impossibile eliminare: " + e.message });
        }
    },




    // Gestione Immagine (Solo Nome File)




    // --- UTILITIES ---
    getOptimizedImageUrl: function (url, width = 500) {
        if (!url) return '';
        // Controlla se è un URL Supabase Storage
        if (url.includes('supabase.co') && url.includes('/storage/v1/object/')) {
            // Append transformation params
            // Supabase Storage Transformation: ?width=X&resize=cover&quality=Y
            // Nota: se l'URL ha già query params, usa &, altrimenti ?
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}width=${width}&resize=cover&quality=80`;
        }
        return url; // Fallback URL originale
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });
