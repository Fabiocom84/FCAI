// js/dashboard.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const Dashboard = {
    state: {
        rawData: [],
        filteredData: [],
        activeStatuses: new Set(['0']), // '0'=Da Validare, '1'=Archivio
        grouping: 'commessa', 
        
        filters: {
            commesse: new Set(),
            dipendenti: new Set(),
            macro: new Set(),
            lavorazioni: new Set()
        },
        
        charts: { dist: null, time: null },
        
        // Stati temporanei per azioni
        editingRow: null,
        pendingIds: []
    },

    dom: {
        // Date e Refresh
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnRefresh: document.getElementById('btnRefresh'),
        
        // Modalità e Raggruppamento
        btnInbox: document.getElementById('btnModeInbox'),
        btnArchive: document.getElementById('btnModeArchive'),
        groupSelect: document.getElementById('groupingSelect'),
        
        // Container Filtri Sidebar
        boxCommesse: document.getElementById('boxCommesse'),
        boxDipendenti: document.getElementById('boxDipendenti'),
        boxMacro: document.getElementById('boxMacro'),
        boxLavorazioni: document.getElementById('boxLavorazioni'),
        
        // Azioni Principali
        btnContabilizza: document.getElementById('btnContabilizza'),
        
        // Footer Status Bar
        selCount: document.getElementById('selCount'),
        selHours: document.getElementById('selHours'),
        statusMsg: document.getElementById('statusMsg'),

        // Navigazione Viste
        viewTabs: document.querySelectorAll('.tab-btn'),
        views: document.querySelectorAll('.view-panel'),
        
        // KPI
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

        // --- ELEMENTI MODALE CONFERMA (Custom) ---
        confirmModal: document.getElementById('confirmModal'),
        confCount: document.getElementById('confCount'),
        confHours: document.getElementById('confHours'),
        btnCancelConfirm: document.getElementById('btnCancelConfirm'),
        btnProceedConfirm: document.getElementById('btnProceedConfirm'),
        closeConfirmModal: document.getElementById('closeConfirmModal'),

        // --- ELEMENTI MODALE EDIT (Generico riutilizzato) ---
        customModalOverlay: document.getElementById('custom-modal-overlay'),
        customModal: document.getElementById('custom-modal'),
        customModalTitle: document.getElementById('custom-modal-title'),
        customModalMessage: document.getElementById('custom-modal-message'),
        customModalButtons: document.getElementById('custom-modal-buttons')
    },

    init: function() {
        console.log("🚀 Dashboard Init v4.0 (Full Features)");
        this.initDates();
        this.addListeners();
        this.fetchData();
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
        
        // 5. Contabilizza (Apre Modale Conferma)
        if(this.dom.btnContabilizza) this.dom.btnContabilizza.addEventListener('click', () => this.openContabilizzaModal());

        // 6. Listeners Modale Conferma
        if(this.dom.btnCancelConfirm) this.dom.btnCancelConfirm.addEventListener('click', () => this.closeConfirmModal());
        if(this.dom.closeConfirmModal) this.dom.closeConfirmModal.addEventListener('click', () => this.closeConfirmModal());
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

            // Gestione Stato: se entrambi attivi, non invio parametro (backend restituisce tutto)
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
            
            if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Pronto.";
            
        } catch (e) {
            console.error(e);
            if(this.dom.statusMsg) this.dom.statusMsg.textContent = "Errore.";
        } finally {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    // --- HELPER: FORMATTAZIONE ETICHETTA COMMESSA ---
    formatCommessaLabel: function(c) {
        if (!c) return 'Nessuna Commessa';
        const parts = [];
        // Ordine: Cliente | Impianto | VO | Rif
        if (c.clienti && c.clienti.ragione_sociale) parts.push(c.clienti.ragione_sociale);
        if (c.impianto) parts.push(c.impianto);
        if (c.vo) parts.push(c.vo);
        if (c.riferimento_tecnico) parts.push(c.riferimento_tecnico);
        return parts.length > 0 ? parts.join(' | ') : 'Dati incompleti';
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

        // Header
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

        // Eventi
        header.querySelector('.fh-title').addEventListener('click', () => { containerBox.classList.toggle('collapsed'); });
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

        // Distribuzione
        const labels = {};
        this.state.filteredData.forEach(r => {
            let key = this.getGroupKey(r, this.state.grouping).label;
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
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
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

    // --- GRID RENDER ---
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
            
            const table = document.createElement('table');
            table.innerHTML = `<thead><tr><th width="30"><input type="checkbox" disabled></th><th>Data</th><th>Chi</th><th>Lavorazione</th><th>Ore</th><th>Note</th><th></th></tr></thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');

            g.rows.forEach(r => {
                const date = new Date(r.data_lavoro).toLocaleDateString();
                const person = r.personale ? r.personale.nome_cognome : '-';
                const task = r.componenti ? r.componenti.nome_componente : '-';
                const macro = r.nome_macro || ''; 
                const note = r.note || '';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td width="30"><input type="checkbox" class="row-check" value="${r.id_registrazione}"></td>
                    <td width="90">${date}</td>
                    <td width="150" title="${person}">${person}</td>
                    <td title="${macro} > ${task}">${task} <span style="color:#999; font-size:0.7em;">(${macro})</span></td>
                    <td width="60" style="font-weight:bold; text-align:center;">${r.ore}</td>
                    <td><small>${note}</small></td>
                    <td width="40" style="text-align:center;"><button class="btn-icon" title="Modifica">✏️</button></td>
                `;
                
                // EVENTO EDIT
                tr.querySelector('.btn-icon').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openEditModal(r);
                });

                // EVENTO CHECKBOX SINGOLA
                tr.querySelector('.row-check').addEventListener('change', () => this.updateSelectionSummary());
                
                tbody.appendChild(tr);
            });
            
            body.appendChild(table);
            
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

            groupHtml.appendChild(header);
            groupHtml.appendChild(body);
            container.appendChild(groupHtml);
        });
    },

    // --- FUNZIONI MODIFICA RAPIDA ---
    openEditModal: function(row) {
        this.state.editingRow = row;
        
        const overlay = this.dom.customModalOverlay;
        const title = document.getElementById('custom-modal-title');
        const message = document.getElementById('custom-modal-message');
        const buttons = document.getElementById('custom-modal-buttons');

        title.textContent = "Modifica Registrazione";
        message.innerHTML = "";

        // Form HTML
        const formHtml = `
            <div class="edit-form-row">
                <label>Data</label>
                <input type="date" id="editData" class="edit-input" value="${row.data_lavoro.split('T')[0]}">
            </div>
            <div class="edit-form-row">
                <label>Ore</label>
                <input type="number" id="editOre" class="edit-input" value="${row.ore}" step="0.5">
            </div>
            <div class="edit-form-row">
                <label>Note</label>
                <textarea id="editNote" class="edit-input">${row.note || ''}</textarea>
            </div>
            <div class="edit-form-row">
                <label>Stato</label>
                <select id="editStato" class="edit-input">
                    <option value="0" ${row.stato === 0 ? 'selected' : ''}>Da Validare</option>
                    <option value="1" ${row.stato === 1 ? 'selected' : ''}>Contabilizzato</option>
                </select>
            </div>
        `;
        
        const formContainer = document.createElement('div');
        formContainer.innerHTML = formHtml;
        message.appendChild(formContainer);

        // Bottoni
        buttons.innerHTML = '';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = "Annulla";
        btnCancel.className = "btn-secondary"; 
        btnCancel.onclick = () => { overlay.style.display = 'none'; };

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

        if (!newData || isNaN(newOre)) return alert("Dati non validi.");

        this.dom.customModalOverlay.style.display = 'none';
        
        // Payload di aggiornamento (Strategia Delete + Insert per ricalcolo)
        const payload = {
            id_personale_override: row.personale.id_personale, 
            data: newData,
            ore: newOre,
            note: newNote,
            stato: newStato,
            id_commessa: row.commesse ? row.commesse.id_commessa : null,
            id_componente: row.componenti ? row.componenti.id_componente : null
        };

        try {
            await apiFetch(`/api/ore/${row.id_registrazione}`, { method: 'DELETE' });
            await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
            
            showModal({ title: "Successo", message: "Modifica salvata." });
            this.fetchData(); 

        } catch (e) {
            console.error(e);
            alert("Errore salvataggio: " + e.message);
        }
    },

    // --- CONFERMA CONTABILIZZAZIONE ---
    updateSelectionSummary: function() {
        const checkedBoxes = document.querySelectorAll('.row-check:checked');
        const count = checkedBoxes.length;
        let totalHours = 0;
        
        const rowsMap = new Map(this.state.filteredData.map(r => [r.id_registrazione, r.ore]));
        checkedBoxes.forEach(cb => {
            totalHours += (rowsMap.get(parseInt(cb.value)) || 0);
        });

        if(this.dom.selCount) this.dom.selCount.textContent = count;
        if(this.dom.selHours) this.dom.selHours.textContent = totalHours.toFixed(1);
    },

    openContabilizzaModal: function() {
        const checked = document.querySelectorAll('.row-check:checked');
        if (checked.length === 0) return alert("Seleziona almeno una riga.");
        
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        this.state.pendingIds = ids; 

        // Totali
        let totalHours = 0;
        const rowsMap = new Map(this.state.filteredData.map(r => [r.id_registrazione, r.ore]));
        ids.forEach(id => totalHours += (rowsMap.get(id) || 0));

        // Popola Modale
        this.dom.confCount.textContent = ids.length;
        this.dom.confHours.textContent = totalHours.toFixed(1) + " h";
        this.dom.confirmModal.style.display = 'flex';
    },

    finalizeContabilizzazione: async function() {
        const ids = this.state.pendingIds;
        if (!ids || ids.length === 0) return;
        const btn = this.dom.btnProceedConfirm;
        btn.textContent = "Elaborazione..."; btn.disabled = true;

        try {
            await apiFetch('/api/dashboard/contabilizza', { method: 'POST', body: JSON.stringify({ ids }) });
            this.closeConfirmModal();
            showModal({ title: "Successo", message: `${ids.length} registrazioni contabilizzate.` });
            this.fetchData();
        } catch(e) { alert("Errore: " + e.message); } 
        finally { btn.textContent = "CONFERMA"; btn.disabled = false; }
    },

    closeConfirmModal: function() {
        this.dom.confirmModal.style.display = 'none';
        this.state.pendingIds = [];
    },

    // --- UTILS ---
    getGroupKey: function(row, mode) {
        if (mode === 'commessa') {
            return { 
                id: row.commesse ? row.commesse.id_commessa : 'nc', 
                label: `📂 ${this.formatCommessaLabel(row.commesse)}`
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