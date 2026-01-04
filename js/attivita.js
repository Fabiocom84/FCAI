// js/attivita.js
// Versione 4.0 - Layout 5 Colonne Fisso + Comandi Toolbar

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const TaskApp = {
    state: {
        boardData: { todo: [], doing: [], review: [], done: [] },
        initData: { categorie: [], commesse: [], etichette: [] },
        personale: [],
        currentUserProfile: null,
        currentTask: null,
        columnsConfig: [
            { key: 'todo',   label: 'Da Fare',       status: 'Da Fare',      colorClass: 'todo' },
            { key: 'doing',  label: 'In Corso',      status: 'In Corso',     colorClass: 'doing' },
            { key: 'review', label: 'In Revisione',  status: 'In Revisione', colorClass: 'review' },
            { key: 'done',   label: 'Completato',    status: 'Completato',   colorClass: 'done' }
        ],
        formCommessaChoices: null,
        formSubcategoryChoices: null
    },

    dom: {},

    init: async function() {
        if (!IsAdmin) { window.location.replace('index.html'); return; }

        this.state.currentUserProfile = JSON.parse(localStorage.getItem('user_profile'));

        // Cache DOM Elements
        this.dom.taskView = document.getElementById('taskView');
        this.dom.inspectorContent = document.getElementById('inspectorContent');
        this.dom.inspectorDetails = document.getElementById('inspectorDetailsArea');
        this.dom.inspectorFooter = document.getElementById('inspectorFooter');
        
        // Toolbar Buttons
        this.dom.btnNew = document.getElementById('addTaskBtn');
        this.dom.btnEdit = document.getElementById('inspectorEditBtn');
        this.dom.btnDelete = document.getElementById('inspectorDeleteBtn');
        
        // Filters (Header)
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');

        // Modali
        this.dom.modalOverlay = document.getElementById('modalOverlay');
        this.dom.formModal = document.getElementById('taskModal');
        this.dom.taskForm = document.getElementById('taskForm');
        this.dom.taskId = document.getElementById('taskId');
        this.dom.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.dom.taskCategory = document.getElementById('taskCategory');

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
            this.populateDropdowns();
            this.renderKanbanBoard(); 

        } catch (error) {
            console.error("Init Error:", error);
        }
    },

    fetchBoardData: async function() {
        const params = new URLSearchParams();
        const filterUser = this.dom.adminUserFilter?.value;
        if (filterUser) params.append('id_utente_filtro', filterUser);
        const res = await apiFetch(`/api/tasks/?${params.toString()}`);
        return await res.json();
    },

    renderKanbanBoard: function() {
        this.dom.taskView.innerHTML = '';
        this.state.columnsConfig.forEach(col => {
            const columnEl = document.createElement('div');
            columnEl.className = 'task-column';
            columnEl.dataset.status = col.status;
            
            const tasksInCol = this.state.boardData[col.key] || [];
            // Bottone archivio solo nell'ultima colonna
            const extraBtn = col.key === 'done' ? `<button id="openArchiveBtn" style="border:none;background:none;cursor:pointer;font-size:1.2em;" title="Archivio">📂</button>` : '';

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
        
        if(document.getElementById('openArchiveBtn'))
            document.getElementById('openArchiveBtn').addEventListener('click', () => this.openArchive());
    },

    createTaskCard: function(task) {
        const el = document.createElement('div');
        el.className = `task-card priority-${(task.priorita || 'Media').toLowerCase()}`;
        el.draggable = true;
        el.dataset.taskId = task.id_task;

        let headerText = task.categoria?.nome_categoria || 'Generale';
        let headerClass = 'cat-tag';
        if (task.commessa) {
            headerText = `${task.commessa.codice_commessa}`;
            headerClass = 'commessa-tag';
        }

        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span class="${headerClass}">${headerText}</span>
                <span style="font-size:0.75em;color:#888;">${task.assegnatario?.nome_cognome.split(' ')[0] || ''}</span>
            </div>
            <h4>${task.titolo}</h4>
            ${task.data_obiettivo ? `<div style="font-size:0.75em; color:${this.isLate(task.data_obiettivo) ? 'red' : '#888'}; margin-top:4px;">📅 ${new Date(task.data_obiettivo).toLocaleDateString()}</div>` : ''}
        `;

        el.addEventListener('click', () => this.selectTask(task.id_task));
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', task.id_task); setTimeout(() => el.classList.add('dragging'), 0); });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));

        return el;
    },

    isLate: function(dateStr) { return new Date(dateStr) < new Date().setHours(0,0,0,0); },

    // --- 5a COLONNA: ISPETTORE ---
    selectTask: async function(taskId) {
        // UI Loading
        this.dom.inspectorContent.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        this.dom.inspectorDetails.style.display = 'none';
        this.dom.inspectorFooter.style.display = 'none';
        
        // Abilita pulsanti toolbar
        this.dom.btnEdit.disabled = true; 
        this.dom.btnDelete.disabled = true;

        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            const task = await res.json();
            this.state.currentTask = task;

            // Popola Contenuto
            const content = `
                <h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">${task.titolo}</h3>
                <div class="read-only-box">
                    <p><strong>Stato:</strong> ${task.stato}</p>
                    <p><strong>Categoria:</strong> ${task.categoria?.nome_categoria}</p>
                    ${task.commessa ? `<p><strong>Commessa:</strong> ${task.commessa.impianto}</p>` : ''}
                    <p><strong>Assegnato:</strong> ${task.assegnatario?.nome_cognome}</p>
                </div>
                <div class="description-block">${task.descrizione || 'Nessuna descrizione.'}</div>
            `;
            this.dom.inspectorContent.innerHTML = content;
            this.dom.inspectorDetails.style.display = 'block';

            // Footer Stato
            const btnComplete = document.getElementById('inspectorCompleteBtn');
            const btnReopen = document.getElementById('inspectorReopenBtn');
            
            if (task.stato === 'Completato') {
                btnComplete.style.display = 'none'; btnReopen.style.display = 'block';
            } else {
                btnComplete.style.display = 'block'; btnReopen.style.display = 'none';
            }
            this.dom.inspectorFooter.style.display = 'block';

            // Abilita bottoni modifica
            this.dom.btnEdit.disabled = false;
            this.dom.btnDelete.disabled = false;

            this.renderHistory(task.task_storia, task.task_commenti);

        } catch (e) {
            this.dom.inspectorContent.innerHTML = `<p style="color:red">Errore: ${e.message}</p>`;
        }
    },

    resetInspector: function() {
        this.state.currentTask = null;
        this.dom.inspectorContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks fa-3x"></i>
                <p>Seleziona un task dalla lista<br>o creane uno nuovo.</p>
            </div>`;
        this.dom.inspectorDetails.style.display = 'none';
        this.dom.inspectorFooter.style.display = 'none';
        this.dom.btnEdit.disabled = true;
        this.dom.btnDelete.disabled = true;
    },

    // --- AZIONI TOOLBAR ---
    deleteCurrentTask: async function() {
        if(!this.state.currentTask) return;
        if(!confirm("Sei sicuro di voler eliminare questo task?")) return;
        
        try {
            // Nota: Se manca API DELETE nel backend, darà 405/404. Assumiamo esista o la aggiungi.
            // Per ora non c'era nel python inviato, ma è facile aggiungere.
            // Simuliamo UI update per ora o aggiungi rotta DELETE nel python.
             await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, { method: 'DELETE' }); // Aggiungere rotta backend se manca!
            // Fallback se backend non ha delete:
            // showModal({title:'Info', message: 'Funzione Delete da implementare lato backend'});
            
            this.resetInspector();
            this.refreshBoard();
        } catch(e) { 
             console.error(e); 
             // Se fallisce (es. 405 Method Not Allowed), ricarichiamo la board
             this.refreshBoard();
        }
    },

    // --- EVENT LISTENERS AGGIORNATI ---
    addEventListeners: function() {
        // Toolbar
        this.dom.btnNew.addEventListener('click', () => this.openFormModal());
        this.dom.btnEdit.addEventListener('click', () => { if(this.state.currentTask) this.openFormModal(this.state.currentTask.id_task); });
        this.dom.btnDelete.addEventListener('click', () => this.deleteCurrentTask());

        // Modali
        this.dom.modalOverlay.addEventListener('click', () => this.closeModals());
        document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => this.closeModals()));
        this.dom.saveTaskBtn.addEventListener('click', () => this.handleSaveTask());
        this.dom.taskCategory.addEventListener('change', () => this.toggleSubcategoryField());
        
        // Azioni Rapide Ispettore
        document.getElementById('inspectorAddCommentBtn').addEventListener('click', () => this.handleAddComment());
        document.getElementById('inspectorCompleteBtn').addEventListener('click', () => this.updateStatus('Completato'));
        document.getElementById('inspectorReopenBtn').addEventListener('click', () => this.updateStatus('Da Fare'));
    },

    // ... (Le funzioni setupAdminFilter, populateDropdowns, dragDrop, form logic, history restano invariate dalla versione precedente, copiale se mancano) ...
    setupAdminFilter: function() {
        if (!this.state.currentUserProfile.is_admin || !this.dom.adminFilterContainer) return;
        this.dom.adminFilterContainer.style.display = 'flex';
        this.dom.adminUserFilter.addEventListener('change', () => this.refreshBoard());
    },

    populateDropdowns: function() {
        const catSel = this.dom.taskCategory;
        catSel.innerHTML = '<option value="" disabled selected>Seleziona...</option>';
        this.state.initData.categorie.forEach(c => catSel.innerHTML += `<option value="${c.id_categoria}">${c.nome_categoria}</option>`);

        const assSel = document.getElementById('taskAssignee');
        assSel.innerHTML = '';
        const users = this.state.personale.filter(p => p.puo_accedere);
        users.forEach(p => assSel.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`);
        
        if (this.state.currentUserProfile.is_admin && this.dom.adminUserFilter) {
            const filterSel = this.dom.adminUserFilter;
            filterSel.innerHTML = '<option value="">Tutti</option>';
            users.forEach(p => filterSel.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`);
        }
    },

    setupDragDrop: function(container) {
        container.addEventListener('dragover', (e) => { e.preventDefault(); container.classList.add('drag-over'); });
        container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
        container.addEventListener('drop', async (e) => {
            e.preventDefault(); container.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const targetColumn = container.closest('.task-column');
            if (!targetColumn) return;
            const newStatus = targetColumn.dataset.status;
            try { await apiFetch(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ stato: newStatus }) }); this.refreshBoard(); } 
            catch (error) { this.refreshBoard(); }
        });
    },

    openFormModal: function(taskId = null) {
        this.dom.taskForm.reset();
        this.dom.taskId.value = '';
        this.initChoices();
        if (taskId) {
            document.getElementById('modalTitle').textContent = "Modifica Task";
            this.dom.taskId.value = taskId;
            this.loadTaskIntoForm(taskId);
        } else {
            document.getElementById('modalTitle').textContent = "Nuovo Task";
            document.getElementById('taskPriority').value = 'Media';
            document.getElementById('taskAssignee').value = this.state.currentUserProfile.id_personale;
            this.dom.taskCategory.value = '';
            this.toggleSubcategoryField();
        }
        this.dom.formModal.style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
    },

    loadTaskIntoForm: async function(taskId) {
        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            const task = await res.json();
            document.getElementById('taskTitle').value = task.titolo;
            document.getElementById('taskDescription').value = task.descrizione || '';
            document.getElementById('taskPriority').value = task.priorita;
            document.getElementById('taskAssignee').value = task.id_assegnatario_fk;
            document.getElementById('taskDueDate').value = task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '';
            this.dom.taskCategory.value = task.id_categoria_fk;
            this.toggleSubcategoryField();
            if (task.id_commessa_fk) this.formCommessaChoices.setChoiceByValue(String(task.id_commessa_fk));
            if (task.sottocategoria) this.formSubcategoryChoices.setChoiceByValue(task.sottocategoria);
        } catch (e) { this.closeModals(); }
    },

    handleSaveTask: async function() {
        const taskId = this.dom.taskId.value;
        const isCommessa = this.getSelectedCategoryType() === 'commessa';
        const payload = {
            titolo: document.getElementById('taskTitle').value,
            descrizione: document.getElementById('taskDescription').value,
            priorita: document.getElementById('taskPriority').value,
            id_categoria_fk: this.dom.taskCategory.value,
            id_assegnatario_fk: document.getElementById('taskAssignee').value,
            data_obiettivo: document.getElementById('taskDueDate').value || null,
            id_commessa_fk: isCommessa ? this.formCommessaChoices.getValue(true) : null,
            sottocategoria: !isCommessa ? this.formSubcategoryChoices.getValue(true) : null
        };
        if (!payload.titolo || !payload.id_categoria_fk) return showModal({ title: 'Dati mancanti', message: 'Titolo e Categoria obbligatori.' });

        try {
            this.dom.saveTaskBtn.disabled = true;
            const method = taskId ? 'PUT' : 'POST';
            const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks/';
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            this.closeModals();
            this.refreshBoard();
            if (taskId && this.state.currentTask && this.state.currentTask.id_task == taskId) this.selectTask(taskId);
        } catch (e) { showModal({ title: 'Errore', message: e.message }); } finally { this.dom.saveTaskBtn.disabled = false; }
    },

    // Utils
    toggleSubcategoryField: function() {
        const type = this.getSelectedCategoryType();
        document.getElementById('textSubcategoryContainer').style.display = (type === 'commessa') ? 'none' : 'block';
        document.getElementById('commessaSubcategoryContainer').style.display = (type === 'commessa') ? 'block' : 'none';
    },
    getSelectedCategoryType: function() {
        const val = this.dom.taskCategory.value;
        const cat = this.state.initData.categorie.find(c => c.id_categoria == val);
        return cat ? cat.nome_categoria.toLowerCase() : '';
    },
    initChoices: function() {
        if (this.state.formCommessaChoices) this.state.formCommessaChoices.destroy();
        if (this.state.formSubcategoryChoices) this.state.formSubcategoryChoices.destroy();
        this.state.formCommessaChoices = new Choices('#taskCommessa', { searchEnabled: true, itemSelectText: '', placeholderValue: 'Cerca...', choices: this.state.initData.commesse.map(c => ({ value: c.id_commessa, label: `${c.impianto} (${c.codice_commessa})` })) });
        this.state.formSubcategoryChoices = new Choices('#taskSubcategory', { searchEnabled: true, itemSelectText: '', placeholderValue: 'Scegli...', choices: this.state.initData.etichette.map(e => ({ value: e.label, label: e.label })) });
    },
    handleAddComment: async function() {
        const input = document.getElementById('inspectorCommentInput');
        const text = input.value.trim();
        if(!text || !this.state.currentTask) return;
        try {
            const res = await apiFetch(`/api/tasks/${this.state.currentTask.id_task}/commenti`, { method: 'POST', body: JSON.stringify({ testo_commento: text }) });
            const newComment = await res.json();
            this.state.currentTask.task_commenti.unshift(newComment);
            this.renderHistory(this.state.currentTask.task_storia, this.state.currentTask.task_commenti);
            input.value = '';
        } catch(e) { console.error(e); }
    },
    updateStatus: async function(status) {
        if(!this.state.currentTask) return;
        try {
            await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, { method: 'PUT', body: JSON.stringify({ stato: status }) });
            this.selectTask(this.state.currentTask.id_task);
            this.refreshBoard();
        } catch(e) { console.error(e); }
    },
    renderHistory: function(history = [], comments = []) {
        const combined = [
            ...history.map(h => ({ ...h, type: 'history', date: new Date(h.data_azione) })),
            ...comments.map(c => ({ ...c, type: 'comment', date: new Date(c.data_creazione) }))
        ].sort((a,b) => b.date - a.date);
        document.getElementById('inspectorHistory').innerHTML = combined.map(item => {
            const dateStr = item.date.toLocaleString('it-IT', { dateStyle:'short', timeStyle:'short' });
            const user = item.type === 'history' ? item.utente?.nome_cognome : item.autore?.nome_cognome;
            return item.type === 'comment' 
                ? `<div class="history-item" style="background:#fff; border-left:2px solid #007bff;"><div style="font-size:0.8em; color:#888;">${dateStr} - <strong>${user}</strong></div><div style="margin-top:2px;">${item.testo_commento}</div></div>`
                : `<div class="history-item"><div style="font-size:0.8em; color:#888;">${dateStr} - ${user}</div><div><em>${item.azione}</em>: ${item.dettagli || ''}</div></div>`;
        }).join('');
    },
    closeModals: function() {
        this.dom.formModal.style.display = 'none';
        document.getElementById('archiveModal').style.display = 'none';
        this.dom.modalOverlay.style.display = 'none';
    },
    openArchive: async function() {
        document.getElementById('archiveModal').style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
        const container = document.getElementById('archiveTasksContainer');
        container.innerHTML = 'Caricamento...';
        try {
            const res = await apiFetch(`/api/tasks/completed?page=1`);
            const tasks = await res.json();
            container.innerHTML = tasks.length ? '' : 'Nessun task.';
            tasks.forEach(t => container.innerHTML += `<div class="archive-task-item"><span>${t.titolo}</span><span>${t.assegnatario?.nome_cognome}</span><span>${new Date(t.data_ultima_modifica).toLocaleDateString()}</span></div>`);
        } catch(e) { container.innerHTML = 'Errore.'; }
    }
};

document.addEventListener('DOMContentLoaded', () => TaskApp.init());