// js/dashboard.js
// V8.1 - Syntax Fixes & Server-Side Analytics

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const Dashboard = {
    state: {
        analyticsData: null, // New Structure: { kpis, charts, rows, row_count_limited }

        // Active Filters (Server-Side)
        filters: {
            dateStart: '',
            dateEnd: '',
            id_commessa: null,
            id_personale: null,
            id_macro: null,
            id_componente: null,
            stato: 0
        },

        chartInstances: {},
        editingRow: null,
        pendingIds: []
    },

    dom: {
        // --- INPUTS ---
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),
        btnInbox: document.getElementById('btnModeInbox'),
        btnArchive: document.getElementById('btnModeArchive'),

        // --- FILTER BOXES ---
        boxCommesse: document.getElementById('boxCommesse'),
        boxDipendenti: document.getElementById('boxDipendenti'),
        boxMacro: document.getElementById('boxMacro'),
        boxLavorazioni: document.getElementById('boxLavorazioni'),

        // --- ACTIONS ---
        btnContabilizza: document.getElementById('btnContabilizza'),
        selCount: document.getElementById('selCount'),
        selHours: document.getElementById('selHours'),
        statusMsg: document.getElementById('statusMsg'),

        // --- TABS & CONTAINERS ---
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),

        // --- KPIs ---
        kpiTotal: document.getElementById('kpiTotalHours'),
        kpiPending: document.getElementById('kpiPending'),
        kpiDone: document.getElementById('kpiDone'),

        // --- GRID ---
        gridContainer: document.getElementById('dataGridContainer'),
        detailSearch: document.getElementById('detailSearch'), // Client-side search on limited rows
        btnExpandAll: document.getElementById('btnExpandAll'),
        btnCollapseAll: document.getElementById('btnCollapseAll'),

        // --- MODALS ---
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

        // --- GRAPHICS ---
        chartCommessaPie: document.getElementById('chartCommessaPie'),
        chartTimeBar: document.getElementById('chartTimeBar'),
        chartLavPie: document.getElementById('chartLavPie'),
        chartLavBar: document.getElementById('chartLavBar'),
        chartMacroPie: document.getElementById('chartMacroPie'),
        chartMacroBar: document.getElementById('chartMacroBar'),
        chartUserPie: document.getElementById('chartUserPie'),
        chartUserBar: document.getElementById('chartUserBar'),
        chartCostCommessa: document.getElementById('chartCostCommessa'),
        chartAbsenceUser: document.getElementById('chartAbsenceUser'),
        // Cross charts momentaneamente disabilitati o semplificati nel backend
    },

    init: function () {
        console.log("🚀 Dashboard V8.1 (Server-Side Analytics)");
        if (!IsAdmin) { window.location.replace('index.html'); return; }

        this.initDates();
        this.addListeners();
        this.fetchData(); // First Load
    },

    initDates: function () {
        // Default: Ultimi 30 giorni
        if (this.dom.dateStart && !this.dom.dateStart.value) {
            // const d = new Date(); d.setDate(d.getDate() - 30);
            // this.dom.dateStart.value = d.toISOString().split('T')[0];
        }
    },

    addListeners: function () {
        if (this.dom.btnRefresh) this.dom.btnRefresh.addEventListener('click', () => this.fetchData());

        // Toggle State Mode
        if (this.dom.btnInbox) this.dom.btnInbox.onclick = () => { this.state.filters.stato = 0; this.updateStateButtons(); this.fetchData(); };
        if (this.dom.btnArchive) this.dom.btnArchive.onclick = () => { this.state.filters.stato = 1; this.updateStateButtons(); this.fetchData(); };

        this.dom.viewTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewTabs.forEach(b => b.classList.remove('active'));
                this.dom.views.forEach(v => v.classList.remove('active'));
                e.currentTarget.classList.add('active'); // Use currentTarget
                const target = document.getElementById(e.currentTarget.dataset.target);
                if (target) target.classList.add('active');
            });
        });

        // Remove client-side grouping buttons as grouping is now server-side or simplified
        if (this.dom.btnExpandAll) this.dom.btnExpandAll.removeEventListener('click', () => this.toggleAllGroups(true));
        if (this.dom.btnCollapseAll) this.dom.btnCollapseAll.removeEventListener('click', () => this.toggleAllGroups(false));

        if (this.dom.detailSearch) this.dom.detailSearch.addEventListener('input', (e) => this.filterGridLocal(e.target.value));
        if (this.dom.btnContabilizza) this.dom.btnContabilizza.addEventListener('click', () => this.openContabilizzaModal());

        // Modals
        if (this.dom.btnCancelConfirm) this.dom.btnCancelConfirm.onclick = () => this.closeConfirmModal();
        if (this.dom.closeConfirmModal) this.dom.closeConfirmModal.onclick = () => this.closeConfirmModal();
        if (this.dom.btnProceedConfirm) this.dom.btnProceedConfirm.onclick = () => this.finalizeContabilizzazione();

        // Initial State Button Update
        this.updateStateButtons();
    },

    updateStateButtons: function () {
        if (this.dom.btnInbox) this.dom.btnInbox.classList.toggle('active', this.state.filters.stato === 0);
        if (this.dom.btnArchive) this.dom.btnArchive.classList.toggle('active', this.state.filters.stato === 1);
    },

    // --- MAIN DATA FETCHING ---
    fetchData: async function () {
        const btn = this.dom.btnRefresh;
        const icon = btn.innerHTML; btn.innerHTML = "⏳"; btn.disabled = true;
        if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Analisi dati in corso...";

        try {
            // Build Query Params from Filters
            const params = new URLSearchParams();
            if (this.dom.dateStart.value) params.append('start', this.dom.dateStart.value);
            if (this.dom.dateEnd.value) params.append('end', this.dom.dateEnd.value);

            // Server-side filters
            if (this.state.filters.stato !== null) params.append('stato', this.state.filters.stato);
            if (this.state.filters.id_commessa) params.append('id_commessa', this.state.filters.id_commessa);
            if (this.state.filters.id_personale) params.append('id_personale', this.state.filters.id_personale);
            if (this.state.filters.id_macro) params.append('id_macro', this.state.filters.id_macro);
            if (this.state.filters.id_componente) params.append('id_componente', this.state.filters.id_componente);

            console.log("Fetching Server-Side Analytics:", params.toString());
            // Use string concatenation to avoid template literal issues
            const res = await apiFetch('/api/dashboard/stats?' + params.toString());
            if (!res.ok) throw new Error("Errore API");

            const data = await res.json();
            this.state.analyticsData = data; // Store full response

            this.renderAll();
            if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Caricati " + data.row_count_limited + " record (Anteprima)";

        } catch (e) {
            console.error(e);
            if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Errore Caricamento.";
        } finally {
            btn.innerHTML = icon; btn.disabled = false;
        }
    },

    renderAll: function () {
        if (!this.state.analyticsData) return;

        this.updateKPIs(this.state.analyticsData.kpis);
        this.renderCharts(this.state.analyticsData.charts);
        this.renderGrid(this.state.analyticsData.rows);
    },

    updateKPIs: function (kpis) {
        if (this.dom.kpiTotal) this.dom.kpiTotal.textContent = Number(kpis.total_hours).toFixed(1);
        if (this.dom.kpiPending) this.dom.kpiPending.textContent = Number(kpis.pending_hours).toFixed(1);
        if (this.dom.kpiDone) this.dom.kpiDone.textContent = Number(kpis.done_hours).toFixed(1);
    },

    renderCharts: function (charts) {
        // Destroy old
        Object.values(this.state.chartInstances).forEach(c => c && c.destroy());
        this.state.chartInstances = {};

        // Helper to map "{label, value}" to ChartJS format
        const mapData = (list) => {
            if (!list) return { labels: [], values: [] };
            return {
                labels: list.map(i => i.label),
                values: list.map(i => i.value)
            };
        };

        // 1. Commesse Pie
        const dComm = mapData(charts.by_commessa);
        this.createPieChart('chartCommessaPie', dComm.labels, dComm.values);

        // 2. Time Trend
        const dTime = mapData(charts.time_trend);
        this.createBarChart('chartTimeBar', dTime.labels, dTime.values, '#2ecc71');

        // 3. Lavorazioni
        const dLav = mapData(charts.by_lavorazione);
        this.createPieChart('chartLavPie', dLav.labels, dLav.values);
        this.createHorizontalBarChart('chartLavBar', dLav.labels, dLav.values, 8);

        // 4. Macro (NEW)
        const dMacro = mapData(charts.by_macro);
        this.createPieChart('chartMacroPie', dMacro.labels, dMacro.values);
        this.createHorizontalBarChart('chartMacroBar', dMacro.labels, dMacro.values, 8);

        // 5. User
        const dUser = mapData(charts.by_user);
        this.createPieChart('chartUserPie', dUser.labels, dUser.values);
        this.createHorizontalBarChart('chartUserBar', dUser.labels, dUser.values, 10);

        // 6. Costi
        const dCosti = mapData(charts.costi_commessa);
        this.createHorizontalBarChart('chartCostCommessa', dCosti.labels, dCosti.values, 10, '#f39c12', true);

        // 7. Assenze
        const dAss = mapData(charts.assenze_user);
        this.createHorizontalBarChart('chartAbsenceUser', dAss.labels, dAss.values, 10, '#e74c3c');
    },

    // --- CHART CREATORS (SIMPLIFIED) ---
    getColors: function (count) {
        const pal = ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f', '#2ecc71', '#34495e', '#e67e22', '#1abc9c', '#7f8c8d'];
        return Array(count).fill().map((_, i) => pal[i % pal.length]);
    },

    createPieChart: function (id, labels, data) {
        if (!this.dom[id] || !labels.length) return;
        this.state.chartInstances[id] = new Chart(this.dom[id], {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: this.getColors(labels.length), borderWidth: 1 }] },
            options: { responsive: true, plugins: { legend: { position: 'left', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    },

    createBarChart: function (id, labels, data, color) {
        if (!this.dom[id]) return;
        this.state.chartInstances[id] = new Chart(this.dom[id], {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Ore', data, backgroundColor: color }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    },

    createHorizontalBarChart: function (id, labels, data, limit = 10, color = '#3498db', isCurrency = false) {
        if (!this.dom[id] || !labels.length) return;
        const l = labels.slice(0, limit);
        const d = data.slice(0, limit);

        this.state.chartInstances[id] = new Chart(this.dom[id], {
            type: 'bar',
            data: { labels: l, datasets: [{ label: isCurrency ? 'Costo' : 'Ore', data: d, backgroundColor: color }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    },

    // --- GRID ---
    renderGrid: function (rows) {
        const container = this.dom.gridContainer;
        if (!container) return;
        container.innerHTML = '';

        if (!rows || rows.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">Nessun dato da visualizzare.</div>';
            return;
        }

        // Simple Table Render
        const table = document.createElement('table');
        table.className = 'dashboard-grid';
        table.innerHTML =
            '<thead>' +
            '<tr>' +
            '<th><input type="checkbox" id="checkAllRows"></th>' +
            '<th>Data</th>' +
            '<th>Utente</th>' +
            '<th>Commessa</th>' +
            '<th>Macro / Lavorazione</th>' +
            '<th>Ore</th>' +
            '<th>Note</th>' +
            '<th>Act</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody></tbody>';

        const tbody = table.querySelector('tbody');

        rows.forEach(r => {
            const tr = document.createElement('tr');
            const date = r.data_lavoro ? r.data_lavoro.split('T')[0] : '-';
            tr.innerHTML =
                '<td><input type="checkbox" class="row-check" value="' + r.id_registrazione + '"></td>' +
                '<td>' + date + '</td>' +
                '<td><div class="cell-primary">' + r.personale_label + '</div></td>' +
                '<td><div class="cell-secondary">' + r.commessa_label + '</div></td>' +
                '<td>' +
                '<div class="cell-primary">' + r.macro_label + '</div>' +
                '<div class="cell-secondary">' + r.componente_label + '</div>' +
                '</td>' +
                '<td style="font-weight:bold;">' + r.ore + '</td>' +
                '<td><small>' + (r.note || '') + '</small></td>' +
                '<td><button class="btn-icon">✏️</button></td>';

            // Edit trigger
            tr.querySelector('.btn-icon').onclick = () => this.openEditModal(r);
            tbody.appendChild(tr);
        });

        // Check All Logic
        table.querySelector('#checkAllRows').addEventListener('change', (e) => {
            const checked = e.target.checked;
            tbody.querySelectorAll('.row-check').forEach(cb => cb.checked = checked);
            this.updateSelectionSummary();
        });

        tbody.addEventListener('change', (e) => {
            if (e.target.classList.contains('row-check')) this.updateSelectionSummary();
        });

        container.appendChild(table);
        this.updateSelectionSummary();
    },

    updateSelectionSummary: function () {
        const checked = document.querySelectorAll('.row-check:checked');
        if (this.dom.selCount) this.dom.selCount.textContent = checked.length;
    },

    // --- EDITING & ACTIONS ---
    openEditModal: function (row) {
        alert("Modifica veloce disponibile prossimamente. Usa 'Inserimento Ore' per modifiche dettagliate.");
    },

    openContabilizzaModal: function () {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) return alert("Seleziona almeno una riga.");
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        this.state.pendingIds = ids;

        this.dom.confCount.textContent = ids.length;
        this.dom.confHours.textContent = "N/D";
        this.dom.confirmModal.style.display = 'flex';
    },

    finalizeContabilizzazione: async function () {
        // Same logic as before
        const ids = this.state.pendingIds;
        if (!ids.length) return;
        const btn = this.dom.btnProceedConfirm;
        btn.textContent = "Wait..."; btn.disabled = true;
        try {
            await apiFetch('/api/dashboard/contabilizza', { method: 'POST', body: JSON.stringify({ ids }) });
            this.closeConfirmModal();
            this.fetchData(); // Reload
            showModal({ title: "Successo", message: "Registrazioni contabilizzate." });
        } catch (e) { alert("Errore: " + e.message); }
        finally { btn.textContent = "CONFERMA"; btn.disabled = false; }
    },

    closeConfirmModal: function () {
        this.dom.confirmModal.style.display = 'none';
        this.state.pendingIds = [];
    },

    filterGridLocal: function (term) {
        const lower = term.toLowerCase();
        const rows = this.dom.gridContainer.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            tr.style.display = tr.innerText.toLowerCase().includes(lower) ? '' : 'none';
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());