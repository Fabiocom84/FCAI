// js/attivita.js

import { apiFetch } from './api-client.js';

const TaskApp = {
    dom: {},
    state: {
        tasks: [],
        personale: [],
        currentTask: null,
    },

    init: async function() {
        this.dom.board = document.getElementById('kanbanBoard');
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
        
        await this.loadInitialData();
        this.addEventListeners();
    },

    // In loadInitialData, change the way tasks are stored
    loadInitialData: async function() {
        try {
            const [tasksRes, personaleRes] = await Promise.all([
                apiFetch('/api/tasks'),
                apiFetch('/api/personale')
            ]);
            // The entire structured object is now stored in state.tasks
            this.state.tasks = await tasksRes.json(); 
            this.state.personale = (await personaleRes.json()).data;
            
            this.populatePersonaleSelect(this.dom.taskAssignee);
            this.renderBoard();
        } catch (error) {
            console.error("Errore nel caricamento dei dati:", error);
        }
    },

    renderBoard: function() {
        const daFareContainer = document.getElementById('daFareContainer');
        const completatiContainer = document.querySelector('#completatiContainer .tasks-container');

        // Clear previous content but keep the main headers
        daFareContainer.innerHTML = '<h2>Attività da Fare</h2>';
        completatiContainer.innerHTML = '';

        // Render categorized "Da Fare" tasks
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
            tasksContainer.dataset.statusContainer = 'Da Fare'; // For drag-drop
            organizedTasks[category].forEach(task => {
                tasksContainer.appendChild(this.createTaskCard(task));
            });
            group.appendChild(tasksContainer);
            daFareContainer.appendChild(group);
        }

        // Render recent "Completato" tasks
        const recentTasks = this.state.tasks.completati_recenti || [];
        recentTasks.forEach(task => {
            completatiContainer.appendChild(this.createTaskCard(task));
        });
        
        // Re-attach drag-drop listeners after re-rendering
        this.addDragDropListeners(); 
    },

    // Add this new helper function to avoid re-attaching listeners unnecessarily
    addDragDropListeners: function() {
        const containers = document.querySelectorAll('.tasks-container');
        containers.forEach(container => {
            container.addEventListener('dragover', this.handleDragOver);
            container.addEventListener('drop', this.handleDrop);
        });
    },

    createTaskCard: function(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
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

    addEventListeners: function() {
        this.dom.addTaskBtn.addEventListener('click', () => this.openModal());
    this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
    this.dom.modalOverlay.addEventListener('click', () => this.closeModal());
    this.dom.saveTaskBtn.addEventListener('click', () => this.handleSaveTask());
    this.dom.addCommentBtn.addEventListener('click', () => this.handleAddComment());
    this.addDragDropListeners();
    
        // Eventi per il Drag & Drop
        const containers = document.querySelectorAll('.tasks-container');
        containers.forEach(container => {
            container.addEventListener('dragover', this.handleDragOver);
            container.addEventListener('drop', this.handleDrop);
        });
    },

    openModal: async function(taskId = null) {
        this.dom.taskForm.reset();
        this.dom.commentsContainer.innerHTML = '';
        this.dom.historyContainer.innerHTML = '';

        if (taskId) {
            // Modal in modalità MODIFICA
            this.dom.modalTitle.textContent = 'Dettaglio Task';
            try {
                const res = await apiFetch(`/api/tasks/${taskId}`);
                const task = await res.json();
                this.state.currentTask = task;
                
                this.dom.taskId.value = task.id_task;
                this.dom.taskTitle.value = task.titolo;
                this.dom.taskDescription.value = task.descrizione || '';
                this.dom.taskAssignee.value = task.id_assegnatario_fk || '';
                this.dom.taskDueDate.value = task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '';
                
                this.renderComments(task.task_commenti);
                this.renderHistory(task.task_storia);

            } catch (error) {
                console.error("Errore nel caricare i dettagli del task:", error);
                return;
            }
        } else {
            // Modal in modalità CREAZIONE
            this.dom.modalTitle.textContent = 'Nuovo Task';
            this.state.currentTask = null;
        }
        
        this.dom.modal.style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
    },

    closeModal: function() {
        this.dom.modal.style.display = 'none';
        this.dom.modalOverlay.style.display = 'none';
    },
    
    populatePersonaleSelect: function(selectElement) {
        selectElement.innerHTML = '<option value="">Non Assegnato</option>';
        this.state.personale.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id_personale;
            option.textContent = p.nome_cognome;
            selectElement.appendChild(option);
        });
    },
    
    renderComments: function(comments) {
        this.dom.commentsContainer.innerHTML = comments.map(c => `
            <div class="comment">
                <strong>${c.autore.nome_cognome}</strong>
                <p>${c.testo_commento}</p>
            </div>
        `).join('');
    },
    
    renderHistory: function(history) {
        this.dom.historyContainer.innerHTML = history.map(h => `
            <li><strong>${new Date(h.data_azione).toLocaleString('it-IT')}:</strong> ${h.utente.nome_cognome} ha eseguito l'azione '${h.azione}'. ${h.dettagli || ''}</li>
        `).join('');
    },
    
    handleSaveTask: async function() {
        const taskId = this.dom.taskId.value;
        const payload = {
            titolo: this.dom.taskTitle.value,
            sottocategoria: this.dom.taskSubcategory.value.trim() || null,
            descrizione: this.dom.taskDescription.value,
            id_assegnatario_fk: this.dom.taskAssignee.value || null,
            data_obiettivo: this.dom.taskDueDate.value || null,
        };

        try {
            if (taskId) {
                // Aggiorna task esistente
                await apiFetch(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                // Crea nuovo task
                await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
            }
            this.closeModal();
            await this.loadInitialData(); // Ricarica tutto
        } catch (error) {
            console.error("Errore nel salvataggio del task:", error);
        }
    },
    
    handleAddComment: async function() {
        const taskId = this.state.currentTask?.id_task;
        const commentText = this.dom.newCommentText.value.trim();

        if (!taskId || !commentText) return;

        try {
            await apiFetch(`/api/tasks/${taskId}/commenti`, {
                method: 'POST',
                body: JSON.stringify({ testo_commento: commentText })
            });
            this.dom.newCommentText.value = '';
            // Ricarica solo i dettagli del modale per aggiornare i commenti
            this.openModal(taskId); 
        } catch (error) {
            console.error("Errore nell'aggiunta del commento:", error);
        }
    },

    // --- Funzioni Drag & Drop ---
    handleDragStart: function(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        setTimeout(() => { e.target.classList.add('dragging'); }, 0);
    },
    
    handleDragOver: function(e) {
        e.preventDefault(); // Necessario per permettere il drop
    },
    
    handleDrop: async function(e) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        draggedElement.classList.remove('dragging');

        const dropContainer = e.target.closest('.tasks-container');
        if (dropContainer) {
            const newStatus = dropContainer.dataset.statusContainer;
            dropContainer.appendChild(draggedElement);

            // Aggiorna lo stato sul backend
            try {
                await apiFetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ stato: newStatus })
                });
                // Aggiorna lo stato locale per coerenza
                const task = TaskApp.state.tasks.find(t => t.id_task == taskId);
                if(task) task.stato = newStatus;
                
            } catch (error) {
                console.error("Errore durante l'aggiornamento dello stato:", error);
                TaskApp.renderBoard(); // Ripristina la board in caso di errore
            }
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    TaskApp.init();
});