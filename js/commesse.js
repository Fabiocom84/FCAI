// js/commesse.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const App = {
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        activeStatus: 'In Lavorazione', // Default a "Tutte" come discusso
        searchTerm: '',
        sortBy: 'data_commessa',
        sortOrder: 'desc',
        allStatuses: [],
        allPhases: []
    },
    
    // Le funzioni ora sono definite come metodi dell'oggetto App
    init: async function() {
        this.dom = {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),
            statusFilters: document.querySelectorAll('.filter-btn'),
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn'),
        };

        // MOSTRA
        if (IsAdmin && this.dom.addBtn) {
            this.dom.addBtn.style.display = 'inline-flex';
        }

        try {
            const [statusRes, phasesRes] = await Promise.all([
                apiFetch('/api/simple/status_commessa'),
                apiFetch('/api/commesse/fasi')
            ]);
            
            this.state.allStatuses = await statusRes.json();
            this.state.allPhases = await phasesRes.json();
            
        } catch (error) {
            console.error("Errore caricamento dati init:", error);
        }
        
        this.addEventListeners();
        this.fetchCommesse(true);
    },
    
    addEventListeners: function() {
        // Ripristina 'window.'
        this.dom.addBtn.addEventListener('click', () => {
            if (typeof window.openNewOrderModal === 'function') {
                window.openNewOrderModal(false);
            } else {
                console.error('Funzione openNewOrderModal non trovata.');
            }
        });

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
    },

    fetchCommesse: async function(isNewQuery = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;
        if (isNewQuery) {
            this.state.currentPage = 1;
            this.dom.grid.innerHTML = '';
        }
        this.dom.loader.style.display = 'block';

        const deepSearchCheckbox = document.getElementById('deep-search-checkbox');
        const isDeepSearch = deepSearchCheckbox.checked;

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
            console.error("Errore durante il fetch delle commesse:", error);
            this.dom.grid.innerHTML = `<p class="error-text">Errore nel caricamento delle commesse.</p>`;
        } finally {
            this.state.isLoading = false;
            this.dom.loader.style.display = 'none';
        }
    },

    renderCards: function(commesseData) {
        if (!commesseData || (commesseData.length === 0 && this.state.currentPage === 1)) {
            this.dom.grid.innerHTML = `<p class="error-text">Nessuna commessa trovata con i filtri attuali.</p>`;
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
        const formattedDate = commessa.data_commessa ? new Date(commessa.data_commessa).toLocaleDateString('it-IT') : 'N/D';
        
        // ============================================================
        // 1. LOGICA BARRA DI AVANZAMENTO (Personalizzata su DB)
        // ============================================================
        
        // Mappatura esatta basata sulla tua tabella 'fasi_produzione'
        const phaseWeights = {
            'ufficio': 10,
            'carpenteria': 30,
            'assemblaggio': 50,
            'preparazione': 80
        };

        let maxProgress = 5; 
        let progressLabel = "Avvio";
        
        // 1. Pulizia e Conversione in Stringhe (Metodo Universale)
        let activeIds = [];
        if (Array.isArray(commessa.ids_fasi_attive)) {
            // Convertiamo tutto in stringa per evitare problemi tra 1 e "1"
            activeIds = commessa.ids_fasi_attive.map(id => String(id));
        }

        if (this.state.allPhases && this.state.allPhases.length > 0) {
            this.state.allPhases.forEach(phase => {
                // 2. Confronto ID Stringa vs Stringa
                const currentPhaseId = String(phase.id_fase);
                
                if (activeIds.includes(currentPhaseId)) {
                    const phaseNameLower = (phase.nome_fase || '').toLowerCase();
                    
                    // 3. Cerchiamo il peso nel dizionario semplificato
                    for (const key in phaseWeights) {
                        if (phaseNameLower.includes(key)) {
                            // Se la fase è attiva e ha una % più alta della attuale, aggiorna la barra
                            if (phaseWeights[key] > maxProgress) {
                                maxProgress = phaseWeights[key];
                                progressLabel = phase.nome_fase;
                            }
                        }
                    }
                }
            });
        }
        
        // Se lo stato generale è "Completato", vince su tutto (100%)
        if(commessa.status_commessa?.nome_status === 'Completato') {
            maxProgress = 100;
            progressLabel = "Completato";
        }

        // Colori barra: Giallo (basso), Blu (medio), Verde (alto)
        let progressColorClass = maxProgress >= 80 ? 'high' : (maxProgress >= 40 ? 'mid' : 'low');
        const totalHours = commessa.totale_ore ? parseFloat(commessa.totale_ore).toFixed(1) : "0.0";

        // ============================================================
        // 2. ELEMENTI HTML CONDIZIONALI (SOLO PER ADMIN)
        // ============================================================

        // A. Note (Solo Admin)
        const noteHtml = IsAdmin ? `<p><strong>Note:</strong> ${commessa.note || 'Nessuna'}</p>` : '';
        
        // B. Link Dettagli (Solo Admin)
        let registrazioniHtml = '';
        if (IsAdmin) {
            const count = commessa.registrazioni ? commessa.registrazioni.length : 0;
            const link = count > 0 ? `| <a href="gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${commessa.id_commessa}" target="_blank">Dettagli</a>` : '';
            registrazioniHtml = `<div class="registrazioni-section"><p><strong>Registrazioni:</strong> ${count} ${link}</p></div>`;
        }

        // C. Pulsanti Azione (Solo Admin)
        let actionsHtml = '';
        if (IsAdmin) {
            actionsHtml = `
            <div class="card-actions">
                <button class="button button--warning" data-action="edit" data-id="${commessa.id_commessa}">✏️ Modifica</button>
                <button class="button button--danger" data-action="delete" data-id="${commessa.id_commessa}">🗑️ Elimina</button>
            </div>`;
        }

        // D. Toggle Fasi (Solo Admin)
        let phasesHtml = '';
        if (IsAdmin && this.state.allPhases && this.state.allPhases.length > 0) {
            phasesHtml = `<div class="phases-container"><div class="phases-title">Fasi Attive</div><div class="phases-grid">`;
            this.state.allPhases.forEach(phase => {
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

        // E. Toggle Stato Generale (Solo Admin)
        let adminToggleHtml = '';
        if (IsAdmin) { 
            adminToggleHtml = `
                <label class="toggle-switch">
                    <input type="checkbox" data-action="toggle-status" data-id="${commessa.id_commessa}" ${commessa.status_commessa?.nome_status === 'Completato' ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>`;
        }

        // ============================================================
        // 3. ASSEMBLAGGIO CARD
        // ============================================================
        card.innerHTML = `
            <div class="card-image" style="background-image: url('${commessa.immagine || 'img/placeholder.png'}')">
                ${!commessa.immagine ? 'Nessuna Immagine' : ''}
            </div>
            <div class="card-details">
                <div class="card-header">
                    <h3>${commessa.clienti?.ragione_sociale || 'Cliente non definito'}</h3>
                    <div class="status-and-toggle">
                        <span class="status-badge ${statusClass}">${commessa.status_commessa?.nome_status || 'N/D'}</span>
                        ${adminToggleHtml}
                    </div>
                </div>
                
                <div class="card-info">
                    <p><strong>Impianto:</strong> ${commessa.impianto || 'N/D'} | <strong>Modello:</strong> ${commessa.modelli?.nome_modello || 'N/D'}</p>
                    <p><strong>Luogo:</strong> ${commessa.paese || 'N/D'} (${commessa.provincia || '-'})</p>
                    <p><strong>Dettagli:</strong> VO: ${commessa.vo || 'N/D'} | Matricola: ${commessa.matricola || 'N/D'} | Anno: ${commessa.anno || 'N/D'}</p>
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

        // ... BINDING EVENTI ...
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

    handleSort: function() {
        const [sortBy, sortOrder] = this.dom.sortSelect.value.split(':');
        this.state.sortBy = sortBy;
        this.state.sortOrder = sortOrder;
        this.fetchCommesse(true);
    },

    handleScroll: function() {
        if (this.state.isLoading) return;
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        const loadedCommesse = this.dom.grid.children.length;
        
        if (clientHeight + scrollTop >= scrollHeight - 100 && loadedCommesse < this.state.totalCount) {
            this.fetchCommesse(false);
        }
    },

    handlePhaseToggle: async function(event) {
        const checkbox = event.target;
        const commessaId = checkbox.dataset.commessaId;
        const phaseId = parseInt(checkbox.dataset.phaseId);
        const isChecked = checkbox.checked;

        try {
            // 1. Trova la commessa nello stato locale per aggiornare l'array
            // (Utile per non dover ricaricare tutta la pagina)
            // Nota: Nella vista 'view', i dati sono in rendering, non salvati uno per uno in state.tableData come in gestione.js.
            // Ma possiamo fare un trucco: leggere lo stato attuale delle checkbox della card.
            
            const card = this.dom.grid.querySelector(`[data-commessa-id="${commessaId}"]`);
            const allCheckboxes = card.querySelectorAll('[data-action="toggle-phase"]');
            
            // Ricostruiamo il nuovo array di ID basandoci su quello che vediamo a video
            const newActiveIds = [];
            allCheckboxes.forEach(cb => {
                if (cb.checked) newActiveIds.push(parseInt(cb.dataset.phaseId));
            });

            // 2. Chiama l'API
            checkbox.disabled = true; // Previeni doppi click
            
            const response = await apiFetch(`/api/commesse/${commessaId}/fasi`, {
                method: 'PUT',
                body: JSON.stringify({ ids_fasi_attive: newActiveIds })
            });

            if (!response.ok) throw new Error("Errore aggiornamento fasi");

            // Feedback visivo non necessario perché lo switch si è già mosso, 
            // ma potremmo mettere un piccolo "toast" se vuoi.
            console.log(`Fasi aggiornate per commessa ${commessaId}:`, newActiveIds);

        } catch (error) {
            console.error(error);
            checkbox.checked = !isChecked; // Torna indietro in caso di errore
            showModal({ title: 'Errore', message: 'Impossibile aggiornare la fase.', confirmText: 'OK' });
        } finally {
            checkbox.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Pagina pronta e guardia passata. Avvio App Commesse.');
    App.init();
});

window.refreshCommesseView = () => App.fetchCommesse(true);