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

        // NUOVO: Nascondi il bottone "Aggiungi" se non è Admin
        if (!IsAdmin && this.dom.addBtn) {
            this.dom.addBtn.style.display = 'none';
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
        
        // --- LOGICA PROGRESSO (Codice esistente che mantieni) ---
        const phaseWeights = { 'ufficio': 15, 'progettazione': 20, 'taglio': 30, 'carpenteria': 45, 'saldatura': 50, 'tornitura': 55, 'assemblaggio': 70, 'montaggio': 75, 'elettricista': 80, 'verniciatura': 85, 'preparazione': 90, 'collaudo': 95, 'spedizione': 100 };
        let maxProgress = 5; 
        let progressLabel = "Avvio";
        const activeIds = commessa.ids_fasi_attive || [];
        if (this.state.allPhases) {
            this.state.allPhases.forEach(phase => {
                if (activeIds.includes(phase.id_fase)) {
                    const phaseNameLower = phase.nome_fase.toLowerCase();
                    for (const key in phaseWeights) {
                        if (phaseNameLower.includes(key) && phaseWeights[key] > maxProgress) {
                            maxProgress = phaseWeights[key];
                            progressLabel = phase.nome_fase;
                        }
                    }
                }
            });
        }
        let progressColorClass = maxProgress > 80 ? 'high' : (maxProgress > 40 ? 'mid' : 'low');
        const totalHours = commessa.totale_ore ? parseFloat(commessa.totale_ore).toFixed(1) : "0.0";
        // ---------------------------------------------------------

        // --- HTML CONDIZIONALE ---
        
        // 1. Note: Visibili solo se Admin
        // Usiamo formatDataContent (importalo in cima se non c'è, o usa raw string)
        const noteHtml = IsAdmin 
            ? `<p><strong>Note:</strong> ${commessa.note || 'Nessuna'}</p>` 
            : ''; 

        // 2. Link Registrazioni: Visibile solo se Admin
        let registrazioniHtml = '';
        if (IsAdmin) {
            const count = commessa.registrazioni ? commessa.registrazioni.length : 0;
            const link = count > 0 
                ? `| <a href="gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${commessa.id_commessa}" target="_blank">Dettagli</a>` 
                : '';
            registrazioniHtml = `<div class="registrazioni-section"><p><strong>Registrazioni:</strong> ${count} ${link}</p></div>`;
        }

        // 3. Azioni (Edit/Delete): Visibili solo se Admin
        let actionsHtml = '';
        if (IsAdmin) {
            actionsHtml = `
            <div class="card-actions">
                <button class="button button--warning" data-action="edit" data-id="${commessa.id_commessa}">✏️ Modifica</button>
                <button class="button button--danger" data-action="delete" data-id="${commessa.id_commessa}">🗑️ Elimina</button>
            </div>`;
        }

        // 4. Toggle e Fasi (Interattivi solo per Admin)
        let phasesHtml = '';
        // Mostriamo le fasi sempre per vedere a che punto siamo, MA disabilitiamo i checkbox se non admin?
        // La tua richiesta dice: "Barra avanzamento e ore... rispecchiare stato".
        // Se l'operatore non deve toccare le fasi, possiamo nascondere i toggle o disabilitarli.
        // Manteniamo la logica: Se admin vede i toggle, se no vede solo la barra.
        if (IsAdmin && this.state.allPhases && this.state.allPhases.length > 0) {
            phasesHtml = `<div class="phases-container"><div class="phases-title">Fasi Attive</div><div class="phases-grid">`;
            this.state.allPhases.forEach(phase => {
                const isChecked = activeIds.includes(phase.id_fase) ? 'checked' : '';
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
                <label class="toggle-switch">
                    <input type="checkbox" data-action="toggle-status" data-id="${commessa.id_commessa}" ${commessa.status_commessa?.nome_status === 'Completato' ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>`;
        }

        // --- ASSEMBLAGGIO CARD ---
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
                    <p><strong>Dettagli:</strong> VO: ${commessa.vo || 'N/D'} | Anno: ${commessa.anno || 'N/D'}</p>
                    
                    ${noteHtml} <!-- Note visibili solo se Admin -->
                </div>
                
                ${phasesHtml} <!-- Toggle Fasi visibili solo se Admin -->

                <!-- BARRA E ORE SEMPRE VISIBILI -->
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

                ${registrazioniHtml} <!-- Link visibile solo se Admin -->
            </div>
            
            ${actionsHtml} <!-- Pulsanti Modifica/Elimina visibili solo se Admin -->
        `;

        // ... BINDING EVENTI (Solo se gli elementi esistono) ...
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

    handleStatusFilter: function(clickedBtn) {
        this.dom.statusFilters.forEach(btn => btn.classList.remove('active'));
        clickedBtn.classList.add('active');
        this.state.activeStatus = clickedBtn.dataset.status;
        this.fetchCommesse(true);
    },

    handleDelete: async function(commessaId) {
        const isConfirmed = await showModal({
            title: 'Conferma Eliminazione',
            message: `Sei sicuro di voler eliminare questa commessa? L'azione è irreversibile.`,
            confirmText: 'Elimina',
            cancelText: 'Annulla'
        });

        if (isConfirmed) {
            try {
                const response = await apiFetch(`/api/commesse/${commessaId}`, { method: 'DELETE' });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Errore del server');
                }
                const cardToRemove = this.dom.grid.querySelector(`[data-commessa-id="${commessaId}"]`);
                if (cardToRemove) cardToRemove.remove();
            } catch (error) {
                showModal({
                    title: 'Errore',
                    message: `Impossibile eliminare la commessa: ${error.message}`,
                    confirmText: 'OK'
                });
            }
        }
    },

    handleEdit: function(commessaId) {
        // Ripristina 'window.'
        if (typeof window.openNewOrderModal === 'function') {
            window.openNewOrderModal(true, commessaId);
        } else {
            console.error('La funzione openNewOrderModal non è stata trovata.');
        }
    },

    handleStatusToggle: async function(event) {
        const toggleInput = event.target;
        const commessaId = toggleInput.dataset.id;
        const isCompleted = toggleInput.checked; // true se è stato spostato su "Completato"

        // Trova gli ID corretti dallo stato che abbiamo caricato all'inizio
        const completedStatus = this.state.allStatuses.find(s => s.nome_status === 'Completato');
        const inProgressStatus = this.state.allStatuses.find(s => s.nome_status === 'In Lavorazione');

        if (!completedStatus || !inProgressStatus) {
            return showModal({ title: 'Errore', message: 'Impossibile trovare gli stati necessari.', confirmText: 'OK' });
        }

        const newStatusId = isCompleted ? completedStatus.id_status : inProgressStatus.id_status;
        const newStatusName = isCompleted ? 'Completato' : 'In Lavorazione';

        try {
            // Disabilita momentaneamente il toggle per prevenire click multipli
            toggleInput.disabled = true;

            // Chiama l'API che abbiamo già creato
            await apiFetch(`/api/commesse/${commessaId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ id_status_fk: newStatusId })
            });

            // --- Aggiornamento UI Istantaneo ---
            const card = this.dom.grid.querySelector(`[data-commessa-id="${commessaId}"]`);
            if (card) {
                // Se il filtro attivo non corrisponde più al nuovo stato, rimuovi la card
                if (this.state.activeStatus && this.state.activeStatus !== newStatusName) {
                    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => card.remove(), 500);
                } else {
                    // Altrimenti, aggiorna semplicemente la card
                    const badge = card.querySelector('.status-badge');
                    const statusNameClass = newStatusName.toLowerCase().replace(' ', '-');

                    badge.textContent = newStatusName;
                    badge.className = `status-badge status-${statusNameClass}`;
                    
                    card.className = 'commesse-card'; // Resetta le classi di sfondo
                    card.classList.add(`status-bg-${statusNameClass}`);
                }
            }

        } catch (error) {
            showModal({ title: 'Errore', message: `Impossibile aggiornare lo stato: ${error.message}`, confirmText: 'OK' });
            // Ripristina lo stato visivo del toggle in caso di errore
            toggleInput.checked = !isCompleted;
        } finally {
            toggleInput.disabled = false;
        }
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