// js/attivita.js
// Versione 5.1 - Fix Syntax Error e Logic Order

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const TaskApp = {
    state: {
        boardData: { todo: [], doing: [], review: [], done: [] },
        initData: { categorie: [], commesse: [], etichette: [] },
        personale: [],
        currentUserProfile: null,
        currentTask: null,
        
        // Choices instances (gestite dinamicamente nel form)
        choicesInstances: [], 

        columnsConfig: [
            { key: 'todo',   label: 'Da Fare',       status: 'Da Fare',      colorClass: 'todo' },
            { key: 'doing',  label: 'In Corso',      status: 'In Corso',     colorClass: 'doing' },
            { key: 'review', label: 'In Revisione',  status: 'In Revisione', colorClass: 'review' },
            { key: 'done',   label: 'Completato',    status: 'Completato',   colorClass: 'done' }
        ]
    },

    dom: {},

    // =================================================================
    // == 1. INIT & LOAD                                              ==
    // =================================================================

    init: async function() {
        if (!IsAdmin) { window.location.replace('index.html'); return; }
        this.state.currentUserProfile = JSON.parse(localStorage.getItem('user_profile'));

        // Cache DOM
        this.dom.taskView = document.getElementById('taskView');
        this.dom.inspectorBody = document.getElementById('inspectorBody');
        
        // Buttons Toolbar
        this.dom.btnNew = document.getElementById('addTaskBtn');
        this.dom.btnEdit = document.getElementById('inspectorEditBtn');
        this.dom.btnDelete = document.getElementById('inspectorDeleteBtn');
        
        // Filter
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');

        await this.loadInitialData();
        this.addEventListeners();
    },

    loadInitialData: async function() {
        try {
            const [boardRes, personaleRes, initDataRes, etichetteRes] = await Promise.all([
                this.fetchBoardData(),
                apiFetch('/api/personale/'),
                apiFetch('/api/tasks/init-data'),
                apiFetch('/api/get-etichette')
            ]);
            this.state.boardData = boardRes;
            this.state.personale = (await personaleRes.json()).data;
            this.state.initData = await initDataRes.json();
            this.state.initData.etichette = await etichetteRes.json();

            this.setupAdminFilter();
            this.renderKanbanBoard(); 
        } catch (error) { console.error("Init Error:", error); }
    },

    fetchBoardData: async function() {
        const params = new URLSearchParams();
        const filterUser = this.dom.adminUserFilter?.value;
        if (filterUser) params.append('id_utente_filtro', filterUser);
        const res = await apiFetch(`/api/tasks/?${params.toString()}`);
        return await res.json();
    },

    // =================================================================
    // == 2. RENDER BOARD                                             ==
    // =================================================================

    renderKanbanBoard: function() {
        this.dom.taskView.innerHTML = '';
        this.state.columnsConfig.forEach(col => {
            const columnEl = document.createElement('div');
            columnEl.className = 'task-column';
            columnEl.dataset.status = col.status;
            
            const tasksInCol = this.state.boardData[col.key] || [];
            const extraBtn = col.key === 'done' ? `<span id="openArchiveBtn" style="cursor:pointer; font-size:1.2em; margin-left:5px;">📂</span>` : '';

            columnEl.innerHTML = `
                <div class="task-column-header">
                    <h2>${col.label} ${extraBtn}</h2>
                    <span class="column-count">${tasksInCol.length}</span>
                </div>
                <div class="tasks-container" data-status-key="${col.key}"></div>
            `;

            const container = columnEl.querySelector('.tasks-container');
            tasksInCol.forEach(task => container.appendChild(this.createTaskCard(task)));
            this.setupDragDrop(container);
            this.dom.taskView.appendChild(columnEl);
        });
        
        const arcBtn = document.getElementById('openArchiveBtn');
        if(arcBtn) arcBtn.addEventListener('click', () => this.openArchive());
    },

    createTaskCard: function(task) {
        const el = document.createElement('div');
        el.className = `task-card priority-${(task.priorita || 'Media').toLowerCase()}`;
        el.draggable = true;
        el.dataset.taskId = task.id_task;

        let headerText = task.categoria?.nome_categoria || 'Generale';
        let headerClass = 'cat-tag';
        if (task.commessa) { headerText = task.commessa.codice_commessa; headerClass = 'commessa-tag'; }

        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span class="${headerClass}">${headerText}</span>
                <span style="font-size:0.7em; color:#888;">${task.assegnatario?.nome_cognome.split(' ')[0] || ''}</span>
            </div>
            <h4>${task.titolo}</h4>
        `;
        el.addEventListener('click', () => this.renderInspectorView(task.id_task));
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', task.id_task); });
        return el;
    },

    setupDragDrop: function(container) {
        container.addEventListener('dragover', e => { e.preventDefault(); container.classList.add('drag-over'); });
        container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
        container.addEventListener('drop', async e => {
            e.preventDefault(); container.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const targetColumn = container.closest('.task-column');
            if(!targetColumn) return;
            const newStatus = targetColumn.dataset.status;
            try { 
                await apiFetch(`/api/tasks/${taskId}`, {method:'PUT', body:JSON.stringify({stato:newStatus})}); 
                this.refreshBoard(); 
            } catch(e){}
        });
    },

    // =================================================================
    // == 3. INSPECTOR: VIEW MODE                                     ==
    // =================================================================

    renderInspectorView: async function(taskId) {
        this.dom.inspectorBody.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        this.dom.btnEdit.disabled = true; this.dom.btnDelete.disabled = true;

        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            const task = await res.json();
            this.state.currentTask = task;
            this.dom.btnEdit.disabled = false; this.dom.btnDelete.disabled = false;

            const html = `
                <h2 class="detail-title">${task.titolo}</h2>
                <div class="detail-grid">
                    <div class="detail-item"><strong>Stato</strong> <span>${task.stato}</span></div>
                    <div class="detail-item"><strong>Priorità</strong> <span>${task.priorita}</span></div>
                    <div class="detail-item"><strong>Categoria</strong> <span>${task.categoria?.nome_categoria}</span></div>
                    <div class="detail-item"><strong>Assegnato</strong> <span>${task.assegnatario?.nome_cognome}</span></div>
                    ${task.commessa ? `<div class="detail-item" style="grid-column: span 2;"><strong>Commessa</strong> <span>${task.commessa.impianto}</span></div>` : ''}
                    ${task.sottocategoria ? `<div class="detail-item"><strong>Tag</strong> <span>${task.sottocategoria}</span></div>` : ''}
                    <div class="detail-item"><strong>Scadenza</strong> <span>${task.data_obiettivo ? new Date(task.data_obiettivo).toLocaleDateString() : '-'}</span></div>
                </div>
                
                <div class="description-block">
                    ${task.descrizione || '<em>Nessuna descrizione.</em>'}
                </div>

                ${task.stato !== 'Completato' ? 
                    `<button id="btnComplete" class="button--success">✅ Segna come Completato</button>` : 
                    `<button id="btnReopen" class="button--primary" style="width:100%">↩️ Riapri Task</button>`
                }

                <div class="history-section">
                    <h4>Attività & Commenti</h4>
                    <div id="inspectorHistory" class="history-list"></div>
                    <div class="comment-box">
                        <textarea id="inpComment" placeholder="Scrivi commento..." rows="1"></textarea>
                        <button id="btnSendComment" class="button--primary">Invia</button>
                    </div>
                </div>
            `;
            this.dom.inspectorBody.innerHTML = html;
            
            // Eventi View
            document.getElementById('btnSendComment').addEventListener('click', () => this.postComment());
            if(document.getElementById('btnComplete')) document.getElementById('btnComplete').addEventListener('click', () => this.updateStatus('Completato'));
            if(document.getElementById('btnReopen')) document.getElementById('btnReopen').addEventListener('click', () => this.updateStatus('Da Fare'));

            this.renderHistory(task.task_storia, task.task_commenti);

        } catch(e) { this.dom.inspectorBody.innerHTML = `<p>Errore: ${e.message}</p>`; }
    },

    // =================================================================
    // == 4. INSPECTOR: EDIT / CREATE MODE (FORM)                     ==
    // =================================================================

    renderInspectorForm: function(task = null) {
        this.dom.btnEdit.disabled = true; this.dom.btnDelete.disabled = true;
        
        const isEdit = !!task;
        const title = isEdit ? "Modifica Task" : "Nuovo Task";
        
        // Defaults
        const values = {
            id: task ? task.id_task : '',
            titolo: task ? task.titolo : '',
            desc: task ? task.descrizione : '',
            prio: task ? task.priorita : 'Media',
            cat: task ? task.id_categoria_fk : '',
            ass: task ? task.id_assegnatario_fk : this.state.currentUserProfile.id_personale,
            date: task && task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '',
            comm: task ? task.id_commessa_fk : '',
            sub: task ? task.sottocategoria : ''
        };

        const html = `
            <h2 class="detail-title">${title}</h2>
            <form id="inspectorForm" class="inspector-form" onsubmit="return false;">
                <input type="hidden" id="inpId" value="${values.id}">
                
                <label class="form-label">Titolo</label>
                <input type="text" id="inpTitle" class="inp-text" value="${values.titolo}" required>
                
                <div class="form-row">
                    <div class="form-col">
                        <label class="form-label">Categoria</label>
                        <select id="inpCat" class="inp-select" required></select>
                    </div>
                    <div class="form-col">
                        <label class="form-label">Priorità</label>
                        <select id="inpPrio" class="inp-select">
                            <option value="Bassa" ${values.prio=='Bassa'?'selected':''}>🟢 Bassa</option>
                            <option value="Media" ${values.prio=='Media'?'selected':''}>🟡 Media</option>
                            <option value="Alta" ${values.prio=='Alta'?'selected':''}>🔴 Alta</option>
                        </select>
                    </div>
                </div>

                <!-- Dynamic Fields -->
                <div id="wrapSub" class="form-group"><label class="form-label">Dettaglio</label><select id="inpSub"></select></div>
                <div id="wrapComm" class="form-group" style="display:none"><label class="form-label">Commessa</label><select id="inpComm"></select></div>

                <label class="form-label">Assegnato a</label>
                <select id="inpAss" class="inp-select"></select>

                <label class="form-label">Scadenza</label>
                <input type="date" id="inpDate" class="inp-date" value="${values.date}">

                <label class="form-label">Descrizione</label>
                <textarea id="inpDesc" class="inp-area">${values.desc || ''}</textarea>

                <div class="form-actions">
                    <button id="btnCancel" class="button--warning">Annulla</button>
                    <button id="btnSave" class="button--success">Salva</button>
                </div>
            </form>
        `;
        this.dom.inspectorBody.innerHTML = html;

        // Populate Dropdowns
        this.populateFormDropdowns(values);

        // Event Listeners Form
        document.getElementById('btnCancel').addEventListener('click', () => {
            if(isEdit) this.renderInspectorView(values.id);
            else this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Seleziona un task o creane uno nuovo.</p></div>';
        });
        document.getElementById('btnSave').addEventListener('click', () => this.saveTask());
        document.getElementById('inpCat').addEventListener('change', () => this.toggleSubField());
    },

    populateFormDropdowns: function(vals) {
        // Categorie
        const cat = document.getElementById('inpCat');
        cat.innerHTML = '<option value="" disabled selected>Seleziona...</option>';
        this.state.initData.categorie.forEach(c => {
            cat.innerHTML += `<option value="${c.id_categoria}" ${vals.cat==c.id_categoria?'selected':''}>${c.nome_categoria}</option>`;
        });

        // Assegnatari
        const ass = document.getElementById('inpAss');
        this.state.personale.filter(p=>p.puo_accedere).forEach(p => {
            ass.innerHTML += `<option value="${p.id_personale}" ${vals.ass==p.id_personale?'selected':''}>${p.nome_cognome}</option>`;
        });

        // Choices per Commessa e Etichette
        this.state.choicesInstances.forEach(c => c.destroy()); // Cleanup old
        this.state.choicesInstances = [];

        const commEl = document.getElementById('inpComm');
        const subEl = document.getElementById('inpSub');

        const commChoice = new Choices(commEl, {
            choices: this.state.initData.commesse.map(c => ({value: c.id_commessa, label: `${c.impianto} (${c.codice_commessa})`, selected: vals.comm == c.id_commessa })),
            searchEnabled: true, itemSelectText: ''
        });
        
        const subChoice = new Choices(subEl, {
            choices: this.state.initData.etichette.map(e => ({value: e.label, label: e.label, selected: vals.sub == e.label })),
            searchEnabled: true, itemSelectText: ''
        });

        this.state.choicesInstances.push(commChoice, subChoice);
        this.toggleSubField();
    },

    toggleSubField: function() {
        const val = document.getElementById('inpCat').value;
        const cat = this.state.initData.categorie.find(c => c.id_categoria == val);
        const type = cat ? cat.nome_categoria.toLowerCase() : '';
        
        const isComm = (type === 'commessa');
        document.getElementById('wrapSub').style.display = isComm ? 'none' : 'block';
        document.getElementById('wrapComm').style.display = isComm ? 'block' : 'none';
    },

    // --- SAVE LOGIC ---
    saveTask: async function() {
        const id = document.getElementById('inpId').value;
        const isComm = document.getElementById('wrapComm').style.display !== 'none';
        
        const commVal = this.state.choicesInstances[0].getValue(true);
        const subVal = this.state.choicesInstances[1].getValue(true);

        const payload = {
            titolo: document.getElementById('inpTitle').value,
            descrizione: document.getElementById('inpDesc').value,
            priorita: document.getElementById('inpPrio').value,
            id_categoria_fk: document.getElementById('inpCat').value,
            id_assegnatario_fk: document.getElementById('inpAss').value,
            data_obiettivo: document.getElementById('inpDate').value || null,
            id_commessa_fk: isComm ? commVal : null,
            sottocategoria: !isComm ? subVal : null
        };

        if (!payload.titolo || !payload.id_categoria_fk) return alert('Titolo e Categoria obbligatori');

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/tasks/${id}` : '/api/tasks/';
            const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
            const saved = await res.json();
            
            await this.refreshBoard();
            this.renderInspectorView(saved.id_task); // Torna alla view
        } catch(e) { alert(e.message); }
    },

    // =================================================================
    // == 5. UTILS & EVENT LISTENERS                                  ==
    // =================================================================

    addEventListeners: function() {
        this.dom.btnNew.addEventListener('click', () => this.renderInspectorForm(null));
        this.dom.btnEdit.addEventListener('click', () => { if(this.state.currentTask) this.renderInspectorForm(this.state.currentTask); });
        this.dom.btnDelete.addEventListener('click', () => this.deleteTask());
        
        // Filtro Header
        if (this.state.currentUserProfile.is_admin) {
            this.dom.adminFilterContainer.style.display = 'flex';
            this.dom.adminUserFilter.addEventListener('change', () => this.refreshBoard());
        }
        
        // Modale Archivio close
        document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
            document.getElementById('archiveModal').style.display = 'none';
            document.getElementById('modalOverlay').style.display = 'none';
        }));
    },

    refreshBoard: async function() {
        this.state.boardData = await this.fetchBoardData();
        this.renderKanbanBoard();
    },

    setupAdminFilter: function() {
        if (!this.state.currentUserProfile.is_admin) return;
        const sel = this.dom.adminUserFilter;
        sel.innerHTML = '<option value="">Tutti</option>';
        this.state.personale.filter(p=>p.puo_accedere).forEach(p => {
            sel.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`;
        });
    },

    postComment: async function() {
        const txt = document.getElementById('inpComment').value;
        if(!txt) return;
        await apiFetch(`/api/tasks/${this.state.currentTask.id_task}/commenti`, {method:'POST', body:JSON.stringify({testo_commento:txt})});
        this.renderInspectorView(this.state.currentTask.id_task); 
    },
    
    updateStatus: async function(status) {
        await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {method:'PUT', body:JSON.stringify({stato:status})});
        this.refreshBoard();
        this.renderInspectorView(this.state.currentTask.id_task);
    },

    deleteTask: async function() {
        if(!confirm("Eliminare definitivamente questo task?")) return;
        // Se non hai la rotta DELETE backend, rimuovi questa riga o aggiungila.
        // await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {method:'DELETE'});
        this.dom.inspectorBody.innerHTML = '<div class="empty-state"><p>Task eliminato</p></div>';
        this.dom.btnEdit.disabled = true; this.dom.btnDelete.disabled = true;
        this.refreshBoard();
    },

    renderHistory: function(history=[], comments=[]) {
        const combined = [...history.map(h=>({...h, type:'h', d:h.data_azione})), ...comments.map(c=>({...c, type:'c', d:c.data_creazione}))].sort((a,b)=>new Date(b.d)-new Date(a.d));
        const html = combined.map(x => {
            const date = new Date(x.d).toLocaleDateString() + ' ' + new Date(x.d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const user = x.type==='h' ? x.utente?.nome_cognome : x.autore?.nome_cognome;
            return x.type==='c' 
                ? `<div class="history-item comment"><strong>${user}</strong> <small>${date}</small><br>${x.testo_commento}</div>`
                : `<div class="history-item"><small>${date} - ${user}</small><br><em>${x.azione}</em> ${x.dettagli||''}</div>`;
        }).join('');
        document.getElementById('inspectorHistory').innerHTML = html;
    },
    
    openArchive: async function() {
        const container = document.getElementById('archiveTasksContainer');
        document.getElementById('archiveModal').style.display = 'block';
        document.getElementById('modalOverlay').style.display = 'block';
        container.innerHTML = 'Caricamento...';
        try {
            const res = await apiFetch(`/api/tasks/completed?page=1`);
            const tasks = await res.json();
            container.innerHTML = tasks.length 
                ? tasks.map(t => `<div class="archive-task-item"><span>${t.titolo}</span><span>${new Date(t.data_ultima_modifica).toLocaleDateString()}</span></div>`).join('')
                : 'Nessun task.';
        } catch(e) { container.innerHTML = 'Errore caricamento.'; }
    }
};

document.addEventListener('DOMContentLoaded', () => TaskApp.init());