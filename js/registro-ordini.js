import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

const App = {
    data: {
        orders: [],
        currentOrder: null
    },
    
    init: async function() {
        console.log("🚀 Registro Ordini Init");
        this.bindEvents();
        await this.loadOrders();
    },

    bindEvents: function() {
        // Filtro Reparto
        document.getElementById('repartoFilter').addEventListener('change', (e) => this.filterOrders());
        // Filtro Ricerca
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterOrders());
        // Bottone Salva
        document.getElementById('btnCloseOrder').addEventListener('click', () => this.saveOrder());
    },

    loadOrders: async function() {
        const listContainer = document.getElementById('ordersList');
        try {
            const res = await apiFetch('/api/produzione/op-aperti');
            this.data.orders = await res.json();
            
            // Popola Select Reparti
            this.populateRepartoFilter();
            
            this.renderList(this.data.orders);
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Errore caricamento dati</div>';
        }
    },

    populateRepartoFilter: function() {
        const select = document.getElementById('repartoFilter');
        // Estrai reparti unici
        const reparti = [...new Set(this.data.orders.map(o => o.ruoli?.nome_ruolo || 'N/D'))].sort();
        
        select.innerHTML = '<option value="">Tutti i Reparti</option>';
        reparti.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            select.appendChild(opt);
        });
    },

    renderList: function(ordersToRender) {
        const container = document.getElementById('ordersList');
        container.innerHTML = '';

        if(ordersToRender.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Nessun ordine trovato.</div>';
            return;
        }

        ordersToRender.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';
            card.dataset.id = order.id;
            
            // Stile bordo per reparto (Semplice hash colore o random)
            const repName = order.ruoli?.nome_ruolo || 'N/D';
            
            card.innerHTML = `
                <div class="card-top">
                    <span class="op-number">OP: ${order.numero_op}</span>
                    <span class="card-date">${order.data_ricezione || '-'}</span>
                </div>
                <div class="card-title">${order.anagrafica_articoli?.codice_articolo}</div>
                <div class="card-desc">${order.anagrafica_articoli?.descrizione || ''}</div>
                <div class="card-meta">
                    <span class="badge-reparto">${repName}</span>
                    <span>Q.tà: <strong>${order.qta_richiesta}</strong></span>
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
                (o.commesse?.vo || '').toLowerCase().includes(search)
            );
            const matchRep = rep === "" || (o.ruoli?.nome_ruolo === rep);
            return matchSearch && matchRep;
        });

        this.renderList(filtered);
    },

    selectOrder: async function(order, cardElement) {
        this.data.currentOrder = order;

        // UI Active Class
        document.querySelectorAll('.order-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');

        // Show Pane
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('detailContent').style.display = 'block';

        // Fill Data
        document.getElementById('detOP').textContent = `OP: ${order.numero_op}`;
        document.getElementById('detReparto').textContent = order.ruoli?.nome_ruolo || 'N/D';
        document.getElementById('detArticolo').textContent = order.anagrafica_articoli?.codice_articolo;
        document.getElementById('detDescrizione').textContent = order.anagrafica_articoli?.descrizione;
        
        const commessaTxt = order.commesse ? 
            `${order.commesse.vo || '???'} - ${order.commesse.clienti?.ragione_sociale || ''} (${order.commesse.impianto || ''})` : 
            'Commessa non assegnata';
        document.getElementById('detCommessa').textContent = commessaTxt;

        // Pre-fill Inputs
        document.getElementById('inputQta').value = order.qta_richiesta;
        document.getElementById('inputOre').value = '';
        document.getElementById('inputNote').value = '';

        // Load Stats
        this.loadStats(order);
    },

    loadStats: async function(order) {
        // Reset Visuale
        document.getElementById('statMediana').textContent = 'Calcolo...';
        document.getElementById('distributionChart').innerHTML = '';
        
        try {
            // 1. Statistiche Articolo (Mediana)
            if(order.id_articolo) {
                const resArt = await apiFetch(`/api/produzione/stats-articolo/${order.id_articolo}`);
                const dataArt = await resArt.json();
                
                if(dataArt.count > 0) {
                    // La mediana arriva in MINUTI dal backend. Convertiamo in Ore.
                    const oreMediane = (dataArt.mediana / 60).toFixed(1);
                    document.getElementById('statMediana').textContent = `${oreMediane}h`;
                } else {
                    document.getElementById('statMediana').textContent = 'N/D (Nuovo)';
                }
            }

            // 2. Statistiche Commessa
            if(order.id_commessa) {
                const resCom = await apiFetch(`/api/produzione/stats-commessa/${order.id_commessa}`);
                const dataCom = await resCom.json();
                
                const oreTot = (dataCom.totale_minuti / 60).toFixed(1);
                document.getElementById('statCommessaTot').textContent = `${oreTot}h`;
                
                this.renderChart(dataCom.distribuzione, dataCom.totale_minuti);
            }

        } catch(e) {
            console.warn("Stats error", e);
        }
    },

    renderChart: function(dist, totalMin) {
        const chart = document.getElementById('distributionChart');
        const legend = document.getElementById('distributionLegend');
        chart.innerHTML = '';
        legend.innerHTML = '';
        
        if(totalMin === 0) return;

        // Colori fissi per reparti comuni (o random)
        const colors = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6'];
        let i = 0;

        for (const [ruolo, minuti] of Object.entries(dist)) {
            const perc = (minuti / totalMin) * 100;
            const color = colors[i % colors.length];
            
            // Barra
            const bar = document.createElement('div');
            bar.className = 'bar-segment';
            bar.style.width = `${perc}%`;
            bar.style.backgroundColor = color;
            bar.title = `${ruolo}: ${(minuti/60).toFixed(1)}h`;
            chart.appendChild(bar);

            // Legenda
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<div class="legend-dot" style="background:${color}"></div> ${ruolo} (${Math.round(perc)}%)`;
            legend.appendChild(item);
            
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
            alert("Inserisci Ore e Quantità.");
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
                tempo_impiegato: minuti, // Salva in minuti per consistenza DB
                data_fine: new Date().toISOString(),
                note: note
            };

            const res = await apiFetch(`/api/produzione/op/${order.id}/chiudi`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if(!res.ok) throw new Error("Errore API");

            showSuccessFeedbackModal("Ordine Chiuso", `OP ${order.numero_op} registrato correttamente.`);
            
            // Rimuovi dalla lista locale e resetta view
            this.data.orders = this.data.orders.filter(o => o.id !== order.id);
            this.filterOrders(); // Re-render lista
            
            // Reset Detail Pane
            document.getElementById('detailContent').style.display = 'none';
            document.getElementById('emptyState').style.display = 'flex';

        } catch (e) {
            alert("Errore salvataggio: " + e.message);
        } finally {
            btn.textContent = "✅ CONFERMA E CHIUDI";
            btn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());