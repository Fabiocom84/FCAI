// js/commesse.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

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

        // 2. Controllo Permessi Admin (Nascondi tasto aggiungi)
        if (!IsAdmin) {
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'none';
        }

        // 3. Event Listeners
        this.addEventListeners();

        // 4. Caricamento Dati Iniziali (Metadata + Card)
        try {
            await this.loadMetadata();
            // Fasi per la barra di progresso
            const phasesRes = await apiFetch('/api/commesse/fasi');
            this.state.allPhases = await phasesRes.json();
        } catch (e) {
            console.warn("Errore caricamento metadati", e);
        }

        // Fetch iniziale delle commesse
        this.fetchCommesse(true);
    },

    loadMetadata: async function () {
        // Chiama endpoint unificato per ottenere Clienti, Modelli, Macro
        try {
            const res = await apiFetch('/api/commesse/init-data');
            const data = await res.json();

            this.state.allStatuses = data.status || [];
            this.state.allMacros = data.macros || [];

            // Inizializza Choices.js SOLO se l'utente è Admin (altrimenti non può aprire il modale)
            if (IsAdmin) {
                this.initModalChoices(data.clienti, data.modelli, data.macros);
            }
        } catch (e) {
            console.error("Errore metadata:", e);
        }
    },

    initModalChoices: function (clienti, modelli, macros) {
        // Configurazione comune
        const baseConfig = { searchEnabled: true, itemSelectText: '', shouldSort: true };

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
                limit: 20, // Carica 20 alla volta
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
            if (data.data.length < 20) {
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

            // Header Image (Codice rimosso come richiesto)
            const imgStyle = c.immagine ? `background-image: url('${c.immagine}')` : '';
            const imgContent = !c.immagine ? '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:500;">NO FOTO</div>' : '';

            // --- 1. TOGGLE STATO RAPIDO (Select style badge) ---
            // Genera le opzioni per la select stato basandosi su allStatuses
            // Se allStatuses è vuoto, usa un fallback
            const statuses = this.state.allStatuses.length > 0 ? this.state.allStatuses : [
                { id_status: 1, nome_status: 'Ufficio' },
                { id_status: 2, nome_status: 'Carpenteria' },
                { id_status: 3, nome_status: 'Assemblaggio' },
                { id_status: 4, nome_status: 'Preparazione' }
            ];

            const statusOptions = statuses.map(s =>
                `<option value="${s.id_status}" ${c.id_status_fk == s.id_status ? 'selected' : ''}>${s.nome_status}</option>`
            ).join('');

            // --- 2. FASI AVANZAMENTO (Toggle Pills) ---
            // Le fasi richieste: Ufficio(1?), Carpenteria(2?), Assemblaggio(7?), Preparazione(4?)
            // Cerchiamo di matchare i nomi se possibile, o usiamo gli ID se li conosciamo
            // Mappatura ideale basata su nomi comuni, fallback su ID standard se non trovati.
            // Filtriamo solo quelle di interesse per la card se la lista è lunga, o tutte.
            // Lavoriamo con this.state.allPhases.

            // Definiamo le fasi "Card" che vogliamo mostrare
            const targetPhases = ['Ufficio', 'Carpenteria', 'Assemblaggio', 'Preparazione'];
            let displayPhases = [];

            if (this.state.allPhases.length > 0) {
                // Trova quelle che matchano per nome (case insensitive parziale)
                displayPhases = this.state.allPhases.filter(p => targetPhases.some(tp => p.nome_fase.toLowerCase().includes(tp.toLowerCase())));
                // Se non trova nulla (es. nomi diversi), mostra le prime 4
                if (displayPhases.length === 0) displayPhases = this.state.allPhases.slice(0, 4);
            } else {
                // Fallback hardcoded se API fasi fallisce
                displayPhases = [
                    { id_fase: 1, nome_fase: 'Ufficio' },
                    { id_fase: 2, nome_fase: 'Carpenteria' },
                    { id_fase: 7, nome_fase: 'Assemblaggio' },
                    { id_fase: 4, nome_fase: 'Preparazione' }
                ];
            }

            // Ordiniamo le fasi visualizzate come richiesto dall'utente
            const sortOrder = ['Ufficio', 'Carpenteria', 'Assemblaggio', 'Preparazione'];
            displayPhases.sort((a, b) => {
                const ia = sortOrder.findIndex(s => a.nome_fase.toLowerCase().includes(s.toLowerCase()));
                const ib = sortOrder.findIndex(s => a.nome_fase.toLowerCase().includes(s.toLowerCase()));
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });

            // Genera HTML Pills
            const activePhases = c.ids_fasi_attive || [];
            const phasesHtml = displayPhases.map(phase => {
                const isActive = activePhases.includes(phase.id_fase);
                return `
                    <div class="phase-pill ${isActive ? 'active' : ''}" 
                         data-commessa="${c.id_commessa}" 
                         data-fase="${phase.id_fase}"
                         onclick="event.stopPropagation();">
                         ${phase.nome_fase}
                    </div>
                `;
            }).join('');

            // --- 3. BARRA AVANZAMENTO (Dinamica) ---
            const totalPhases = displayPhases.length || 1;
            // Conta quante delle fasi VISUALIZZATE sono attive
            const activeCount = displayPhases.filter(p => activePhases.includes(p.id_fase)).length;

            let progressPct = 0;
            if (c.status_commessa?.nome_status === 'Completato') {
                progressPct = 100;
            } else {
                progressPct = Math.round((activeCount / totalPhases) * 100);
            }

            // --- 4. LINK REGISTRAZIONI (Nuova Logica) ---
            // Conta registrazioni (assume che c.registrazioni sia popolato dalla view)
            const regCount = c.registrazioni ? c.registrazioni.length : 0;
            // Link per Vista Agile filtrata
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
                    <!-- Codice rimosso -->
                </div>
                <div class="card-details">
                    <div class="card-header">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                            <h3>${c.clienti?.ragione_sociale || 'Cliente ???'}</h3>
                            <!-- STATUS TOGGLE -->
                            <select class="status-select-badge" data-commessa="${c.id_commessa}" onclick="event.stopPropagation()">
                                ${statusOptions}
                            </select>
                        </div>
                        <span>${c.impianto || 'Impianto Generico'}</span>
                    </div>
                    
                    <div class="card-info-grid">
                        <div class="info-item"><span class="info-label">Modello</span><span class="info-value">${c.modelli?.nome_modello || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Ordine (VO)</span><span class="info-value">${c.vo || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Matricola</span><span class="info-value">${c.matricola || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Luogo</span><span class="info-value">${c.paese || '-'} (${c.provincia || ''})</span></div>
                    </div>

                    <!-- FASI TOGGLES -->
                    <div class="phase-toggles-container">
                        <span class="info-label" style="display:block; margin-bottom:5px;">Fasi Attive</span>
                        <div class="phase-pills-wrapper">
                            ${phasesHtml}
                        </div>
                    </div>

                    <div class="progress-container">
                        <div class="progress-labels">
                            <span>AVANZAMENTO (${activeCount}/${totalPhases})</span>
                            <span>${progressPct}%</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${progressPct}%;"></div>
                        </div>
                    </div>

                    <div class="card-footer-actions">
                        <a href="${linkReg}" class="btn-registrazioni">
                            <img src="img/table.png" style="width:16px; opacity:0.8;">
                            Vedi ${regCount > 0 ? regCount : ''} Registrazioni
                        </a>
                        ${adminActions}
                    </div>
                </div>
            `;

            // Bind eventi 

            // 1. Status Change
            const statusSelect = card.querySelector('.status-select-badge');
            if (statusSelect) {
                statusSelect.addEventListener('change', (e) => {
                    this.updateStatusCommesse(c.id_commessa, e.target.value);
                });
                // Colora in base allo stato
                this.styleStatusSelect(statusSelect);
                statusSelect.addEventListener('change', (e) => this.styleStatusSelect(e.target));
            }

            // 2. Phase Toggle
            card.querySelectorAll('.phase-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    const commId = pill.dataset.commessa;
                    const faseId = parseInt(pill.dataset.fase);
                    const isCurrentlyActive = pill.classList.contains('active');
                    this.togglePhase(commId, faseId, !isCurrentlyActive);
                });
            });

            // 3. Admin Buttons
            if (IsAdmin) {
                card.querySelector('.edit-btn')?.addEventListener('click', () => this.handleEdit(c.id_commessa));
                card.querySelector('.del-btn')?.addEventListener('click', () => this.handleDelete(c.id_commessa));
            }

            fragment.appendChild(card);
        });

        this.dom.grid.appendChild(fragment);
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
            this.fetchCommesse(false);

        } catch (e) {
            console.error("Errore toggle fase", e);
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
            const data = await res.json();

            // Popola campi testuali
            document.getElementById('commessaId').value = data.id_commessa;
            document.getElementById('impianto').value = data.impianto || '';
            document.getElementById('vo').value = data.vo || '';
            document.getElementById('matricola').value = data.matricola || '';
            document.getElementById('rif_tecnico').value = data.riferimento_tecnico || '';
            document.getElementById('luogo').value = data.paese || '';
            document.getElementById('provincia').value = data.provincia || '';
            document.getElementById('anno').value = data.anno || '';
            document.getElementById('note').value = data.note || '';

            // Popola Select (Choices.js)
            if (this.state.choicesInstances.cliente && data.id_cliente_fk) {
                this.state.choicesInstances.cliente.setChoiceByValue(data.id_cliente_fk);
            }
            if (this.state.choicesInstances.modello && data.id_modello_fk) {
                this.state.choicesInstances.modello.setChoiceByValue(data.id_modello_fk);
            }
            // Popola Macro (Multipla)
            if (this.state.choicesInstances.macro && data.ids_macro_categorie_attive) {
                this.state.choicesInstances.macro.setChoiceByValue(data.ids_macro_categorie_attive);
            }

            // Popola Immagine
            if (data.immagine) {
                this.dom.imagePreview.src = data.immagine;
                this.dom.previewContainer.style.display = 'block';
                this.dom.uploadText.textContent = "Immagine caricata";
            }

        } catch (e) {
            console.error("Errore fetch dettagli", e);
            showModal({ title: "Errore", message: "Impossibile caricare i dati della commessa." });
            this.closeModal();
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
            // Appendiamo come stringa JSON che il backend parserà
            formData.set('ids_macro_categorie_attive', JSON.stringify(selectedMacros));
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

    // Gestione Immagine (Preview Locale)
    handleImageSelect: function (e) {
        const file = e.target.files[0];
        if (file) {
            this.dom.uploadText.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.dom.imagePreview.src = ev.target.result;
                this.dom.previewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    },

    resetImage: function () {
        this.dom.imageInput.value = '';
        this.dom.uploadText.textContent = 'Scegli file...';
        this.dom.previewContainer.style.display = 'none';
        this.dom.imagePreview.src = '';
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });