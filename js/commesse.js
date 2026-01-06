import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const App = {
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        activeStatus: 'In Lavorazione', 
        searchTerm: '',
        sortBy: 'data_commessa',
        sortOrder: 'desc',
        allStatuses: [],
        allPhases: []
    },
    
    dom: {},

    init: async function() {
        // Mappatura DOM
        this.dom = {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),
            statusFilters: document.querySelectorAll('.filter-btn'),
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn'),
            deepSearchWrapper: document.getElementById('deep-search-wrapper'),
            deepSearchCheckbox: document.getElementById('search-deep'),

            // Elementi Modale
            modal: document.getElementById('commessaModal'),
            closeModalBtn: document.getElementById('closeModal'),
            modalForm: document.getElementById('commessaForm'),
            modalTitle: document.getElementById('modalTitle'),
            overlay: document.getElementById('modalOverlay'),

            // Campi Select Modale
            modelloSelect: document.getElementById('modello'),
            clienteSelect: document.getElementById('cliente'),
            statusSelect: document.getElementById('status-select'),

            // Campi Upload Immagine
            imageInput: document.getElementById('imageInput'),
            uploadWidget: document.getElementById('uploadWidget'),
            uploadText: document.getElementById('uploadText'),
            previewContainer: document.getElementById('imagePreviewContainer'),
            imagePreview: document.getElementById('imagePreview'),
            removeImageBtn: document.getElementById('removeImageBtn')
        };

        // Gestione Permessi
        if (!IsAdmin) {
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'none';
            if (this.dom.deepSearchWrapper) this.dom.deepSearchWrapper.style.display = 'none';
        } else {
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'flex';
            if (this.dom.deepSearchWrapper) this.dom.deepSearchWrapper.style.display = 'flex';
        }

        // Caricamento Dati Iniziali
        try {
            await this.loadDropdowns(); // Carica select per il modale
            
            // Carica le fasi per le card
            const phasesRes = await apiFetch('/api/commesse/fasi');
            this.state.allPhases = await phasesRes.json();
            
        } catch (error) {
            console.warn("Errore caricamento metadati.", error);
        }
        
        this.addEventListeners();
        this.fetchCommesse(true);
    },

    // --- CARICAMENTO DROPDOWN (Choices.js) ---
    loadDropdowns: async function() {
        if (!IsAdmin) return; // Non serve caricare le select se non puoi aggiungere

        try {
            const [modelliRes, clientiRes, statusRes] = await Promise.all([
                apiFetch('/api/simple/modelli'),
                apiFetch('/api/simple/clienti'),
                apiFetch('/api/simple/status_commessa')
            ]);

            const modelli = await modelliRes.json();
            const clienti = await clientiRes.json();
            const statuses = await statusRes.json();

            this.state.allStatuses = statuses;

            // Inizializza Choices.js
            this.initChoice(this.dom.modelloSelect, modelli, 'id_modello', 'nome_modello', 'Cerca modello...');
            this.initChoice(this.dom.clienteSelect, clienti, 'id_cliente', 'ragione_sociale', 'Cerca cliente...');
            
            // Select Status (Standard HTML è sufficiente per pochi valori)
            if (this.dom.statusSelect) {
                this.dom.statusSelect.innerHTML = statuses.map(s => 
                    `<option value="${s.id_status}" ${s.nome_status === 'In Lavorazione' ? 'selected' : ''}>${s.nome_status}</option>`
                ).join('');
            }

        } catch (e) {
            console.error("Errore caricamento dropdown:", e);
        }
    },

    initChoice: function(element, data, valueKey, labelKey, placeholder) {
        if (!element) return;
        
        // Distruggi istanza precedente se esiste (per evitare duplicati su hot reload)
        if (element.choicesInstance) {
            element.choicesInstance.destroy();
        }

        const choices = new Choices(element, {
            searchEnabled: true,
            itemSelectText: '',
            placeholder: true,
            placeholderValue: placeholder,
            shouldSort: true,
            removeItemButton: true,
            searchResultLimit: 10,
            position: 'bottom'
        });

        const formattedData = data.map(item => ({ 
            value: item[valueKey], 
            label: item[labelKey] 
        }));
        
        choices.setChoices(formattedData, 'value', 'label', true);
        element.choicesInstance = choices; // Salviamo riferimento
    },

    // --- EVENT LISTENERS ---
    addEventListeners: function() {
        // Modale
        if (this.dom.addBtn) this.dom.addBtn.addEventListener('click', () => this.openModal(false));
        if (this.dom.closeModalBtn) this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.overlay) this.dom.overlay.addEventListener('click', () => this.closeModal());
        if (this.dom.modalForm) this.dom.modalForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Filtri e Ricerca
        this.dom.statusFilters.forEach(btn => {
            btn.addEventListener('click', () => this.handleStatusFilter(btn));
        });
        
        let searchTimeout;
        this.dom.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.searchTerm = this.dom.searchInput.value;
                this.fetchCommesse(true);
            }, 500);
        });

        this.dom.sortSelect.addEventListener('change', () => this.handleSort());
        window.addEventListener('scroll', () => this.handleScroll());

        // Gestione Formattazione Input (Modale)
        const voInput = document.getElementById('vo');
        if (voInput) {
            voInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/[^0-9]/g, ''); // Solo numeri
                if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2, 6);
                e.target.value = val;
            });
        }

        const rifInput = document.getElementById('rif_tecnico');
        if (rifInput) {
            rifInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        // Gestione Immagine
        if (this.dom.imageInput) this.dom.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        if (this.dom.removeImageBtn) this.dom.removeImageBtn.addEventListener('click', () => this.resetImage());
        if (this.dom.uploadWidget) this.dom.uploadWidget.addEventListener('click', () => this.dom.imageInput.click());
    },

    // --- GESTIONE MODALE ---
    openModal: function(isEdit, commessaId = null) {
        if (!IsAdmin) return;

        // Reset Form
        this.dom.modalForm.reset();
        document.getElementById('commessaId').value = '';
        this.resetImage();

        // Reset Choices (opzionale ma consigliato se si vuole pulire la selezione)
        // Qui lasciamo l'ultimo stato o resettiamo se necessario

        if (isEdit && commessaId) {
            this.dom.modalTitle.textContent = "MODIFICA COMMESSA";
            // TODO: Qui andrebbe la logica per fetchare i dati della singola commessa e popolare il form
        } else {
            this.dom.modalTitle.textContent = "NUOVA COMMESSA";
            // Default anno corrente
            const yearInput = document.getElementById('anno');
            if(yearInput) yearInput.value = new Date().getFullYear();
        }

        this.dom.modal.classList.add('active');
    },

    closeModal: function() {
        this.dom.modal.classList.remove('active');
    },

    // --- GESTIONE IMMAGINE ---
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
    },

    // --- SALVATAGGIO FORM (MULTIPART) ---
    handleFormSubmit: async function(e) {
        e.preventDefault();
        
        const saveBtn = this.dom.modalForm.querySelector('.save-button');
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>Salvataggio...</span>';

        const id = document.getElementById('commessaId').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/commesse/${id}` : '/api/commesse';

        // Usiamo FormData per gestire file + testo
        const formData = new FormData(this.dom.modalForm);

        try {
            // Nota: Usiamo fetch nativo invece di apiFetch perché dobbiamo gestire FormData
            // senza che venga forzato l'header 'Content-Type: application/json'
            const token = localStorage.getItem('session_token');
            const baseUrl = 'https://segretario-ai-backend-service-460205196659.europe-west1.run.app'; // O importalo da config

            const res = await fetch(baseUrl + url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`
                    // NON impostare Content-Type, il browser lo mette automatico con il boundary corretto per FormData
                },
                body: formData
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.error || "Errore durante il salvataggio");
            }

            this.closeModal();
            showModal({ title: "Successo", message: "Commessa salvata correttamente." });
            this.fetchCommesse(true); // Ricarica la griglia

        } catch (error) {
            console.error(error);
            showModal({ title: "Errore", message: error.message });
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
    },

    // --- FETCH COMMESSE ---
    fetchCommesse: async function(isNewQuery = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;
        
        if (isNewQuery) {
            this.state.currentPage = 1;
            this.dom.grid.innerHTML = '';
        }
        
        if(this.dom.loader) this.dom.loader.style.display = 'block';

        const isDeepSearch = this.dom.deepSearchCheckbox ? this.dom.deepSearchCheckbox.checked : false;
        
        // Gestione Sort
        let sortBy = 'data_commessa';
        let sortOrder = 'desc';
        if (this.dom.sortSelect.value.includes(':')) {
            [sortBy, sortOrder] = this.dom.sortSelect.value.split(':');
        } else {
            // Compatibilità vecchi value
            if (this.dom.sortSelect.value === 'recent') { sortBy = 'data_commessa'; sortOrder = 'desc'; }
            if (this.dom.sortSelect.value === 'oldest') { sortBy = 'data_commessa'; sortOrder = 'asc'; }
            if (this.dom.sortSelect.value === 'alpha')  { sortBy = 'cliente'; sortOrder = 'asc'; }
        }

        const params = new URLSearchParams({
            page: this.state.currentPage,
            limit: 20,
            status: this.state.activeStatus,
            search: this.state.searchTerm,
            sortBy: sortBy,
            sortOrder: sortOrder,
        });

        if (isDeepSearch) params.append('deep_search', 'true');

        try {
            const response = await apiFetch(`/api/commesse/view?${params.toString()}`);
            if (!response.ok) throw new Error('Errore API');
            const data = await response.json();
            
            this.state.totalCount = data.count;
            this.renderCards(data.data);
            this.state.currentPage++;
            
        } catch (error) {
            console.error("Errore fetch:", error);
            this.dom.grid.innerHTML = `<p class="error-text">Impossibile caricare i dati.</p>`;
        } finally {
            this.state.isLoading = false;
            if(this.dom.loader) this.dom.loader.style.display = 'none';
        }
    },

    // --- RENDER CARDS ---
    renderCards: function(commesseData) {
        if (!commesseData || (commesseData.length === 0 && this.state.currentPage === 1)) {
            this.dom.grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">Nessuna commessa trovata.</div>`;
            return;
        }
        
        const fragment = document.createDocumentFragment();
        commesseData.forEach(commessa => {
            const card = this.createCard(commessa);
            fragment.appendChild(card);
        });
        this.dom.grid.appendChild(fragment);
    },
    
    createCard: function(commessa) {
        const card = document.createElement('div');
        card.className = 'commesse-card';
        card.dataset.commessaId = commessa.id_commessa;

        const statusName = commessa.status_commessa?.nome_status?.toLowerCase().replace(' ', '-') || 'default';
        // Aggiunge bordo colorato in base allo stato (opzionale se gestito da CSS)
        card.classList.add(`status-border-${statusName}`);

        // --- Logica Fasi Attive ---
        let activeIds = [];
        if (Array.isArray(commessa.ids_fasi_attive)) {
            activeIds = commessa.ids_fasi_attive.map(String);
        }

        // --- Logica Avanzamento (Barra) ---
        // Pesi: Ufficio(1)=10, Carpenteria(2)=30, Assemblaggio(7)=60, Preparazione(4)=80, Completato=100
        let maxProgress = 5; 
        
        if (commessa.status_commessa?.nome_status === 'Completato') {
            maxProgress = 100;
        } else {
            if (activeIds.includes('1')) maxProgress = Math.max(maxProgress, 15);
            if (activeIds.includes('2')) maxProgress = Math.max(maxProgress, 35);
            if (activeIds.includes('7')) maxProgress = Math.max(maxProgress, 65);
            if (activeIds.includes('4')) maxProgress = Math.max(maxProgress, 85);
        }
        
        let progressColor = maxProgress >= 80 ? 'high' : (maxProgress >= 40 ? 'mid' : 'low');
        const totalHours = commessa.totale_ore ? parseFloat(commessa.totale_ore).toFixed(1) : "0.0";

        // HTML Elementi condizionali
        const noteHtml = IsAdmin ? `<p class="card-note"><strong>Note:</strong> ${commessa.note || '-'}</p>` : '';
        
        let adminToggleHtml = '';
        if (IsAdmin) { 
            adminToggleHtml = `
                <div class="status-and-toggle">
                    <span class="status-badge status-${statusName}">${commessa.status_commessa?.nome_status || 'N/D'}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" data-action="toggle-status" data-id="${commessa.id_commessa}" ${commessa.status_commessa?.nome_status === 'Completato' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>`;
        } else {
             adminToggleHtml = `<span class="status-badge status-${statusName}">${commessa.status_commessa?.nome_status || 'N/D'}</span>`;
        }

        let phasesHtml = '';
        if (IsAdmin) {
            // Default fasi se API fallisce
            const phasesToRender = (this.state.allPhases && this.state.allPhases.length > 0) 
                ? this.state.allPhases 
                : [{id_fase:1, nome_fase:'Ufficio'}, {id_fase:2, nome_fase:'Carpenteria'}, {id_fase:7, nome_fase:'Assemblaggio'}, {id_fase:4, nome_fase:'Preparazione'}];

            phasesHtml = `<div class="phases-container"><div class="phases-grid">`;
            phasesToRender.forEach(p => {
                const isChecked = activeIds.includes(String(p.id_fase)) ? 'checked' : '';
                phasesHtml += `
                    <div class="phase-item">
                        <span>${p.nome_fase}</span>
                        <label class="mini-switch">
                            <input type="checkbox" data-action="toggle-phase" data-commessa-id="${commessa.id_commessa}" data-phase-id="${p.id_fase}" ${isChecked}>
                            <span class="mini-slider"></span>
                        </label>
                    </div>`;
            });
            phasesHtml += `</div></div>`;
        }

        let actionsHtml = '';
        if (IsAdmin) {
            actionsHtml = `
            <div class="card-actions">
                <button class="std-btn std-btn--warning" data-action="edit" data-id="${commessa.id_commessa}">✏️ Modifica</button>
                <button class="std-btn std-btn--danger" data-action="delete" data-id="${commessa.id_commessa}">🗑️ Elimina</button>
            </div>`;
        }

        // Costruzione HTML Card
        card.innerHTML = `
            <div class="card-image" style="background-image: url('${commessa.immagine || 'img/placeholder.png'}')">
                ${!commessa.immagine ? '<span style="opacity:0.5">No Image</span>' : ''}
            </div>
            <div class="card-details">
                <div class="card-header">
                    <h3>${commessa.clienti?.ragione_sociale || 'Cliente Sconosciuto'}</h3>
                    ${adminToggleHtml}
                </div>
                
                <div class="card-info">
                    <p><strong>Imp:</strong> ${commessa.impianto || '-'} | <strong>Mod:</strong> ${commessa.modelli?.nome_modello || '-'}</p>
                    <p><strong>Luogo:</strong> ${commessa.paese || ''} (${commessa.provincia || ''}) - ${commessa.anno || ''}</p>
                    <p><strong>Dettagli:</strong> VO: ${commessa.vo || '-'} | Matr: ${commessa.matricola || '-'}</p>
                    <p><strong>Rif. Tec:</strong> ${commessa.riferimento_tecnico || '-'}</p>
                    ${noteHtml}
                </div>
                
                ${phasesHtml} 

                <div class="progress-section">
                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill ${progressColor}" style="width: ${maxProgress}%"></div>
                        </div>
                    </div>
                    <div class="hours-badge">
                        <span class="hours-value">${totalHours}</span>
                        <span class="hours-label">ORE</span>
                    </div>
                </div>
            </div>
            ${actionsHtml}
        `;

        // Binding Eventi Card
        if (IsAdmin) {
            const delBtn = card.querySelector('[data-action="delete"]');
            if (delBtn) delBtn.addEventListener('click', () => this.handleDelete(commessa.id_commessa));

            const editBtn = card.querySelector('[data-action="edit"]');
            if (editBtn) editBtn.addEventListener('click', () => this.handleEdit(commessa.id_commessa)); // TODO: Implementare Edit completo

            const statusToggle = card.querySelector('[data-action="toggle-status"] input');
            if (statusToggle) statusToggle.addEventListener('change', (e) => this.handleStatusToggle(e));

            card.querySelectorAll('[data-action="toggle-phase"] input').forEach(cb => {
                cb.addEventListener('change', (e) => this.handlePhaseToggle(e));
            });
        }

        return card;
    },

    // --- ACTIONS HANDLERS ---
    
    handleScroll: function() {
        if (this.state.isLoading) return;
        // Lo scroll è su std-app-content, non window
        const contentDiv = document.querySelector('.std-app-content');
        if (!contentDiv) return;

        const { scrollTop, scrollHeight, clientHeight } = contentDiv;
        if (scrollTop + clientHeight >= scrollHeight - 50 && this.dom.grid.children.length < this.state.totalCount) {
            this.fetchCommesse(false);
        }
    },

    handleStatusFilter: function(btn) {
        this.dom.statusFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.activeStatus = btn.dataset.filter;
        this.fetchCommesse(true);
    },

    handleSort: function() { this.fetchCommesse(true); },

    // Toggle Phase
    handlePhaseToggle: async function(e) {
        const checkbox = e.target;
        const commessaId = checkbox.dataset.commessaId;
        const card = this.dom.grid.querySelector(`[data-commessa-id="${commessaId}"]`);
        
        // Raccogli tutte le checkbox attive nella card
        const newActiveIds = [];
        card.querySelectorAll('[data-action="toggle-phase"] input').forEach(cb => {
            if (cb.checked) newActiveIds.push(parseInt(cb.dataset.phaseId));
        });

        try {
            checkbox.disabled = true;
            await apiFetch(`/api/commesse/${commessaId}/fasi`, {
                method: 'PUT',
                body: JSON.stringify({ ids_fasi_attive: newActiveIds })
            });
            // Non serve ricaricare tutta la griglia, l'UI è già aggiornata
        } catch (error) {
            console.error(error);
            checkbox.checked = !checkbox.checked; // Revert visuale
            showModal({ title: 'Errore', message: 'Impossibile aggiornare la fase.' });
        } finally {
            checkbox.disabled = false;
        }
    },

    // Toggle Status (Completato/In Lavorazione)
    handleStatusToggle: async function(e) {
        const checkbox = e.target;
        const commessaId = checkbox.dataset.id;
        // ID 5 = Completato, ID 2 = In Lavorazione (da verificare nel tuo DB)
        const newStatusId = checkbox.checked ? 5 : 2; 

        try {
            checkbox.disabled = true;
            await apiFetch(`/api/commesse/${commessaId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ id_status_fk: newStatusId })
            });
            
            // Se siamo nel filtro "In Lavorazione" e completiamo, la card dovrebbe sparire o aggiornarsi
            // Ricarichiamo per coerenza
            this.fetchCommesse(false); 
        } catch (err) {
            console.error(err);
            checkbox.checked = !checkbox.checked;
            showModal({ title: "Errore", message: "Impossibile aggiornare lo stato." });
        } finally {
            checkbox.disabled = false;
        }
    },

    handleDelete: async function(id) {
        const confirm = await showModal({
            title: "Elimina Commessa",
            message: "Sei sicuro di voler eliminare questa commessa? L'azione è irreversibile.",
            confirmText: "ELIMINA",
            cancelText: "Annulla"
        });

        if (!confirm) return;

        try {
            await apiFetch(`/api/commesse/${id}`, { method: 'DELETE' });
            showModal({ title: "Eliminata", message: "Commessa rimossa con successo." });
            this.fetchCommesse(true);
        } catch (e) {
            showModal({ title: "Errore", message: "Impossibile eliminare: " + e.message });
        }
    },

    handleEdit: function(id) {
        // Per ora apriamo solo il modale vuoto o con un alert, 
        // implementare logica di fetch singolo se necessario
        this.openModal(true, id);
        // showModal({ title: "Info", message: "Funzione modifica completa in arrivo." });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});