// js/attivita.js

import { apiFetch } from './api-client.js';

const TaskApp = {
    dom: {},
    state: {
        tasks: null,
        personale: [],
        initData: null,
        currentUserProfile: null,
        currentTask: null,
        archivePage: 1,
        archiveTasks: [],
        isLoadingArchive: false,
        canLoadMore: true,
        // NUOVO: Istanza per il dropdown delle commesse
        commessaChoicesInstance: null,
    },

    init: async function() {
        // ... (selezione elementi DOM esistenti) ...
        this.dom.addTaskBtn = document.getElementById('addTaskBtn');
        this.dom.modal = document.getElementById('taskModal');
        this.dom.modalOverlay = document.getElementById('modalOverlay');
        this.dom.modalTitle = document.getElementById('modalTitle');
        this.dom.taskForm = document.getElementById('taskForm');
        this.dom.taskId = document.getElementById('taskId');
        this.dom.taskTitle = document.getElementById('taskTitle');
        this.dom.taskDescription = document.getElementById('taskDescription');
        this.dom.taskAssignee = document.getElementById('taskAssignee');
        this.dom.taskDueDate = document.getElementById('taskDueDate');
        this.dom.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.dom.closeModalBtn = this.dom.modal.querySelector('.close-button');
        this.dom.commentsContainer = document.getElementById('commentsContainer');
        this.dom.newCommentText = document.getElementById('newCommentText');
        this.dom.addCommentBtn = document.getElementById('addCommentBtn');
        this.dom.historyContainer = document.getElementById('historyContainer');
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');
        this.dom.taskCategory = document.getElementById('taskCategory');
        this.dom.taskPriority = document.getElementById('taskPriority');
        this.dom.taskSubcategory = document.getElementById('taskSubcategory');
        this.dom.taskCommessa = document.getElementById('taskCommessa');
        this.dom.commessaSubcategoryContainer = document.getElementById('commessaSubcategoryContainer');
        this.dom.textSubcategoryContainer = document.getElementById('textSubcategoryContainer');
        this.dom.completeTaskBtn = document.getElementById('completeTaskBtn');
        this.dom.reopenTaskBtn = document.getElementById('reopenTaskBtn');
        this.dom.commentsSection = document.getElementById('commentsSection');
        this.dom.historySection = document.getElementById('historySection');
        this.dom.openArchiveBtn = document.getElementById('openArchiveBtn');
        this.dom.archiveModal = document.getElementById('archiveModal');
        this.dom.closeArchiveBtn = this.dom.archiveModal.querySelector('.close-button');
        this.dom.archiveTasksContainer = document.getElementById('archiveTasksContainer');
        this.dom.loadMoreBtn = document.getElementById('loadMoreBtn');
        this.dom.archiveLoader = document.getElementById('archiveLoader');
        this.dom.daFareContent = document.getElementById('daFareContent');
        
        await this.loadInitialData();
        this.addEventListeners();
    },

    loadInitialData: async function() {
        try {
            this.state.currentUserProfile = JSON.parse(localStorage.getItem('user_profile'));

            const [tasksRes, personaleRes, initDataRes] = await Promise.all([
                this.loadTasks(),
                apiFetch('/api/personale/'),
                apiFetch('/api/tasks/init-data')
            ]);
            
            this.state.tasks = tasksRes;
            const personaleData = await personaleRes.json();
            this.state.initData = await initDataRes.json();
            this.state.personale = personaleData.data;

            this.setupAdminFilter();
            this.populateDropdowns();
            this.renderBoard();
        } catch (error) {
            console.error("Errore nel caricamento dei dati iniziali:", error);
        }
    },
    
    loadTasks: async function() {
        try {
            const params = new URLSearchParams();
            const selectedUserId = this.dom.adminUserFilter.value;
            if (this.state.currentUserProfile?.is_admin && selectedUserId) {
                params.append('id_utente_filtro', selectedUserId);
            }
            const res = await apiFetch(`/api/tasks/?${params.toString()}`);
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (error) {
             console.error("Errore nel caricamento dei task:", error);
             if (this.dom.daFareContent) {
                this.dom.daFareContent.innerHTML = `<p class="error-text">Impossibile caricare i task.</p>`;
             }
             return { da_fare_organizzato: {}, completati_recenti: [] };
        }
    },

    addEventListeners: function() {
        this.dom.addTaskBtn.addEventListener('click', () => this.openTaskModal());
        this.dom.closeModalBtn.addEventListener('click', () => this.closeTaskModal());
        this.dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.dom.modalOverlay) {
                this.closeTaskModal();
                this.closeArchiveModal();
            }
        });
        this.dom.saveTaskBtn.addEventListener('click', () => this.handleSaveTask());
        this.dom.addCommentBtn.addEventListener('click', () => this.handleAddComment());
        this.dom.adminUserFilter.addEventListener('change', async () => {
            this.state.tasks = await this.loadTasks();
            this.renderBoard();
        });
        this.dom.taskCategory.addEventListener('change', () => this.toggleSubcategoryField());
        this.dom.completeTaskBtn.addEventListener('click', () => this.updateTaskStatus('Completato'));
        this.dom.reopenTaskBtn.addEventListener('click', () => this.updateTaskStatus('Da Fare'));
        this.dom.openArchiveBtn.addEventListener('click', () => this.openArchiveModal());
        this.dom.closeArchiveBtn.addEventListener('click', () => this.closeArchiveModal());
        this.dom.loadMoreBtn.addEventListener('click', () => this.loadCompletedTasks());
    },

    openArchiveModal: async function() {
        this.dom.archiveModal.style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
        this.state.archivePage = 1;
        this.state.archiveTasks = [];
        this.state.canLoadMore = true;
        this.dom.archiveTasksContainer.innerHTML = '';
        this.dom.loadMoreBtn.style.display = 'inline-block';
        await this.loadCompletedTasks();
    },

    closeArchiveModal: function() {
        this.dom.archiveModal.style.display = 'none';
        if (this.dom.modal.style.display !== 'block') {
            this.dom.modalOverlay.style.display = 'none';
        }
    },

    loadCompletedTasks: async function() {
        if (this.state.isLoadingArchive || !this.state.canLoadMore) return;
        this.state.isLoadingArchive = true;
        this.dom.archiveLoader.style.display = 'block';
        this.dom.loadMoreBtn.style.display = 'none';

        try {
            const res = await apiFetch(`/api/tasks/completed?page=${this.state.archivePage}`);
            const completedTasks = await res.json();
            if (completedTasks.length < 15) {
                this.state.canLoadMore = false;
            }
            this.state.archiveTasks.push(...completedTasks);
            this.renderArchive();
            this.state.archivePage++;
        } catch (error) {
            console.error("Errore nel caricamento dei task completati:", error);
        } finally {
            this.state.isLoadingArchive = false;
            this.dom.archiveLoader.style.display = 'none';
            if (this.state.canLoadMore) {
                this.dom.loadMoreBtn.style.display = 'inline-block';
            }
        }
    },

    renderArchive: function() {
        const fragment = document.createDocumentFragment();
        this.state.archiveTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'archive-task-item';
            const completionDate = new Date(task.data_ultima_modifica).toLocaleDateString('it-IT');
            item.innerHTML = `
                <span class="title">${task.titolo}</span>
                <span class="assignee">${task.assegnatario?.nome_cognome || 'N/D'}</span>
                <span class="date">Completato il: ${completionDate}</span>
            `;
            fragment.appendChild(item);
        });
        this.dom.archiveTasksContainer.innerHTML = ''; 
        this.dom.archiveTasksContainer.appendChild(fragment);
    },

    initializeCommessaChoices: function() {
        if (this.state.commessaChoicesInstance) {
            this.state.commessaChoicesInstance.destroy();
        }

        this.state.commessaChoicesInstance = new Choices(this.dom.taskCommessa, {
            searchEnabled: true,
            removeItemButton: true,
            itemSelectText: 'Seleziona',
            searchPlaceholderValue: 'Digita per cercare...',
            placeholder: true,
            placeholderValue: 'Seleziona una commessa...',
        });

        const commesseOptions = this.state.initData.commesse.map(c => ({
            value: c.id_commessa,
            label: `${c.impianto} (${c.codice_commessa})`
        }));

        this.state.commessaChoicesInstance.setChoices(commesseOptions, 'value', 'label', false);
    },

    openTaskModal: async function(taskId = null) {
        this.dom.taskForm.reset();
        this.dom.commentsContainer.innerHTML = '';
        this.dom.historyContainer.innerHTML = '';
        
        this.initializeCommessaChoices();
        this.toggleSubcategoryField();

        if (taskId) {
            this.dom.modalTitle.textContent = 'Dettaglio Task';
            try {
                const res = await apiFetch(`/api/tasks/${taskId}`);
                const task = await res.json();
                this.state.currentTask = task;
                this.dom.taskId.value = task.id_task;
                this.dom.taskTitle.value = task.titolo;
                this.dom.taskCategory.value = task.id_categoria_fk;
                
                this.toggleSubcategoryField(); 
                
                if(task.id_commessa_fk) {
                    this.state.commessaChoicesInstance.setChoiceByValue(String(task.id_commessa_fk));
                } else {
                    this.dom.taskSubcategory.value = task.sottocategoria || '';
                }
                this.dom.taskDescription.value = task.descrizione || '';
                this.dom.taskAssignee.value = task.id_assegnatario_fk || '';
                this.dom.taskDueDate.value = task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '';
                this.dom.taskPriority.value = task.priorita || 'Media';
                this.renderComments(task.task_commenti);
                this.renderHistory(task.task_storia);
                this.dom.commentsSection.style.display = 'block';
                this.dom.historySection.style.display = 'block';
                this.dom.reopenTaskBtn.style.display = task.stato === 'Completato' ? 'inline-block' : 'none';
                this.dom.completeTaskBtn.style.display = task.stato === 'Da Fare' ? 'inline-block' : 'none';

            } catch (error) {
                console.error("Errore nel caricare i dettagli del task:", error);
                return;
            }
        } else {
            this.dom.modalTitle.textContent = 'Nuovo Task';
            this.state.currentTask = null;
            this.dom.taskAssignee.value = this.state.currentUserProfile.id_personale;
            this.dom.commentsSection.style.display = 'none';
            this.dom.historySection.style.display = 'none';
            this.dom.completeTaskBtn.style.display = 'none';
            this.dom.reopenTaskBtn.style.display = 'none';
        }
        
        this.dom.modal.style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
    },

    closeTaskModal: function() {
        this.dom.modal.style.display = 'none';
        if (this.dom.archiveModal.style.display !== 'block') {
            this.dom.modalOverlay.style.display = 'none';
        }
        if (this.state.commessaChoicesInstance) {
            this.state.commessaChoicesInstance.destroy();
            this.state.commessaChoicesInstance = null;
        }
    },

    renderBoard: function() {
        const daFareContent = document.getElementById('daFareContent');
        const completatiContainer = document.querySelector('#completatiContainer .tasks-container');
        daFareContent.innerHTML = '';
        completatiContainer.innerHTML = '';
        const organizedTasks = this.state.tasks.da_fare_organizzato || {};
        for (const category in organizedTasks) {
            const group = document.createElement('div');
            group.className = 'subcategory-group';
            const header = document.createElement('h3');
            header.className = 'subcategory-header';
            header.textContent = category;
            group.appendChild(header);
            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'tasks-container';
            tasksContainer.dataset.statusContainer = 'Da Fare';
            organizedTasks[category].forEach(task => {
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
        card.dataset.taskId = task.id_task;
        card.draggable = true;
        if(task.priorita) {
            card.classList.add(`priority-${task.priorita.toLowerCase()}`);
        }
        const assigneeName = task.assegnatario ? task.assegnatario.nome_cognome : 'Non Assegnato';
        card.innerHTML = `
            <h4>${task.titolo}</h4>
            <span class="assignee">${assigneeName}</span>
        `;
        card.addEventListener('click', () => this.openTaskModal(task.id_task));
        card.addEventListener('dragstart', (e) => this.handleDragStart(e));
        card.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
        return card;
    },

    addDragDropListeners: function() {
        const containers = document.querySelectorAll('.tasks-container');
        containers.forEach(container => {
            container.addEventListener('dragover', this.handleDragOver);
            container.addEventListener('drop', (e) => this.handleDrop(e));
        });
    },

    setupAdminFilter: function() {
        if (this.state.currentUserProfile?.is_admin) {
            this.dom.adminFilterContainer.style.display = 'flex';
            const select = this.dom.adminUserFilter;
            select.innerHTML = '<option value="">Tutti</option>';
            const usersWithAccess = this.state.personale.filter(p => p.puo_accedere);
            usersWithAccess.forEach(p => {
                select.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`;
            });
        }
    },

    populateDropdowns: function() {
        const catSelect = this.dom.taskCategory;
        catSelect.innerHTML = '<option value="" disabled selected>Seleziona Categoria...</option>';
        this.state.initData.categorie.forEach(c => {
            catSelect.innerHTML += `<option value="${c.id_categoria}">${c.nome_categoria}</option>`;
        });
        
        const assigneeSelect = this.dom.taskAssignee;
        assigneeSelect.innerHTML = '<option value="">Non Assegnato</option>';
        const filteredPersonale = this.state.personale.filter(p => p.puo_accedere);
        filteredPersonale.forEach(p => {
            assigneeSelect.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`;
        });
    },

    toggleSubcategoryField: function() {
        const selectedCategoryId = this.dom.taskCategory.value;
        const selectedCategory = this.state.initData.categorie.find(c => c.id_categoria == selectedCategoryId);
        if (selectedCategory && selectedCategory.nome_categoria.toLowerCase() === 'commessa') {
            this.dom.commessaSubcategoryContainer.style.display = 'block';
            this.dom.textSubcategoryContainer.style.display = 'none';
        } else {
            this.dom.commessaSubcategoryContainer.style.display = 'none';
            this.dom.textSubcategoryContainer.style.display = 'block';
        }
    },
    
    handleSaveTask: async function() {
        const taskId = this.dom.taskId.value;
        const selectedCategory = this.state.initData.categorie.find(c => c.id_categoria == this.dom.taskCategory.value);
        const isCommessa = selectedCategory && selectedCategory.nome_categoria.toLowerCase() === 'commessa';

        const commessaId = isCommessa ? this.state.commessaChoicesInstance.getValue(true) : null;

        const payload = {
            titolo: this.dom.taskTitle.value,
            descrizione: this.dom.taskDescription.value,
            id_assegnatario_fk: this.dom.taskAssignee.value || null,
            data_obiettivo: this.dom.taskDueDate.value || null,
            id_categoria_fk: this.dom.taskCategory.value,
            priorita: this.dom.taskPriority.value,
            id_commessa_fk: commessaId,
            sottocategoria: !isCommessa ? this.dom.taskSubcategory.value.trim() : null,
        };

        try {
            if (taskId) {
                await apiFetch(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                await apiFetch('/api/tasks/', { method: 'POST', body: JSON.stringify(payload) });
            }
            this.closeTaskModal();
            this.state.tasks = await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error("Errore nel salvataggio del task:", error);
        }
    },
    
    updateTaskStatus: async function(newStatus) {
        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;
        try {
            await apiFetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ stato: newStatus })
            });
            this.closeTaskModal();
            this.state.tasks = await this.loadTasks();
            this.renderBoard();
        } catch(error) {
            console.error(`Errore nell'aggiornare lo stato a ${newStatus}:`, error);
        }
    },

    handleAddComment: async function() {
        const taskId = this.state.currentTask?.id_task;
        const commentText = this.dom.newCommentText.value.trim();
        if (!taskId || !commentText) return;

        try {
            const res = await apiFetch(`/api/tasks/${taskId}/commenti`, {
                method: 'POST',
                body: JSON.stringify({ testo_commento: commentText })
            });
            const newComment = await res.json();
            this.state.currentTask.task_commenti.push(newComment);
            this.renderComments(this.state.currentTask.task_commenti);
            this.dom.newCommentText.value = '';
        } catch (error) {
            console.error("Errore nell'aggiunta del commento:", error);
        }
    },

    renderComments: function(comments) {
        if (!comments || comments.length === 0) {
            this.dom.commentsContainer.innerHTML = '<p>Nessun commento.</p>';
            return;
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
            this.dom.historyContainer.innerHTML = '<li>Nessuno storico disponibile.</li>';
            return;
        }
        this.dom.historyContainer.innerHTML = history.sort((a,b) => new Date(b.data_azione) - new Date(a.data_azione)).map(h => `
            <li><strong>${new Date(h.data_azione).toLocaleString('it-IT')}:</strong> ${h.utente?.nome_cognome || 'Sistema'} ha eseguito l'azione '${h.azione}'. ${h.dettagli || ''}</li>
        `).join('');
    },

    handleDragStart: function(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        setTimeout(() => { e.target.classList.add('dragging'); }, 0);
    },
    
    handleDragOver: function(e) {
        e.preventDefault();
    },
    
    handleDrop: async function(e) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (!draggedElement) return;
        
        draggedElement.classList.remove('dragging');

        const dropContainer = e.target.closest('.tasks-container');
        if (dropContainer) {
            const newStatus = dropContainer.dataset.statusContainer;
            if (newStatus) {
                try {
                    await apiFetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ stato: newStatus })
                    });
                    this.state.tasks = await this.loadTasks();
                    this.renderBoard();
                } catch (error) {
                    console.error("Errore durante l'aggiornamento dello stato:", error);
                    this.renderBoard(); 
                }
            }
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    TaskApp.init();
});