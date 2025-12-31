import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

const App = {
    data: {
        allOrders: [],
        filteredOrders: [],
        currentOrder: null
    },
    
    init: async function() {
        this.bindEvents();
        // Carica tutti per default (o aperti, come preferisci)
        await this.loadOrders('aperti'); 
    },

    bindEvents: function() {
        // Radio Status
        document.querySelectorAll('input[name="status"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.loadOrders(e.target.value));
        });

        // Filtri
        document.getElementById('commessaFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('articoloFilter').addEventListener('input', () => this.applyFilters());
        
        // Reset
        document.getElementById('resetFiltersBtn').addEventListener('click', () => this.resetFilters());

        // Salva
        document.getElementById('btnCloseOrder').addEventListener('click', () => this.saveOrder());
    },

    resetFilters: function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('commessaFilter').value = '';
        document.getElementById('articoloFilter').value = '';
        this.applyFilters();
    },

    loadOrders: async function(status = 'aperti') {
        const listContainer = document.getElementById('ordersList');
        listContainer.innerHTML = '<div style="padding:20px; text-align:center;">Caricamento...</div>';
        
        // Svuota dettaglio se cambio stato massivo
        document.getElementById('detailContent').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        
        try {
            const res = await apiFetch(`/api/produzione/ordini?status=${status}`);
            this.data.allOrders = await res.json();
            
            this.populateCommessaFilter();
            this.applyFilters();
            
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div style="color:red; padding:20px;">Errore caricamento.</div>';
        }
    },

    populateCommessaFilter: function() {
        const select = document.getElementById('commessaFilter');
        const uniqueCommesse = new Set();
        
        this.data.allOrders.forEach(o => {
            if(o.commesse && o.commesse.vo) {
                const label = `${o.commesse.vo} - ${o.commesse.clienti?.ragione_sociale || ''}`;
                uniqueCommesse.add(label);
            }
        });

        const sorted = Array.from(uniqueCommesse).sort();
        const oldVal = select.value;
        select.innerHTML = '<option value="">Tutte le Commesse</option>';
        
        sorted.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            select.appendChild(opt);
        });
        
        if (sorted.includes(oldVal)) select.value = oldVal;
    },

    applyFilters: function() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const commessaVal = document.getElementById('commessaFilter').value.toLowerCase();
        const artVal = document.getElementById('articoloFilter').value.toLowerCase();

        this.data.filteredOrders = this.data.allOrders.filter(o => {
            const codice = (o.anagrafica_articoli?.codice_articolo || '').toLowerCase();
            const desc = (o.anagrafica_articoli?.descrizione || '').toLowerCase();
            const op = o.numero_op.toLowerCase();

            // Match Search
            const txt = op + codice + desc;
            const matchSearch = txt.includes(search);

            // Match Commessa
            let matchComm = true;
            if (commessaVal) {
                const label = `${o.commesse?.vo || ''} - ${o.commesse?.clienti?.ragione_sociale || ''}`.toLowerCase();
                matchComm = label === commessaVal;
            }

            // Match Articolo
            const matchArt = !artVal || codice.includes(artVal);

            return matchSearch && matchComm && matchArt;
        });

        this.renderGroupedList();
    },

    renderGroupedList: function() {
        const container = document.getElementById('ordersList');
        container.innerHTML = '';

        if (this.data.filteredOrders.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">Nessun ordine trovato.</div>';
            return;
        }

        const groups = {};
        this.data.filteredOrders.forEach(order => {
            const op = order.numero_op;
            if (!groups[op]) {
                groups[op] = {
                    opNumber: op,
                    commessa: order.commesse ? `${order.commesse.vo} (${order.commesse.clienti?.ragione_sociale || '?'})` : 'N/D',
                    items: []
                };
            }
            groups[op].items.push(order);
        });

        // Ordinamento Decrescente OP
        const sortedOpKeys = Object.keys(groups).sort((a, b) => {
            return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
        });

        sortedOpKeys.forEach(opKey => {
            const group = groups[opKey];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'op-group';
            groupDiv.innerHTML = `
                <div class="op-group-header">
                    <div class="op-title">OP: ${group.opNumber}</div>
                    <div class="op-commessa">${group.commessa}</div>
                </div>
            `;

            group.items.forEach(order => {
                const row = document.createElement('div');
                row.className = 'compact-row';
                row.dataset.id = order.id;
                
                const fase = order.fasi_produzione?.nome_fase || 'N/D';
                const desc = order.anagrafica_articoli?.descrizione || '';
                
                // Se l'ordine è chiuso (ha data invio), mettiamo un indicatore visivo
                const statusIcon = order.data_invio ? '✅' : '';

                row.innerHTML = `
                    <div class="col-code">${order.anagrafica_articoli?.codice_articolo || '?'}</div>
                    <div class="col-desc" title="${desc}">${desc}</div>
                    <div style="font-size:0.75em; background:#eee; padding:2px 6px; border-radius:4px; margin-right:10px;">${fase}</div>
                    <div class="col-qta">${statusIcon} Q: ${order.qta_richiesta}</div>
                `;

                row.addEventListener('click', () => this.selectOrder(order, row));
                groupDiv.appendChild(row);
            });

            container.appendChild(groupDiv);
        });
    },

    selectOrder: async function(order, rowElement) {
        this.data.currentOrder = order;

        document.querySelectorAll('.compact-row').forEach(el => el.classList.remove('selected'));
        rowElement.classList.add('selected');

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('detailContent').style.display = 'block';

        // Header Dettaglio
        document.getElementById('detOP').textContent = `OP: ${order.numero_op}`;
        document.getElementById('detArticolo').textContent = order.anagrafica_articoli?.codice_articolo;
        document.getElementById('detDescrizione').textContent = order.anagrafica_articoli?.descrizione;
        
        const commTxt = order.commesse ? 
            `${order.commesse.vo} - ${order.commesse.clienti?.ragione_sociale}` : 'N/D';
        document.getElementById('detCommessa').textContent = commTxt;

        // --- LOGICA DI POPOLAMENTO CAMPI (MODIFICATA) ---
        const btn = document.getElementById('btnCloseOrder');
        
        // Verifica se l'ordine è CHIUSO (ha dati salvati)
        // Usiamo data_invio come flag di chiusura, oppure controlliamo se tempo_impiegato > 0
        const isClosed = (order.data_invio !== null); 

        if (isClosed) {
            // ORDINE CHIUSO: Mostra i dati salvati
            document.getElementById('inputQta').value = order.qta_prodotta; // Quelli fatti
            
            // Converti minuti DB in ore decimali per l'input
            let oreSalvato = 0;
            if (order.tempo_impiegato) {
                oreSalvato = parseFloat((order.tempo_impiegato / 60).toFixed(2));
            }
            document.getElementById('inputOre').value = oreSalvato > 0 ? oreSalvato : '';
            
            document.getElementById('inputNote').value = order.note || '';
            
            // Cambia testo bottone
            btn.textContent = "🔄 AGGIORNA DATI";
            btn.style.backgroundColor = "#f39c12"; // Arancione per modifica
        } else {
            // ORDINE APERTO: Default
            document.getElementById('inputQta').value = order.qta_richiesta; // Suggerisci la richiesta
            document.getElementById('inputOre').value = '';
            document.getElementById('inputNote').value = '';
            
            // Cambia testo bottone
            btn.textContent = "✅ SALVA E CHIUDI";
            btn.style.backgroundColor = "#27ae60"; // Verde per salvataggio
        }

        document.getElementById('inputOre').focus();

        this.loadStats(order);
    },

    loadStats: async function(order) {
        document.getElementById('statMediana').textContent = '...';
        document.getElementById('statCommessaTot').textContent = '...';
        document.getElementById('distributionChart').innerHTML = '';

        try {
            if(order.id_articolo) {
                const res = await apiFetch(`/api/produzione/stats-articolo/${order.id_articolo}`);
                const d = await res.json();
                if(d.count > 0) {
                    const ore = (d.mediana / 60).toFixed(1);
                    document.getElementById('statMediana').textContent = `${ore}h (${d.count} ordini)`;
                } else {
                    document.getElementById('statMediana').textContent = 'N/D';
                }
            }
            if(order.id_commessa) {
                const res = await apiFetch(`/api/produzione/stats-commessa/${order.id_commessa}`);
                const d = await res.json();
                const ore = (d.totale_minuti / 60).toFixed(1);
                document.getElementById('statCommessaTot').textContent = `${ore}h`;
                
                const chart = document.getElementById('distributionChart');
                const colors = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6'];
                let i = 0;
                for (const [k, v] of Object.entries(d.distribuzione)) {
                    const pct = (v / d.totale_minuti) * 100;
                    const bar = document.createElement('div');
                    bar.className = 'bar-segment';
                    bar.style.width = `${pct}%`;
                    bar.style.backgroundColor = colors[i % colors.length];
                    bar.title = `${k}: ${(v/60).toFixed(1)}h`;
                    chart.appendChild(bar);
                    i++;
                }
            }
        } catch(e) { console.warn(e); }
    },

    saveOrder: async function() {
        const order = this.data.currentOrder;
        if(!order) return;

        const oreStr = document.getElementById('inputOre').value;
        const qtaStr = document.getElementById('inputQta').value;
        const note = document.getElementById('inputNote').value;

        if(!oreStr || !qtaStr) {
            showModal({ title: "Attenzione", message: "Inserisci Ore e Quantità." });
            return;
        }

        const btn = document.getElementById('btnCloseOrder');
        btn.textContent = "Salvataggio...";
        btn.disabled = true;

        try {
            const payload = {
                qta_prodotta: parseInt(qtaStr),
                tempo_impiegato: Math.round(parseFloat(oreStr.replace(',','.')) * 60),
                data_fine: new Date().toISOString(),
                note: note
            };

            const res = await apiFetch(`/api/produzione/op/${order.id}/chiudi`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if(!res.ok) throw new Error("Errore API");

            // Aggiorna l'oggetto locale in memoria per riflettere le modifiche senza ricaricare tutto
            order.qta_prodotta = payload.qta_prodotta;
            order.tempo_impiegato = payload.tempo_impiegato;
            order.note = payload.note;
            order.data_invio = payload.data_fine; // Marca come chiuso

            showSuccessFeedbackModal("Registrato", `OP ${order.numero_op} aggiornato.`);
            
            // Gestione Refresh Lista
            const currentStatus = document.querySelector('input[name="status"]:checked').value;
            
            // Se eravamo su "Aperti" e ora l'abbiamo chiuso, rimuoviamolo dalla lista
            if(currentStatus === 'aperti') {
                this.data.allOrders = this.data.allOrders.filter(o => o.id !== order.id);
                // Pulisci Dettaglio
                document.getElementById('detailContent').style.display = 'none';
                document.getElementById('emptyState').style.display = 'block';
            } else {
                // Se eravamo su "Tutti" o "Chiusi", rimaniamo lì e aggiorniamo solo il colore del bottone
                // Ricarichiamo la lista per aggiornare eventuali icone di stato
            }
            
            this.applyFilters(); // Rerender lista

        } catch(e) {
            showModal({ title: "Errore", message: e.message });
        } finally {
            // Ripristina testo in base allo stato attuale dell'ordine in memoria
            if (order.data_invio) {
                btn.textContent = "🔄 AGGIORNA DATI";
                btn.style.backgroundColor = "#f39c12";
            } else {
                btn.textContent = "✅ SALVA E CHIUDI";
                btn.style.backgroundColor = "#27ae60";
            }
            btn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());