// js/attivita.js

import { apiFetch } from './api-client.js';

const TaskApp = {
    dom: {},
    state: {
        currentUserProfile: null,
        tasks: { da_fare_organizzato: {}, completati_recenti: [] },
        personale: [],
        initData: { categorie: [], commesse: [] },
        currentTask: null,
        selectedUserId: null, // Per il filtro admin
    },

    init: async function() {
        this.cacheDom();
        this.addEventListeners();
        await this.loadInitialData();
    },

    cacheDom: function() {
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');
        this.dom.addTaskBtn = document.getElementById('addTaskBtn');
        this.dom.modal = document.getElementById('taskModal');
        this.dom.modalOverlay = document.getElementById('modalOverlay');
        this.dom.modalTitle = document.getElementById('modalTitle');
        this.dom.taskForm = document.getElementById('taskForm');
        this.dom.taskId = document.getElementById('taskId');
        this.dom.taskTitle = document.getElementById('taskTitle');
        this.dom.taskCategory = document.getElementById('taskCategory');
        this.dom.taskPriority = document.getElementById('taskPriority');
        this.dom.commessaSubcategoryContainer = document.getElementById('commessaSubcategoryContainer');
        this.dom.taskCommessa = document.getElementById('taskCommessa');
        this.dom.textSubcategoryContainer = document.getElementById('textSubcategoryContainer');
        this.dom.taskSubcategory = document.getElementById('taskSubcategory');
        this.dom.taskDescription = document.getElementById('taskDescription');
        this.dom.taskAssignee = document.getElementById('taskAssignee');
        this.dom.taskDueDate = document.getElementById('taskDueDate');
        this.dom.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.dom.closeModalBtn = this.dom.modal.querySelector('.close-button');
        this.dom.completeTaskBtn = document.getElementById('completeTaskBtn');
        this.dom.reopenTaskBtn = document.getElementById('reopenTaskBtn');
        this.dom.commentsSection = document.getElementById('commentsSection');
        this.dom.commentsContainer = document.getElementById('commentsContainer');
        this.dom.newCommentText = document.getElementById('newCommentText');
        this.dom.addCommentBtn = document.getElementById('addCommentBtn');
        this.dom.historySection = document.getElementById('historySection');
        this.dom.historyContainer = document.getElementById('historyContainer');
    },

    addEventListeners: function() {
        this.dom.addTaskBtn.addEventListener('click', () => this.openModal());
        this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.dom.modalOverlay.addEventListener('click', () => this.closeModal());
        this.dom.saveTaskBtn.addEventListener('click', () => this.handleSaveTask());
        this.dom.addCommentBtn.addEventListener('click', () => this.handleAddComment());
        this.dom.adminUserFilter.addEventListener('change', this.handleAdminFilterChange.bind(this));
        this.dom.taskCategory.addEventListener('change', this.handleCategoryChange.bind(this));
        this.dom.completeTaskBtn.addEventListener('click', () => this.handleStatusChange('Completato'));
        this.dom.reopenTaskBtn.addEventListener('click', () => this.handleStatusChange('Da Fare'));
    },

    loadInitialData: async function() {
        try {
            const profileString = localStorage.getItem('user_profile');
            if (!profileString) throw new Error("Profilo utente non trovato.");
            this.state.currentUserProfile = JSON.parse(profileString);

            const [initDataRes, personaleRes] = await Promise.all([
                apiFetch('/api/tasks/init-data'),
                apiFetch('/api/personale')
            ]);
            
            this.state.initData = await initDataRes.json();
            const personaleData = await personaleRes.json();
            this.state.personale = personaleData.data;
            
            this.populatePersonaleSelects();
            this.setupAdminFilter();
            await this.loadTasks();
        } catch (error) {
            console.error("Errore nel caricamento dei dati iniziali:", error);
        }
    },

    loadTasks: async function() {
        try {
            let url = '/api/tasks';
            if (this.state.selectedUserId) {
                url += `?id_utente_filtro=${this.state.selectedUserId}`;
            }
            const tasksRes = await apiFetch(url);
            this.state.tasks = await tasksRes.json();
            this.renderBoard();
        } catch (error) {
            console.error("Errore nel caricamento dei task:", error);
        }
    },

    setupAdminFilter: function() {
        if (this.state.currentUserProfile?.is_admin) {
            this.dom.adminFilterContainer.style.display = 'block';
            const select = this.dom.adminUserFilter;
            select.innerHTML = '<option value="">Tutti</option>';
            this.state.personale.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id_personale;
                option.textContent = p.nome_cognome;
                select.appendChild(option);
            });
        }
    },
    
    renderBoard: function() {
        const daFareContent = document.getElementById('daFareContent');
        const completatiContainer = document.querySelector('#completatiContainer .tasks-container');

        daFareContent.innerHTML = '';
        completatiContainer.innerHTML = '';

        const organizedTasks = this.state.tasks.da_fare_organizzato || {};
        for (const categoryName in organizedTasks) {
            const group = document.createElement('div');
            group.className = 'subcategory-group';
            
            const header = document.createElement('h3');
            header.className = 'subcategory-header';
            header.textContent = categoryName;
            group.appendChild(header);
            
            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'tasks-container';
            tasksContainer.dataset.statusContainer = 'Da Fare';
            organizedTasks[categoryName].forEach(task => {
                tasksContainer.appendChild(this.createTaskCard(task));
            });
            group.appendChild(tasksContainer);
            daFareContent.appendChild(group);
        }

        const recentTasks = this.state.tasks.completati_recenti || [];
        recentTasks.forEach(task => {
            completatiContainer.appendChild(this.createTaskCard(task));
        });
        
        this.addDragDropListeners(); 
    },

    createTaskCard: function(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.classList.add(`priority-${task.priorita?.toLowerCase() || 'media'}`);
        card.dataset.taskId = task.id_task;
        card.draggable = true;

        const assigneeName = task.assegnatario ? task.assegnatario.nome_cognome : 'Non Assegnato';

        card.innerHTML = `
            <h4>${task.titolo}</h4>
            <span class="assignee">${assigneeName}</span>
        `;
        
        card.addEventListener('click', () => this.openModal(task.id_task));
        card.addEventListener('dragstart', this.handleDragStart);
        return card;
    },

    openModal: async function(taskId = null) {
        this.dom.taskForm.reset();
        this.populateModalSelects();

        if (taskId) {
            this.dom.modalTitle.textContent = 'Dettaglio Task';
            this.dom.commentsSection.style.display = 'block';
            this.dom.historySection.style.display = 'block';
            try {
                const res = await apiFetch(`/api/tasks/${taskId}`);
                const task = await res.json();
                this.state.currentTask = task;
                
                this.dom.taskId.value = task.id_task;
                this.dom.taskTitle.value = task.titolo;
                this.dom.taskCategory.value = task.id_categoria_fk;
                this.dom.taskPriority.value = task.priorita;
                this.dom.taskSubcategory.value = task.sottocategoria || '';
                this.dom.taskCommessa.value = task.id_commessa_fk || '';
                this.dom.taskDescription.value = task.descrizione || '';
                this.dom.taskAssignee.value = task.id_assegnatario_fk || '';
                this.dom.taskDueDate.value = task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '';
                
                this.renderComments(task.task_commenti);
                this.renderHistory(task.task_storia);

                this.dom.completeTaskBtn.style.display = task.stato === 'Da Fare' ? 'inline-block' : 'none';
                this.dom.reopenTaskBtn.style.display = task.stato === 'Completato' ? 'inline-block' : 'none';

                // Trigger change to show correct subcategory field
                this.handleCategoryChange();

            } catch (error) {
                console.error("Errore nel caricare i dettagli del task:", error);
                return;
            }
        } else {
            this.dom.modalTitle.textContent = 'Nuovo Task';
            this.state.currentTask = null;
            this.dom.commentsSection.style.display = 'none';
            this.dom.historySection.style.display = 'none';
            this.dom.completeTaskBtn.style.display = 'none';
            this.dom.reopenTaskBtn.style.display = 'none';
            this.handleCategoryChange();
        }
        
        this.dom.modal.style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
    },

    closeModal: function() {
        this.dom.modal.style.display = 'none';
        this.dom.modalOverlay.style.display = 'none';
    },
    
    populatePersonaleSelects: function() {
        const select = this.dom.taskAssignee;
        select.innerHTML = '<option value="">Non Assegnato</option>';
        this.state.personale.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id_personale;
            option.textContent = p.nome_cognome;
            select.appendChild(option);
        });
    },

    populateModalSelects: function() {
        const catSelect = this.dom.taskCategory;
        catSelect.innerHTML = '<option value="" disabled selected>Seleziona Categoria...</option>';
        this.state.initData.categorie.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id_categoria;
            option.textContent = c.nome_categoria;
            catSelect.appendChild(option);
        });

        const commSelect = this.dom.taskCommessa;
        commSelect.innerHTML = '<option value="">Nessuna Commessa</option>';
        this.state.initData.commesse.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id_commessa;
            option.textContent = `${c.codice_commessa} - ${c.impianto}`;
            commSelect.appendChild(option);
        });
    },
    
    handleSaveTask: async function() {
        const taskId = this.dom.taskId.value;
        const selectedCategory = this.state.initData.categorie.find(c => c.id_categoria == this.dom.taskCategory.value);

        const payload = {
            titolo: this.dom.taskTitle.value,
            descrizione: this.dom.taskDescription.value,
            id_categoria_fk: this.dom.taskCategory.value,
            priorita: this.dom.taskPriority.value,
            id_assegnatario_fk: this.dom.taskAssignee.value || null,
            data_obiettivo: this.dom.taskDueDate.value || null,
            // Dynamic subcategory
            id_commessa_fk: selectedCategory?.nome_categoria === 'Commessa' ? this.dom.taskCommessa.value || null : null,
            sottocategoria: selectedCategory?.nome_categoria !== 'Commessa' ? this.dom.taskSubcategory.value.trim() : null,
        };

        try {
            if (taskId) {
                await apiFetch(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
            }
            this.closeModal();
            await this.loadTasks();
        } catch (error) {
            console.error("Errore nel salvataggio del task:", error);
        }
    },
    
    handleStatusChange: async function(newStatus) {
        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;
        try {
            await apiFetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ stato: newStatus, data_ultima_modifica: new Date().toISOString() })
            });
            this.closeModal();
            await this.loadTasks();
        } catch (error) {
            console.error("Errore nell'aggiornamento dello stato:", error);
        }
    },

    handleCategoryChange: function() {
        const selectedCategory = this.state.initData.categorie.find(c => c.id_categoria == this.dom.taskCategory.value);
        if (selectedCategory?.nome_categoria === 'Commessa') {
            this.dom.commessaSubcategoryContainer.style.display = 'block';
            this.dom.textSubcategoryContainer.style.display = 'none';
        } else {
            this.dom.commessaSubcategoryContainer.style.display = 'none';
            this.dom.textSubcategoryContainer.style.display = 'block';
        }
    },
    
    handleAdminFilterChange: function(e) {
        this.state.selectedUserId = e.target.value || null;
        this.loadTasks();
    },

    // --- Unchanged Methods ---
    renderComments: function(comments) {
        if (!comments || comments.length === 0) {
            this.dom.commentsContainer.innerHTML = '<p>Nessun commento.</p>'; return;
        }
        this.dom.commentsContainer.innerHTML = comments.map(c => `
            <div class="comment">
                <strong>${c.autore?.nome_cognome || 'Utente'}</strong>
                <p>${c.testo_commento}</p>
            </div>
        `).join('');
    },
    renderHistory: function(history) {
        if (!history || history.length === 0) {
            this.dom.historyContainer.innerHTML = '<li>Nessuno storico disponibile.</li>'; return;
        }
        this.dom.historyContainer.innerHTML = history.reverse().map(h => `
            <li><strong>${new Date(h.data_azione).toLocaleString('it-IT')}:</strong> ${h.utente?.nome_cognome || 'Sistema'} ha eseguito l'azione '${h.azione}'. ${h.dettagli || ''}</li>
        `).join('');
    },
    handleAddComment: async function() {
        const taskId = this.state.currentTask?.id_task;
        const commentText = this.dom.newCommentText.value.trim();
        if (!taskId || !commentText) return;
        try {
            const newComment = await (await apiFetch(`/api/tasks/${taskId}/commenti`, {
                method: 'POST', body: JSON.stringify({ testo_commento: commentText })
            })).json();
            this.dom.newCommentText.value = '';
            this.state.currentTask.task_commenti.push(newComment);
            this.renderComments(this.state.currentTask.task_commenti);
        } catch (error) {
            console.error("Errore nell'aggiunta del commento:", error);
        }
    },
    addDragDropListeners: function() {
        const containers = document.querySelectorAll('.tasks-container');
        containers.forEach(container => {
            container.addEventListener('dragover', this.handleDragOver);
            container.addEventListener('drop', this.handleDrop.bind(this));
        });
    },
    handleDragStart: function(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        setTimeout(() => { e.target.classList.add('dragging'); }, 0);
    },
    handleDragOver: function(e) { e.preventDefault(); },
    handleDrop: async function(e) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (!draggedElement) return;
        draggedElement.classList.remove('dragging');
        const dropContainer = e.target.closest('.tasks-container');
        if (dropContainer && dropContainer !== draggedElement.parentElement) {
            const newStatus = dropContainer.dataset.statusContainer;
            try {
                await apiFetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ stato: newStatus, data_ultima_modifica: new Date().toISOString() })
                });
                await this.loadTasks();
            } catch (error) {
                console.error("Errore durante l'aggiornamento dello stato:", error);
                this.renderBoard();
            }
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    TaskApp.init();
});