import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

const App = {
    data: {
        orders: [],
        currentOrder: null
    },
    
    init: async function() {
        this.bindEvents();
        await this.loadOrders();
    },

    bindEvents: function() {
        document.getElementById('repartoFilter').addEventListener('change', () => this.filterOrders());
        document.getElementById('searchInput').addEventListener('input', () => this.filterOrders());
        document.getElementById('btnCloseOrder').addEventListener('click', () => this.saveOrder());
        
        // NUOVO: Listener Tasto Reset
        document.getElementById('resetFiltersBtn').addEventListener('click', () => this.resetFilters());
    },

    // Funzione Reset Filtri
    resetFilters: function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('repartoFilter').value = '';
        this.filterOrders(); // Ricarica lista completa
    },

    loadOrders: async function() {
        const listContainer = document.getElementById('ordersList');
        try {
            const res = await apiFetch('/api/produzione/op-aperti');
            this.data.orders = await res.json();
            
            this.populateRepartoFilter();
            this.renderList(this.data.orders);
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Errore caricamento dati</div>';
        }
    },

    populateRepartoFilter: function() {
        const select = document.getElementById('repartoFilter');
        const reparti = [...new Set(this.data.orders.map(o => o.ruoli?.nome_ruolo || 'N/D'))].sort();
        
        // Salva selezione corrente se c'è
        const currentVal = select.value;
        
        select.innerHTML = '<option value="">Tutti i Reparti</option>';
        reparti.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            select.appendChild(opt);
        });
        
        // Ripristina selezione (utile se ricarichi dati senza reset)
        if (reparti.includes(currentVal)) select.value = currentVal;
    },

    renderList: function(ordersToRender) {
        const container = document.getElementById('ordersList');
        container.innerHTML = '';

        if(ordersToRender.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">Nessun ordine trovato.</div>';
            return;
        }

        ordersToRender.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';
            card.dataset.id = order.id;
            
            const repName = order.ruoli?.nome_ruolo || 'N/D';
            // Colore bordo laterale basato sul reparto (semplice switch)
            let borderColor = '#ccc';
            if(repName.toLowerCase().includes('montaggio')) borderColor = '#e67e22'; // Arancio
            if(repName.toLowerCase().includes('cablaggio')) borderColor = '#9b59b6'; // Viola
            if(repName.toLowerCase().includes('collaudo')) borderColor = '#2ecc71'; // Verde
            card.style.borderLeftColor = borderColor;

            card.innerHTML = `
                <div class="card-top">
                    <span class="op-number">OP: ${order.numero_op}</span>
                    <span class="card-date">${order.data_ricezione || '-'}</span>
                </div>
                <div class="card-title">${order.anagrafica_articoli?.codice_articolo}</div>
                <div class="card-desc">${order.anagrafica_articoli?.descrizione || ''}</div>
                <div class="card-meta">
                    <span class="badge-reparto" style="color:${borderColor === '#ccc' ? '#555' : borderColor}">${repName}</span>
                    <span class="qta-badge">Q.tà: ${order.qta_richiesta}</span>
                </div>
            `;

            card.addEventListener('click', () => this.selectOrder(order, card));
            container.appendChild(card);
        });
    },

    filterOrders: function() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const rep = document.getElementById('repartoFilter').value;

        const filtered = this.data.orders.filter(o => {
            const matchSearch = (
                o.numero_op.toLowerCase().includes(search) ||
                (o.anagrafica_articoli?.codice_articolo || '').includes(search) ||
                (o.commesse?.vo || '').toLowerCase().includes(search) ||
                (o.anagrafica_articoli?.descrizione || '').toLowerCase().includes(search)
            );
            const matchRep = rep === "" || (o.ruoli?.nome_ruolo === rep);
            return matchSearch && matchRep;
        });

        this.renderList(filtered);
    },

    selectOrder: async function(order, cardElement) {
        this.data.currentOrder = order;

        document.querySelectorAll('.order-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('detailContent').style.display = 'block';

        // Fill Data
        document.getElementById('detOP').textContent = `OP: ${order.numero_op}`;
        const repName = order.ruoli?.nome_ruolo || 'N/D';
        document.getElementById('detReparto').textContent = repName;
        
        document.getElementById('detArticolo').textContent = order.anagrafica_articoli?.codice_articolo;
        document.getElementById('detDescrizione').textContent = order.anagrafica_articoli?.descrizione;
        
        const commessaTxt = order.commesse ? 
            `${order.commesse.vo || '???'} - ${order.commesse.clienti?.ragione_sociale || ''} (${order.commesse.impianto || ''})` : 
            'Commessa non assegnata';
        document.getElementById('detCommessa').textContent = commessaTxt;

        // Pre-fill
        document.getElementById('inputQta').value = order.qta_richiesta;
        document.getElementById('inputOre').value = '';
        document.getElementById('inputNote').value = '';

        // Focus primo input per velocità
        document.getElementById('inputOre').focus();

        this.loadStats(order);
    },

    loadStats: async function(order) {
        document.getElementById('statMediana').textContent = '...';
        document.getElementById('statCommessaTot').textContent = '...';
        document.getElementById('distributionChart').innerHTML = '';
        
        try {
            if(order.id_articolo) {
                const resArt = await apiFetch(`/api/produzione/stats-articolo/${order.id_articolo}`);
                const dataArt = await resArt.json();
                if(dataArt.count > 0) {
                    const oreMediane = (dataArt.mediana / 60).toFixed(1);
                    document.getElementById('statMediana').textContent = `${oreMediane}h (${dataArt.count} ordini)`;
                } else {
                    document.getElementById('statMediana').textContent = 'N/D (Nuovo)';
                }
            }

            if(order.id_commessa) {
                const resCom = await apiFetch(`/api/produzione/stats-commessa/${order.id_commessa}`);
                const dataCom = await resCom.json();
                const oreTot = (dataCom.totale_minuti / 60).toFixed(1);
                document.getElementById('statCommessaTot').textContent = `${oreTot}h`;
                this.renderChart(dataCom.distribuzione, dataCom.totale_minuti);
            }
        } catch(e) { console.warn(e); }
    },

    renderChart: function(dist, totalMin) {
        const chart = document.getElementById('distributionChart');
        chart.innerHTML = '';
        if(totalMin === 0) return;

        const colors = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6'];
        let i = 0;
        for (const [ruolo, minuti] of Object.entries(dist)) {
            const perc = (minuti / totalMin) * 100;
            const bar = document.createElement('div');
            bar.className = 'bar-segment';
            bar.style.width = `${perc}%`;
            bar.style.backgroundColor = colors[i % colors.length];
            bar.title = `${ruolo}: ${(minuti/60).toFixed(1)}h`;
            chart.appendChild(bar);
            i++;
        }
    },

    saveOrder: async function() {
        const order = this.data.currentOrder;
        if(!order) return;

        const oreStr = document.getElementById('inputOre').value;
        const qtaStr = document.getElementById('inputQta').value;
        const note = document.getElementById('inputNote').value;

        if(!oreStr || !qtaStr) {
            showModal({ title: "Dati Mancanti", message: "Inserisci Ore lavorate e Quantità prodotta." });
            return;
        }

        const ore = parseFloat(oreStr.replace(',', '.'));
        const qta = parseInt(qtaStr);
        const minuti = Math.round(ore * 60);

        const btn = document.getElementById('btnCloseOrder');
        btn.textContent = "Salvataggio...";
        btn.disabled = true;

        try {
            const payload = {
                qta_prodotta: qta,
                tempo_impiegato: minuti,
                data_fine: new Date().toISOString(),
                note: note
            };

            const res = await apiFetch(`/api/produzione/op/${order.id}/chiudi`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if(!res.ok) throw new Error("Errore API");

            showSuccessFeedbackModal("Ordine Chiuso", `OP ${order.numero_op} registrato.`);
            
            // Rimuovi dalla lista locale e aggiorna UI
            this.data.orders = this.data.orders.filter(o => o.id !== order.id);
            this.filterOrders(); 
            
            // Pulisci Dettaglio
            document.getElementById('detailContent').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';

        } catch (e) {
            showModal({ title: "Errore", message: "Impossibile salvare: " + e.message });
        } finally {
            btn.textContent = "✅ SALVA E CHIUDI";
            btn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());