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
        try {
            // Carichiamo Stati E Fasi in parallelo
            const [statusRes, phasesRes] = await Promise.all([
                apiFetch('/api/simple/status_commessa'),
                apiFetch('/api/commesse/fasi') // <--- Chiamata alla nuova rotta
            ]);
            
            this.state.allStatuses = await statusRes.json();
            this.state.allPhases = await phasesRes.json(); // Salviamo le fasi
            
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
        
        // Gestione link registrazioni
        const registrazioniSummary = commessa.registrazioni.length > 0
            ? `<p><strong>Registrazioni:</strong> ${commessa.registrazioni.length} 
                | <a href="gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${commessa.id_commessa}" target="_blank">Visualizza Dettagli</a></p>`
            : `<p><strong>Registrazioni:</strong> 0</p>`;
        
        // --- LOGICA FASI (Invariata) ---
        let phasesHtml = '';
        if (this.state.allPhases && this.state.allPhases.length > 0) {
            phasesHtml = `<div class="phases-container"><div class="phases-title">Fasi Attive</div><div class="phases-grid">`;
            const activePhases = commessa.ids_fasi_attive || [];
            this.state.allPhases.forEach(phase => {
                const isChecked = activePhases.includes(phase.id_fase) ? 'checked' : '';
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

        // --- NUOVA LOGICA TOGGLE ADMIN (FIX RACE CONDITION) ---
        // Usiamo IsAdmin importato: è immediato e sicuro.
        let adminToggleHtml = '';
        
        if (IsAdmin) { 
            adminToggleHtml = `
                <label class="toggle-switch">
                    <input type="checkbox" 
                           data-action="toggle-status" 
                           data-id="${commessa.id_commessa}" 
                           ${commessa.status_commessa?.nome_status === 'Completato' ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
        }
        // ------------------------------------------------------

        card.innerHTML = `
            <div class="card-image" style="background-image: url('${commessa.immagine || 'img/placeholder.png'}')">
                ${!commessa.immagine ? 'Nessuna Immagine' : ''}
            </div>
            <div class="card-details">
                <div class="card-header">
                    <h3>${commessa.clienti?.ragione_sociale || 'Cliente non definito'}</h3>
                    <div class="status-and-toggle">
                        <span class="status-badge ${statusClass}">${commessa.status_commessa?.nome_status || 'N/D'}</span>
                        
                        <!-- QUI INSERIAMO IL TOGGLE SOLO SE ADMIN -->
                        ${adminToggleHtml}
                        
                    </div>
                </div>
                <div class="card-info">
                    <p><strong>Impianto:</strong> ${commessa.impianto || 'N/D'} | <strong>Modello:</strong> ${commessa.modelli?.nome_modello || 'N/D'}</p>
                    <p><strong>Luogo:</strong> ${commessa.paese || 'N/D'} (${commessa.provincia || 'N/D'})</p>
                    <p><strong>Dettagli:</strong> VO: ${commessa.vo || 'N/D'} | Matricola: ${commessa.matricola || 'N/D'} | Anno: ${commessa.anno || 'N/D'}</p>
                    <p><strong>Rif. Tecnico:</strong> ${commessa.riferimento_tecnico || 'N/D'}</p>
                    <p><strong>Data:</strong> ${formattedDate}</p>
                    
                    <!-- Nota: Se vuoi formattare i caratteri speciali anche qui, dimmelo e aggiungiamo la funzione -->
                    <p><strong>Note:</strong> ${commessa.note || 'Nessuna'}</p>
                </div>
                ${phasesHtml}
                <div class="registrazioni-section">
                    ${registrazioniSummary}
                </div>
            </div>
            <div class="card-actions">
                <button class="button button--warning" data-action="edit" data-id="${commessa.id_commessa}">✏️ Modifica</button>
                <button class="button button--danger" data-action="delete" data-id="${commessa.id_commessa}">🗑️ Elimina</button>
            </div>
        `;

        // ... binding eventi invariato ...
        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.handleDelete(deleteBtn.dataset.id); });
        }
        const editBtn = card.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); this.handleEdit(editBtn.dataset.id); });
        }
        
        // Aggiungiamo il listener per il toggle SOLO se esiste (cioè se siamo admin)
        const toggleInput = card.querySelector('[data-action="toggle-status"]');
        if (toggleInput) {
            toggleInput.addEventListener('change', (e) => { this.handleStatusToggle(e); });
        }

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