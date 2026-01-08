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

    init: async function() {
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

    loadMetadata: async function() {
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

    initModalChoices: function(clienti, modelli, macros) {
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

    addEventListeners: function() {
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

    fetchCommesse: async function(reset = false) {
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

    handleScroll: function() {
        const { scrollTop, scrollHeight, clientHeight } = this.dom.wrapper;
        // Triggera quando siamo a 100px dal fondo
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.fetchCommesse(false);
        }
    },

    renderCards: function(commesse) {
        const fragment = document.createDocumentFragment();
        
        commesse.forEach(c => {
            const card = document.createElement('div');
            card.className = 'commesse-card';
            
            // Header Image
            const imgStyle = c.immagine ? `background-image: url('${c.immagine}')` : '';
            const imgContent = !c.immagine ? '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:500;">NO FOTO</div>' : '';
            
            // Logica Avanzamento (Barra)
            let maxProgress = 0;
            let progressLabel = "0%";
            if (c.status_commessa?.nome_status === 'Completato') {
                maxProgress = 100; progressLabel = "COMPLETATO";
            } else if (c.ids_fasi_attive) {
                // Esempio logica pesi fasi
                if (c.ids_fasi_attive.includes(1)) maxProgress = 15;
                if (c.ids_fasi_attive.includes(2)) maxProgress = 35;
                if (c.ids_fasi_attive.includes(7)) maxProgress = 65;
                if (c.ids_fasi_attive.includes(4)) maxProgress = 85;
                progressLabel = maxProgress + "%";
            }
            
            // Link Registrazioni
            const linkReg = `gestione.html?commessaId=${c.id_commessa}`;

            // Azioni Admin
            let adminActions = '';
            if (IsAdmin) {
                adminActions = `
                    <div class="admin-actions">
                        <button class="std-btn std-btn--warning edit-btn" data-id="${c.id_commessa}" style="padding: 5px 10px; font-size: 0.8em;">✏️ Modifica</button>
                        <button class="std-btn std-btn--danger del-btn" data-id="${c.id_commessa}" style="padding: 5px 10px; font-size: 0.8em;">🗑️</button>
                    </div>
                `;
            }

            // HTML Card
            card.innerHTML = `
                <div class="card-image" style="${imgStyle}">
                    ${imgContent}
                    <div class="card-id-badge">${c.codice_commessa || 'NEW'}</div>
                </div>
                <div class="card-details">
                    <div class="card-header">
                        <h3>${c.clienti?.ragione_sociale || 'Cliente ???'}</h3>
                        <span>${c.impianto || 'Impianto Generico'}</span>
                    </div>
                    
                    <div class="card-info-grid">
                        <div class="info-item"><span class="info-label">Modello</span><span class="info-value">${c.modelli?.nome_modello || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Ordine (VO)</span><span class="info-value">${c.vo || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Matricola</span><span class="info-value">${c.matricola || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Luogo</span><span class="info-value">${c.paese || '-'} (${c.provincia || ''})</span></div>
                    </div>

                    <div class="progress-container">
                        <div class="progress-labels">
                            <span>AVANZAMENTO</span>
                            <span>${progressLabel}</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${maxProgress}%;"></div>
                        </div>
                    </div>

                    <div class="card-footer-actions">
                        <a href="${linkReg}" class="btn-registrazioni">
                            <img src="img/table.png" style="width:16px; opacity:0.8;">
                            Vedi Registrazioni
                        </a>
                        ${adminActions}
                    </div>
                </div>
            `;
            
            // Bind eventi Admin
            if (IsAdmin) {
                card.querySelector('.edit-btn')?.addEventListener('click', () => this.handleEdit(c.id_commessa));
                card.querySelector('.del-btn')?.addEventListener('click', () => this.handleDelete(c.id_commessa));
            }

            fragment.appendChild(card);
        });
        
        this.dom.grid.appendChild(fragment);
    },

    // --- MODALE CREAZIONE / MODIFICA ---

    openModal: function(isEdit, id = null) {
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
            if(yearInput) yearInput.value = new Date().getFullYear();
        }
        
        this.dom.modal.classList.add('active');
    },

    loadCommessaDetails: async function(id) {
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

    handleEdit: function(id) {
        this.openModal(true, id);
    },

    handleDelete: async function(id) {
        const confirmDelete = await showModal({ 
            title: "Elimina Commessa", 
            message: "Sei sicuro? L'operazione è irreversibile.", 
            confirmText: "ELIMINA", 
            cancelText: "Annulla" 
        });
        
        if(!confirmDelete) return;

        try {
            await apiFetch(`/api/commesse/${id}`, { method: 'DELETE' });
            this.fetchCommesse(true);
        } catch (e) { 
            showModal({ title: "Errore", message: "Impossibile eliminare: " + e.message });
        }
    },

    handleFormSubmit: async function(e) {
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

    closeModal: function() { 
        this.dom.modal.classList.remove('active'); 
    },
    
    // Gestione Immagine (Preview Locale)
    handleImageSelect: function(e) {
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
    
    resetImage: function() {
        this.dom.imageInput.value = '';
        this.dom.uploadText.textContent = 'Scegli file...';
        this.dom.previewContainer.style.display = 'none';
        this.dom.imagePreview.src = '';
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });