// js/commesse.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';
import { supabase } from './supabase-client.js';

const App = {
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        hasMore: true,
        activeStatus: 'In Lavorazione',
        searchTerm: '',
        sortBy: 'data_commessa',
        sortOrder: 'desc',
        allStatuses: [],
        allPhases: [],
        allMacros: [], // Cache delle macro categorie

        // Istanze Choices.js per poterle resettare/popolare programmaticamente
        choicesInstances: {
            cliente: null,
            modello: null,
            macro: null
        }
    },

    dom: {},

    init: async function () {
        console.log("🚀 Init Commesse Module");

        // 1. Mappatura DOM
        this.dom = {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),         // Loader Iniziale
            scrollLoader: document.getElementById('infinite-scroll-loader'), // Loader Scroll
            wrapper: document.querySelector('.std-app-content'), // Container scrollabile

            // Controlli
            statusFilters: document.querySelectorAll('.filter-btn'),
            searchInput: document.getElementById('search-input'),
            deepSearchCheckbox: document.getElementById('search-deep'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn'),

            // Modale
            modal: document.getElementById('commessaModal'),
            closeModalBtn: document.getElementById('closeModal'),
            modalForm: document.getElementById('commessaForm'),
            modalTitle: document.getElementById('modalTitle'),
            overlay: document.getElementById('modalOverlay'),

            // Upload
            imageInput: document.getElementById('imageInput'),
            uploadWidget: document.getElementById('uploadWidget'),
            uploadText: document.getElementById('uploadText'),
            previewContainer: document.getElementById('imagePreviewContainer'),
            imagePreview: document.getElementById('imagePreview'),
            removeImageBtn: document.getElementById('removeImageBtn')
        };

        // 2. Controllo Permessi Admin (Mostra tasto aggiungi solo se Admin)
        if (IsAdmin) {
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'flex'; // Mostra il bottone (nascosto di default)
        } else {
            // Se NON è admin, nascondi opzioni avanzate (già nascoste o da nascondere)
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
        // --- SWR PATTERN (Stale-While-Revalidate) ---
        // 1. Check & Render Cached Data (Instant)
        const cachedInit = localStorage.getItem('commesse_init_v1');
        const cachedList = localStorage.getItem('commesse_list_cache');
        const cacheTimestamp = localStorage.getItem('commesse_cache_ts');
        const now = Date.now();
        const MAX_AGE = 3600 * 1000; // 1 ora per init data

        let renderedFromCache = false;

        if (cachedInit && cachedList) {
            try {
                const initData = JSON.parse(cachedInit);
                const listData = JSON.parse(cachedList);

                // Check Validità Init Data (Non scaduto)
                if (cacheTimestamp && (now - parseInt(cacheTimestamp) < MAX_AGE)) {
                    console.log("⚡ CACHE HIT: Rendering from Storage");

                    // Popola State
                    this.state.allStatuses = initData.status || [];
                    this.state.allMacros = initData.macros || [];
                    this.state.allPhases = initData.fasi || [];

                    if (IsAdmin) this.initModalChoices(initData.clienti || [], initData.modelli || [], initData.macros || []);

                    if (listData && listData.length > 0) {
                        this.state.totalCount = listData.length; // Approssimato
                        this.renderCards(listData);
                        renderedFromCache = true;

                        // Show "Syncing" indicator
                        this.showSyncIndicator(true);
                    }
                }
            } catch (e) {
                console.warn("Cache Corrupted", e);
                localStorage.removeItem('commesse_init_v1');
            }
        }

        // 2. Network Fetch (Always execute to revalidate/update)
        try {
            console.log("📡 REMOTE FETCH: Updating data...");
            // Se non abbiamo renderizzato da cache, mostriamo loader classico
            if (!renderedFromCache && this.dom.loader) this.dom.loader.style.display = 'flex';

            const res = await apiFetch('/api/commesse/init-data');
            const data = await res.json();

            // Aggiorna Storage
            localStorage.setItem('commesse_init_v1', JSON.stringify({
                status: data.status,
                macros: data.macros,
                fasi: data.fasi,
                clienti: data.clienti,
                modelli: data.modelli
            }));
            localStorage.setItem('commesse_cache_ts', now.toString());

            // Aggiorna State
            this.state.allStatuses = data.status || [];
            this.state.allMacros = data.macros || [];
            this.state.allPhases = data.fasi || [];

            // Re-init Choices se Admin (Aggiorna opzioni con dati freschi)
            if (IsAdmin) {
                // Forziamo l'aggiornamento delle scelte anche se esistono già (per bug fix lista incompleta cache vs live)
                this.initModalChoices(data.clienti || [], data.modelli || [], data.macros || []);
            }

            // 3. Verifica dati lista (Fresh)
            if (data.commesse_data) {
                this.state.totalCount = data.commesse_count || 0;
                localStorage.setItem('commesse_list_cache', JSON.stringify(data.commesse_data)); // Cache Fresh List

                if (data.commesse_data.length === 0) {
                    this.state.hasMore = false;
                    this.dom.grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">Nessuna commessa trovata.</div>';
                } else {
                    // Re-Render Solo se dati diversi? Per semplicità ri-renderizziamo sempre per ora.
                    // UX: Se l'utente sta scrollando potrebbe disturbare.
                    // Ma siamo al load iniziale, quindi ok.
                    this.dom.grid.innerHTML = ''; // Reset UI cache
                    this.renderCards(data.commesse_data);

                    if (data.commesse_data.length < 12) {
                        this.state.hasMore = false;
                    } else {
                        this.state.currentPage = 2;
                    }
                }
            } else {
                // Fallback fetch se init-data non ha commesse
                this.fetchCommesse(true);
            }

        } catch (e) {
            console.error("Errore fetch unified data:", e);
            if (!renderedFromCache) {
                this.fetchCommesse(true);
            }
        } finally {
            if (this.dom.loader) this.dom.loader.style.display = 'none';
            this.showSyncIndicator(false);
        }
    },

    showSyncIndicator: function (show) {
        let el = document.getElementById('sync-indicator');
        if (!el && show) {
            el = document.createElement('div');
            el.id = 'sync-indicator';
            el.style.cssText = "position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:20px; font-size:12px; z-index:9999; display:flex; align-items:center; gap:5px;";
            el.innerHTML = '<div class="spinner-small" style="width:12px;height:12px;border-width:2px;"></div> Sync...';
            document.body.appendChild(el);
        }
        if (el) el.style.display = show ? 'flex' : 'none';
    },

    initModalChoices: function (clienti, modelli, macros) {
        // Destroy previous instances if any to avoid duplicates
        if (this.state.choicesInstances.cliente) { try { this.state.choicesInstances.cliente.destroy(); } catch (e) { } }
        if (this.state.choicesInstances.modello) { try { this.state.choicesInstances.modello.destroy(); } catch (e) { } }
        if (this.state.choicesInstances.macro) { try { this.state.choicesInstances.macro.destroy(); } catch (e) { } }

        // Configurazione comune
        const baseConfig = { searchEnabled: true, itemSelectText: '', shouldSort: true, searchResultLimit: 100 };

        // 1. Clienti
        const clientSelect = document.getElementById('cliente');
        if (clientSelect) {
            this.state.choicesInstances.cliente = new Choices(clientSelect, {
                ...baseConfig,
                placeholder: true,
                placeholderValue: 'Seleziona Cliente'
            });
            this.state.choicesInstances.cliente.setChoices(
                clienti.map(c => ({ value: c.id_cliente, label: c.ragione_sociale })),
                'value', 'label', true
            );
        }

        // 2. Modelli
        const modelSelect = document.getElementById('modello');
        if (modelSelect) {
            this.state.choicesInstances.modello = new Choices(modelSelect, {
                ...baseConfig,
                placeholder: true,
                placeholderValue: 'Seleziona Modello'
            });
            this.state.choicesInstances.modello.setChoices(
                modelli.map(m => ({ value: m.id_modello, label: m.nome_modello })),
                'value', 'label', true
            );
        }

        // 3. Macro Categorie (Multipla)
        const macroSelect = document.getElementById('macro-select');
        if (macroSelect) {
            this.state.choicesInstances.macro = new Choices(macroSelect, {
                ...baseConfig,
                removeItemButton: true,
                placeholder: true,
                placeholderValue: 'Associa Macro Categorie...'
            });
            this.state.choicesInstances.macro.setChoices(
                macros.map(m => ({ value: m.id_macro_categoria, label: m.nome || m.nome_macro })),
                'value', 'label', true
            );
        }
    },

    addEventListeners: function () {
        // Scroll Infinito
        if (this.dom.wrapper) {
            this.dom.wrapper.addEventListener('scroll', () => this.handleScroll());
        }

        // Filtri Stato
        this.dom.statusFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                this.dom.statusFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.activeStatus = btn.dataset.filter;
                this.fetchCommesse(true); // Reset e ricarica
            });
        });

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

        // Modale Events
        if (this.dom.addBtn) this.dom.addBtn.addEventListener('click', () => this.openModal(false));
        if (this.dom.closeModalBtn) this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.overlay) this.dom.overlay.addEventListener('click', () => this.closeModal());
        if (this.dom.modalForm) this.dom.modalForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Upload Widget
        if (this.dom.uploadWidget) this.dom.uploadWidget.addEventListener('click', () => this.dom.imageInput.click());
        if (this.dom.imageInput) this.dom.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        if (this.dom.removeImageBtn) this.dom.removeImageBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita riapertura widget
            this.resetImage();
        });

        // Drag & Drop
        this.setupDragDrop();

        // [NEW] Setup Geocoding Interactions
        setupGeocodingControls();
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
                limit: 12, // User requested 12
                status: this.state.activeStatus,
                search: this.state.searchTerm,
                deep_search: this.dom.deepSearchCheckbox?.checked || false,
                sortBy: this.state.sortBy,
                sortOrder: this.state.sortOrder
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
                    this.dom.grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">Nessuna commessa trovata.</div>';
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
        const fragment = document.createDocumentFragment();

        commesse.forEach(c => {
            const card = document.createElement('div');
            card.className = 'commesse-card';

            // Header Image
            const imgStyle = c.immagine ? `background-image: url('${c.immagine}'); cursor: pointer;` : '';
            const imgContent = !c.immagine ? '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:500;">NO FOTO</div>' :
                `<div style="width:100%;height:100%;" data-full-img="${c.immagine}"></div>`;

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
                <div class="card-image" style="${imgStyle}">
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
                    `<span class="status-badge" style="background:${c.status_commessa?.colore || '#ccc'}; color:white; padding:4px 8px; border-radius:12px; font-size:0.8em;">
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
                    </div>

                    ${(() => {
                    let macrosToDisplay = [];
                    if (c.macro_categorie && c.macro_categorie.length) {
                        macrosToDisplay = c.macro_categorie.map(m => m.nome || m.nome_macro || m);
                    } else if (c.ids_macro_categorie_attive && this.state.allMacros && this.state.allMacros.length) {
                        macrosToDisplay = (Array.isArray(c.ids_macro_categorie_attive) ? c.ids_macro_categorie_attive : [c.ids_macro_categorie_attive]).map(id => {
                            const match = this.state.allMacros.find(m => m.id_macro_categoria == id);
                            return match ? (match.nome || match.nome_macro) : id;
                        });
                    }

                    if (macrosToDisplay.length === 0) return '';

                    return `
                        <div class="card-macro-list" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px; margin-bottom: 8px;">
                            ${macrosToDisplay.map(name => `<span style="background:#eef2f3; color:#555; padding:2px 6px; border-radius:10px; font-size:0.75em; border:1px solid #ddd;">${name}</span>`).join('')}
                        </div>`;
                })()}

                    <!-- NOTE COMMESSA (Se presenti) -->
                    ${c.note ? `<div class="commessa-note" style="margin: 10px 0; padding: 8px; background: #fffde7; border-left: 3px solid #f1c40f; font-size: 0.8em; color: #555;"><strong>Note:</strong> ${c.note}</div>` : ''}

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
                        ${IsAdmin ? `
                        <a href="${linkReg}" class="btn-registrazioni">
                            <img src="img/table.png" style="width:16px; opacity:0.8;">
                            Vedi Registrazioni
                        </a>` : ''}
                        ${adminActions}
                    </div>
                </div>
            `;

            // --- BINDING EVENTI (Con stopPropagation per evitare click su card non voluti) ---

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

            // 2. Phase Toggle
            card.querySelectorAll('.phase-pill').forEach(pill => {
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

                    console.log(`Toggle Fase: Commessa ${commId}, Fase ${faseId}, SetActive: ${!isCurrentlyActive}`);

                    this.togglePhase(commId, faseId, !isCurrentlyActive);
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

    togglePhase: async function (commessaId, faseId, setActive) {
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
            await apiFetch(`/api/commesse/${commessaId}/fasi`, {
                method: 'PUT',
                body: JSON.stringify({ ids_fasi_attive: currentFasi })
            });

            // Refresh UI (senza reset scroll)
            // this.fetchCommesse(false);

        } catch (e) {
            console.error("Errore toggle fase", e);
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

    // --- MODALE CREAZIONE / MODIFICA ---

    openModal: function (isEdit, id = null) {
        if (!IsAdmin) return;

        // Reset Form
        this.dom.modalForm.reset();
        this.resetImage();
        document.getElementById('commessaId').value = '';

        // Reset Choices
        if (this.state.choicesInstances.cliente) this.state.choicesInstances.cliente.setChoiceByValue('');
        if (this.state.choicesInstances.modello) this.state.choicesInstances.modello.setChoiceByValue('');
        if (this.state.choicesInstances.macro) this.state.choicesInstances.macro.removeActiveItems();

        if (isEdit && id) {
            this.dom.modalTitle.textContent = "MODIFICA COMMESSA";
            this.loadCommessaDetails(id); // Fetch dati reali e popola
        } else {
            this.dom.modalTitle.textContent = "NUOVA COMMESSA";
            const yearInput = document.getElementById('anno');
            if (yearInput) yearInput.value = new Date().getFullYear();
        }

        this.dom.modal.classList.add('active');
    },

    loadCommessaDetails: async function (id) {
        try {
            const res = await apiFetch(`/api/commesse/${id}`);
            if (!res.ok) throw new Error("Errore nel recupero dati commessa");

            const data = await res.json();

            // Popola campi testuali
            // Usa encadement opzionale per evitare crash su proprietà mancanti
            if (this.dom.modalForm) {
                const setValue = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };

                setValue('commessaId', data.id_commessa);
                setValue('impianto', data.nome_commessa || data.impianto); // Gestione fallback nome
                setValue('vo', data.vo || data.vo_offerta);
                setValue('matricola', data.matricola);
                setValue('rif_tecnico', data.riferimento_tecnico);
                setValue('luogo', data.paese || data.luogo); // Fallback
                setValue('provincia', data.provincia);
                setValue('anno', data.anno);
                setValue('note', data.note || data.descrizione);

                // [NEW] Popola lat/lon se presenti
                setValue('latitudine', data.latitudine);
                setValue('longitudine', data.longitudine);
            }

            // Popola Select (Choices.js)
            // Timeout breve per assicurare che Choices sia pronto se necessario, ma qui è sincrono
            if (this.state.choicesInstances.cliente && data.id_cliente_fk) {
                try {
                    const val = data.id_cliente_fk;
                    this.state.choicesInstances.cliente.setChoiceByValue([val, String(val)]);
                } catch (e) { console.warn("Errore set cliente", e); }
            }

            if (this.state.choicesInstances.modello && data.id_modello_fk) {
                try {
                    const val = data.id_modello_fk;
                    this.state.choicesInstances.modello.setChoiceByValue([val, String(val)]);
                } catch (e) { console.warn("Errore set modello", e); }
            }

            // Popola Macro (Multipla)
            if (this.state.choicesInstances.macro && data.ids_macro_categorie_attive) {
                try {
                    const vals = Array.isArray(data.ids_macro_categorie_attive) ? data.ids_macro_categorie_attive : [data.ids_macro_categorie_attive];
                    const expandedVals = vals.flatMap(v => [v, String(v)]);
                    this.state.choicesInstances.macro.setChoiceByValue(expandedVals);
                } catch (e) { console.warn("Errore set macro", e); }
            }


            // Popola Immagine
            if (data.immagine) {
                // Non mostriamo preview IMG come da richiesta recente, ma mostriamo testo "file esistente" o simile?
                // L'utente ha chiesto di vedere solo il nome. Se è una stringa base64 o URL, 
                // mostriamo "Immagine caricata".
                this.dom.uploadText.textContent = "Immagine presente (modifica per cambiare)";
                this.dom.previewContainer.style.display = 'block';
                // NON impostiamo src preview
            }

        } catch (e) {
            console.error("Errore fetch dettagli", e);
            showModal({ title: "Attenzione", message: "Impossibile caricare i dati completi della commessa: " + e.message });
            // NON chiudiamo il modale, così l'utente può vedere cosa manca o riprovare
            // this.closeModal(); 
        }
    },

    handleEdit: function (id) {
        this.openModal(true, id);
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
            await apiFetch(`/api/commesse/${id}`, { method: 'DELETE' });
            this.fetchCommesse(true);
        } catch (e) {
            showModal({ title: "Errore", message: "Impossibile eliminare: " + e.message });
        }
    },

    handleFormSubmit: async function (e) {
        e.preventDefault();
        const id = document.getElementById('commessaId').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/commesse/${id}` : '/api/commesse';

        // Usa FormData per multipart (dati + file)
        const formData = new FormData(this.dom.modalForm);

        // GESTIONE SPECIALE MACRO:
        // Choices.js non popola automaticamente l'input hidden per le select multiple in modo compatibile con FormData a volte.
        // Estraiamo i valori manualmente e li passiamo come JSON string
        if (this.state.choicesInstances.macro) {
            const selectedMacros = this.state.choicesInstances.macro.getValue(true); // Ritorna array di value
            // Inviamo come stringa separata da virgola per attivare il parsing fallback del backend (che fa cast a int)
            formData.set('ids_macro_categorie_attive', selectedMacros.join(','));
        }

        const saveBtn = this.dom.modalForm.querySelector('.save-button');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = "Salvando...";

        try {
            const token = localStorage.getItem('session_token');
            const baseUrl = 'https://segretario-ai-backend-service-460205196659.europe-west1.run.app'; // Importato da config idealmente

            // Fetch nativa per gestire FormData senza header Content-Type manuale
            const res = await fetch(baseUrl + url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.error || "Errore salvataggio");
            }

            this.closeModal();
            this.fetchCommesse(true); // Ricarica griglia

        } catch (error) {
            console.error(error);
            showModal({ title: "Errore", message: error.message });
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    },

    closeModal: function () {
        this.dom.modal.classList.remove('active');
    },

    // Gestione Immagine (Solo Nome File)
    handleImageSelect: function (e) {
        const file = e.target.files[0];
        this.processFile(file);
    },

    processFile: function (file) {
        if (file) {
            this.dom.uploadText.textContent = file.name;
            // Mostra container rimuovi (senza img preview)
            this.dom.previewContainer.style.display = 'block';
        }
    },

    setupDragDrop: function () {
        const widget = this.dom.uploadWidget;
        if (!widget) return;

        const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            widget.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            widget.addEventListener(eventName, () => widget.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            widget.addEventListener(eventName, () => widget.classList.remove('drag-over'), false);
        });

        widget.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file && file.type.startsWith('image/')) {
                this.dom.imageInput.files = dt.files;
                this.processFile(file);
            }
        });
    },

    resetImage: function () {
        this.dom.imageInput.value = '';
        this.dom.uploadText.textContent = 'Trascina file o Clicca';
        this.dom.previewContainer.style.display = 'none';
    }
};

// ==========================================
// [NEW] GEOLOCALIZZAZIONE LOGIC
// ==========================================
let map = null;
let currentMarker = null;

function setupGeocodingControls() {
    const btnCalc = document.getElementById('btn-calc-geo');
    const btnMap = document.getElementById('btn-open-map');
    const btnConfirmMap = document.getElementById('confirmMapBtn');
    const btnCloseMap = document.getElementById('closeMapBtn');
    const mapModal = document.getElementById('mapModal');
    const mapOverlay = document.getElementById('mapModalOverlay');

    // 1. CALCOLA DA INDIRIZZO
    if (btnCalc) {
        btnCalc.addEventListener('click', async () => {
            const city = document.getElementById('luogo').value;
            const prov = document.getElementById('provincia').value;

            if (!city) {
                showModal({ title: "Attenzione", message: "Inserisci almeno il Luogo (Città) per calcolare le coordinate." });
                return;
            }

            // Show loading state on button
            const originalText = btnCalc.innerHTML;
            btnCalc.innerHTML = "<span>⏳...</span>";
            btnCalc.disabled = true;

            try {
                const token = localStorage.getItem('access_token');
                // Fix: apiFetch handles base URL internally. Use relative path.
                const url = `/api/geocoding/lookup?city=${encodeURIComponent(city)}&province=${encodeURIComponent(prov || '')}`;

                const response = await apiFetch(url, { method: 'GET' });
                // apiFetch already handles auth, but we need strictly GET here. 
                // Note: apiFetch usually returns the response object.

                if (response.ok) {
                    const data = await response.json();
                    const newLatLng = [data.lat, data.lon];

                    // Apri Modale Mappa per Conferma
                    if (mapModal) mapModal.style.display = 'block';
                    if (mapOverlay) mapOverlay.style.display = 'block';

                    // Inizializza/Aggiorna Mappa con i nuovi dati
                    setTimeout(() => {
                        if (!map) {
                            initMap();
                        } else {
                            map.invalidateSize();
                        }
                        // Forza vista e marker sui dati calcolati (senza toccare ancora gli input)
                        map.setView(newLatLng, 15);
                        placeMarker(newLatLng);
                    }, 100);

                } else {
                    showModal({ title: "Non trovato", message: "Impossibile trovare le coordinate per questo luogo." });
                }
            } catch (error) {
                console.error(error);
                showModal({ title: "Errore", message: "Errore durante la geocodifica." });
            } finally {
                btnCalc.innerHTML = originalText;
                btnCalc.disabled = false;
            }
        });
    }

    // 2. MAPPA INTERATTIVA
    if (btnMap) {
        btnMap.addEventListener('click', () => {
            if (mapModal) mapModal.style.display = 'block';
            if (mapOverlay) mapOverlay.style.display = 'block';

            // Inizializza mappa solo se visibile
            setTimeout(() => {
                initMap();
            }, 100);
        });
    }

    function closeMap() {
        if (mapModal) mapModal.style.display = 'none';
        if (mapOverlay) mapOverlay.style.display = 'none';
    }

    if (btnCloseMap) btnCloseMap.addEventListener('click', closeMap);
    if (mapOverlay) mapOverlay.addEventListener('click', closeMap);

    if (btnConfirmMap) {
        btnConfirmMap.addEventListener('click', () => {
            if (currentMarker) {
                const latlng = currentMarker.getLatLng();
                document.getElementById('latitudine').value = latlng.lat.toFixed(6);
                document.getElementById('longitudine').value = latlng.lng.toFixed(6);
                closeMap();
            } else {
                showModal({ title: "Info", message: "Seleziona un punto sulla mappa." });
            }
        });
    }
}

function initMap() {
    if (map) {
        map.invalidateSize(); // Fix render issues if hidden
        // Update view based on current inputs
        updateMapFromInputs();
        return;
    }

    // Check if L (Leaflet) is loaded
    if (typeof L === 'undefined') {
        console.error("Leaflet not loaded");
        return;
    }

    // Default: Italia centrale
    map = L.map('mapContainer').setView([41.8719, 12.5674], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Click handler to move marker
    map.on('click', function (e) {
        placeMarker(e.latlng);
    });

    updateMapFromInputs();
}

function updateMapFromInputs() {
    const latIn = parseFloat(document.getElementById('latitudine').value);
    const lonIn = parseFloat(document.getElementById('longitudine').value);

    // Se abbiamo input validi, centriamo la mappa li
    if (!isNaN(latIn) && !isNaN(lonIn)) {
        const latlng = [latIn, lonIn];
        map.setView(latlng, 13);
        placeMarker(latlng);
    }
}

function placeMarker(latlng) {
    if (currentMarker) {
        currentMarker.setLatLng(latlng);
    } else {
        currentMarker = L.marker(latlng, { draggable: true }).addTo(map);
        currentMarker.on('dragend', function (event) {
            const position = event.target.getLatLng();
            updateCoordsDisplay(position);
        });
    }
    updateCoordsDisplay(latlng);
}

function updateCoordsDisplay(latlng) {
    const display = document.getElementById('map-coords-display');
    if (display) {
        // Gestiamo sia oggetto Leaflet ({lat, lng}) che array ([lat, lon])
        const lat = latlng.lat || latlng[0];
        const lng = latlng.lng || latlng[1];
        display.textContent = `Lat: ${parseFloat(lat).toFixed(6)}, Lon: ${parseFloat(lng).toFixed(6)}`;
    }
}

document.addEventListener('DOMContentLoaded', () => { App.init(); });

// --- GEO MAP FEATURE ---
let geoMap = null;
let geoMarkersLayer = null;
let allGeoCommesse = []; // Cache for filtering locally

function setupGeoMapControls() {
    const btnOpenGeoMap = document.getElementById('btn-open-geomap');
    const geoModal = document.getElementById('geoMapModal');
    const geoOverlay = document.getElementById('geoMapModalOverlay');
    const btnCloseGeo = document.getElementById('closeGeoMapBtn');

    if (btnOpenGeoMap) {
        btnOpenGeoMap.addEventListener('click', () => {
            if (geoModal) geoModal.style.display = 'block';
            if (geoOverlay) geoOverlay.style.display = 'block';

            // Init Map after transition
            setTimeout(() => {
                initGeoMap();
                loadGeoMapData();
            }, 200);
        });
    }

    function closeGeoMap() {
        if (geoModal) geoModal.style.display = 'none';
        if (geoOverlay) geoOverlay.style.display = 'none';
    }

    if (btnCloseGeo) btnCloseGeo.addEventListener('click', closeGeoMap);
    if (geoOverlay) geoOverlay.addEventListener('click', closeGeoMap);

    // Sidebar Search
    const searchInput = document.getElementById('geomap-search-labels');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.geomap-label-item');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

function initGeoMap() {
    if (geoMap) {
        geoMap.invalidateSize();
        return;
    }

    if (typeof L === 'undefined') return;

    // Use a different container ID: geoMapFullContainer
    geoMap = L.map('geoMapFullContainer').setView([41.8719, 12.5674], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(geoMap);

    geoMarkersLayer = L.layerGroup().addTo(geoMap);
}

async function loadGeoMapData() {
    try {
        const res = await apiFetch('/api/commesse/geo-map');
        if (res.ok) {
            allGeoCommesse = await res.json();
            renderGeoMapSidebar(); // Build filters
            renderGeoMapMarkers(allGeoCommesse); // Show all initially
        }
    } catch (e) {
        console.error("GeoMap Fetch Error", e);
    }
}

function renderGeoMapMarkers(list) {
    if (!geoMarkersLayer) return;
    geoMarkersLayer.clearLayers();

    if (list.length === 0) return;

    const bounds = L.latLngBounds();

    list.forEach(c => {
        if (c.latitudine && c.longitudine) {
            const marker = L.marker([c.latitudine, c.longitudine]);

            // Build Popup
            let popupContent = `<div style="font-family: Roboto, sans-serif;">`;
            popupContent += `<b style="color:#2c3e50; font-size:1.1em;">${c.impianto || 'Impianto'}</b><br>`;
            if (c.clienti && c.clienti.ragione_sociale) {
                popupContent += `<span style="color:#7f8c8d; font-size:0.9em;">${c.clienti.ragione_sociale}</span><br>`;
            }
            // Helper Link
            //  popupContent += `<a href="#" style="color:#3498db; text-decoration:none; font-size:0.85em; margin-top:5px; display:inline-block;">Vedi Dettaglio</a>`;
            popupContent += `</div>`;

            marker.bindPopup(popupContent);
            geoMarkersLayer.addLayer(marker);
            bounds.extend([c.latitudine, c.longitudine]);
        }
    });

    if (list.length > 0) {
        geoMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

function renderGeoMapSidebar() {
    const listContainer = document.getElementById('geomap-labels-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    // Extract all unique macros from allGeoCommesse
    const macroMap = {};
    if (App.state.allMacros) {
        App.state.allMacros.forEach(m => {
            macroMap[m.id_macro_categoria] = m.nome || m.nome_macro;
        });
    }

    // Count usage
    const stats = {}; // Name -> Count

    allGeoCommesse.forEach(c => {
        if (c.ids_macro_categorie_attive && Array.isArray(c.ids_macro_categorie_attive)) {
            c.ids_macro_categorie_attive.forEach(mid => {
                const name = macroMap[mid] || `Macro ${mid}`;
                stats[name] = (stats[name] || 0) + 1;
            });
        }
    });

    // Sort by name
    const sortedNames = Object.keys(stats).sort();

    let activeItem = null;

    // Helper to create items
    const createItem = (text, count, onClick) => {
        const div = document.createElement('div');
        div.className = 'geomap-label-item';
        div.style.cssText = 'padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;';
        div.innerHTML = `<span style="font-weight:500; color:#34495e;">${text}</span> <span style="background: #ecf0f1; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; color:#7f8c8d;">${count}</span>`;

        div.onmouseover = () => { if (div !== activeItem) div.style.background = '#f5f6fa'; };
        div.onmouseout = () => { if (div !== activeItem) div.style.background = 'transparent'; };

        div.onclick = () => {
            if (activeItem) {
                activeItem.style.background = 'transparent';
            }
            activeItem = div;
            div.style.background = '#e1f5fe'; // Selected
            onClick();
        };
        return div;
    };

    // "All" option
    const allItem = createItem('Tutte le Etichette', allGeoCommesse.length, () => {
        renderGeoMapMarkers(allGeoCommesse);
    });
    listContainer.appendChild(allItem);

    // Default Active
    activeItem = allItem;
    allItem.style.background = '#e1f5fe';

    sortedNames.forEach(name => {
        listContainer.appendChild(createItem(name, stats[name], () => {
            const filtered = allGeoCommesse.filter(c => {
                if (!c.ids_macro_categorie_attive) return false;
                return c.ids_macro_categorie_attive.some(mid => (macroMap[mid] || `Macro ${mid}`) === name);
            });
            renderGeoMapMarkers(filtered);
        }));
    });
}
