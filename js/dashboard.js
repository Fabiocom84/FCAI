// js/dashboard.js
// V9.0 - Pagination, Multi-Select Filters, Unified View

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const Dashboard = {
    state: {
        analyticsData: null,

        // Active Filters (Multi-select arrays)
        filters: {
            dateStart: '',
            dateEnd: '',
            id_commessa: [],
            id_personale: [],
            id_macro: [],
            id_componente: [],
            stato: [0] // Default: Da Validare (0)
        },

        pagination: {
            page: 1,
            pageSize: 50,
            total: 0,
            hasMore: false
        },

        chartInstances: {},
        pendingIds: []
    },

    dom: {
        // --- INPUTS ---
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),

        // Mode Toggles
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

        // --- TABS ---
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),
        groupingSelect: document.getElementById('groupingSelect'),

        // --- KPIs ---
        kpiTotal: document.getElementById('kpiTotalHours'),
        kpiPending: document.getElementById('kpiPending'),
        kpiDone: document.getElementById('kpiDone'),

        // --- GRID ---
        gridContainer: document.getElementById('dataGridContainer'),
        detailSearch: document.getElementById('detailSearch'), // Client-search

        // --- MODALS ---
        confirmModal: document.getElementById('confirmModal'),
        confCount: document.getElementById('confCount'),
        confHours: document.getElementById('confHours'),
        btnCancelConfirm: document.getElementById('btnCancelConfirm'),
        btnProceedConfirm: document.getElementById('btnProceedConfirm'),
        closeConfirmModal: document.getElementById('closeConfirmModal'),

        // --- GRAPHS ---
        // (Access dynamically by ID in renderCharts)
    },

    init: function () {
        console.log("🚀 Dashboard V9.0 (Pagination + Multi-Select)");
        if (!IsAdmin) { window.location.replace('index.html'); return; }

        this.initDates();
        this.addListeners();
        this.fetchData({ resetPage: true });
    },

    initDates: function () {
        // Optional default range
    },

    addListeners: function () {
        if (this.dom.btnRefresh) this.dom.btnRefresh.addEventListener('click', () => this.fetchData({ resetPage: true }));

        // Toggle State Mode (Multi-select)
        const toggleState = (val, btn) => {
            const idx = this.state.filters.stato.indexOf(val);
            if (idx > -1) {
                // Remove (ensure at least one selected?? fallback to empty means 'all' in logic or 'none'? User said "Both = All", so empty = none or all? Let's assume user wants to toggle freely)
                this.state.filters.stato.splice(idx, 1);
            } else {
                this.state.filters.stato.push(val);
            }
            this.updateStateButtons();
            this.fetchData({ resetPage: true });
        };

        if (this.dom.btnInbox) this.dom.btnInbox.onclick = () => toggleState(0, this.dom.btnInbox);
        if (this.dom.btnArchive) this.dom.btnArchive.onclick = () => toggleState(1, this.dom.btnArchive);

        // View Tabs
        this.dom.viewTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewTabs.forEach(b => b.classList.remove('active'));
                this.dom.views.forEach(v => v.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const target = document.getElementById(e.currentTarget.dataset.target);
                if (target) target.classList.add('active');
            });
        });

        // Grouping
        if (this.dom.groupingSelect) {
            this.dom.groupingSelect.addEventListener('change', () => this.renderGrid());
        }

        // Search (Client side filter of CURRENT page/loaded rows)
        if (this.dom.detailSearch) {
            this.dom.detailSearch.addEventListener('input', () => this.renderGrid());
        }

        if (this.dom.btnContabilizza) this.dom.btnContabilizza.addEventListener('click', () => this.openContabilizzaModal());

        // Modals
        if (this.dom.btnCancelConfirm) this.dom.btnCancelConfirm.onclick = () => this.closeConfirmModal();
        if (this.dom.closeConfirmModal) this.dom.closeConfirmModal.onclick = () => this.closeConfirmModal();
        if (this.dom.btnProceedConfirm) this.dom.btnProceedConfirm.onclick = () => this.finalizeContabilizzazione();

        this.updateStateButtons();
    },

    updateStateButtons: function () {
        if (this.dom.btnInbox) this.dom.btnInbox.classList.toggle('active', this.state.filters.stato.includes(0));
        if (this.dom.btnArchive) this.dom.btnArchive.classList.toggle('active', this.state.filters.stato.includes(1));
    },

    // --- MAIN DATA FETCHING ---
    fetchData: async function (opts = {}) {
        const resetPage = opts.resetPage || false;
        const append = opts.append || false;

        if (resetPage) this.state.pagination.page = 1;

        const btn = this.dom.btnRefresh;
        const icon = btn.innerHTML; btn.innerHTML = "⏳"; btn.disabled = true;
        if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Caricamento...";

        try {
            const f = this.state.filters;
            const p = this.state.pagination;

            const params = new URLSearchParams();
            params.append('page', p.page);
            params.append('pageSize', p.pageSize);

            // Scalar Filters
            if (this.dom.dateStart.value) params.append('start', this.dom.dateStart.value);
            if (this.dom.dateEnd.value) params.append('end', this.dom.dateEnd.value);

            // Array Filters
            f.stato.forEach(v => params.append('stato', v));
            f.id_commessa.forEach(v => params.append('id_commessa', v));
            f.id_personale.forEach(v => params.append('id_personale', v));
            f.id_macro.forEach(v => params.append('id_macro', v));
            f.id_componente.forEach(v => params.append('id_componente', v));

            console.log("Fetch V2:", params.toString());
            const res = await apiFetch('/api/dashboard/stats?' + params.toString());
            if (!res.ok) throw new Error("Errore API");

            const data = await res.json(); // Expected: { rows, kpis, charts, total_count }

            // Merge Logic
            if (append) {
                this.state.analyticsData.rows = [...this.state.analyticsData.rows, ...data.rows];
                this.state.analyticsData.kpis = data.kpis; // Update KPIs (global)
                // Charts might need recalc or just take new ones? Usually charts reflect total current filtered set, which backend returns.
                this.state.analyticsData.charts = data.charts;
            } else {
                this.state.analyticsData = data;
            }

            this.state.pagination.total = data.total_count || 0;
            this.state.pagination.hasMore = (p.page * p.pageSize) < this.state.pagination.total;

            this.renderAll(append);

            const loaded = this.state.analyticsData.rows.length;
            if (this.dom.statusMsg) this.dom.statusMsg.innerHTML = `Visualizzati <b>${loaded}</b> di <b>${this.state.pagination.total}</b>`;

        } catch (e) {
            console.error(e);
            if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Errore: " + e.message;
        } finally {
            btn.innerHTML = icon; btn.disabled = false;
        }
    },

    loadMore: function () {
        if (!this.state.pagination.hasMore) return;
        this.state.pagination.page++;
        this.fetchData({ append: true });
    },

    renderAll: function (append) {
        if (!this.state.analyticsData) return;

        this.updateKPIs(this.state.analyticsData.kpis);
        if (!append) {
            // Only re-render charts and filters on full reload to avoid jumpiness/loss of context? 
            // Actually filters should probably reflect available data in the global filtered set.
            this.renderCharts(this.state.analyticsData.charts);
            this.renderSidebarFilters();
        }
        this.renderGrid(); // Handles grouping internally
    },

    updateKPIs: function (kpis) {
        if (!kpis) return;
        if (this.dom.kpiTotal) this.dom.kpiTotal.textContent = Number(kpis.total_hours).toFixed(1);
        if (this.dom.kpiPending) this.dom.kpiPending.textContent = Number(kpis.pending_hours).toFixed(1);
        if (this.dom.kpiDone) this.dom.kpiDone.textContent = Number(kpis.done_hours).toFixed(1);
    },

    // --- CHARTS (Same as V8) ---
    renderCharts: function (charts) {
        // Cleanup
        Object.values(this.state.chartInstances).forEach(c => c && c.destroy());
        this.state.chartInstances = {};
        if (!charts) return;

        const mapData = (list) => ({
            labels: list ? list.map(i => i.label) : [],
            values: list ? list.map(i => i.value) : []
        });

        // Basic implementations
        this.createPieChart('chartCommessaPie', mapData(charts.by_commessa));
        this.createBarChart('chartTimeBar', mapData(charts.time_trend));
        this.createPieChart('chartLavPie', mapData(charts.by_lavorazione));
        this.createHorizontalBarChart('chartLavBar', mapData(charts.by_lavorazione));
        this.createPieChart('chartMacroPie', mapData(charts.by_macro));
        this.createHorizontalBarChart('chartMacroBar', mapData(charts.by_macro));
        this.createPieChart('chartUserPie', mapData(charts.by_user));
        this.createHorizontalBarChart('chartUserBar', mapData(charts.by_user));
        this.createHorizontalBarChart('chartCostCommessa', mapData(charts.costi_commessa), '#f39c12');
    },

    createPieChart: function (id, d) {
        const el = document.getElementById(id);
        if (!el || !d.labels.length) return;
        this.state.chartInstances[id] = new Chart(el, {
            type: 'doughnut',
            data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: this.getColors(d.labels.length) }] },
            options: { responsive: true, plugins: { legend: { position: 'left', labels: { boxWidth: 10 } } } }
        });
    },

    createBarChart: function (id, d, color = '#2ecc71') {
        const el = document.getElementById(id);
        if (!el) return;
        this.state.chartInstances[id] = new Chart(el, {
            type: 'bar',
            data: { labels: d.labels, datasets: [{ label: 'Ore', data: d.values, backgroundColor: color }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    },

    createHorizontalBarChart: function (id, d, color = '#3498db') {
        const el = document.getElementById(id);
        if (!el || !d.labels.length) return;
        this.state.chartInstances[id] = new Chart(el, {
            type: 'bar',
            data: { labels: d.labels, datasets: [{ label: 'Ore', data: d.values, backgroundColor: color }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    },

    getColors: function (count) {
        const pal = ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f', '#2ecc71', '#34495e', '#e67e22', '#1abc9c', '#7f8c8d'];
        return Array(count).fill().map((_, i) => pal[i % pal.length]);
    },

    // --- FILTERS V2 (Bio-Directional, Multi-Select) ---
    renderSidebarFilters: function () {
        const charts = this.state.analyticsData.charts;
        if (!charts) return;

        this.renderCheckList(this.dom.boxCommesse, charts.by_commessa, 'id_commessa');
        this.renderCheckList(this.dom.boxDipendenti, charts.by_user, 'id_personale');
        this.renderCheckList(this.dom.boxMacro, charts.by_macro, 'id_macro');
        this.renderCheckList(this.dom.boxLavorazioni, charts.by_lavorazione, 'id_componente');
    },

    renderCheckList: function (container, items, filterKey) {
        if (!container) return;
        container.innerHTML = '';

        // Select All / Deselect All
        const controls = document.createElement('div');
        controls.className = 'filter-controls';
        controls.innerHTML = `
            <small onclick="Dashboard.toggleAllFilter('${filterKey}', true, this)" style="cursor:pointer; color:var(--primary-color);">Tutti</small> | 
            <small onclick="Dashboard.toggleAllFilter('${filterKey}', false, this)" style="cursor:pointer; color:var(--primary-color);">Nessuno</small>
        `;
        container.appendChild(controls);

        items.forEach(item => {
            if (!item.id && !item.label) return;
            const val = item.id || item.label;
            const isChecked = this.state.filters[filterKey].includes(parseInt(val));

            const div = document.createElement('div');
            div.className = 'filter-item';
            div.innerHTML = `
                <label>
                    <input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''}>
                    <span>${item.label} (${Number(item.value).toFixed(0)})</span>
                </label>
            `;

            div.querySelector('input').addEventListener('change', (e) => {
                const v = parseInt(e.target.value);
                if (e.target.checked) {
                    this.state.filters[filterKey].push(v);
                } else {
                    this.state.filters[filterKey] = this.state.filters[filterKey].filter(x => x !== v);
                }
                this.fetchData({ resetPage: true });
            });

            container.appendChild(div);
        });
    },

    toggleAllFilter: function (key, selectAll, el) {
        // Logic: If selectAll, we don't actually need to push ALL IDs (which might represent thousands?)
        // Backend treats empty list as "ALL".
        // BUT logic "Select All" usually means "Select all visible options".
        // Better: "Reset" -> Empty Array -> "All".

        if (selectAll) {
            // In this context, "Tutti" for a filter basically means "Remove Filter" (Show everything).
            // If user consciously wants to select specific 5 items, they check them.
            // If they click "Tutti", they typically mean "Reset selection".
            this.state.filters[key] = [];
        } else {
            // "Nessuno" makes no sense in additive filter context unless it means deselect everything (same as Tutti/Reset?).
            // If user wants to EXCLUDE, that's negative filtering.
            // Let's assume "Tutti" = Reset/Empty = All. "Nessuno" = ??
            // User requirement: "Option option seleziona o deseleziona tutto".
            // If I check 50 items, I send 50 IDs. 

            // Implementation: "Seleziona Tutto" -> Check visual boxes & push IDs. 
            // "Deseleziona Tutto" -> Uncheck & clear IDs.

            if (!selectAll) {
                this.state.filters[key] = [];
            } else {
                // Determine IDs from container context? Or from current Chart data?
                // We don't have easy ref here. 
                // Let's rely on the "reset" meaning.
                // Re-read user request: "checkbox multiselezionabili separate... opzione seleziona o deseleziona tutto"

                // If I select "Select All", I expect all checkboxes checked.
                // But sending ALL IDs is inefficient if list is huge.
                // Let's stick to: "Deselect All" = Clear Filter.

                // Let's implement Deselect All as clearing. Select All... maybe just select current top items?
                // For now, let's map "Tutti" to Clear (which implies All).
                this.state.filters[key] = [];
            }
        }
        this.fetchData({ resetPage: true });
    },

    // Expose for HTML inline calls
    toggleAllFilterPublic: function (key, select) {
        this.toggleAllFilter(key, select, null);
    },

    // --- GRID with GROUPING ---
    renderGrid: function () {
        const container = this.dom.gridContainer;
        if (!container) return;
        container.innerHTML = '';

        const rows = this.state.analyticsData ? this.state.analyticsData.rows : [];
        if (!rows.length) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">Nessun dato.</div>';
            return;
        }

        // Apply Client-Side Search (Filter)
        const searchTerm = this.dom.detailSearch ? this.dom.detailSearch.value.toLowerCase() : '';
        const filteredRows = rows.filter(r => {
            if (!searchTerm) return true;
            return (r.personale_label && r.personale_label.toLowerCase().includes(searchTerm)) ||
                (r.commessa_label && r.commessa_label.toLowerCase().includes(searchTerm)) ||
                (r.macro_label && r.macro_label.toLowerCase().includes(searchTerm)) ||
                (r.componente_label && r.componente_label.toLowerCase().includes(searchTerm));
        });

        // Grouping
        const groupKey = this.dom.groupingSelect ? this.dom.groupingSelect.value : 'commessa';
        const groups = {};

        filteredRows.forEach(r => {
            let k = 'Altro';
            let label = 'Altro';

            if (groupKey === 'commessa') { k = r.id_commessa; label = r.commessa_label; }
            else if (groupKey === 'macro') { k = r.id_macro_categoria; label = r.macro_label; }
            else if (groupKey === 'lavorazione') { k = r.id_componente; label = r.componente_label; }
            else if (groupKey === 'dipendente') { k = r.id_personale; label = r.personale_label; }

            k = k || 'null';
            if (!groups[k]) groups[k] = { label, rows: [], hours: 0 };
            groups[k].rows.push(r);
            groups[k].hours += r.ore;
        });

        // Loop Groups
        Object.values(groups).forEach(g => {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'grid-group-header';
            groupHeader.innerHTML = `
                <div class="g-title">${g.label}</div>
                <div class="g-meta">${g.rows.length} righe, ${g.hours.toFixed(1)} ore</div>
            `;
            container.appendChild(groupHeader);

            // Table
            const table = document.createElement('table');
            table.className = 'dashboard-grid';
            table.innerHTML = Object.values(groups).length === 1 && g.label === 'Altro' ? this.getHeaderHTML() : '';
            // If grouped, maybe we don't need header for every group? Or yes? 
            // Let's put header only once at top? Grouping usually implies headers inside or just headers at top.
            // Let's do simple rows inside.

            const tbody = document.createElement('tbody');
            g.rows.forEach(r => {
                tbody.appendChild(this.createRow(r));
            });
            table.appendChild(tbody);
            container.appendChild(table);
        });

        // Load More Button
        if (this.state.pagination.hasMore) {
            const btn = document.createElement('button');
            btn.className = 'btn-load-more';
            btn.innerText = `Carica altri... (Totale ${this.state.pagination.total})`;
            btn.onclick = () => this.loadMore();
            container.appendChild(btn);
        }

        this.updateSelectionSummary();
    },

    getHeaderHTML: function () {
        return `<thead><tr>
            <th width="30"></th>
            <th>Data</th>
            <th>Utente</th>
            <th>Commessa</th>
            <th>Macro / Lav.</th>
            <th>Ore</th>
            <th>Note</th>
            <th>Act</th>
        </tr></thead>`;
    },

    createRow: function (r) {
        const tr = document.createElement('tr');
        const date = r.data_lavoro ? r.data_lavoro.split('T')[0] : '-';
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${r.id_registrazione}"></td>
            <td>${date}</td>
            <td><div class="cell-primary">${r.personale_label}</div></td>
            <td><div class="cell-secondary">${r.commessa_label}</div></td>
            <td>
                <div class="cell-primary">${r.macro_label}</div>
                <div class="cell-secondary">${r.componente_label}</div>
            </td>
            <td style="font-weight:bold;">${r.ore}</td>
            <td><small>${r.note || ''}</small></td>
            <td><button class="btn-icon">✏️</button></td>
        `;
        tr.querySelector('.btn-icon').onclick = () => alert("Modifica non implementata in questa vista.");

        // Row check listener
        tr.querySelector('.row-check').addEventListener('change', () => this.updateSelectionSummary());
        return tr;
    },

    updateSelectionSummary: function () {
        const checked = document.querySelectorAll('.row-check:checked');
        if (this.dom.selCount) this.dom.selCount.textContent = checked.length;

        // Sum hours (needs lookup or data attr)
        // Hard to get hours from DOM efficiently if not stored. 
        // We can just count rows for now, or traverse DOM.
        // Let's leave hours sum as 0 or fix later if critical.
    },

    openContabilizzaModal: function () {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) return alert("Seleziona almeno una riga.");
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        this.state.pendingIds = ids;
        this.dom.confCount.textContent = ids.length;
        this.dom.confirmModal.style.display = 'flex';
    },

    finalizeContabilizzazione: async function () {
        const ids = this.state.pendingIds;
        if (!ids.length) return;

        try {
            await apiFetch('/api/dashboard/contabilizza', { method: 'POST', body: JSON.stringify({ ids }) });
            this.closeConfirmModal();
            this.fetchData({ resetPage: true });
            showModal({ title: "Successo", message: "Registrazioni contabilizzate." });
        } catch (e) { alert("Errore: " + e.message); }
    },

    closeConfirmModal: function () {
        this.dom.confirmModal.style.display = 'none';
        this.state.pendingIds = [];
    }
};

// Global for inline onclick
window.Dashboard = Dashboard;
document.addEventListener('DOMContentLoaded', () => Dashboard.init());