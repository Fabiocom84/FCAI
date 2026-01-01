// js/dashboard.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const Dashboard = {
    state: {
        rawData: [],
        filteredData: [],
        mode: 'inbox', // 'inbox' (da validare) | 'archive' (storico)
        grouping: 'commessa', // commessa | macro | lavorazione | dipendente
        filters: {
            commesse: new Set(),
            dipendenti: new Set()
        },
        charts: {
            dist: null,
            time: null
        }
    },

    dom: {
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),
        btnInbox: document.getElementById('btnModeInbox'),
        btnArchive: document.getElementById('btnModeArchive'),
        
        radioGroup: document.querySelectorAll('input[name="grouping"]'),
        
        listCommesse: document.getElementById('listFilterCommesse'),
        listDipendenti: document.getElementById('listFilterDipendenti'),
        countCommesse: document.getElementById('countCommesse'),
        countDipendenti: document.getElementById('countDipendenti'),
        
        selectionSummary: document.getElementById('selectionSummary'),
        btnContabilizza: document.getElementById('btnContabilizza'),
        
        // Viste
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),
        
        // KPI
        kpiTotal: document.getElementById('kpiTotalHours'),
        kpiPending: document.getElementById('kpiPending'),
        kpiDone: document.getElementById('kpiDone'),
        
        // Charts
        canvasDist: document.getElementById('chartDistribution'),
        canvasTimeline: document.getElementById('chartTimeline'),
        
        // Grid
        gridContainer: document.getElementById('dataGridContainer'),
        detailSearch: document.getElementById('detailSearch'),
        btnExpandAll: document.getElementById('btnExpandAll'),
        btnCollapseAll: document.getElementById('btnCollapseAll')
    },

    initDates: function() {
        // NON impostiamo date di default. 
        // Lasciamo vuoto per indicare "Tutto lo storico" (comportamento richiesto).
        this.dom.dateStart.value = '';
        this.dom.dateEnd.value = '';
    },

    initDates: function() {
        // Default: Mese corrente
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        this.dom.dateStart.valueAsDate = firstDay;
        this.dom.dateEnd.valueAsDate = lastDay;
    },

    addListeners: function() {
        // 1. Refresh & Mode
        this.dom.btnRefresh.addEventListener('click', () => this.fetchData());
        
        this.dom.btnInbox.addEventListener('click', () => this.setMode('inbox'));
        this.dom.btnArchive.addEventListener('click', () => this.setMode('archive'));

        // 2. Raggruppamento
        this.dom.radioGroup.forEach(r => {
            r.addEventListener('change', (e) => {
                this.state.grouping = e.target.value;
                this.renderAll();
            });
        });

        // 3. Tab Switching
        this.dom.viewTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewTabs.forEach(b => b.classList.remove('active'));
                this.dom.views.forEach(v => v.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.target).classList.add('active');
            });
        });

        // 4. Grid Actions
        this.dom.btnExpandAll.addEventListener('click', () => this.toggleAllGroups(true));
        this.dom.btnCollapseAll.addEventListener('click', () => this.toggleAllGroups(false));
        this.dom.detailSearch.addEventListener('input', (e) => this.filterGridLocal(e.target.value));
        
        // 5. Contabilizza
        this.dom.btnContabilizza.addEventListener('click', () => this.contabilizzaSelection());
    },

    setMode: function(mode) {
        this.state.mode = mode;
        this.dom.btnInbox.classList.toggle('active', mode === 'inbox');
        this.dom.btnArchive.classList.toggle('active', mode === 'archive');
        
        // Reset filtri manuali quando cambio modalità
        this.state.filters.commesse.clear();
        this.state.filters.dipendenti.clear();
        
        this.fetchData();
    },

    // --- DATA FETCHING ---
    fetchData: async function() {
        const btn = this.dom.btnRefresh;
        const originalIcon = btn.innerHTML; 
        btn.innerHTML = "⏳"; 
        btn.disabled = true;

        try {
            const params = new URLSearchParams();
            
            // 1. DATE: Inviamo i parametri SOLO se compilati dall'utente.
            //    Se vuoti, il backend caricherà tutto lo storico.
            if (this.dom.dateStart.value) {
                params.append('start', this.dom.dateStart.value);
            }
            if (this.dom.dateEnd.value) {
                params.append('end', this.dom.dateEnd.value);
            }

            // 2. STATO: inbox=0, archive=1
            const statoVal = this.state.mode === 'archive' ? '1' : '0';
            params.append('stato', statoVal);

            console.log("Fetching con params:", params.toString());

            const res = await apiFetch(`/api/dashboard/stats?${params.toString()}`);
            const payload = await res.json();
            
            this.state.rawData = payload.rows || [];
            
            // Reset dei dati filtrati e ricostruzione sidebar
            this.state.filteredData = [...this.state.rawData]; 
            this.buildSidebarFilters(); 
            this.applySidebarFilters();
            
        } catch (e) {
            console.error(e);
            // Non mostriamo alert bloccanti al caricamento iniziale se fallisce per filtri vuoti
            // ma mostriamo errore in console o un toast
        } finally {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    // --- SIDEBAR FILTERS ---
    buildSidebarFilters: function() {
        const commesse = new Map();
        const dipendenti = new Map();
        
        this.state.rawData.forEach(row => {
            const cName = row.commesse ? row.commesse.impianto : 'N/D';
            const cId = row.commesse ? row.commesse.id_commessa : 'null';
            const dName = row.personale ? row.personale.nome_cognome : 'Ex Dipendente';
            const dId = row.personale ? row.personale.id_personale : 'null';
            
            commesse.set(cId, cName);
            dipendenti.set(dId, dName);
        });

        this.renderFilterList(this.dom.listCommesse, commesse, 'commesse', this.dom.countCommesse);
        this.renderFilterList(this.dom.listDipendenti, dipendenti, 'dipendenti', this.dom.countDipendenti);
    },

    renderFilterList: function(container, map, filterKey, countEl) {
        container.innerHTML = '';
        countEl.textContent = map.size;
        
        // Ordina alfabetico
        const sorted = Array.from(map.entries()).sort((a,b) => a[1].localeCompare(b[1]));

        sorted.forEach(([id, label]) => {
            const div = document.createElement('label');
            div.innerHTML = `<input type="checkbox" value="${id}" checked> ${label}`;
            
            div.querySelector('input').addEventListener('change', () => {
                this.updateFilterSet(filterKey);
                this.applySidebarFilters();
            });
            container.appendChild(div);
        });
        
        // Aggiorna il set interno per rispecchiare che inizialmente sono tutti checkati
        this.updateFilterSet(filterKey);
    },

    updateFilterSet: function(key) {
        const container = key === 'commesse' ? this.dom.listCommesse : this.dom.listDipendenti;
        const checkboxes = container.querySelectorAll('input:checked');
        const set = this.state.filters[key];
        set.clear();
        checkboxes.forEach(cb => set.add(cb.value));
    },

    applySidebarFilters: function() {
        const { commesse, dipendenti } = this.state.filters;
        
        this.state.filteredData = this.state.rawData.filter(row => {
            const cId = row.commesse ? String(row.commesse.id_commessa) : 'null';
            const dId = row.personale ? String(row.personale.id_personale) : 'null';
            
            return commesse.has(cId) && dipendenti.has(dId);
        });

        this.renderAll();
    },

    // --- RENDER MAIN ---
    renderAll: function() {
        this.calculateKPI();
        this.renderCharts();
        this.renderGrid();
        this.updateSelectionSummary();
    },

    calculateKPI: function() {
        let total = 0, pending = 0, done = 0;
        this.state.filteredData.forEach(r => {
            total += r.ore;
            if (r.stato === 0) pending += r.ore;
            else done += r.ore;
        });

        this.dom.kpiTotal.textContent = total.toFixed(1);
        this.dom.kpiPending.textContent = pending.toFixed(1);
        this.dom.kpiDone.textContent = done.toFixed(1);
    },

    renderCharts: function() {
        // Destroy old
        if (this.state.charts.dist) this.state.charts.dist.destroy();
        if (this.state.charts.time) this.state.charts.time.destroy();

        // 1. Distribution (Grouping corrente)
        const labels = {};
        this.state.filteredData.forEach(r => {
            let key = this.getGroupKey(r, this.state.grouping).label;
            labels[key] = (labels[key] || 0) + r.ore;
        });

        const ctxDist = this.dom.canvasDist.getContext('2d');
        this.state.charts.dist = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: Object.keys(labels),
                datasets: [{ data: Object.values(labels), backgroundColor: this.getColors(Object.keys(labels).length) }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 2. Timeline (Per giorno)
        const days = {};
        this.state.filteredData.forEach(r => {
            const d = r.data_lavoro.split('T')[0];
            days[d] = (days[d] || 0) + r.ore;
        });
        // Sort dates
        const sortedDays = Object.keys(days).sort();
        
        const ctxTime = this.dom.canvasTimeline.getContext('2d');
        this.state.charts.time = new Chart(ctxTime, {
            type: 'bar',
            data: {
                labels: sortedDays,
                datasets: [{ label: 'Ore', data: sortedDays.map(d => days[d]), backgroundColor: '#3498db' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    renderGrid: function() {
        const container = this.dom.gridContainer;
        container.innerHTML = '';
        
        if (this.state.filteredData.length === 0) {
            container.innerHTML = '<div class="placeholder-msg">Nessun dato trovato con i filtri attuali.</div>';
            return;
        }

        // 1. Raggruppa i dati
        const groups = {};
        this.state.filteredData.forEach(row => {
            const { id, label } = this.getGroupKey(row, this.state.grouping);
            if (!groups[id]) groups[id] = { label, rows: [], total: 0 };
            groups[id].rows.push(row);
            groups[id].total += row.ore;
        });

        // 2. Crea HTML
        Object.values(groups).forEach(g => {
            const groupHtml = document.createElement('div');
            groupHtml.className = 'grid-group';
            
            const header = document.createElement('div');
            header.className = 'group-header';
            header.innerHTML = `
                <div class="gh-left">
                    <span class="toggle-icon">▶</span> 
                    <span>${g.label}</span>
                </div>
                <div class="gh-right">
                    <span style="margin-right:15px;">Tot: ${g.total.toFixed(1)}h</span>
                    <input type="checkbox" class="group-check" title="Seleziona Gruppo">
                </div>
            `;
            
            const body = document.createElement('div');
            body.className = 'group-body';
            
            // Tabella righe
            let rowsHtml = '';
            g.rows.forEach(r => {
                const date = new Date(r.data_lavoro).toLocaleDateString();
                const person = r.personale ? r.personale.nome_cognome : '-';
                const task = r.componenti ? r.componenti.nome_componente : (r.commesse ? r.commesse.impianto : '-');
                const note = r.note || '';
                
                rowsHtml += `
                    <tr>
                        <td width="30"><input type="checkbox" class="row-check" value="${r.id_registrazione}"></td>
                        <td>${date}</td>
                        <td>${person}</td>
                        <td>${task}</td>
                        <td width="60" style="font-weight:bold;">${r.ore}</td>
                        <td><small>${note}</small></td>
                        <td width="40"><button class="btn-icon">✏️</button></td>
                    </tr>
                `;
            });
            
            body.innerHTML = `<table><thead><tr><th><input type="checkbox" disabled></th><th>Data</th><th>Chi</th><th>Cosa</th><th>Ore</th><th>Note</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
            
            // Eventi
            header.addEventListener('click', (e) => {
                if(e.target.type !== 'checkbox') {
                    body.classList.toggle('open');
                    header.querySelector('.toggle-icon').textContent = body.classList.contains('open') ? '▼' : '▶';
                }
            });

            // Checkbox Gruppo
            const groupCheck = header.querySelector('.group-check');
            groupCheck.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                body.querySelectorAll('.row-check').forEach(cb => {
                    cb.checked = isChecked;
                });
                this.updateSelectionSummary();
            });

            // Checkbox Righe (aggiorna conteggio)
            body.querySelectorAll('.row-check').forEach(cb => {
                cb.addEventListener('change', () => this.updateSelectionSummary());
            });
            
            groupHtml.appendChild(header);
            groupHtml.appendChild(body);
            container.appendChild(groupHtml);
        });
    },

    // --- UTILS ---
    getGroupKey: function(row, mode) {
        if (mode === 'commessa') {
            return { 
                id: row.commesse ? row.commesse.id_commessa : 'nc', 
                label: row.commesse ? `${row.commesse.impianto} (${row.commesse.codice_commessa})` : 'Nessuna Commessa'
            };
        }
        if (mode === 'dipendente') {
            return {
                id: row.personale ? row.personale.id_personale : 'np',
                label: row.personale ? row.personale.nome_cognome : 'Ignoto'
            };
        }
        // Fallback generico
        return { id: 'all', label: 'Tutti' };
    },

    toggleAllGroups: function(open) {
        document.querySelectorAll('.group-body').forEach(el => {
            if(open) el.classList.add('open');
            else el.classList.remove('open');
        });
        document.querySelectorAll('.toggle-icon').forEach(el => {
            el.textContent = open ? '▼' : '▶';
        });
    },

    updateSelectionSummary: function() {
        const count = document.querySelectorAll('.row-check:checked').length;
        this.dom.selectionSummary.textContent = `${count} righe selezionate`;
    },

    contabilizzaSelection: async function() {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) return alert("Seleziona almeno una riga.");
        
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        
        if (!confirm(`Confermi la contabilizzazione di ${ids.length} registrazioni?`)) return;

        try {
            await apiFetch('/api/dashboard/contabilizza', {
                method: 'POST',
                body: JSON.stringify({ ids })
            });
            
            showModal({ title: "Successo", message: "Righe contabilizzate correttamente." });
            this.fetchData(); // Ricarica
            
        } catch(e) {
            alert("Errore: " + e.message);
        }
    },

    filterGridLocal: function(term) {
        // Implementazione semplice: nasconde le righe che non matchano
        const lower = term.toLowerCase();
        document.querySelectorAll('.group-body tbody tr').forEach(tr => {
            const text = tr.innerText.toLowerCase();
            tr.style.display = text.includes(lower) ? '' : 'none';
        });
    },

    getColors: function(count) {
        const pal = ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f', '#2ecc71', '#34495e', '#e67e22', '#1abc9c'];
        const res = [];
        for(let i=0; i<count; i++) res.push(pal[i % pal.length]);
        return res;
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());