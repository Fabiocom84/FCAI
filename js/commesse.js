// js/commesse.js

import { apiFetch } from './api-client.js';
import { authReady } from './auth-guard.js';

const App = {
    state: {
        currentPage: 1,
        totalCount: 0,
        isLoading: false,
        activeStatus: 'In Lavorazione',
        searchTerm: '',
        sortBy: 'data_commessa',
        sortOrder: 'desc',
    },
    
    init() {
        this.dom = {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),
            statusFilters: document.querySelectorAll('.filter-btn'),
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn'),
        };
        this.addEventListeners();
        this.fetchCommesse(true);
    },
    
    addEventListeners() {
        // Unico listener per il pulsante Aggiungi, che chiama la funzione globale
        this.dom.addBtn.addEventListener('click', () => {
            if (typeof window.openNewOrderModal === 'function') {
                window.openNewOrderModal(false); // false = non è in modalità modifica
            } else {
                console.error('Funzione openNewOrderModal non trovata.');
            }
        });

        // Altri listeners (invariati)
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

    async fetchCommesse(isNewQuery = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;
        if (isNewQuery) {
            this.state.currentPage = 1;
            this.dom.grid.innerHTML = ''; // Clear grid for new query
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
            const response = await apiFetch(`/api/commesse-view?${params.toString()}`);
            const data = await response.json();
            
            this.state.totalCount = data.count;
            this.renderCards(data.data);
            this.state.currentPage++;
            
        } catch (error) {
            this.dom.grid.innerHTML = `<p class="error-text">Errore nel caricamento delle commesse.</p>`;
        } finally {
            this.state.isLoading = false;
            this.dom.loader.style.display = 'none';
        }
    },

    renderCards(commesseData) {
        if (commesseData.length === 0 && this.state.currentPage === 1) {
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
    
    createCard(commessa) {
        const card = document.createElement('div');
        card.className = 'commesse-card';
        card.dataset.commessaId = commessa.id_commessa; // Aggiungiamo l'ID qui per trovarlo facilmente

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
                    <span class="status-badge ${statusClass}">${commessa.status_commessa?.nome_status || 'N/D'}</span>
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

        // --- INIZIO BLOCCO MANCANTE ---
        // Questo codice trova i pulsanti appena creati e aggiunge gli event listener
        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Impedisce che il click si propaghi ad altri elementi
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
        // --- FINE BLOCCO MANCANTE ---

        return card;
    },

    handleStatusFilter(clickedBtn) {
        this.dom.statusFilters.forEach(btn => btn.classList.remove('active'));
        clickedBtn.classList.add('active');
        this.state.activeStatus = clickedBtn.dataset.status;
        this.fetchCommesse(true);
    },

    async handleDelete(commessaId) {
        const isConfirmed = await window.showModal({
            title: 'Conferma Eliminazione',
            message: `Sei sicuro di voler eliminare questa commessa? L'azione è irreversibile.`,
            confirmText: 'Elimina',
            cancelText: 'Annulla'
        });

        if (isConfirmed) {
            try {
                const response = await apiFetch(`/api/commesse/${commessaId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Errore del server');
                }
                
                // Remove the card from the view without a full reload
                const cardToRemove = this.dom.grid.querySelector(`[data-id="${commessaId}"]`).closest('.commesse-card');
                if (cardToRemove) {
                    cardToRemove.remove();
                }
                
            } catch (error) {
                window.showModal({
                    title: 'Errore',
                    message: `Impossibile eliminare la commessa: ${error.message}`,
                    confirmText: 'OK'
                });
            }
        }
    },

    handleEdit(commessaId) {
        if (typeof window.openNewOrderModal === 'function') {
            window.openNewOrderModal(true, commessaId); // true = è in modalità modifica
        } else {
            console.error('La funzione openNewOrderModal non è stata trovata.');
            alert('Errore: la funzionalità di modifica non è disponibile.');
        }
    },

    handleSort() {
        const [sortBy, sortOrder] = this.dom.sortSelect.value.split(':');
        this.state.sortBy = sortBy;
        this.state.sortOrder = sortOrder;
        this.fetchCommesse(true);
    },

    handleScroll() {
        if (this.state.isLoading) return;
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        const remainingCommesse = this.state.totalCount - ((this.state.currentPage - 1) * 20);
        
        if (clientHeight + scrollTop >= scrollHeight - 100 && remainingCommesse > 0) {
            this.fetchCommesse(false); // Fetch next page
        }
    }
};

authReady.then((session) => {
    console.log('Promessa di autenticazione mantenuta. Avvio App Commesse per l-utente:', session.user.email);
    App.init();
});

// Rendiamo la funzione di refresh disponibile globalmente
window.refreshCommesseView = () => App.fetchCommesse(true);