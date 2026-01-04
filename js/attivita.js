// js/attivita.js
// Versione 3.0 - Kanban Board Completa (4 Colonne + Ispettore)

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const TaskApp = {
    state: {
        boardData: { todo: [], doing: [], review: [], done: [] }, // Struttura Backend
        initData: { categorie: [], commesse: [], etichette: [] },
        personale: [],
        currentUserProfile: null,
        currentTask: null, // Task aperto nel dettaglio
        
        // Configurazione Colonne Kanban
        columnsConfig: [
            { key: 'todo',   label: 'Da Fare',       status: 'Da Fare',      colorClass: 'todo' },
            { key: 'doing',  label: 'In Corso',      status: 'In Corso',     colorClass: 'doing' },
            { key: 'review', label: 'In Revisione',  status: 'In Revisione', colorClass: 'review' },
            { key: 'done',   label: 'Completato',    status: 'Completato',   colorClass: 'done' }
        ],

        // Choices Instances
        formCommessaChoices: null,
        formSubcategoryChoices: null,
        
        // Archivio
        archivePage: 1,
        canLoadMoreArchive: true
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
        this.dom.addTaskBtn = document.getElementById('addTaskBtn');
        this.dom.modalOverlay = document.getElementById('modalOverlay');
        
        // Filters
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');

        // Modale Form
        this.dom.formModal = document.getElementById('taskModal');
        this.dom.taskForm = document.getElementById('taskForm');
        this.dom.taskId = document.getElementById('taskId');
        // ...altri input form mappati dinamicamente al bisogno...
        this.dom.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.dom.taskCategory = document.getElementById('taskCategory');

        // Modale Dettaglio
        this.dom.detailModal = document.getElementById('taskDetailModal');
        this.dom.detailReadOnly = document.getElementById('taskDetailReadOnlyContainer');
        this.dom.detailHistory = document.getElementById('detailTaskHistoryContainer');
        
        // Avvio
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
            this.renderKanbanBoard(); // <-- Genera le colonne e le card

        } catch (error) {
            console.error("Init Error:", error);
            this.dom.taskView.innerHTML = `<p class="error-text">Errore caricamento dati: ${error.message}</p>`;
        }
    },

    fetchBoardData: async function() {
        const params = new URLSearchParams();
        const filterUser = this.dom.adminUserFilter?.value;
        if (filterUser) params.append('id_utente_filtro', filterUser);
        
        const res = await apiFetch(`/api/tasks/?${params.toString()}`);
        if (!res.ok) throw new Error('Errore API Tasks');
        return await res.json();
    },

    // =================================================================
    // == 2. RENDER KANBAN (Core Logic)                               ==
    // =================================================================

    renderKanbanBoard: function() {
        this.dom.taskView.innerHTML = ''; // Pulisce tutto

        // Genera le 4 colonne dinamicamente
        this.state.columnsConfig.forEach(col => {
            const columnEl = document.createElement('div');
            columnEl.className = 'task-column';
            columnEl.dataset.status = col.status; // Fondamentale per il Drop
            
            // Header Colonna
            const tasksInCol = this.state.boardData[col.key] || [];
            const count = tasksInCol.length;
            
            // Extra: Bottone archivio solo nell'ultima colonna
            const extraBtn = col.key === 'done' 
                ? `<button id="openArchiveBtn" class="small-action-btn">Archivio</button>` 
                : '';

            columnEl.innerHTML = `
                <div class="task-column-header">
                    <h2>
                        <span class="dot-indicator" style="background-color: var(--${col.colorClass}-color, #ccc)"></span> 
                        ${col.label}
                    </h2>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="column-count">${count}</span>
                        ${extraBtn}
                    </div>
                </div>
                <div class="tasks-container" data-status-key="${col.key}"></div>
            `;

            // Card Container
            const container = columnEl.querySelector('.tasks-container');
            
            // Popola Cards
            tasksInCol.forEach(task => {
                container.appendChild(this.createTaskCard(task));
            });

            // Eventi Drag & Drop sulla colonna
            this.setupDragDrop(container);

            this.dom.taskView.appendChild(columnEl);
        });

        // Ri-attacca listener archivio se esiste
        const archiveBtn = document.getElementById('openArchiveBtn');
        if (archiveBtn) archiveBtn.addEventListener('click', () => this.openArchive());
    },

    createTaskCard: function(task) {
        const el = document.createElement('div');
        el.className = `task-card priority-${(task.priorita || 'Media').toLowerCase()}`;
        el.draggable = true;
        el.dataset.taskId = task.id_task;

        // Header: Categoria o Commessa
        let headerText = task.categoria?.nome_categoria || 'Generale';
        let headerClass = 'cat-tag';
        if (task.commessa) {
            headerText = `${task.commessa.codice_commessa}`;
            headerClass = 'commessa-tag';
        }

        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.75em; color:#888;">
                <span class="${headerClass}"><strong>${headerText}</strong></span>
                <span>${task.assegnatario?.nome_cognome || ''}</span>
            </div>
            <h4>${task.titolo}</h4>
            ${task.data_obiettivo ? `<div style="margin-top:5px; font-size:0.8em; color:${this.isLate(task.data_obiettivo) ? 'red' : '#666'}">📅 ${new Date(task.data_obiettivo).toLocaleDateString()}</div>` : ''}
        `;

        el.addEventListener('click', () => this.openDetailModal(task.id_task));
        
        // Drag Events
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id_task);
            setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));

        return el;
    },

    isLate: function(dateStr) {
        return new Date(dateStr) < new Date().setHours(0,0,0,0);
    },

    // =================================================================
    // == 3. DRAG & DROP LOGIC                                        ==
    // =================================================================

    setupDragDrop: function(container) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault(); // Permette il drop
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const targetColumn = container.closest('.task-column');
            const newStatus = targetColumn.dataset.status;

            if (!newStatus || !taskId) return;

            // Update UI Ottimistico
            const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
            if(card) container.appendChild(card);

            // API Call
            try {
                await apiFetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ stato: newStatus })
                });
                // Ricarica background per riordinare correttamente
                this.refreshBoard(); 
            } catch (error) {
                console.error("Drop Error:", error);
                this.refreshBoard(); // Revert
                showModal({ title: 'Errore', message: 'Spostamento fallito.' });
            }
        });
    },

    // =================================================================
    // == 4. MODALS & FORMS                                           ==
    // =================================================================

    openFormModal: function(taskId = null) {
        this.dom.taskForm.reset();
        this.dom.taskId.value = '';
        const modalTitle = document.getElementById('modalTitle');
        
        // Reset Choices
        this.initChoices();

        if (taskId) {
            modalTitle.textContent = "Modifica Task";
            this.dom.taskId.value = taskId;
            this.loadTaskIntoForm(taskId);
        } else {
            modalTitle.textContent = "Nuovo Task";
            // Defaults
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

        } catch (e) {
            console.error(e);
            this.closeModals();
        }
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

        if (!payload.titolo || !payload.id_categoria_fk) {
            return showModal({ title: 'Mancano Dati', message: 'Titolo e Categoria obbligatori.' });
        }

        try {
            this.dom.saveTaskBtn.disabled = true;
            const method = taskId ? 'PUT' : 'POST';
            const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks/';
            
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            
            this.closeModals();
            this.refreshBoard();
            
        } catch (e) {
            showModal({ title: 'Errore Salvataggio', message: e.message });
        } finally {
            this.dom.saveTaskBtn.disabled = false;
        }
    },

    openDetailModal: async function(taskId) {
        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            if(!res.ok) throw new Error("Task not found");
            const task = await res.json();
            this.state.currentTask = task;

            document.getElementById('detailModalTitle').textContent = task.titolo;
            
            // Render Info
            this.dom.detailReadOnly.innerHTML = `
                <p><strong>Stato:</strong> ${task.stato}</p>
                <p><strong>Categoria:</strong> ${task.categoria?.nome_categoria}</p>
                ${task.commessa ? `<p><strong>Commessa:</strong> ${task.commessa.impianto} (${task.commessa.codice_commessa})</p>` : ''}
                ${task.sottocategoria ? `<p><strong>Tag:</strong> ${task.sottocategoria}</p>` : ''}
                <p><strong>Assegnato:</strong> ${task.assegnatario?.nome_cognome}</p>
                <p><strong>Scadenza:</strong> ${task.data_obiettivo ? new Date(task.data_obiettivo).toLocaleDateString() : '-'}</p>
                <div class="description-block">${task.descrizione || 'Nessuna descrizione.'}</div>
            `;

            // Bottoni Stato
            const completeBtn = document.getElementById('detailCompleteTaskBtn');
            const reopenBtn = document.getElementById('detailReopenTaskBtn');
            if (task.stato === 'Completato') {
                completeBtn.style.display = 'none';
                reopenBtn.style.display = 'block';
            } else {
                completeBtn.style.display = 'block';
                reopenBtn.style.display = 'none';
            }

            // Render History & Comments
            this.renderHistory(task.task_storia, task.task_commenti);

            this.dom.detailModal.style.display = 'block';
            this.dom.modalOverlay.style.display = 'block';

        } catch (e) {
            console.error(e);
        }
    },

    // =================================================================
    // == 5. HELPERS & UTILS                                          ==
    // =================================================================

    refreshBoard: async function() {
        this.state.boardData = await this.fetchBoardData();
        this.renderKanbanBoard();
    },

    addEventListeners: function() {
        this.dom.addTaskBtn.addEventListener('click', () => this.openFormModal());
        this.dom.modalOverlay.addEventListener('click', () => this.closeModals());
        
        // Bottoni chiusura modali
        document.querySelectorAll('.close-button').forEach(b => 
            b.addEventListener('click', () => this.closeModals())
        );

        this.dom.saveTaskBtn.addEventListener('click', () => this.handleSaveTask());
        this.dom.taskCategory.addEventListener('change', () => this.toggleSubcategoryField());
        this.dom.adminUserFilter?.addEventListener('change', () => this.refreshBoard());

        // Dettaglio Azioni
        document.getElementById('detailOpenEditBtn').addEventListener('click', () => {
            this.closeModals();
            this.openFormModal(this.state.currentTask.id_task);
        });

        document.getElementById('detailAddCommentBtn').addEventListener('click', () => this.handleAddComment());
        
        document.getElementById('detailCompleteTaskBtn').addEventListener('click', () => this.updateStatus('Completato'));
        document.getElementById('detailReopenTaskBtn').addEventListener('click', () => this.updateStatus('Da Fare'));
    },

    handleAddComment: async function() {
        const input = document.getElementById('detailTaskCommentInput');
        const text = input.value.trim();
        if(!text) return;

        try {
            const res = await apiFetch(`/api/tasks/${this.state.currentTask.id_task}/commenti`, {
                method: 'POST', body: JSON.stringify({ testo_commento: text })
            });
            const newComment = await res.json();
            
            // Append locale veloce
            this.state.currentTask.task_commenti.unshift(newComment);
            this.renderHistory(this.state.currentTask.task_storia, this.state.currentTask.task_commenti);
            input.value = '';
        } catch(e) { console.error(e); }
    },

    updateStatus: async function(status) {
        try {
            await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {
                method: 'PUT', body: JSON.stringify({ stato: status })
            });
            this.closeModals();
            this.refreshBoard();
        } catch(e) { console.error(e); }
    },

    renderHistory: function(history = [], comments = []) {
        // Unisce e ordina
        const combined = [
            ...history.map(h => ({ ...h, type: 'history', date: new Date(h.data_ora_azione) })),
            ...comments.map(c => ({ ...c, type: 'comment', date: new Date(c.data_creazione) }))
        ].sort((a,b) => b.date - a.date);

        this.dom.detailHistory.innerHTML = combined.map(item => {
            const dateStr = item.date.toLocaleString('it-IT', { dateStyle:'short', timeStyle:'short' });
            const user = item.type === 'history' ? item.utente?.nome_cognome : item.autore?.nome_cognome;
            
            if (item.type === 'comment') {
                return `
                    <div class="history-item" style="background:#fff; padding:8px; border-radius:4px; border:1px solid #eee;">
                        <div style="font-size:0.8em; color:#888;">${dateStr} - <strong>${user}</strong></div>
                        <div style="margin-top:4px;">${item.testo_commento}</div>
                    </div>
                `;
            } else {
                return `
                    <div class="history-item">
                        <div style="font-size:0.8em; color:#888;">${dateStr} - ${user}</div>
                        <div><em>${item.azione}</em>: ${item.dettagli || ''}</div>
                    </div>
                `;
            }
        }).join('');
    },

    closeModals: function() {
        this.dom.formModal.style.display = 'none';
        this.dom.detailModal.style.display = 'none';
        document.getElementById('archiveModal').style.display = 'none';
        this.dom.modalOverlay.style.display = 'none';
    },

    // --- Dynamic Form Helpers ---
    initChoices: function() {
        if (this.state.formCommessaChoices) this.state.formCommessaChoices.destroy();
        if (this.state.formSubcategoryChoices) this.state.formSubcategoryChoices.destroy();

        // Commessa Select
        this.state.formCommessaChoices = new Choices('#taskCommessa', {
            searchEnabled: true, itemSelectText: '', placeholderValue: 'Cerca Commessa...',
            choices: this.state.initData.commesse.map(c => ({ value: c.id_commessa, label: `${c.impianto} (${c.codice_commessa})` }))
        });

        // Etichette Select
        this.state.formSubcategoryChoices = new Choices('#taskSubcategory', {
            searchEnabled: true, itemSelectText: '', placeholderValue: 'Scegli o scrivi...',
            choices: this.state.initData.etichette.map(e => ({ value: e.label, label: e.label }))
        });
    },

    populateDropdowns: function() {
        // Categorie
        const catSel = this.dom.taskCategory;
        catSel.innerHTML = '<option value="" disabled selected>Seleziona...</option>';
        this.state.initData.categorie.forEach(c => {
            catSel.innerHTML += `<option value="${c.id_categoria}">${c.nome_categoria}</option>`;
        });

        // Assegnatari
        const assSel = document.getElementById('taskAssignee');
        assSel.innerHTML = '';
        this.state.personale.filter(p => p.puo_accedere).forEach(p => {
            assSel.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`;
        });
        
        // Admin Filter
        if (this.state.currentUserProfile.is_admin) {
            const filterSel = this.dom.adminUserFilter;
            filterSel.innerHTML = '<option value="">Tutti</option>';
            this.state.personale.filter(p => p.puo_accedere).forEach(p => {
                 filterSel.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`;
            });
        }
    },

    toggleSubcategoryField: function() {
        const type = this.getSelectedCategoryType();
        const textCont = document.getElementById('textSubcategoryContainer');
        const commCont = document.getElementById('commessaSubcategoryContainer');

        if (type === 'commessa') {
            textCont.style.display = 'none';
            commCont.style.display = 'block';
        } else {
            textCont.style.display = 'block';
            commCont.style.display = 'none';
        }
    },

    getSelectedCategoryType: function() {
        const val = this.dom.taskCategory.value;
        const cat = this.state.initData.categorie.find(c => c.id_categoria == val);
        return cat ? cat.nome_categoria.toLowerCase() : '';
    },

    // --- Archivio ---
    openArchive: async function() {
        document.getElementById('archiveModal').style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
        const container = document.getElementById('archiveTasksContainer');
        container.innerHTML = 'Caricamento...';
        
        try {
            const res = await apiFetch(`/api/tasks/completed?page=1`);
            const tasks = await res.json();
            container.innerHTML = tasks.length ? '' : 'Nessun task in archivio.';
            
            tasks.forEach(t => {
                container.innerHTML += `
                    <div class="archive-task-item">
                        <span>${t.titolo}</span>
                        <span>${t.assegnatario?.nome_cognome}</span>
                        <span>${new Date(t.data_ultima_modifica).toLocaleDateString()}</span>
                    </div>
                `;
            });
        } catch(e) { container.innerHTML = 'Errore caricamento.'; }
    }
};

document.addEventListener('DOMContentLoaded', () => TaskApp.init());