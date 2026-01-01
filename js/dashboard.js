// js/dashboard.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const Dashboard = {
    state: {
        rawData: [],
        filteredData: [],
        // Set attivo per gli stati (0=Inbox, 1=Archivio). Default: solo Inbox
        activeStatuses: new Set(['0']), 
        grouping: 'commessa', 
        
        // Stati dei filtri laterali
        filters: {
            commesse: new Set(),
            dipendenti: new Set(),
            macro: new Set(),
            lavorazioni: new Set()
        },

        pendingIds: [],
        
        charts: { dist: null, time: null }
    },

    dom: {
        // Date
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),
        
        // Mode & Grouping
        btnInbox: document.getElementById('btnModeInbox'),
        btnArchive: document.getElementById('btnModeArchive'),
        groupSelect: document.getElementById('groupingSelect'),
        
        // Contenitori Filtri (DIV nel DOM)
        boxCommesse: document.getElementById('boxCommesse'),
        boxDipendenti: document.getElementById('boxDipendenti'),
        boxMacro: document.getElementById('boxMacro'),
        boxLavorazioni: document.getElementById('boxLavorazioni'),
        
        // Azioni
        btnContabilizza: document.getElementById('btnContabilizza'),
        
        // Footer Status Bar
        selCount: document.getElementById('selCount'),
        selHours: document.getElementById('selHours'),
        statusMsg: document.getElementById('statusMsg'),

        // Viste e Tab
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),
        
        // KPI Sintesi
        kpiTotal: document.getElementById('kpiTotalHours'),
        kpiPending: document.getElementById('kpiPending'),
        kpiDone: document.getElementById('kpiDone'),
        
        // Grafici
        canvasDist: document.getElementById('chartDistribution'),
        canvasTimeline: document.getElementById('chartTimeline'),
        
        // Griglia Dettaglio
        gridContainer: document.getElementById('dataGridContainer'),
        detailSearch: document.getElementById('detailSearch'),
        btnExpandAll: document.getElementById('btnExpandAll'),
        btnCollapseAll: document.getElementById('btnCollapseAll'),

        // NUOVI ELEMENTI MODALE CONFERMA
        confirmModal: document.getElementById('confirmModal'),
        confCount: document.getElementById('confCount'),
        confHours: document.getElementById('confHours'),
        btnCancelConfirm: document.getElementById('btnCancelConfirm'),
        btnProceedConfirm: document.getElementById('btnProceedConfirm'),
        closeConfirmModal: document.getElementById('closeConfirmModal')
    },

    init: function() {
        console.log("🚀 Dashboard Init Complete v3.0");
        this.initDates();
        this.addListeners();
        this.fetchData();
        this.addListeners();
    },

    initDates: function() {
        // Lasciamo vuoto per indicare "Tutto lo storico" di default
        if(this.dom.dateStart) this.dom.dateStart.value = '';
        if(this.dom.dateEnd) this.dom.dateEnd.value = '';
    },

    addListeners: function() {
        // 1. Refresh & Mode
        if(this.dom.btnRefresh) this.dom.btnRefresh.addEventListener('click', () => this.fetchData());
        
        if(this.dom.btnInbox) this.dom.btnInbox.addEventListener('click', () => this.toggleStatus('0', this.dom.btnInbox));
        if(this.dom.btnArchive) this.dom.btnArchive.addEventListener('click', () => this.toggleStatus('1', this.dom.btnArchive));

        // 2. Raggruppamento
        if(this.dom.groupSelect) {
            this.dom.groupSelect.addEventListener('change', (e) => {
                this.state.grouping = e.target.value;
                this.renderAll();
            });
        }

        // 3. Tab Switching
        this.dom.viewTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewTabs.forEach(b => b.classList.remove('active'));
                this.dom.views.forEach(v => v.classList.remove('active'));
                
                e.target.classList.add('active');
                const target = document.getElementById(e.target.dataset.target);
                if(target) target.classList.add('active');
            });
        });

        // 4. Grid Actions
        if(this.dom.btnExpandAll) this.dom.btnExpandAll.addEventListener('click', () => this.toggleAllGroups(true));
        if(this.dom.btnCollapseAll) this.dom.btnCollapseAll.addEventListener('click', () => this.toggleAllGroups(false));
        if(this.dom.detailSearch) this.dom.detailSearch.addEventListener('input', (e) => this.filterGridLocal(e.target.value));
        
        // 5. Contabilizza
        if(this.dom.btnContabilizza) this.dom.btnContabilizza.addEventListener('click', () => this.contabilizzaSelection());

        // NUOVI LISTENERS PER IL MODALE
        if(this.dom.btnCancelConfirm) this.dom.btnCancelConfirm.addEventListener('click', () => this.closeConfirmModal());
        if(this.dom.closeConfirmModal) this.dom.closeConfirmModal.addEventListener('click', () => this.closeConfirmModal());
        
        // Cliccando "CONFERMA" nel modale
        if(this.dom.btnProceedConfirm) this.dom.btnProceedConfirm.addEventListener('click', () => this.finalizeContabilizzazione());
    },

    toggleStatus: function(statusValue, btnElement) {
        if (this.state.activeStatuses.has(statusValue)) {
            // Impedisce di deselezionare tutto (almeno uno deve restare attivo)
            if (this.state.activeStatuses.size > 1) {
                this.state.activeStatuses.delete(statusValue);
                btnElement.classList.remove('active');
            }
        } else {
            this.state.activeStatuses.add(statusValue);
            btnElement.classList.add('active');
        }
        // Resetta i filtri laterali quando cambi modalità per coerenza
        this.resetAllFilters();
        this.fetchData();
    },

    resetAllFilters: function() {
        this.state.filters.commesse.clear();
        this.state.filters.dipendenti.clear();
        this.state.filters.macro.clear();
        this.state.filters.lavorazioni.clear();
    },

    // --- DATA FETCHING ---
    fetchData: async function() {
        const btn = this.dom.btnRefresh;
        const originalIcon = btn.innerHTML; 
        btn.innerHTML = "⏳"; 
        btn.disabled = true;
        
        if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Caricamento dati...";

        try {
            const params = new URLSearchParams();
            
            // Invia date solo se popolate
            if (this.dom.dateStart.value) params.append('start', this.dom.dateStart.value);
            if (this.dom.dateEnd.value) params.append('end', this.dom.dateEnd.value);

            // Gestione Stato (0, 1 o Entrambi)
            // Se sono selezionati entrambi (size=2), non inviamo 'stato' -> il backend restituisce tutto.
            if (this.state.activeStatuses.size === 1) {
                const val = Array.from(this.state.activeStatuses)[0];
                params.append('stato', val);
            }

            const res = await apiFetch(`/api/dashboard/stats?${params.toString()}`);
            const payload = await res.json();
            
            this.state.rawData = payload.rows || [];
            // Inizialmente i dati filtrati coincidono con quelli grezzi
            this.state.filteredData = [...this.state.rawData]; 
            
            this.buildSidebarFilters(); 
            this.applySidebarFilters();
            
            if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Dati aggiornati.";
            
        } catch (e) {
            console.error(e);
            if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Errore caricamento.";
        } finally {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    // --- HELPER: FORMATTAZIONE ETICHETTA COMMESSA ---
    getCommessaLabel: function(c) {
        if (!c) return 'Nessuna Commessa';
        const parts = [];
        // Ordine: Cliente | Impianto | VO | Rif
        if (c.clienti && c.clienti.ragione_sociale) parts.push(c.clienti.ragione_sociale);
        if (c.impianto) parts.push(c.impianto);
        if (c.vo) parts.push(c.vo);
        if (c.riferimento_tecnico) parts.push(c.riferimento_tecnico);
        
        return parts.length > 0 ? parts.join(' | ') : 'Dati mancanti';
    },

    // --- SIDEBAR FILTERS ---
    buildSidebarFilters: function() {
        const maps = {
            commesse: new Map(),
            dipendenti: new Map(),
            macro: new Map(),
            lavorazioni: new Map()
        };
        
        this.state.rawData.forEach(row => {
            // Commessa (Etichetta complessa)
            const cName = this.getCommessaLabel(row.commesse);
            const cId = row.commesse ? String(row.commesse.id_commessa) : 'null';
            maps.commesse.set(cId, cName);

            // Dipendente
            const dName = row.personale ? row.personale.nome_cognome : 'Ex Dipendente';
            const dId = row.personale ? String(row.personale.id_personale) : 'null';
            maps.dipendenti.set(dId, dName);

            // Macro Categoria (usa nome backend)
            const mName = row.nome_macro || 'Nessun Reparto';
            maps.macro.set(mName, mName); 

            // Lavorazione
            const lName = row.componenti ? row.componenti.nome_componente : 'Generico';
            const lId = row.componenti ? String(row.componenti.id_componente) : 'null';
            maps.lavorazioni.set(lId, lName);
        });

        // Rendering dei Box Filtro
        this.renderSmartFilterBox(this.dom.boxCommesse, 'Commesse', maps.commesse, 'commesse');
        this.renderSmartFilterBox(this.dom.boxDipendenti, 'Dipendenti', maps.dipendenti, 'dipendenti');
        this.renderSmartFilterBox(this.dom.boxMacro, 'Macrocategorie', maps.macro, 'macro');
        this.renderSmartFilterBox(this.dom.boxLavorazioni, 'Lavorazioni', maps.lavorazioni, 'lavorazioni');
    },

    renderSmartFilterBox: function(containerBox, title, mapData, filterKey) {
        if(!containerBox) return;
        containerBox.innerHTML = ''; 

        // Header con azioni
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

        // Lista
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

        // Eventi Toggle Apertura/Chiusura
        header.querySelector('.fh-title').addEventListener('click', () => {
            containerBox.classList.toggle('collapsed');
        });

        // Eventi Azioni di Massa
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

        // Init Set
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

            return f.commesse.has(cId) && 
                   f.dipendenti.has(dId) &&
                   f.macro.has(mName) &&
                   f.lavorazioni.has(lId);
        });

        this.renderAll();
    },

    // --- RENDER MAIN ---
    renderAll: function() {
        this.calculateKPI();
        this.renderCharts();
        this.renderGrid();
        this.updateSelectionSummary(); // Reset footer al render
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

        // Distribuzione (in base al raggruppamento attivo)
        const labels = {};
        this.state.filteredData.forEach(r => {
            let key = this.getGroupKey(r, this.state.grouping).label;
            // Pulizia label per il grafico (toglie le emoji se presenti)
            key = key.replace(/📂|🏗️|🔧|👤/g, '').trim(); 
            labels[key] = (labels[key] || 0) + r.ore;
        });

        const ctxDist = this.dom.canvasDist.getContext('2d');
        this.state.charts.dist = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: Object.keys(labels),
                datasets: [{ data: Object.values(labels), backgroundColor: this.getColors(Object.keys(labels).length) }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } 
            }
        });

        // Timeline
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
                const macro = r.nome_macro || ''; 
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
            
            // Accordion Toggle
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
                body.querySelectorAll('.row-check').forEach(cb => cb.checked = isChecked);
                this.updateSelectionSummary();
            });

            // Checkbox Righe Singole
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
                label: `📂 ${this.getCommessaLabel(row.commesse)}`
            };
        }
        if (mode === 'dipendente') {
            return {
                id: row.personale ? row.personale.id_personale : 'np',
                label: row.personale ? `👤 ${row.personale.nome_cognome}` : 'Ignoto'
            };
        }
        if (mode === 'macro') {
            const m = row.nome_macro || 'Nessun Reparto';
            return { id: m, label: `🏗️ ${m}` };
        }
        if (mode === 'lavorazione') {
            return {
                id: row.componenti ? row.componenti.id_componente : 'nl',
                label: row.componenti ? `🔧 ${row.componenti.nome_componente}` : 'Nessuna Lavorazione'
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

    // --- CALCOLO TOTALI FOOTER ---
    updateSelectionSummary: function() {
        const checkedBoxes = document.querySelectorAll('.row-check:checked');
        const count = checkedBoxes.length;
        
        let totalHours = 0;
        
        // Mappa ID -> Ore per performance
        const rowsMap = new Map(this.state.filteredData.map(r => [r.id_registrazione, r.ore]));

        checkedBoxes.forEach(cb => {
            const id = parseInt(cb.value);
            const ore = rowsMap.get(id) || 0;
            totalHours += ore;
        });

        // Aggiorna UI Footer
        if(this.dom.selCount) this.dom.selCount.textContent = count;
        if(this.dom.selHours) this.dom.selHours.textContent = totalHours.toFixed(1);
    },

    contabilizzaSelection: function() {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) return alert("Seleziona almeno una riga.");
        
        // 1. Raccogli gli ID
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        this.state.pendingIds = ids; // Salva nello stato temporaneo

        // 2. Calcola i totali per il riepilogo
        let totalHours = 0;
        const rowsMap = new Map(this.state.filteredData.map(r => [r.id_registrazione, r.ore]));
        ids.forEach(id => {
            totalHours += (rowsMap.get(id) || 0);
        });

        // 3. Popola e Mostra Modale
        this.dom.confCount.textContent = ids.length;
        this.dom.confHours.textContent = totalHours.toFixed(1) + " h";
        
        // Usa flex per centrare (come definito nel CSS .modal)
        this.dom.confirmModal.style.display = 'flex'; 
    },

    // --- NUOVA: Esegue l'API dopo la conferma ---
    finalizeContabilizzazione: async function() {
        const ids = this.state.pendingIds;
        if (!ids || ids.length === 0) return;

        // Feedback visivo sul bottone conferma
        const btn = this.dom.btnProceedConfirm;
        const oldText = btn.textContent;
        btn.textContent = "Elaborazione...";
        btn.disabled = true;

        try {
            await apiFetch('/api/dashboard/contabilizza', {
                method: 'POST',
                body: JSON.stringify({ ids })
            });
            
            this.closeConfirmModal();
            showModal({ title: "Successo", message: `${ids.length} registrazioni contabilizzate.` });
            this.fetchData(); // Ricarica la tabella
            
        } catch(e) {
            alert("Errore: " + e.message);
        } finally {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    },

    closeConfirmModal: function() {
        this.dom.confirmModal.style.display = 'none';
        this.state.pendingIds = [];
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