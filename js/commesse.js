// js/commesse.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const App = {
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        activeStatus: 'In Lavorazione', // Default a "Tutte" come discusso
        searchTerm: '',
        sortBy: 'data_commessa',
        sortOrder: 'desc',
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
            // Carica tutti gli stati possibili e li salva nello stato dell'app
            const response = await apiFetch('/api/simple/status_commessa');
            this.state.allStatuses = await response.json();
        } catch (error) {
            console.error("Errore nel caricamento degli stati delle commesse:", error);
            this.state.allStatuses = []; // Imposta un array vuoto in caso di errore
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
        const registrazioniSummary = commessa.registrazioni.length > 0
            ? `<p><strong>Registrazioni:</strong> ${commessa.registrazioni.length} 
                | <a href="gestione.html?view=registrazioni&filterKey=id_commessa_fk&filterValue=${commessa.id_commessa}" target="_blank">Visualizza Dettagli</a></p>`
            : `<p><strong>Registrazioni:</strong> 0</p>`;

        card.innerHTML = `
            <div class="card-image" style="background-image: url('${commessa.immagine || 'img/placeholder.png'}')">
                ${!commessa.immagine ? 'Nessuna Immagine' : ''}
            </div>
            <div class="card-details">
                <div class="card-header">
                    <h3>${commessa.clienti?.ragione_sociale || 'Cliente non definito'}</h3>
                    <div class="status-and-toggle">
                        <span class="status-badge ${statusClass}">${commessa.status_commessa?.nome_status || 'N/D'}</span>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   data-action="toggle-status" 
                                   data-id="${commessa.id_commessa}" 
                                   ${commessa.status_commessa?.nome_status === 'Completato' ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="card-info">
                    <p><strong>Impianto:</strong> ${commessa.impianto || 'N/D'} | <strong>Modello:</strong> ${commessa.modelli?.nome_modello || 'N/D'}</p>
                    <p><strong>Luogo:</strong> ${commessa.paese || 'N/D'} (${commessa.provincia || 'N/D'})</p>
                    <p><strong>Dettagli:</strong> VO: ${commessa.vo || 'N/D'} | Matricola: ${commessa.matricola || 'N/D'} | Anno: ${commessa.anno || 'N/D'}</p>
                    <p><strong>Rif. Tecnico:</strong> ${commessa.riferimento_tecnico || 'N/D'}</p>
                    <p><strong>Data:</strong> ${formattedDate}</p>
                    <p><strong>Note:</strong> ${commessa.note || 'Nessuna'}</p>
                </div>
                <div class="registrazioni-section">
                    ${registrazioniSummary}
                </div>
            </div>
            <div class="card-actions">
                <button class="button button--warning" data-action="edit" data-id="${commessa.id_commessa}">✏️ Modifica</button>
                <button class="button button--danger" data-action="delete" data-id="${commessa.id_commessa}">🗑️ Elimina</button>
            </div>
        `;

        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDelete(deleteBtn.dataset.id);
            });
        }

        const editBtn = card.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleEdit(editBtn.dataset.id); 
            });
        }

        const toggleInput = card.querySelector('[data-action="toggle-status"]');
        if (toggleInput) {
            toggleInput.addEventListener('change', (e) => {
                this.handleStatusToggle(e);
            });
        }

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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Pagina pronta e guardia passata. Avvio App Commesse.');
    App.init();
});

window.refreshCommesseView = () => App.fetchCommesse(true);