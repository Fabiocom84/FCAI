// js/dashboard.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const Dashboard = {
    state: {
        rawData: [],
        filteredData: [],
        activeStatuses: new Set(['0']), 
        grouping: 'commessa', 
        
        // --- NUOVI STATI FILTRI ---
        filters: {
            commesse: new Set(),
            dipendenti: new Set(),
            macro: new Set(),
            lavorazioni: new Set()
        },
        
        charts: { dist: null, time: null }
    },

    dom: {
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),
        
        btnInbox: document.getElementById('btnModeInbox'),
        btnArchive: document.getElementById('btnModeArchive'),
        groupSelect: document.getElementById('groupingSelect'),
        
        // --- CONTENITORI LISTE FILTRI ---
        // Nota: Ora puntiamo ai DIV .filter-box per iniettare tutto (header + lista)
        boxCommesse: document.getElementById('boxCommesse'),
        boxDipendenti: document.getElementById('boxDipendenti'),
        boxMacro: document.getElementById('boxMacro'),
        boxLavorazioni: document.getElementById('boxLavorazioni'),
        
        selectionSummary: document.getElementById('selectionSummary'),
        btnContabilizza: document.getElementById('btnContabilizza'),
        
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),
        
        kpiTotal: document.getElementById('kpiTotalHours'),
        kpiPending: document.getElementById('kpiPending'),
        kpiDone: document.getElementById('kpiDone'),
        
        canvasDist: document.getElementById('chartDistribution'),
        canvasTimeline: document.getElementById('chartTimeline'),
        
        gridContainer: document.getElementById('dataGridContainer'),
        detailSearch: document.getElementById('detailSearch'),
        btnExpandAll: document.getElementById('btnExpandAll'),
        btnCollapseAll: document.getElementById('btnCollapseAll')
    },

    init: function() {
        console.log("🚀 Dashboard Init (Advanced Filters)");
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
        if(this.dom.btnContabilizza) this.dom.btnContabilizza.addEventListener('click', () => this.contabilizzaSelection());
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
        // Reset filtri al cambio modalità per evitare stati inconsistenti
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

        try {
            const params = new URLSearchParams();
            if (this.dom.dateStart.value) params.append('start', this.dom.dateStart.value);
            if (this.dom.dateEnd.value) params.append('end', this.dom.dateEnd.value);

            if (this.state.activeStatuses.size === 1) {
                const val = Array.from(this.state.activeStatuses)[0];
                params.append('stato', val);
            }

            const res = await apiFetch(`/api/dashboard/stats?${params.toString()}`);
            const payload = await res.json();
            
            this.state.rawData = payload.rows || [];
            this.state.filteredData = [...this.state.rawData]; 
            
            this.buildSidebarFilters(); 
            this.applySidebarFilters();
            
        } catch (e) {
            console.error(e);
        } finally {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    // --- LOGICA FILTRI AVANZATA ---
    buildSidebarFilters: function() {
        const maps = {
            commesse: new Map(),
            dipendenti: new Map(),
            macro: new Map(),
            lavorazioni: new Map()
        };
        
        this.state.rawData.forEach(row => {
            // Commesse
            const cName = row.commesse ? row.commesse.impianto : 'Nessuna Commessa';
            const cId = row.commesse ? String(row.commesse.id_commessa) : 'null';
            maps.commesse.set(cId, cName);

            // Dipendenti
            const dName = row.personale ? row.personale.nome_cognome : 'Ex Dipendente';
            const dId = row.personale ? String(row.personale.id_personale) : 'null';
            maps.dipendenti.set(dId, dName);

            // Macro Categorie (Nome dal backend)
            const mName = row.nome_macro || 'Nessun Reparto';
            // Usiamo il nome come ID univoco per il filtro frontend
            maps.macro.set(mName, mName); 

            // Lavorazioni (Componenti)
            const lName = row.componenti ? row.componenti.nome_componente : 'Generico';
            const lId = row.componenti ? String(row.componenti.id_componente) : 'null';
            maps.lavorazioni.set(lId, lName);
        });

        // Renderizza i 4 box
        this.renderSmartFilterBox(this.dom.boxCommesse, 'Commesse', maps.commesse, 'commesse');
        this.renderSmartFilterBox(this.dom.boxDipendenti, 'Dipendenti', maps.dipendenti, 'dipendenti');
        this.renderSmartFilterBox(this.dom.boxMacro, 'Macrocategorie', maps.macro, 'macro');
        this.renderSmartFilterBox(this.dom.boxLavorazioni, 'Lavorazioni', maps.lavorazioni, 'lavorazioni');
    },

    /**
     * Crea un box filtro completo con Header, Azioni e Lista
     */
    renderSmartFilterBox: function(containerBox, title, mapData, filterKey) {
        if(!containerBox) return;
        containerBox.innerHTML = ''; // Pulisci

        // 1. Crea Header con azioni
        const header = document.createElement('div');
        header.className = 'filter-header-smart';
        header.innerHTML = `
            <div class="fh-title">
                <span class="toggle-arrow">▼</span> ${title} <small>(${mapData.size})</small>
            </div>
            <div class="fh-actions">
                <button class="action-mini-btn btn-check-all" title="Seleziona Tutti">☑️</button>
                <button class="action-mini-btn btn-uncheck-all" title="Deseleziona Tutti">⬜</button>
            </div>
        `;

        // 2. Crea Lista
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

        // 3. Eventi Header (Toggle)
        header.querySelector('.fh-title').addEventListener('click', () => {
            containerBox.classList.toggle('collapsed');
        });

        // 4. Eventi Azioni Massiva (Stop Propagation per non chiudere il box)
        header.querySelector('.btn-check-all').addEventListener('click', (e) => {
            e.stopPropagation();
            this.setAllCheckboxes(listDiv, true);
            this.updateFilterSet(filterKey, listDiv);
            this.applySidebarFilters();
        });

        header.querySelector('.btn-uncheck-all').addEventListener('click', (e) => {
            e.stopPropagation();
            this.setAllCheckboxes(listDiv, false);
            this.updateFilterSet(filterKey, listDiv);
            this.applySidebarFilters();
        });

        containerBox.appendChild(header);
        containerBox.appendChild(listDiv);

        // Inizializza il Set interno
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
            const mName = row.nome_macro || 'Nessun Reparto'; // La chiave per macro è il nome

            // Logica AND tra categorie (deve soddisfare TUTTE le categorie attive)
            // Logica OR dentro la categoria (basta che sia in uno dei check selezionati)
            
            // Nota: Se un set è vuoto (tutto deselezionato), filtriamo tutto via?
            // Sì, comportamento standard dei filtri.
            
            return f.commesse.has(cId) && 
                   f.dipendenti.has(dId) &&
                   f.macro.has(mName) &&
                   f.lavorazioni.has(lId);
        });

        this.renderAll();
    },

    // --- RENDER MAIN (Invariato ma richiamato dai nuovi filtri) ---
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

    renderCharts: function() {
        if (this.state.charts.dist) this.state.charts.dist.destroy();
        if (this.state.charts.time) this.state.charts.time.destroy();

        if(!this.dom.canvasDist || !this.dom.canvasTimeline) return;

        const labels = {};
        this.state.filteredData.forEach(r => {
            // Usa il raggruppamento corrente per il grafico a torta
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
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });

        const days = {};
        this.state.filteredData.forEach(r => {
            const d = r.data_lavoro.split('T')[0];
            days[d] = (days[d] || 0) + r.ore;
        });
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
                <div class="gh-left">
                    <span class="toggle-icon">▶</span> 
                    <span>${g.label}</span>
                </div>
                <div class="gh-right">
                    <span style="margin-right:15px; font-weight:normal; font-size:0.8rem;">Tot: <b>${g.total.toFixed(1)}h</b></span>
                    <input type="checkbox" class="group-check" title="Seleziona Gruppo">
                </div>
            `;
            
            const body = document.createElement('div');
            body.className = 'group-body';
            
            let rowsHtml = '';
            g.rows.forEach(r => {
                const date = new Date(r.data_lavoro).toLocaleDateString();
                const person = r.personale ? r.personale.nome_cognome : '-';
                const task = r.componenti ? r.componenti.nome_componente : '-';
                const macro = r.nome_macro || ''; // Aggiungo info macro nella griglia per chiarezza
                const note = r.note || '';
                
                rowsHtml += `
                    <tr>
                        <td width="30"><input type="checkbox" class="row-check" value="${r.id_registrazione}"></td>
                        <td width="90">${date}</td>
                        <td width="150" title="${person}">${person}</td>
                        <td title="${macro} > ${task}">${task} <span style="color:#999; font-size:0.7em;">(${macro})</span></td>
                        <td width="60" style="font-weight:bold; text-align:center;">${r.ore}</td>
                        <td><small>${note}</small></td>
                        <td width="40" style="text-align:center;"><button class="btn-icon">✏️</button></td>
                    </tr>
                `;
            });
            
            body.innerHTML = `<table><thead><tr><th><input type="checkbox" disabled></th><th>Data</th><th>Chi</th><th>Lavorazione</th><th>Ore</th><th>Note</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
            
            header.addEventListener('click', (e) => {
                if(e.target.type !== 'checkbox') {
                    body.classList.toggle('open');
                    header.querySelector('.toggle-icon').textContent = body.classList.contains('open') ? '▼' : '▶';
                }
            });

            const groupCheck = header.querySelector('.group-check');
            groupCheck.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                body.querySelectorAll('.row-check').forEach(cb => cb.checked = isChecked);
                this.updateSelectionSummary();
            });

            body.querySelectorAll('.row-check').forEach(cb => {
                cb.addEventListener('change', () => this.updateSelectionSummary());
            });
            
            groupHtml.appendChild(header);
            groupHtml.appendChild(body);
            container.appendChild(groupHtml);
        });
    },

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
        if (mode === 'macro') {
            const m = row.nome_macro || 'Nessun Reparto';
            return { id: m, label: `🏗️ ${m}` };
        }
        if (mode === 'lavorazione') {
            return {
                id: row.componenti ? row.componenti.id_componente : 'nl',
                label: row.componenti ? row.componenti.nome_componente : 'Nessuna Lavorazione'
            };
        }
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
        if(this.dom.selectionSummary) this.dom.selectionSummary.textContent = `${count} righe selezionate`;
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
            showModal({ title: "Successo", message: "Righe contabilizzate." });
            this.fetchData(); 
        } catch(e) { alert("Errore: " + e.message); }
    },

    filterGridLocal: function(term) {
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