// js/dashboard.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const Dashboard = {
    state: {
        rawData: [],
        filteredData: [],
        activeStatuses: new Set(['0']),
        grouping: 'commessa', 
        
        filters: {
            commesse: new Set(),
            dipendenti: new Set(),
            macro: new Set(),
            lavorazioni: new Set()
        },
        
        chartInstances: {},
        editingRow: null,
        pendingIds: []
    },

    // FALLBACK: Usato solo se il DB non restituisce il costo (es. ruolo mancante)
    CONSTANTS: {
        COSTO_DEFAULT: 45 
    },

    dom: {
        // ... (elementi DOM identici a prima) ...
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),
        btnInbox: document.getElementById('btnModeInbox'),
        btnArchive: document.getElementById('btnModeArchive'),
        groupSelect: document.getElementById('groupingSelect'),
        boxCommesse: document.getElementById('boxCommesse'),
        boxDipendenti: document.getElementById('boxDipendenti'),
        boxMacro: document.getElementById('boxMacro'),
        boxLavorazioni: document.getElementById('boxLavorazioni'),
        btnContabilizza: document.getElementById('btnContabilizza'),
        selCount: document.getElementById('selCount'),
        selHours: document.getElementById('selHours'),
        statusMsg: document.getElementById('statusMsg'),
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),
        kpiTotal: document.getElementById('kpiTotalHours'),
        kpiPending: document.getElementById('kpiPending'),
        kpiDone: document.getElementById('kpiDone'),
        gridContainer: document.getElementById('dataGridContainer'),
        detailSearch: document.getElementById('detailSearch'),
        btnExpandAll: document.getElementById('btnExpandAll'),
        btnCollapseAll: document.getElementById('btnCollapseAll'),
        confirmModal: document.getElementById('confirmModal'),
        confCount: document.getElementById('confCount'),
        confHours: document.getElementById('confHours'),
        btnCancelConfirm: document.getElementById('btnCancelConfirm'),
        btnProceedConfirm: document.getElementById('btnProceedConfirm'),
        closeConfirmModal: document.getElementById('closeConfirmModal'),
        customModalOverlay: document.getElementById('custom-modal-overlay'),
        customModalTitle: document.getElementById('custom-modal-title'),
        customModalMessage: document.getElementById('custom-modal-message'),
        customModalButtons: document.getElementById('custom-modal-buttons'),

        // GRAFICI
        chartCommessaPie: document.getElementById('chartCommessaPie'),
        chartTimeBar: document.getElementById('chartTimeBar'),
        chartLavPie: document.getElementById('chartLavPie'),
        chartLavBar: document.getElementById('chartLavBar'),
        chartMacroPie: document.getElementById('chartMacroPie'),
        chartMacroBar: document.getElementById('chartMacroBar'),
        chartUserPie: document.getElementById('chartUserPie'),
        chartUserBar: document.getElementById('chartUserBar'),
        chartCrossLavUser: document.getElementById('chartCrossLavUser'),
        chartCrossMacroUser: document.getElementById('chartCrossMacroUser'),
        chartCostCommessa: document.getElementById('chartCostCommessa'),
        chartAbsenceUser: document.getElementById('chartAbsenceUser'),
        chartAbsenceTrend: document.getElementById('chartAbsenceTrend')
    },

    init: function() {
        console.log("🚀 Dashboard Init v7.0 (Real Costs)");
        this.initDates();
        this.addListeners();
        this.fetchData();
    },

    initDates: function() {
        if(this.dom.dateStart) this.dom.dateStart.value = '';
        if(this.dom.dateEnd) this.dom.dateEnd.value = '';
    },

    addListeners: function() {
        if(this.dom.btnRefresh) this.dom.btnRefresh.addEventListener('click', () => this.fetchData());
        if(this.dom.btnInbox) this.dom.btnInbox.addEventListener('click', () => this.toggleStatus('0', this.dom.btnInbox));
        if(this.dom.btnArchive) this.dom.btnArchive.addEventListener('click', () => this.toggleStatus('1', this.dom.btnArchive));
        if(this.dom.groupSelect) {
            this.dom.groupSelect.addEventListener('change', (e) => {
                this.state.grouping = e.target.value;
                this.renderAll();
            });
        }
        this.dom.viewTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewTabs.forEach(b => b.classList.remove('active'));
                this.dom.views.forEach(v => v.classList.remove('active'));
                e.target.classList.add('active');
                const target = document.getElementById(e.target.dataset.target);
                if(target) target.classList.add('active');
            });
        });
        if(this.dom.btnExpandAll) this.dom.btnExpandAll.addEventListener('click', () => this.toggleAllGroups(true));
        if(this.dom.btnCollapseAll) this.dom.btnCollapseAll.addEventListener('click', () => this.toggleAllGroups(false));
        if(this.dom.detailSearch) this.dom.detailSearch.addEventListener('input', (e) => this.filterGridLocal(e.target.value));
        if(this.dom.btnContabilizza) this.dom.btnContabilizza.addEventListener('click', () => this.openContabilizzaModal());
        if(this.dom.btnCancelConfirm) this.dom.btnCancelConfirm.addEventListener('click', () => this.closeConfirmModal());
        if(this.dom.closeConfirmModal) this.dom.closeConfirmModal.addEventListener('click', () => this.closeConfirmModal());
        if(this.dom.btnProceedConfirm) this.dom.btnProceedConfirm.addEventListener('click', () => this.finalizeContabilizzazione());
    },

    toggleStatus: function(statusValue, btnElement) {
        if (this.state.activeStatuses.has(statusValue)) {
            if (this.state.activeStatuses.size > 1) {
                this.state.activeStatuses.delete(statusValue);
                btnElement.classList.remove('active');
            }
        } else {
            this.state.activeStatuses.add(statusValue);
            btnElement.classList.add('active');
        }
        this.resetAllFilters();
        this.fetchData();
    },

    resetAllFilters: function() {
        this.state.filters.commesse.clear();
        this.state.filters.dipendenti.clear();
        this.state.filters.macro.clear();
        this.state.filters.lavorazioni.clear();
    },

    fetchData: async function() {
        const btn = this.dom.btnRefresh;
        const originalIcon = btn.innerHTML; 
        btn.innerHTML = "⏳"; 
        btn.disabled = true;
        
        if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Caricamento dati...";

        try {
            const params = new URLSearchParams();
            if (this.dom.dateStart.value) params.append('start', this.dom.dateStart.value);
            if (this.dom.dateEnd.value) params.append('end', this.dom.dateEnd.value);
            if (this.state.activeStatuses.size === 1) {
                params.append('stato', Array.from(this.state.activeStatuses)[0]);
            }

            const res = await apiFetch(`/api/dashboard/stats?${params.toString()}`);
            const payload = await res.json();
            
            this.state.rawData = payload.rows || [];
            this.state.filteredData = [...this.state.rawData]; 
            
            this.buildSidebarFilters(); 
            this.applySidebarFilters();
            
            if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Pronto.";
            
        } catch (e) {
            console.error(e);
            if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Errore.";
        } finally {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    formatCommessaLabel: function(c) {
        if (!c) return 'Nessuna Commessa';
        const parts = [];
        if (c.clienti && c.clienti.ragione_sociale) parts.push(c.clienti.ragione_sociale);
        if (c.impianto) parts.push(c.impianto);
        return parts.length > 0 ? parts.join(' | ') : 'Dati incompleti';
    },

    buildSidebarFilters: function() {
        const maps = {
            commesse: new Map(),
            dipendenti: new Map(),
            macro: new Map(),
            lavorazioni: new Map()
        };
        
        this.state.rawData.forEach(row => {
            const cName = this.formatCommessaLabel(row.commesse);
            const cId = row.commesse ? String(row.commesse.id_commessa) : 'null';
            maps.commesse.set(cId, cName);

            const dName = row.personale ? row.personale.nome_cognome : 'Ex Dipendente';
            const dId = row.personale ? String(row.personale.id_personale) : 'null';
            maps.dipendenti.set(dId, dName);

            const mName = row.nome_macro || 'Nessun Reparto';
            maps.macro.set(mName, mName); 

            const lName = row.componenti ? row.componenti.nome_componente : 'Generico';
            const lId = row.componenti ? String(row.componenti.id_componente) : 'null';
            maps.lavorazioni.set(lId, lName);
        });

        this.renderSmartFilterBox(this.dom.boxCommesse, 'Commesse', maps.commesse, 'commesse');
        this.renderSmartFilterBox(this.dom.boxDipendenti, 'Dipendenti', maps.dipendenti, 'dipendenti');
        this.renderSmartFilterBox(this.dom.boxMacro, 'Macrocategorie', maps.macro, 'macro');
        this.renderSmartFilterBox(this.dom.boxLavorazioni, 'Lavorazioni', maps.lavorazioni, 'lavorazioni');
    },

    renderSmartFilterBox: function(containerBox, title, mapData, filterKey) {
        if(!containerBox) return;
        containerBox.innerHTML = ''; 

        const header = document.createElement('div');
        header.className = 'filter-header-smart';
        header.innerHTML = `
            <div class="fh-title"><span class="toggle-arrow">▼</span> ${title} <small>(${mapData.size})</small></div>
            <div class="fh-actions">
                <button class="action-mini-btn btn-check-all" title="Tutti">☑️</button>
                <button class="action-mini-btn btn-uncheck-all" title="Nessuno">⬜</button>
            </div>
        `;

        const listDiv = document.createElement('div');
        listDiv.className = 'filter-list';
        const sorted = Array.from(mapData.entries()).sort((a,b) => a[1].localeCompare(b[1]));
        
        sorted.forEach(([id, label]) => {
            const row = document.createElement('label');
            row.innerHTML = `<input type="checkbox" value="${id}" checked> ${label}`;
            row.querySelector('input').addEventListener('change', () => {
                this.updateFilterSet(filterKey, listDiv);
                this.applySidebarFilters();
            });
            listDiv.appendChild(row);
        });

        header.querySelector('.fh-title').addEventListener('click', () => containerBox.classList.toggle('collapsed'));
        header.querySelector('.btn-check-all').addEventListener('click', (e) => { e.stopPropagation(); this.setAllCheckboxes(listDiv, true); this.updateFilterSet(filterKey, listDiv); this.applySidebarFilters(); });
        header.querySelector('.btn-uncheck-all').addEventListener('click', (e) => { e.stopPropagation(); this.setAllCheckboxes(listDiv, false); this.updateFilterSet(filterKey, listDiv); this.applySidebarFilters(); });

        containerBox.appendChild(header);
        containerBox.appendChild(listDiv);
        this.updateFilterSet(filterKey, listDiv);
    },

    setAllCheckboxes: function(container, checked) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
    },

    updateFilterSet: function(key, container) {
        const checkboxes = container.querySelectorAll('input:checked');
        const set = this.state.filters[key];
        set.clear();
        checkboxes.forEach(cb => set.add(cb.value));
    },

    applySidebarFilters: function() {
        const f = this.state.filters;
        this.state.filteredData = this.state.rawData.filter(row => {
            const cId = row.commesse ? String(row.commesse.id_commessa) : 'null';
            const dId = row.personale ? String(row.personale.id_personale) : 'null';
            const lId = row.componenti ? String(row.componenti.id_componente) : 'null';
            const mName = row.nome_macro || 'Nessun Reparto'; 
            return f.commesse.has(cId) && f.dipendenti.has(dId) && f.macro.has(mName) && f.lavorazioni.has(lId);
        });
        this.renderAll();
    },

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
        if(this.dom.kpiTotal) this.dom.kpiTotal.textContent = total.toFixed(1);
        if(this.dom.kpiPending) this.dom.kpiPending.textContent = pending.toFixed(1);
        if(this.dom.kpiDone) this.dom.kpiDone.textContent = done.toFixed(1);
    },

    // =========================================================
    // ==  RENDER CHART LOGIC AGGIORNATA ==
    // =========================================================
    renderCharts: function() {
        // Pulizia
        Object.keys(this.state.chartInstances).forEach(key => {
            if (this.state.chartInstances[key]) {
                this.state.chartInstances[key].destroy();
                this.state.chartInstances[key] = null;
            }
        });

        if (this.state.filteredData.length === 0) return;

        const data = this.state.filteredData;
        const COSTO_FALLBACK = this.CONSTANTS.COSTO_DEFAULT;

        // --- HELPER DI IDENTIFICAZIONE ASSENZE ---
        const isAbsence = (r) => {
            const txt = (r.componenti?.nome_componente || '') + ' ' + (r.nome_macro || '') + ' ' + (r.note || '');
            const lower = txt.toLowerCase();
            return lower.includes('ferie') || lower.includes('permess') || lower.includes('malattia') || lower.includes('104') || lower.includes('assenza');
        };

        // --- 1. AGGREGAZIONI STANDARD ---
        const groupBy = (keyFn, filterFn = () => true) => {
            const map = {};
            data.forEach(r => {
                if(filterFn(r)) {
                    const k = keyFn(r);
                    map[k] = (map[k] || 0) + r.ore;
                }
            });
            return map;
        };

        const aggCommessa = groupBy(r => (!r.commesse) ? 'Nessuna Commessa' : (r.commesse.impianto || r.commesse.clienti?.ragione_sociale || 'Commessa'));
        const aggLavorazione = groupBy(r => r.componenti ? r.componenti.nome_componente : 'Generico');
        const aggMacro = groupBy(r => r.nome_macro || 'Nessun Reparto');
        const aggUser = groupBy(r => r.personale ? r.personale.nome_cognome : 'Ignoto');
        
        // Aggregazione Temporale
        const aggTime = {}; 
        data.forEach(r => {
            const d = new Date(r.data_lavoro);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            aggTime[k] = (aggTime[k] || 0) + r.ore;
        });

        // --- 2. AGGREGAZIONE COSTI (DINAMICA DA DB) ---
        // Recupera costo_orario da 'ruoli' tramite 'personale'
        const aggCosti = {};
        data.forEach(r => {
            const nome = (!r.commesse) ? 'Nessuna Commessa' : (r.commesse.impianto || r.commesse.clienti?.ragione_sociale || 'Commessa');
            
            // Logica Recupero Costo
            let costoOrario = COSTO_FALLBACK;
            if (r.personale && r.personale.ruoli && r.personale.ruoli.costo_orario) {
                // Il dato da DB potrebbe arrivare come stringa numerica
                costoOrario = parseFloat(r.personale.ruoli.costo_orario);
            }

            const costo = r.ore * costoOrario;
            aggCosti[nome] = (aggCosti[nome] || 0) + costo;
        });

        // --- 3. AGGREGAZIONE ASSENZE (HR) ---
        const absData = data.filter(r => isAbsence(r));
        const aggAbsUser = {};
        absData.forEach(r => {
            const u = r.personale ? r.personale.nome_cognome : 'Ignoto';
            aggAbsUser[u] = (aggAbsUser[u] || 0) + r.ore;
        });

        const aggAbsTrend = {};
        absData.forEach(r => {
            const d = new Date(r.data_lavoro);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            aggAbsTrend[k] = (aggAbsTrend[k] || 0) + r.ore;
        });

        // --- GENERAZIONE GRAFICI ---

        // RIGA 1-4: STANDARD
        this.createPieChart('chartCommessaPie', aggCommessa);
        this.createTimeBarChart('chartTimeBar', aggTime);
        this.createPieChart('chartLavPie', aggLavorazione);
        this.createTopBarChart('chartLavBar', aggLavorazione, 8);
        this.createPieChart('chartMacroPie', aggMacro);
        this.createTopBarChart('chartMacroBar', aggMacro, 8);
        this.createPieChart('chartUserPie', aggUser);
        this.createTopBarChart('chartUserBar', aggUser, 8);

        // RIGA 5-6: CROSS DATA
        this.createStackedChart('chartCrossLavUser', 
            r => r.componenti ? r.componenti.nome_componente : 'Generico', 
            r => r.personale ? r.personale.nome_cognome : 'Ignoto', 8
        );
        this.createStackedChart('chartCrossMacroUser', 
            r => r.nome_macro || 'Nessun Reparto',                        
            r => r.personale ? r.personale.nome_cognome : 'Ignoto', 8
        );

        // RIGA 7: COSTI (NUOVO)
        this.createCostBarChart('chartCostCommessa', aggCosti, 10);

        // RIGA 8: HR ASSENZE
        this.createTopBarChart('chartAbsenceUser', aggAbsUser, 10, '#e74c3c');
        this.createTimeBarChart('chartAbsenceTrend', aggAbsTrend, '#e74c3c');
    },

    // --- CHART CREATORS HELPER ---

    createPieChart: function(canvasId, dataMap) {
        if (!this.dom[canvasId]) return;
        const sorted = Object.entries(dataMap).sort((a,b) => b[1] - a[1]);
        const labels = sorted.map(e => e[0]);
        const values = sorted.map(e => e[1]);
        this.state.chartInstances[canvasId] = new Chart(this.dom[canvasId], {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: values, backgroundColor: this.getColors(labels.length), borderWidth: 1 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'left', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    },

    createTopBarChart: function(canvasId, dataMap, limit, color = '#3498db') {
        if (!this.dom[canvasId]) return;
        const sorted = Object.entries(dataMap).sort((a,b) => b[1] - a[1]).slice(0, limit);
        const labels = sorted.map(e => e[0]);
        const values = sorted.map(e => e[1]);

        this.state.chartInstances[canvasId] = new Chart(this.dom[canvasId], {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Ore', data: values, backgroundColor: color, borderRadius: 4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } }
            }
        });
    },

    createCostBarChart: function(canvasId, dataMap, limit) {
        if (!this.dom[canvasId]) return;
        const sorted = Object.entries(dataMap).sort((a,b) => b[1] - a[1]).slice(0, limit);
        const labels = sorted.map(e => e[0]);
        const values = sorted.map(e => e[1]); 

        this.state.chartInstances[canvasId] = new Chart(this.dom[canvasId], {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Costo Reale (€)', data: values, backgroundColor: '#f39c12', borderRadius: 4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `€ ${ctx.raw.toLocaleString()}` } }
                },
                scales: { y: { beginAtZero: true } }
            }
        });
    },

    createTimeBarChart: function(canvasId, aggTime, color = '#2ecc71') {
        if (!this.dom[canvasId]) return;
        const sortedKeys = Object.keys(aggTime).sort();
        const labels = sortedKeys.map(k => {
            const [y, m] = k.split('-');
            const date = new Date(y, m - 1);
            return date.toLocaleString('it-IT', { month: 'short', year: '2-digit' });
        });
        const values = sortedKeys.map(k => aggTime[k]);

        this.state.chartInstances[canvasId] = new Chart(this.dom[canvasId], {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Ore', data: values, backgroundColor: color, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    },

    createStackedChart: function(canvasId, categoryExtractor, stackExtractor, limitTopCat) {
        if (!this.dom[canvasId]) return;
        const catTotals = {};
        this.state.filteredData.forEach(r => {
            const cat = categoryExtractor(r);
            catTotals[cat] = (catTotals[cat] || 0) + r.ore;
        });
        const topCategories = Object.entries(catTotals).sort((a,b) => b[1] - a[1]).slice(0, limitTopCat).map(e => e[0]);
        if (topCategories.length === 0) return;

        const userMap = {};
        const allUsers = new Set();
        this.state.filteredData.forEach(r => {
            const cat = categoryExtractor(r);
            if (!topCategories.includes(cat)) return;
            const user = stackExtractor(r);
            allUsers.add(user);
            if (!userMap[user]) userMap[user] = {};
            userMap[user][cat] = (userMap[user][cat] || 0) + r.ore;
        });

        const colors = this.getColors(allUsers.size);
        const datasets = Array.from(allUsers).map((user, idx) => {
            return {
                label: user,
                data: topCategories.map(cat => userMap[user][cat] || 0),
                backgroundColor: colors[idx % colors.length]
            };
        });

        this.state.chartInstances[canvasId] = new Chart(this.dom[canvasId], {
            type: 'bar',
            data: { labels: topCategories, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                plugins: { tooltip: { mode: 'index', intersect: false }, legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
            }
        });
    },

    // --- GRID & EDITING ---
    renderGrid: function() {
        const container = this.dom.gridContainer;
        if(!container) return;
        container.innerHTML = '';
        if (this.state.filteredData.length === 0) {
            container.innerHTML = '<div class="placeholder-msg">Nessun dato trovato con i filtri attuali.</div>';
            return;
        }

        const groups = {};
        this.state.filteredData.forEach(row => {
            const { id, label } = this.getGroupKey(row, this.state.grouping);
            if (!groups[id]) groups[id] = { label, rows: [], total: 0 };
            groups[id].rows.push(row);
            groups[id].total += row.ore;
        });

        Object.values(groups).forEach(g => {
            const groupHtml = document.createElement('div');
            groupHtml.className = 'grid-group';
            const header = document.createElement('div');
            header.className = 'group-header';
            header.innerHTML = `
                <div class="gh-left"><span class="toggle-icon">▶</span> <span>${g.label}</span></div>
                <div class="gh-right">
                    <span style="margin-right:15px; font-weight:normal; font-size:0.8rem;">Tot: <b>${g.total.toFixed(1)}h</b></span>
                    <input type="checkbox" class="group-check">
                </div>
            `;
            const body = document.createElement('div');
            body.className = 'group-body';
            const table = document.createElement('table');
            table.innerHTML = `<thead><tr><th width="30"><input type="checkbox" disabled></th><th>Data</th><th>Chi</th><th>Lavorazione</th><th>Ore</th><th>Note</th><th></th></tr></thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');

            g.rows.forEach(r => {
                const date = new Date(r.data_lavoro).toLocaleDateString();
                const person = r.personale ? r.personale.nome_cognome : '-';
                const task = r.componenti ? r.componenti.nome_componente : '-';
                const macro = r.nome_macro || ''; 
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td width="30"><input type="checkbox" class="row-check" value="${r.id_registrazione}"></td>
                    <td width="90">${date}</td>
                    <td width="150">${person}</td>
                    <td>${task} <span style="color:#999; font-size:0.7em;">(${macro})</span></td>
                    <td width="60" style="font-weight:bold; text-align:center;">${r.ore}</td>
                    <td><small>${r.note || ''}</small></td>
                    <td width="40" style="text-align:center;"><button class="btn-icon">✏️</button></td>
                `;
                tr.querySelector('.btn-icon').addEventListener('click', (e) => { e.stopPropagation(); this.openEditModal(r); });
                tr.querySelector('.row-check').addEventListener('change', () => this.updateSelectionSummary());
                tbody.appendChild(tr);
            });
            body.appendChild(table);
            header.addEventListener('click', (e) => {
                if(e.target.type !== 'checkbox') {
                    body.classList.toggle('open');
                    header.querySelector('.toggle-icon').textContent = body.classList.contains('open') ? '▼' : '▶';
                }
            });
            header.querySelector('.group-check').addEventListener('change', (e) => {
                body.querySelectorAll('.row-check').forEach(cb => cb.checked = e.target.checked);
                this.updateSelectionSummary();
            });
            groupHtml.appendChild(header);
            groupHtml.appendChild(body);
            container.appendChild(groupHtml);
        });
    },

    openEditModal: function(row) {
        this.state.editingRow = row;
        const overlay = this.dom.customModalOverlay;
        const message = document.getElementById('custom-modal-message');
        const buttons = document.getElementById('custom-modal-buttons');
        document.getElementById('custom-modal-title').textContent = "Modifica Registrazione";

        message.innerHTML = `
            <div class="edit-form-row"><label>Data</label><input type="date" id="editData" class="edit-input" value="${row.data_lavoro.split('T')[0]}"></div>
            <div class="edit-form-row"><label>Ore</label><input type="number" id="editOre" class="edit-input" value="${row.ore}" step="0.5"></div>
            <div class="edit-form-row"><label>Note</label><textarea id="editNote" class="edit-input">${row.note || ''}</textarea></div>
            <div class="edit-form-row"><label>Stato</label><select id="editStato" class="edit-input"><option value="0" ${row.stato === 0 ? 'selected' : ''}>Da Validare</option><option value="1" ${row.stato === 1 ? 'selected' : ''}>Contabilizzato</option></select></div>
        `;
        
        buttons.innerHTML = '';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = "Annulla";
        btnCancel.className = "btn-secondary";
        btnCancel.onclick = () => overlay.style.display = 'none';

        const btnSave = document.createElement('button');
        btnSave.textContent = "Salva";
        btnSave.className = "btn-primary-large";
        btnSave.style.width = "auto";
        btnSave.onclick = () => this.saveEdit();

        buttons.appendChild(btnCancel);
        buttons.appendChild(btnSave);
        overlay.style.display = 'flex';
    },

    saveEdit: async function() {
        const row = this.state.editingRow;
        if (!row) return;
        const newData = document.getElementById('editData').value;
        const newOre = parseFloat(document.getElementById('editOre').value);
        const newNote = document.getElementById('editNote').value;
        const newStato = parseInt(document.getElementById('editStato').value);

        this.dom.customModalOverlay.style.display = 'none';
        
        const payload = {
            id_personale_override: row.personale.id_personale, 
            data: newData, ore: newOre, note: newNote, stato: newStato,
            id_commessa: row.commesse ? row.commesse.id_commessa : null,
            id_componente: row.componenti ? row.componenti.id_componente : null
        };

        try {
            await apiFetch(`/api/ore/${row.id_registrazione}`, { method: 'DELETE' });
            await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
            showModal({ title: "Successo", message: "Modifica salvata." });
            this.fetchData(); 
        } catch (e) { alert("Errore: " + e.message); }
    },

    updateSelectionSummary: function() {
        const checked = document.querySelectorAll('.row-check:checked');
        const rowsMap = new Map(this.state.filteredData.map(r => [r.id_registrazione, r.ore]));
        let total = 0;
        checked.forEach(cb => total += (rowsMap.get(parseInt(cb.value)) || 0));
        if(this.dom.selCount) this.dom.selCount.textContent = checked.length;
        if(this.dom.selHours) this.dom.selHours.textContent = total.toFixed(1);
    },

    openContabilizzaModal: function() {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) return alert("Seleziona almeno una riga.");
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        this.state.pendingIds = ids; 
        let total = 0;
        const rowsMap = new Map(this.state.filteredData.map(r => [r.id_registrazione, r.ore]));
        ids.forEach(id => total += (rowsMap.get(id) || 0));
        
        this.dom.confCount.textContent = ids.length;
        this.dom.confHours.textContent = total.toFixed(1) + " h";
        this.dom.confirmModal.style.display = 'flex';
    },

    finalizeContabilizzazione: async function() {
        const ids = this.state.pendingIds;
        if (!ids || ids.length === 0) return;
        const btn = this.dom.btnProceedConfirm;
        btn.textContent = "Wait..."; btn.disabled = true;
        try {
            await apiFetch('/api/dashboard/contabilizza', { method: 'POST', body: JSON.stringify({ ids }) });
            this.closeConfirmModal();
            showModal({ title: "Successo", message: "Registrazioni contabilizzate." });
            this.fetchData();
        } catch(e) { alert("Errore: " + e.message); } 
        finally { btn.textContent = "CONFERMA"; btn.disabled = false; }
    },

    closeConfirmModal: function() {
        this.dom.confirmModal.style.display = 'none';
        this.state.pendingIds = [];
    },

    getGroupKey: function(row, mode) {
        if (mode === 'commessa') return { id: row.commesse ? row.commesse.id_commessa : 'nc', label: `📂 ${this.formatCommessaLabel(row.commesse)}` };
        if (mode === 'dipendente') return { id: row.personale ? row.personale.id_personale : 'np', label: row.personale ? `👤 ${row.personale.nome_cognome}` : 'Ignoto' };
        if (mode === 'macro') return { id: row.nome_macro || 'nm', label: `🏗️ ${row.nome_macro || 'Nessun Reparto'}` };
        if (mode === 'lavorazione') return { id: row.componenti ? row.componenti.id_componente : 'nl', label: row.componenti ? `🔧 ${row.componenti.nome_componente}` : 'Generico' };
        return { id: 'all', label: 'Tutti' };
    },

    toggleAllGroups: function(open) {
        document.querySelectorAll('.group-body').forEach(el => open ? el.classList.add('open') : el.classList.remove('open'));
        document.querySelectorAll('.toggle-icon').forEach(el => el.textContent = open ? '▼' : '▶');
    },

    filterGridLocal: function(term) {
        const lower = term.toLowerCase();
        document.querySelectorAll('.group-body tbody tr').forEach(tr => {
            tr.style.display = tr.innerText.toLowerCase().includes(lower) ? '' : 'none';
        });
    },

    getColors: function(count) {
        const pal = ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f', '#2ecc71', '#34495e', '#e67e22', '#1abc9c', '#7f8c8d', '#d35400', '#2980b9', '#c0392b', '#8e44ad', '#f39c12', '#27ae60'];
        const res = [];
        for(let i=0; i<count; i++) res.push(pal[i % pal.length]);
        return res;
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());