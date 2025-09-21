// js/commesse.js

document.addEventListener('DOMContentLoaded', () => {
    
    const App = {
        dom: {
            grid: document.getElementById('commesse-grid'),
            loader: document.getElementById('loader'),
            statusFilters: document.querySelectorAll('.filter-btn'),
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            addBtn: document.getElementById('add-commessa-btn'),
        },
        state: {
            commesse: [],
            currentPage: 1,
            totalCount: 0,
            isLoading: false,
            activeStatus: 'In Lavorazione',
            searchTerm: '',
            sortBy: 'data_commessa',
            sortOrder: 'desc',
        },
        
        init() {
            this.addEventListeners();
            this.fetchCommesse(true); // Initial load with default filters
            
            // Setup for the "Nuova Commessa" modal
            this.dom.addBtn.addEventListener('click', () => {
                if (window.openNewOrderModal) window.openNewOrderModal();
            });
        },
        
        addEventListeners() {
            this.dom.statusFilters.forEach(btn => {
                btn.addEventListener('click', () => this.handleStatusFilter(btn));
            });
            
            // Debounced search
            let searchTimeout;
            this.dom.searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchTerm = this.dom.searchInput.value;
                    this.fetchCommesse(true);
                }, 500); // 500ms delay
            });

            this.dom.sortSelect.addEventListener('change', () => this.handleSort());
            
            // Infinite scroll / lazy loading
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

            const params = new URLSearchParams({
                page: this.state.currentPage,
                limit: 20,
                status: this.state.activeStatus,
                search: this.state.searchTerm,
                sortBy: this.state.sortBy,
                sortOrder: this.state.sortOrder,
            });

            try {
                const response = await window.apiFetch(`/api/commesse-view?${params.toString()}`);
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

            const statusClass = `status-${commessa.status_commessa?.nome_status?.toLowerCase().replace(' ', '-') || 'default'}`;

            const registrazioniSummary = commessa.registrazioni.length > 0
                ? `<p><strong>Registrazioni:</strong> ${commessa.registrazioni.length} 
                   | <a href="gestione.html?view=registrazioni&filter_id_commessa_fk=${commessa.id_commessa}" target="_blank">Visualizza Dettagli</a></p>`
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
                        <p><strong>Impianto:</strong> ${commessa.impianto || 'N/D'}</p>
                        <p><strong>VO:</strong> ${commessa.vo || 'N/D'} | <strong>Rif. Tecnico:</strong> ${commessa.riferimento_tecnico || 'N/D'}</p>
                    </div>
                    <div class="registrazioni-section">
                        ${registrazioniSummary}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="button button--warning" data-id="${commessa.id_commessa}">✏️ Modifica</button>
                    <button class="button button--danger" data-id="${commessa.id_commessa}">🗑️ Elimina</button>
                </div>
            `;
            // Add event listeners for edit/delete here
            return card;
        },

        handleStatusFilter(clickedBtn) {
            this.dom.statusFilters.forEach(btn => btn.classList.remove('active'));
            clickedBtn.classList.add('active');
            this.state.activeStatus = clickedBtn.dataset.status;
            this.fetchCommesse(true);
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

    App.init();
});