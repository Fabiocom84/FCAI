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
        
        // NUOVO: Filtro Articolo
        document.getElementById('articoloFilter').addEventListener('input', () => this.applyFilters());
        
        // Reset
        document.getElementById('resetFiltersBtn').addEventListener('click', () => this.resetFilters());

        // Salva
        document.getElementById('btnCloseOrder').addEventListener('click', () => this.saveOrder());
    },

    resetFilters: function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('commessaFilter').value = '';
        document.getElementById('articoloFilter').value = ''; // Reset Articolo
        this.applyFilters();
    },

    loadOrders: async function(status = 'aperti') {
        const listContainer = document.getElementById('ordersList');
        listContainer.innerHTML = '<div style="padding:20px; text-align:center;">Caricamento...</div>';
        
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
        const artVal = document.getElementById('articoloFilter').value.toLowerCase(); // Nuovo Valore

        this.data.filteredOrders = this.data.allOrders.filter(o => {
            const codice = (o.anagrafica_articoli?.codice_articolo || '').toLowerCase();
            const desc = (o.anagrafica_articoli?.descrizione || '').toLowerCase();
            const op = o.numero_op.toLowerCase();

            // Match Search (Generica)
            const txt = op + codice + desc;
            const matchSearch = txt.includes(search);

            // Match Commessa
            let matchComm = true;
            if (commessaVal) {
                const label = `${o.commesse?.vo || ''} - ${o.commesse?.clienti?.ragione_sociale || ''}`.toLowerCase();
                matchComm = label === commessaVal;
            }

            // Match Articolo (Specifico)
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

        Object.values(groups).forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'op-group';

            const header = document.createElement('div');
            header.className = 'op-group-header';
            header.innerHTML = `
                <div class="op-title">OP: ${group.opNumber}</div>
                <div class="op-commessa">${group.commessa}</div>
            `;
            groupDiv.appendChild(header);

            group.items.forEach(order => {
                const row = document.createElement('div');
                row.className = 'compact-row';
                row.dataset.id = order.id;
                
                const desc = order.anagrafica_articoli?.descrizione || '';
                
                row.innerHTML = `
                    <div class="col-code">${order.anagrafica_articoli?.codice_articolo || '?'}</div>
                    <div class="col-desc" title="${desc}">${desc}</div>
                    <div class="col-qta">Q: ${order.qta_richiesta}</div>
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

        document.getElementById('detOP').textContent = `OP: ${order.numero_op}`;
        document.getElementById('detArticolo').textContent = order.anagrafica_articoli?.codice_articolo;
        document.getElementById('detDescrizione').textContent = order.anagrafica_articoli?.descrizione;
        
        const commTxt = order.commesse ? 
            `${order.commesse.vo} - ${order.commesse.clienti?.ragione_sociale}` : 'N/D';
        document.getElementById('detCommessa').textContent = commTxt;

        document.getElementById('inputQta').value = order.qta_richiesta;
        document.getElementById('inputOre').value = '';
        document.getElementById('inputNote').value = '';
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

            showSuccessFeedbackModal("Registrato", `OP ${order.numero_op} salvato.`);
            
            const currentStatus = document.querySelector('input[name="status"]:checked').value;
            if(currentStatus === 'aperti') {
                this.data.allOrders = this.data.allOrders.filter(o => o.id !== order.id);
            }
            this.applyFilters(); 

            document.getElementById('detailContent').style.display = 'none';
            document.getElementById('emptyState').style.display = 'flex';

        } catch(e) {
            showModal({ title: "Errore", message: e.message });
        } finally {
            btn.textContent = "✅ SALVA E CHIUDI";
            btn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());