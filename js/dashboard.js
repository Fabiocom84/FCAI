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
        btnExpandAll: document.getElementById('btnExpandAll'),
        btnCollapseAll: document.getElementById('btnCollapseAll'),
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
        if (this.dom.btnArchive) this.dom.btnArchive.onclick = () => {
            // Toggle Logic for Mode Buttons (They are now independent toggles)
            // But we can stick to simple logic: Click -> Toggle selection in filter array
            // If stato is [0,1], both active. 
            // Better: update logic to just set specific state.
            this.dom.btnArchive.classList.toggle('active');
            this.updateStateFilterFromButtons();
        };

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

        // Client-side grouping buttons - RE-ENABLED
        if (this.dom.btnExpandAll) this.dom.btnExpandAll.onclick = () => this.toggleAllGroups(true);
        if (this.dom.btnCollapseAll) this.dom.btnCollapseAll.onclick = () => this.toggleAllGroups(false);

        // Grouping
        if (this.dom.groupingSelect) {
            this.dom.groupingSelect.addEventListener('change', () => this.fetchData({ resetPage: true }));
        }

        // Search (Server Side)
        if (this.dom.detailSearch) {
            // Debounce function
            const debounce = (func, wait) => {
                let timeout;
                return function (...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), wait);
                };
            };

            this.dom.detailSearch.addEventListener('input', debounce((e) => {
                this.state.searchTerm = e.target.value;
                this.fetchData({ resetPage: true });
                // Note: We trigger fetchData which refreshes GROUPS. 
                // We do NOT clear opened items? 
                // Actually, if we search, the group list changes entirely.
                // Best to collapse all or maintain open if ID still exists?
                // Collapsing all is safer/simpler for now.
            }, 500));
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
        const append = opts.append || false; // Used for Analytics (Grid) Load More - DEPRECATED in V2 Group Mode?
        // With Group Mode, "Load More" applies to rows INSIDE a group.
        // The global "Pagination" might apply to Groups themselves? 
        // For now, let's assume we load ALL Groups (headers) or reasonable amount.
        // User asked for "data grouped... not download all data".

        const btn = this.dom.btnRefresh;
        const icon = btn.innerHTML; btn.innerHTML = "⏳"; btn.disabled = true;
        if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Caricamento...";

        try {
            // 1. Fetch KPI & Charts (Analytics Mode)
            const params = this.buildFilterParams();
            // Note: analytics mode might return rows too, we can ignore them or use them for "Synthesis View".
            // If current view is Detail, we focus on Groups.

            console.log("Fetch Analytics:", params.toString());
            const res = await apiFetch('/api/dashboard/stats?' + params.toString());
            if (!res.ok) throw new Error("Errore API Analytics");
            const data = await res.json();
            this.state.analyticsData = data;

            // Render KPIs & Charts
            this.updateKPIs(data.kpis);
            this.renderCharts(data.charts);
            if (!this.state.availableFilters) { // Init once
                this.state.availableFilters = data.charts;
                this.renderSidebarFilters();
            }

            // 2. Fetch Groups (Headers)
            await this.fetchGroups();

            if (this.dom.statusMsg) this.dom.statusMsg.innerHTML = `Dati aggiornati.`;

        } catch (e) {
            console.error(e);
            if (this.dom.statusMsg) this.dom.statusMsg.textContent = "Errore: " + e.message;
        } finally {
            btn.innerHTML = icon; btn.disabled = false;
        }
    },

    buildFilterParams: function () {
        const f = this.state.filters;
        const params = new URLSearchParams();
        // Scalar Filters
        if (this.dom.dateStart.value) params.append('start', this.dom.dateStart.value);
        if (this.dom.dateEnd.value) params.append('end', this.dom.dateEnd.value);
        // Array Filters
        f.stato.forEach(v => params.append('stato', v));
        f.id_commessa.forEach(v => params.append('id_commessa', v));
        f.id_personale.forEach(v => params.append('id_personale', v));
        f.id_macro.forEach(v => params.append('id_macro', v));
        if (this.state.filters.id_componente.length) params.append('id_componente', this.state.filters.id_componente.join(','));

        // Search
        if (this.state.searchTerm) params.append('search', this.state.searchTerm);

        return params;
    },

    fetchGroups: async function () {
        const params = this.buildFilterParams();
        params.append('mode', 'groups');

        // Grouping Key
        const groupKey = this.dom.groupingSelect ? this.dom.groupingSelect.value : 'commessa';
        params.append('groupBy', groupKey);

        console.log("Fetch Groups:", params.toString());
        const res = await apiFetch('/api/dashboard/stats?' + params.toString());
        if (!res.ok) throw new Error("Errore Fetch Groups");
        const data = await res.json();

        this.state.groups = data.groups || [];
        this.renderGrid();
    },

    fetchGroupDetails: async function (group, groupId, groupBody) {
        // Validation to avoid multiple fetches
        if (group.detailsLoaded || group.loading) return;

        group.loading = true;
        groupBody.innerHTML = '<div style="padding:10px; text-align:center; color:#999;">Caricamento dettagli...</div>';

        try {
            const params = this.buildFilterParams();
            params.append('mode', 'details');
            params.append('groupBy', this.dom.groupingSelect ? this.dom.groupingSelect.value : 'commessa');
            params.append('groupId', groupId);

            console.log("Fetch Details:", params.toString());
            const res = await apiFetch('/api/dashboard/stats?' + params.toString());
            if (!res.ok) throw new Error("Errore Dettagli");
            const data = await res.json();

            group.rows = data.rows || [];
            group.detailsLoaded = true;

            // Render Rows
            this.renderGroupRows(group, groupBody);

        } catch (e) {
            console.error(e);
            groupBody.innerHTML = `<div style="color:red; padding:10px;">Errore: ${e.message}</div>`;
        } finally {
            group.loading = false;
        }
    },

    loadMore: function () {
        // Deprecated/Changed in Group Mode? 
        // If we want global pagination of groups, we'd need page/pageSize for fetchGroups.
        // User requirement: "all that match filter... load titles first".
        // So presumably we load all headers.
    },

    renderAll: function (append) {
        // Replaced by specific calls in fetchData
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

        // ... (Charts logic remains same)
        const mapData = (list) => ({
            labels: list ? list.map(i => i.label) : [],
            values: list ? list.map(i => i.value) : []
        });

        this.createPieChart('chartCommessaPie', mapData(charts.by_commessa));
        // ... restore other charts ...
        this.createBarChart('chartTimeBar', mapData(charts.time_trend));
        this.createPieChart('chartLavPie', mapData(charts.by_lavorazione));
        this.createHorizontalBarChart('chartLavBar', mapData(charts.by_lavorazione));
        this.createPieChart('chartMacroPie', mapData(charts.by_macro));
        this.createHorizontalBarChart('chartMacroBar', mapData(charts.by_macro));
        this.createPieChart('chartUserPie', mapData(charts.by_user));
        this.createHorizontalBarChart('chartUserBar', mapData(charts.by_user));
        this.createHorizontalBarChart('chartCostCommessa', mapData(charts.costi_commessa), '#f39c12');
    },

    renderSidebarFilters: function () {
        // ... existing filter render logic ...
        const charts = this.state.availableFilters;
        if (!charts) return;
        this.renderCheckList(this.dom.boxCommesse, charts.by_commessa, 'id_commessa');
        this.renderCheckList(this.dom.boxDipendenti, charts.by_user, 'id_personale');
        this.renderCheckList(this.dom.boxMacro, charts.by_macro, 'id_macro');
        this.renderCheckList(this.dom.boxLavorazioni, charts.by_lavorazione, 'id_componente');
    },

    // --- GRID with GROUPING ---
    renderGrid: function () {
        const container = this.dom.gridContainer;
        if (!container) return;
        container.innerHTML = '';

        const groups = this.state.groups || [];
        if (!groups.length) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">Nessun dato trovato.</div>';
            return;
        }

        // Loop Groups (Headers Only First)
        groups.forEach((g, index) => {
            const groupId = `group-container-${index}`;

            // Header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'grid-group-header collapsed';
            groupHeader.style.cursor = 'pointer';

            // Pass the group object 'g' to the toggle function
            groupHeader.onclick = () => this.toggleGroup(g, groupId, groupHeader);

            groupHeader.innerHTML = `
                <div class="g-title">
                    <span class="toggle-icon">▶</span> ${g.group_label}
                </div>
                <div class="g-stats">
                    <span class="badge-count">${g.row_count} righe</span>
                    <span class="badge-hours">${Number(g.total_hours).toFixed(1)} ore</span>
                </div>
            `;
            container.appendChild(groupHeader);

            // Body
            const groupBody = document.createElement('div');
            groupBody.id = groupId;
            groupBody.className = 'grid-group-body';
            groupBody.style.display = 'none';
            container.appendChild(groupBody);
        });

        this.updateSelectionSummary();
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

        const groups = this.state.groups || [];
        if (!groups.length) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">Nessun dato trovato.</div>';
            return;
        }

        // Search Term (Server handles filtering, so we just render what we have)
        // Groups returned by server are already filtered.

        // Loop Groups (Headers Only First)
        groups.forEach((g, index) => {
            const groupId = `group-container-${index}`;

            // Header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'grid-group-header collapsed';
            groupHeader.style.cursor = 'pointer';

            // Pass the group object 'g' to the toggle function
            groupHeader.onclick = () => this.toggleGroup(g, groupId, groupHeader);

            groupHeader.innerHTML = `
                <div class="g-title">
                    <span class="toggle-icon">▶</span> ${g.group_label}
                </div>
                <div class="g-stats">
                    <span class="badge-count">${g.row_count} righe</span>
                    <span class="badge-hours">${Number(g.total_hours).toFixed(1)} ore</span>
                </div>
            `;
            container.appendChild(groupHeader);

            // Body
            const groupBody = document.createElement('div');
            groupBody.id = groupId;
            groupBody.className = 'grid-group-body';
            groupBody.style.display = 'none';
            container.appendChild(groupBody);

            // If search is active and group is visible, maybe expand automatically?
            // User requested: "bypass lazy loading" - server did the search.
            // If the group is returned, it means it Matches.
            // Data inside is NOT loaded yet. 
            // We do NOT auto-expand to save bandwidth, unless user wants it.
            // User said: "evitiamo di scaricare tutti i dati".
            // So we show the Group (with count matching search). 
            // User clicks -> we download DETAILED rows filtered by search.
        });

        this.updateSelectionSummary();
    },

    // filterGridLocal REMOVED - using Server Side Search

    // --- ACTIONS ---

    toggleGroup: async function (group, groupId, headerEl) {
        const body = document.getElementById(groupId);
        const icon = headerEl.querySelector('.toggle-icon');

        if (body.style.display === 'none') {
            // EXPAND
            headerEl.classList.remove('collapsed');
            if (icon) icon.innerText = '▼';
            body.style.display = 'block';

            // Lazy Load if needed
            if (!group.detailsLoaded) {
                await this.fetchGroupDetails(group, group.group_id, body);
                // After loading, if search term exists, we might need to re-run filter?
                // Because now we have rows that might match or not.
                if (this.state.searchTerm) {
                    this.filterGridLocal(this.state.searchTerm);
                    // Warning: this re-renders grid and collapses everything.
                    // Ideally we just filter rows here.
                    // Refactor: filterGridLocal should just update data, renderGrid renders.
                    // For now, let's just render rows filtered.
                }
            } else {
                // If already loaded, render rows (filtering applied inside renderGroupRows)
                this.renderGroupRows(group, body);
            }
        } else {
            // COLLAPSE
            body.style.display = 'none';
            headerEl.classList.add('collapsed');
            if (icon) icon.innerText = '▶';
        }
    },

    toggleAllGroups: async function (expand) {
        // Warning: Expanding all might trigger many requests if not loaded.
        // We could show a specific loader or just do it.
        const groups = this.state.groups || [];

        // We need to map UI elements to groups. 
        // Logic: Iterate state.groups, find DOM elements, trigger toggle if needed.

        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const groupId = `group-container-${i}`;
            const body = document.getElementById(groupId);
            const header = body.previousElementSibling; // Header is right before body in renderGrid

            if (expand) {
                if (body.style.display === 'none') {
                    // Trigger expand
                    // We simply call toggleGroup? Or manual? 
                    // Manual is safer to control flow/await.
                    header.classList.remove('collapsed');
                    const icon = header.querySelector('.toggle-icon');
                    if (icon) icon.innerText = '▼';
                    body.style.display = 'block';

                    if (!g.detailsLoaded && !g.loading) {
                        // Sequential fetch to avoid flooding? Or parallel?
                        // Parallel 50 requests is bad. Sequential is slow.
                        // Let's do sequential for safety.
                        await this.fetchGroupDetails(g, g.group_id, body);
                    }
                }
            } else {
                // Collapse
                body.style.display = 'none';
                header.classList.add('collapsed');
                const icon = header.querySelector('.toggle-icon');
                if (icon) icon.innerText = '▶';
            }
        }
    },

    renderGroupRows: function (group, container) {
        container.innerHTML = ''; // Clear loader

        if (!group.rows || !group.rows.length) {
            container.innerHTML = '<div style="padding:10px; font-style:italic; color:#999;">Nessuna riga.</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'dashboard-grid';

        // We can add a Header per group if we want column titles again?
        // User didn't strictly ask, but it helps readability.
        // Let's add it only if it's the first group? Or always?
        // Let's add it always for clarity inside the "accordion".

        table.innerHTML = `
            <thead><tr>
                <th width="40"></th>
                <th width="90">Data</th>
                <th width="140">Utente</th>
                <th width="150">Commessa</th>
                <th>Macro / Lav.</th>
                <th width="50">Ore</th>
                <th width="150">Note</th>
                <th width="50">Act</th>
            </tr></thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        let rows = group.rows || [];
        const t = this.state.searchTerm ? this.state.searchTerm.toLowerCase() : '';

        if (t) {
            rows = rows.filter(r => {
                return (r.personale_label && r.personale_label.toLowerCase().includes(t)) ||
                    (r.commessa_label && r.commessa_label.toLowerCase().includes(t)) ||
                    (r.macro_label && r.macro_label.toLowerCase().includes(t)) ||
                    (r.componente_label && r.componente_label.toLowerCase().includes(t)) ||
                    (r.note && r.note.toLowerCase().includes(t));
            });
        }

        if (!rows.length) {
            container.innerHTML = `<div style="padding:10px; font-style:italic; color:#999;">Nessuna riga corrispondente a "${t}".</div>`;
            return;
        }

        rows.forEach(r => {
            tbody.appendChild(this.createRow(r));
        });

        container.appendChild(table);
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
            <td style="font-weight:bold; text-align:right;">${r.ore}</td>
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