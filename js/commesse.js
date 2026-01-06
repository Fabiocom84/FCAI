// js/commesse.js

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
    
    dom: {}, // Contenitore riferimenti DOM

    init: async function() {
        // Mappatura elementi DOM
        this.dom = {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),
            statusFilters: document.querySelectorAll('.filter-btn'),
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn'),
            deepSearchWrapper: document.getElementById('deep-search-wrapper'), // La label con la checkbox
            deepSearchCheckbox: document.getElementById('search-deep'),
            
            // Elementi del Modale
            modal: document.getElementById('commessaModal'),
            closeModalBtn: document.getElementById('closeModal'),
            modalForm: document.getElementById('commessaForm'),
            modalTitle: document.getElementById('modalTitle'),
            overlay: document.getElementById('modalOverlay')
        };

        // 1. GESTIONE PERMESSI (Admin vs User)
        if (!IsAdmin) {
            // Nascondi pulsante aggiungi
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'none';
            // Nascondi checkbox "Reg." (Deep search)
            if (this.dom.deepSearchWrapper) this.dom.deepSearchWrapper.style.display = 'none';
        } else {
            // Assicurati che siano visibili se admin
            if (this.dom.addBtn) this.dom.addBtn.style.display = 'flex';
            if (this.dom.deepSearchWrapper) this.dom.deepSearchWrapper.style.display = 'flex';
        }

        // Caricamento dati iniziali (Fasi e Status)
        try {
            const [statusRes, phasesRes] = await Promise.all([
                apiFetch('/api/simple/status_commessa'),
                apiFetch('/api/commesse/fasi')
            ]);
            this.state.allStatuses = await statusRes.json();
            this.state.allPhases = await phasesRes.json();
        } catch (error) {
            console.warn("Impossibile caricare metadati (status/fasi), uso fallback.", error);
        }
        
        this.addEventListeners();
        this.fetchCommesse(true);
    },
    
    addEventListeners: function() {
        // Apertura Modale Nuova Commessa
        if (this.dom.addBtn) {
            this.dom.addBtn.addEventListener('click', () => this.openModal(false));
        }

        // Chiusura Modale
        if (this.dom.closeModalBtn) {
            this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.dom.overlay) {
            this.dom.overlay.addEventListener('click', () => this.closeModal());
        }

        // Salvataggio Form
        if (this.dom.modalForm) {
            this.dom.modalForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Filtri Status
        this.dom.statusFilters.forEach(btn => {
            btn.addEventListener('click', () => this.handleStatusFilter(btn));
        });
        
        // Ricerca (Debounce)
        let searchTimeout;
        this.dom.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.searchTerm = this.dom.searchInput.value;
                this.fetchCommesse(true);
            }, 500);
        });

        // Ordinamento
        this.dom.sortSelect.addEventListener('change', () => this.handleSort());
        
        // Infinite Scroll
        window.addEventListener('scroll', () => this.handleScroll());
    },

    // --- LOGICA MODALE (Nuovo/Modifica) ---
    openModal: function(isEdit, commessaId = null) {
        if (!IsAdmin) return; // Sicurezza extra

        const modal = this.dom.modal;
        const form = this.dom.modalForm;
        
        // Reset Form
        form.reset();
        document.getElementById('commessaId').value = '';
        
        if (isEdit && commessaId) {
            this.dom.modalTitle.textContent = "Modifica Commessa";
            this.loadCommessaDetails(commessaId);
        } else {
            this.dom.modalTitle.textContent = "Nuova Commessa";
        }

        // Mostra Modale (CSS usa .active per display: flex)
        modal.classList.add('active');
        this.dom.overlay.style.display = 'block';
    },

    closeModal: function() {
        this.dom.modal.classList.remove('active');
        this.dom.overlay.style.display = 'none';
    },

    loadCommessaDetails: async function(id) {
        try {
            // Simulazione caricamento dati per edit (o chiamata API specifica se esiste endpoint singolo)
            // Per ora non implementato nel dettaglio, resetta solo il form
            console.log("Loading details for", id);
        } catch (e) {
            console.error(e);
        }
    },

    handleFormSubmit: async function(e) {
        e.preventDefault();
        
        // Raccolta dati base
        const formData = {
            cliente: document.getElementById('cliente').value,
            impianto: document.getElementById('impianto').value,
            luogo: document.getElementById('luogo').value,
            modello: document.getElementById('modello').value,
            anno: document.getElementById('anno').value,
            vo: document.getElementById('vo').value,
            matricola: document.getElementById('matricola').value,
            riferimento_tecnico: document.getElementById('rif_tecnico').value,
            note: document.getElementById('note').value
        };

        const id = document.getElementById('commessaId').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/commesse/${id}` : '/api/commesse';

        try {
            const res = await apiFetch(url, {
                method: method,
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error("Errore salvataggio");

            this.closeModal();
            showModal({ title: "Successo", message: "Commessa salvata correttamente." });
            this.fetchCommesse(true); // Ricarica lista

        } catch (error) {
            console.error(error);
            showModal({ title: "Errore", message: "Impossibile salvare la commessa." });
        }
    },

    // --- LOGICA LISTA (Fetch & Render) ---
    fetchCommesse: async function(isNewQuery = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;
        
        if (isNewQuery) {
            this.state.currentPage = 1;
            this.dom.grid.innerHTML = '';
        }
        
        if(this.dom.loader) this.dom.loader.style.display = 'block';

        // Checkbox Deep Search (Gestione sicura null)
        const isDeepSearch = this.dom.deepSearchCheckbox ? this.dom.deepSearchCheckbox.checked : false;

        const params = new URLSearchParams({
            page: this.state.currentPage,
            limit: 20,
            status: this.state.activeStatus,
            search: this.state.searchTerm,
            sortBy: this.state.sortBy,
            sortOrder: this.state.sortOrder,
        });

        if (isDeepSearch) {
            params.append('deep_search', 'true');
        }

        try {
            const response = await apiFetch(`/api/commesse/view?${params.toString()}`);
            if (!response.ok) throw new Error('Risposta di rete non valida.');
            const data = await response.json();
            
            this.state.totalCount = data.count;
            this.renderCards(data.data);
            this.state.currentPage++;
            
        } catch (error) {
            console.error("Errore fetch:", error);
            this.dom.grid.innerHTML = `<p class="error-text">Errore nel caricamento.</p>`;
        } finally {
            this.state.isLoading = false;
            if(this.dom.loader) this.dom.loader.style.display = 'none';
        }
    },

    renderCards: function(commesseData) {
        if (!commesseData || (commesseData.length === 0 && this.state.currentPage === 1)) {
            this.dom.grid.innerHTML = `<p class="error-text">Nessuna commessa trovata.</p>`;
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
        card.classList.add(`status-bg-${statusName}`);
        const statusClass = `status-${statusName}`;
        
        // Logica Barre Avanzamento (Fissa)
        const phaseConfig = {
            '1': { label: 'Ufficio', weight: 10 },
            '2': { label: 'Carpenteria', weight: 30 },
            '7': { label: 'Assemblaggio', weight: 50 },
            '4': { label: 'Preparazione', weight: 80 }
        };

        let maxProgress = 5; 
        let progressLabel = "Avvio";
        
        let activeIds = [];
        if (Array.isArray(commessa.ids_fasi_attive)) {
            activeIds = commessa.ids_fasi_attive.map(id => String(id));
        } else if (typeof commessa.ids_fasi_attive === 'string') {
            try { activeIds = JSON.parse(commessa.ids_fasi_attive).map(id => String(id)); } catch(e){}
        }

        activeIds.forEach(id => {
            const phase = phaseConfig[id];
            if (phase && phase.weight > maxProgress) {
                maxProgress = phase.weight;
                progressLabel = phase.label;
            }
        });
        
        if(commessa.status_commessa?.nome_status === 'Completato') {
            maxProgress = 100;
            progressLabel = "Completato";
        }

        let progressColorClass = maxProgress >= 80 ? 'high' : (maxProgress >= 40 ? 'mid' : 'low');
        const totalHours = commessa.totale_ore ? parseFloat(commessa.totale_ore).toFixed(1) : "0.0";

        // HTML Condizionale Admin
        const noteHtml = IsAdmin ? `<p><strong>Note:</strong> ${commessa.note || 'Nessuna'}</p>` : '';
        
        let registrazioniHtml = '';
        if (IsAdmin) {
            const count = commessa.registrazioni ? commessa.registrazioni.length : 0;
            const link = count > 0 ? `| <a href="gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${commessa.id_commessa}" target="_blank">Dettagli</a>` : '';
            registrazioniHtml = `<div class="registrazioni-section"><p><strong>Registrazioni:</strong> ${count} ${link}</p></div>`;
        }

        let actionsHtml = '';
        if (IsAdmin) {
            actionsHtml = `
            <div class="card-actions">
                <button class="std-btn std-btn--warning" data-action="edit" data-id="${commessa.id_commessa}">
                    <span>✏️ Modifica</span>
                </button>
                <button class="std-btn std-btn--danger" data-action="delete" data-id="${commessa.id_commessa}">
                    <span>🗑️ Elimina</span>
                </button>
            </div>`;
        }

        let phasesHtml = '';
        const phasesToRender = (this.state.allPhases && this.state.allPhases.length > 0) 
            ? this.state.allPhases 
            : [ 
                {id_fase: 1, nome_fase: 'Ufficio'},
                {id_fase: 2, nome_fase: 'Carpenteria'},
                {id_fase: 7, nome_fase: 'Assemblaggio'},
                {id_fase: 4, nome_fase: 'Preparazione'}
              ];

        if (IsAdmin) {
            phasesHtml = `<div class="phases-container"><div class="phases-title">Fasi Attive</div><div class="phases-grid">`;
            phasesToRender.forEach(phase => {
                const currentPhaseId = String(phase.id_fase);
                const isChecked = activeIds.includes(currentPhaseId) ? 'checked' : '';
                phasesHtml += `
                    <div class="phase-item">
                        <span>${phase.nome_fase}</span>
                        <label class="mini-switch">
                            <input type="checkbox" data-action="toggle-phase" data-commessa-id="${commessa.id_commessa}" data-phase-id="${phase.id_fase}" ${isChecked}>
                            <span class="mini-slider"></span>
                        </label>
                    </div>`;
            });
            phasesHtml += `</div></div>`;
        }

        let adminToggleHtml = '';
        if (IsAdmin) { 
            adminToggleHtml = `
                <div class="status-and-toggle">
                    <span class="status-badge ${statusClass}">${commessa.status_commessa?.nome_status || 'N/D'}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" data-action="toggle-status" data-id="${commessa.id_commessa}" ${commessa.status_commessa?.nome_status === 'Completato' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>`;
        } else {
            // Per non admin mostriamo solo il badge
             adminToggleHtml = `<span class="status-badge ${statusClass}">${commessa.status_commessa?.nome_status || 'N/D'}</span>`;
        }

        // Template Card
        card.innerHTML = `
            <div class="card-image" style="background-image: url('${commessa.immagine || 'img/placeholder.png'}')">
                ${!commessa.immagine ? 'Nessuna Immagine' : ''}
            </div>
            <div class="card-details">
                <div class="card-header">
                    <h3>${commessa.clienti?.ragione_sociale || 'Cliente non definito'}</h3>
                    ${adminToggleHtml}
                </div>
                
                <div class="card-info">
                    <p><strong>Impianto:</strong> ${commessa.impianto || 'N/D'} | <strong>Modello:</strong> ${commessa.modelli?.nome_modello || 'N/D'}</p>
                    <p><strong>Luogo:</strong> ${commessa.paese || 'N/D'} (${commessa.provincia || '-'})</p>
                    <p><strong>Dettagli:</strong> VO: ${commessa.vo || 'N/D'} | Matr: ${commessa.matricola || 'N/D'} | Anno: ${commessa.anno || 'N/D'}</p>
                    <p><strong>Rif. Tecnico:</strong> ${commessa.riferimento_tecnico || 'N/D'}</p>
                    ${noteHtml}
                </div>
                
                ${phasesHtml} 

                <div class="progress-section">
                    <div class="progress-container">
                        <div class="progress-labels">
                            <span>Avanzamento</span>
                            <span>${progressLabel} (${maxProgress}%)</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill ${progressColorClass}" style="width: ${maxProgress}%"></div>
                        </div>
                    </div>
                    <div class="hours-badge">
                        <span class="hours-value">${totalHours}</span>
                        <span class="hours-label">ORE</span>
                    </div>
                </div>

                ${registrazioniHtml}
            </div>
            
            ${actionsHtml}
        `;

        // Event Listeners Card
        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.handleDelete(deleteBtn.dataset.id); });
        
        const editBtn = card.querySelector('[data-action="edit"]');
        if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); this.handleEdit(editBtn.dataset.id); });
        
        const toggleInput = card.querySelector('[data-action="toggle-status"]');
        if (toggleInput) toggleInput.addEventListener('change', (e) => { this.handleStatusToggle(e); });

        card.querySelectorAll('[data-action="toggle-phase"]').forEach(toggle => {
            toggle.addEventListener('change', (e) => this.handlePhaseToggle(e));
        });

        return card;
    },

    // --- UTILS EVENTI ---
    handleStatusFilter: function(clickedBtn) {
        this.dom.statusFilters.forEach(btn => btn.classList.remove('active'));
        clickedBtn.classList.add('active');
        this.state.activeStatus = clickedBtn.dataset.filter; // Nota: nel HTML è data-filter
        this.fetchCommesse(true);
    },

    handleSort: function() {
        const val = this.dom.sortSelect.value;
        if(val === 'recent') { this.state.sortBy = 'data_commessa'; this.state.sortOrder = 'desc'; }
        if(val === 'oldest') { this.state.sortBy = 'data_commessa'; this.state.sortOrder = 'asc'; }
        if(val === 'alpha')  { this.state.sortBy = 'cliente'; this.state.sortOrder = 'asc'; }
        this.fetchCommesse(true);
    },

    handleScroll: function() {
        if (this.state.isLoading) return;
        const { scrollTop, scrollHeight, clientHeight } = document.querySelector('.std-app-content'); // Scroll è sul div interno ora
        const loadedCommesse = this.dom.grid.children.length;
        
        // Se siamo vicini alla fine
        if (scrollTop + clientHeight >= scrollHeight - 50 && loadedCommesse < this.state.totalCount) {
            this.fetchCommesse(false);
        }
    },

    // Funzioni Azione (Toggle, Delete, ecc.) rimangono invariate nella logica
    handlePhaseToggle: async function(event) {
        /* ...Logica fase invariata, vedi versioni precedenti se serve copia/incolla... */
        /* Per brevità, assumiamo sia uguale a prima */
        const checkbox = event.target;
        const commessaId = checkbox.dataset.commessaId;
        const newActiveIds = [];
        const card = this.dom.grid.querySelector(`[data-commessa-id="${commessaId}"]`);
        card.querySelectorAll('[data-action="toggle-phase"]').forEach(cb => {
            if (cb.checked) newActiveIds.push(parseInt(cb.dataset.phaseId));
        });

        try {
            checkbox.disabled = true;
            await apiFetch(`/api/commesse/${commessaId}/fasi`, {
                method: 'PUT',
                body: JSON.stringify({ ids_fasi_attive: newActiveIds })
            });
        } catch (error) {
            console.error(error);
            checkbox.checked = !checkbox.checked;
            showModal({ title: 'Errore', message: 'Impossibile aggiornare la fase.' });
        } finally {
            checkbox.disabled = false;
        }
    },

    handleStatusToggle: async function(event) {
        const checkbox = event.target;
        const commessaId = checkbox.dataset.id;
        const newStatusId = checkbox.checked ? 5 : 2; 

        try {
            checkbox.disabled = true;
            await apiFetch(`/api/commesse/${commessaId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ id_status: newStatusId })
            });
            this.fetchCommesse(false);
        } catch (e) {
            console.error(e);
            checkbox.checked = !checkbox.checked;
            showModal({ title: "Errore", message: "Impossibile aggiornare lo stato." });
        } finally {
            checkbox.disabled = false;
        }
    },

    handleDelete: async function(commessaId) {
        const confirm = await showModal({
            title: "Elimina Commessa",
            message: "Sei sicuro?",
            confirmText: "Elimina",
            cancelText: "Annulla"
        });
        if (!confirm) return;

        try {
            await apiFetch(`/api/commesse/${commessaId}`, { method: 'DELETE' });
            showModal({ title: "Successo", message: "Commessa eliminata." });
            this.fetchCommesse(true);
        } catch (e) {
            console.error(e);
            showModal({ title: "Errore", message: "Impossibile eliminare." });
        }
    },

    handleEdit: function(commessaId) {
        this.openModal(true, commessaId);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});