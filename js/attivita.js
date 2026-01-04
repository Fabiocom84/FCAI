// js/attivita.js
// Versione 8.0 - Full Inspector UI (Transfer, Comments, Notifications in Column 5)

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const TaskApp = {
    state: {
        boardData: { todo: [], doing: [], review: [], done: [] },
        initData: { categorie: [], commesse: [], etichette: [] },
        personale: [],
        currentUserProfile: null,
        currentTask: null,
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

        // Cache DOM Elements
        this.dom.taskView = document.getElementById('taskView');
        this.dom.inspectorBody = document.getElementById('inspectorBody');
        
        // Toolbar Buttons
        this.dom.btnNew = document.getElementById('addTaskBtn');
        this.dom.btnEdit = document.getElementById('inspectorEditBtn');
        this.dom.btnDelete = document.getElementById('inspectorDeleteBtn');
        this.dom.btnComplete = document.getElementById('inspectorCompleteBtn');
        this.dom.btnTransfer = document.getElementById('inspectorTransferBtn');
        this.dom.btnBell = document.getElementById('inspectorBellBtn');
        
        // Header Filter
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');

        // Modals (Solo Archivio rimasto)
        this.dom.modalOverlay = document.getElementById('modalOverlay');

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
    // == 2. RENDER KANBAN BOARD                                      ==
    // =================================================================

    renderKanbanBoard: function() {
        this.dom.taskView.innerHTML = '';
        this.state.columnsConfig.forEach(col => {
            const columnEl = document.createElement('div');
            columnEl.className = 'task-column';
            columnEl.dataset.status = col.status;
            
            const tasksInCol = this.state.boardData[col.key] || [];
            // Icona Archivio solo nell'ultima colonna
            const extraBtn = col.key === 'done' ? `<i id="openArchiveBtn" class="fas fa-folder-open" style="cursor:pointer; margin-left:8px; opacity:0.6;" title="Archivio"></i>` : '';

            columnEl.innerHTML = `
                <div class="task-column-header">
                    <h2>
                        <span class="dot-indicator" style="background-color: var(--${col.colorClass}-color, #ccc)"></span>
                        ${col.label} ${extraBtn}
                    </h2>
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
            ${task.data_obiettivo ? `<div style="font-size:0.75em; color:${this.isLate(task.data_obiettivo) ? 'red' : '#999'}; margin-top:4px;"><i class="far fa-calendar"></i> ${new Date(task.data_obiettivo).toLocaleDateString()}</div>` : ''}
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

    isLate: function(dateStr) { return new Date(dateStr) < new Date().setHours(0,0,0,0); },

    // =================================================================
    // == 3. INSPECTOR: VIEW MODE (VISUALIZZAZIONE)                   ==
    // =================================================================

    renderInspectorView: async function(taskId) {
        this.dom.inspectorBody.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        this.toggleToolbar(false); // Disabilita toolbar durante caricamento

        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            const task = await res.json();
            this.state.currentTask = task;
            
            // Configura Toolbar
            this.toggleToolbar(true);
            const isDone = task.stato === 'Completato';
            this.dom.btnComplete.innerHTML = isDone ? 'Riapri' : 'Chiudi';
            this.dom.btnComplete.title = isDone ? "Riapri Task" : "Segna come Completato";
            // Cambia colore bottone se necessario (es. grigio se riapri)
            this.dom.btnComplete.classList.toggle('btn-complete', !isDone); 
            this.dom.btnComplete.classList.toggle('btn-transfer', isDone); // Uso stile neutro per riapri

            const html = `
                <h2 class="detail-title">${task.titolo}</h2>
                <div class="read-only-box">
                    <div class="detail-grid">
                        <div class="detail-item"><strong>Stato</strong> <span>${task.stato}</span></div>
                        <div class="detail-item"><strong>Priorità</strong> <span>${task.priorita}</span></div>
                        <div class="detail-item"><strong>Categoria</strong> <span>${task.categoria?.nome_categoria}</span></div>
                        <div class="detail-item"><strong>Assegnato</strong> <span>${task.assegnatario?.nome_cognome}</span></div>
                        ${task.commessa ? `<div class="detail-item" style="grid-column: span 2;"><strong>Commessa</strong> <span>${task.commessa.impianto} (${task.commessa.codice_commessa})</span></div>` : ''}
                        ${task.sottocategoria ? `<div class="detail-item" style="grid-column: span 2;"><strong>Tag</strong> <span>${task.sottocategoria}</span></div>` : ''}
                        <div class="detail-item"><strong>Scadenza</strong> <span>${task.data_obiettivo ? new Date(task.data_obiettivo).toLocaleDateString() : '-'}</span></div>
                        
                        <div class="detail-description">
                            <strong>Descrizione</strong>
                            <div class="description-text">${task.descrizione || '<em>Nessuna descrizione.</em>'}</div>
                        </div>
                    </div>
                </div>

                <div class="history-section">
                    <h4>Attività & Commenti</h4>
                    
                    <!-- BOX COMMENTO: SPOSTATO SOPRA LA LISTA -->
                    <div class="comment-box">
                        <textarea id="inpComment" placeholder="Scrivi un commento..." rows="1"></textarea>
                        <button id="btnSendComment" class="btn-send"><i class="fas fa-paper-plane"></i></button>
                    </div>

                    <!-- LISTA STORIA -->
                    <div id="inspectorHistory" class="history-list"></div>
                </div>
            `;
            this.dom.inspectorBody.innerHTML = html;
            
            document.getElementById('btnSendComment').addEventListener('click', () => this.postComment());
            this.renderHistory(task.task_storia, task.task_commenti);

        } catch(e) { this.dom.inspectorBody.innerHTML = `<p style="color:red; text-align:center;">Errore caricamento: ${e.message}</p>`; }
    },

    toggleToolbar: function(enable) {
        this.dom.btnEdit.disabled = !enable;
        this.dom.btnDelete.disabled = !enable;
        this.dom.btnComplete.disabled = !enable;
        this.dom.btnTransfer.disabled = !enable;
        // Bell and New are always enabled
    },

    // =================================================================
    // == 4. INSPECTOR: MODALITÀ TRASFERIMENTO (NO MODAL)             ==
    // =================================================================

    renderTransferMode: function() {
        if(!this.state.currentTask) return;
        this.toggleToolbar(false); // Disabilita navigazione durante azione

        const currentAssignee = this.state.currentTask.id_assegnatario_fk;
        const html = `
            <h2 class="detail-title">Invia / Trasferisci Task</h2>
            <div style="padding: 20px 0;">
                <label style="display:block; margin-bottom:10px; font-weight:500;">Seleziona il nuovo assegnatario:</label>
                <div class="styled-select-wrapper">
                    <select id="transferUserSelect" class="full-width-input" style="padding:10px; font-size:1em;">
                        ${this.state.personale
                            .filter(p => p.puo_accedere && p.id_personale != currentAssignee)
                            .map(p => `<option value="${p.id_personale}">${p.nome_cognome}</option>`)
                            .join('')}
                    </select>
                </div>
            </div>
            <div class="form-actions">
                <button id="btnCancelTransfer" class="button button--warning">Annulla</button>
                <button id="btnConfirmTransfer" class="button button--success">Conferma Invio</button>
            </div>
        `;
        this.dom.inspectorBody.innerHTML = html;

        document.getElementById('btnCancelTransfer').addEventListener('click', () => this.renderInspectorView(this.state.currentTask.id_task));
        document.getElementById('btnConfirmTransfer').addEventListener('click', () => this.executeTransfer());
    },

    executeTransfer: async function() {
        const newAssignee = document.getElementById('transferUserSelect').value;
        if(!newAssignee) return;
        try {
            await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {
                method: 'PUT', body: JSON.stringify({ id_assegnatario_fk: newAssignee })
            });
            await this.refreshBoard();
            this.renderInspectorView(this.state.currentTask.id_task);
        } catch(e) { alert('Errore trasferimento: ' + e.message); }
    },

    // =================================================================
    // == 5. INSPECTOR: MODALITÀ NOTIFICHE (NO MODAL)                 ==
    // =================================================================

    renderNotificationsMode: async function() {
        this.dom.inspectorBody.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        
        try {
            const res = await apiFetch(`/api/tasks/notifiche`);
            const notes = await res.json();

            const listHtml = notes.length > 0 
                ? notes.map(n => `
                    <div class="notification-item ${n.letto ? '' : 'unread'}" onclick="alert('TODO: Link al task')">
                        <div style="font-weight:500; margin-bottom:4px;">${n.tipo_notifica} <span style="float:right; font-size:0.8em; color:#999;">${new Date(n.data_creazione).toLocaleDateString()}</span></div>
                        <div>${n.messaggio}</div>
                        <small>Da: ${n.sender ? n.sender.nome_cognome : 'Sistema'}</small>
                    </div>
                  `).join('')
                : '<div class="empty-state"><p>Nessuna notifica recente.</p></div>';

            const html = `
                <h2 class="detail-title">Notifiche</h2>
                <div class="notification-list">
                    ${listHtml}
                </div>
                <div style="margin-top:20px; text-align:center;">
                    <button id="btnCloseNotes" class="button button--warning">Indietro</button>
                </div>
            `;
            this.dom.inspectorBody.innerHTML = html;

            document.getElementById('btnCloseNotes').addEventListener('click', () => {
                if(this.state.currentTask) this.renderInspectorView(this.state.currentTask.id_task);
                else this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Seleziona un task.</p></div>';
            });

        } catch(e) { 
            this.dom.inspectorBody.innerHTML = `<p>Errore: ${e.message}</p>`; 
        }
    },

    // =================================================================
    // == 6. INSPECTOR: EDIT / CREATE FORM                            ==
    // =================================================================

    renderInspectorForm: function(task = null) {
        this.toggleToolbar(false);
        const isEdit = !!task;
        const title = isEdit ? "Modifica Dati" : "Nuovo Task";
        
        const vals = {
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
                <input type="hidden" id="inpId" value="${vals.id}">
                
                <label>Titolo</label>
                <input type="text" id="inpTitle" class="inp-text" value="${vals.titolo}" required>
                
                <div class="form-row">
                    <div class="form-col">
                        <label>Categoria</label>
                        <select id="inpCat" class="inp-select" required></select>
                    </div>
                    <div class="form-col">
                        <label>Priorità</label>
                        <select id="inpPrio" class="inp-select">
                            <option value="Bassa" ${vals.prio=='Bassa'?'selected':''}>🟢 Bassa</option>
                            <option value="Media" ${vals.prio=='Media'?'selected':''}>🟡 Media</option>
                            <option value="Alta" ${vals.prio=='Alta'?'selected':''}>🔴 Alta</option>
                        </select>
                    </div>
                </div>

                <div id="wrapSub" class="form-group"><label>Dettaglio / Tag</label><select id="inpSub"></select></div>
                <div id="wrapComm" class="form-group" style="display:none"><label>Commessa</label><select id="inpComm"></select></div>

                <label>Assegnato a</label>
                <select id="inpAss" class="inp-select"></select>

                <label>Scadenza</label>
                <input type="date" id="inpDate" class="inp-date" value="${vals.date}">

                <label>Descrizione</label>
                <textarea id="inpDesc" class="inp-area">${vals.desc || ''}</textarea>

                <div class="form-actions">
                    <button id="btnCancel" class="button button--warning">Annulla</button>
                    <button id="btnSave" class="button button--success">Salva</button>
                </div>
            </form>
        `;
        this.dom.inspectorBody.innerHTML = html;

        this.populateFormDropdowns(vals);

        document.getElementById('btnCancel').addEventListener('click', () => {
            if(isEdit) this.renderInspectorView(vals.id);
            else {
                this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Seleziona un task o creane uno nuovo.</p></div>';
                this.toggleToolbar(false);
            }
        });
        document.getElementById('btnSave').addEventListener('click', () => this.saveTask());
        document.getElementById('inpCat').addEventListener('change', () => this.toggleSubField());
    },

    // --- FORM HELPERS ---
    populateFormDropdowns: function(vals) {
        const cat = document.getElementById('inpCat');
        cat.innerHTML = '<option value="" disabled selected>Seleziona...</option>';
        this.state.initData.categorie.forEach(c => {
            cat.innerHTML += `<option value="${c.id_categoria}" ${vals.cat==c.id_categoria?'selected':''}>${c.nome_categoria}</option>`;
        });

        const ass = document.getElementById('inpAss');
        this.state.personale.filter(p=>p.puo_accedere).forEach(p => {
            ass.innerHTML += `<option value="${p.id_personale}" ${vals.ass==p.id_personale?'selected':''}>${p.nome_cognome}</option>`;
        });

        this.state.choicesInstances.forEach(c => c.destroy());
        this.state.choicesInstances = [];

        const commChoice = new Choices('#inpComm', {
            choices: this.state.initData.commesse.map(c => ({value: c.id_commessa, label: `${c.impianto} (${c.codice_commessa})`, selected: vals.comm == c.id_commessa })),
            searchEnabled: true, itemSelectText: ''
        });
        
        const subChoice = new Choices('#inpSub', {
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
            this.renderInspectorView(saved.id_task); 
        } catch(e) { alert(e.message); }
    },

    // =================================================================
    // == 7. UTILS & EVENT LISTENERS                                  ==
    // =================================================================

    addEventListeners: function() {
        // Toolbar
        this.dom.btnNew.addEventListener('click', () => this.renderInspectorForm(null));
        this.dom.btnEdit.addEventListener('click', () => { if(this.state.currentTask) this.renderInspectorForm(this.state.currentTask); });
        this.dom.btnDelete.addEventListener('click', () => this.deleteTask());
        this.dom.btnComplete.addEventListener('click', () => this.toggleCompleteStatus());
        
        // NUOVI BOTTONI COLLEGATI
        this.dom.btnTransfer.addEventListener('click', () => this.renderTransferMode());
        this.dom.btnBell.addEventListener('click', () => this.renderNotificationsMode());

        // Filtro Header
        if (this.state.currentUserProfile.is_admin) {
            this.dom.adminFilterContainer.style.display = 'flex';
            this.dom.adminUserFilter.addEventListener('change', () => this.refreshBoard());
        }
        
        // Modale Archivio close
        document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', (e) => {
            if(e.target.dataset.closeArchive !== undefined) {
                document.getElementById('archiveModal').style.display = 'none';
                document.getElementById('modalOverlay').style.display = 'none';
            }
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
    
    toggleCompleteStatus: function() {
        if(!this.state.currentTask) return;
        const newStatus = this.state.currentTask.stato === 'Completato' ? 'Da Fare' : 'Completato';
        this.updateStatus(newStatus);
    },

    updateStatus: async function(status) {
        await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {method:'PUT', body:JSON.stringify({stato:status})});
        this.refreshBoard();
        this.renderInspectorView(this.state.currentTask.id_task);
    },

    deleteTask: async function() {
        if(!confirm("Eliminare definitivamente questo task?")) return;
        // await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {method:'DELETE'});
        this.dom.inspectorBody.innerHTML = '<div class="empty-state"><p>Task eliminato</p></div>';
        this.toggleToolbar(false);
        this.refreshBoard();
    },

    renderHistory: function(history=[], comments=[]) {
        const combined = [...history.map(h=>({...h, type:'h', d:h.data_azione})), ...comments.map(c=>({...c, type:'c', d:c.data_creazione}))].sort((a,b)=>new Date(b.d)-new Date(a.d));
        document.getElementById('inspectorHistory').innerHTML = combined.map(x => {
            const date = new Date(x.d).toLocaleDateString() + ' ' + new Date(x.d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const user = x.type==='h' ? x.utente?.nome_cognome : x.autore?.nome_cognome;
            
            const isAction = x.type === 'h' && (x.azione === 'CAMBIO STATO' || x.azione === 'RIASSEGNATO' || x.azione === 'CREATO');
            const itemClass = isAction ? 'history-item action' : (x.type === 'c' ? 'history-item comment' : 'history-item');

            return x.type==='c' 
                ? `<div class="${itemClass}"><strong>${user}</strong> <small>${date}</small><br>${x.testo_commento}</div>`
                : `<div class="${itemClass}"><small>${date} - ${user}</small><br><strong>${x.azione}</strong>: ${x.dettagli||''}</div>`;
        }).join('');
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