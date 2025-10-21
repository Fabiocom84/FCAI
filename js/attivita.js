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
        commessaChoicesInstance: null,
        subcategoryChoicesInstance: null, 
    },

    init: async function() {
        // --- Inizializzazione DOM Pulita ---
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
        
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');
        this.dom.taskCategory = document.getElementById('taskCategory');
        this.dom.taskPriority = document.getElementById('taskPriority');
        this.dom.taskSubcategory = document.getElementById('taskSubcategory');
        this.dom.taskCommessa = document.getElementById('taskCommessa');
        this.dom.commessaSubcategoryContainer = document.getElementById('commessaSubcategoryContainer');
        this.dom.textSubcategoryContainer = document.getElementById('textSubcategoryContainer');
        
        this.dom.openArchiveBtn = document.getElementById('openArchiveBtn');
        this.dom.archiveModal = document.getElementById('archiveModal');
        this.dom.closeArchiveBtn = this.dom.archiveModal.querySelector('.close-button');
        this.dom.archiveTasksContainer = document.getElementById('archiveTasksContainer');
        this.dom.loadMoreBtn = document.getElementById('loadMoreBtn');
        this.dom.archiveLoader = document.getElementById('archiveLoader');
        this.dom.daFareContent = document.getElementById('daFareContent');

        // --- Nuovi Elementi (Commenti/Storico/Azioni) ---
        this.dom.addCommentBtn = document.getElementById('addCommentBtn');
        this.dom.taskCommentInput = document.getElementById('taskCommentInput');
        this.dom.taskHistoryContainer = document.getElementById('taskHistoryContainer');
        this.dom.completeTaskBtn = document.getElementById('completeTaskBtn');
        this.dom.reopenTaskBtn = document.getElementById('reopenTaskBtn');
        // this.dom.deleteTaskBtn = document.getElementById('deleteTaskBtn'); // Decommenta se hai un pulsante elimina
        
        await this.loadInitialData();
        this.addEventListeners();
    },

    loadInitialData: async function() {
        try {
            this.state.currentUserProfile = JSON.parse(localStorage.getItem('user_profile'));

            const [tasksRes, personaleRes, initDataRes, etichetteRes] = await Promise.all([
                this.loadTasks(),
                apiFetch('/api/personale/'),
                apiFetch('/api/tasks/init-data'),
                apiFetch('/api/get-etichette')
            ]);
            
            this.state.tasks = tasksRes;
            const personaleData = await personaleRes.json();
            this.state.initData = await initDataRes.json();
            this.state.personale = personaleData.data;
            this.state.initData.etichette = await etichetteRes.json();

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
        this.dom.adminUserFilter.addEventListener('change', async () => {
            this.state.tasks = await this.loadTasks();
            this.renderBoard();
        });
        this.dom.taskCategory.addEventListener('change', () => this.toggleSubcategoryField());
        this.dom.openArchiveBtn.addEventListener('click', () => this.openArchiveModal());
        this.dom.closeArchiveBtn.addEventListener('click', () => this.closeArchiveModal());
        this.dom.loadMoreBtn.addEventListener('click', () => this.loadCompletedTasks());

        // --- Listener Nuovi/Modificati ---
        this.dom.addCommentBtn.addEventListener('click', () => this.addCommentToHistory());
        this.dom.completeTaskBtn.addEventListener('click', () => this.completeTask());
        this.dom.reopenTaskBtn.addEventListener('click', () => this.updateTaskStatus('Da Fare'));
        // this.dom.deleteTaskBtn.addEventListener('click', () => this.deleteTask()); // Decommenta se hai un pulsante elimina

        // Listener Accordion (era già corretto)
        this.dom.taskForm.querySelectorAll('.form-section').forEach(section => {
            const header = section.querySelector('.form-section-header');
            const content = section.querySelector('.form-section-content');
            
            if (header && content) {
                header.addEventListener('click', () => {
                    if (header.classList.contains('collapsible')) {
                        const isCollapsed = content.style.display === 'none';
                        content.style.display = isCollapsed ? 'block' : 'none';
                    }
                });
            }
        });
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

    initializeSubcategoryChoices: function() {
        if (this.state.subcategoryChoicesInstance) {
            this.state.subcategoryChoicesInstance.destroy();
        }
        this.state.subcategoryChoicesInstance = new Choices(this.dom.taskSubcategory, {
            searchEnabled: true,
            removeItemButton: true,
            itemSelectText: 'Seleziona',
            searchPlaceholderValue: 'Digita per cercare...',
            placeholder: true,
            placeholderValue: 'Seleziona o digita dettaglio...',
            allowHTML: false,
        });
        const etichetteOptions = this.state.initData.etichette.map(e => ({
            value: e.label,
            label: e.label
        }));
        this.state.subcategoryChoicesInstance.setChoices(etichetteOptions, 'value', 'label', false);
    },

    openTaskModal: async function(taskId = null) {
        this.dom.taskForm.reset();
        
        // Pulizia nuovi campi
        this.dom.taskCommentInput.value = '';
        this.dom.taskHistoryContainer.innerHTML = '';
        
        this.initializeCommessaChoices();
        this.initializeSubcategoryChoices();
        this.toggleSubcategoryField();

        // Logica Accordion
        const formSections = this.dom.taskForm.querySelectorAll('.form-section');
        const isEditing = !!taskId; 
        formSections.forEach(section => {
            const header = section.querySelector('.form-section-header');
            const content = section.querySelector('.form-section-content');
            if (!header || !content) return;

            // ## INIZIO MODIFICA ##
            // Controlla se la sezione è quella dei commenti o dello storico
            const isAlwaysOpen = section.id === 'commentSection' || section.id === 'historySection';

            if (isEditing) {
                if (isAlwaysOpen) {
                    // Se è commento o storico, forzane l'apertura e non renderlo collassabile
                    header.classList.remove('collapsible');
                    content.style.display = 'block';
                } else {
                    // Altrimenti, applica la vecchia logica (collassa)
                    header.classList.add('collapsible');
                    content.style.display = 'none';
                }
            } else {
                // In modalità creazione, tutto è visibile (comportamento invariato)
                header.classList.remove('collapsible');
                content.style.display = 'block';
            }
            // ## FINE MODIFICA ##
        });

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
                } else if (task.sottocategoria) {
                    this.state.subcategoryChoicesInstance.setChoiceByValue(task.sottocategoria);
                }
                
                this.dom.taskDescription.value = task.descrizione || '';
                this.dom.taskAssignee.value = task.id_assegnatario_fk || '';
                this.dom.taskDueDate.value = task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '';
                this.dom.taskPriority.value = task.priorita || 'Media';
                
                // --- Logica bottoni ---
                this.dom.reopenTaskBtn.style.display = task.stato === 'Completato' ? 'inline-block' : 'none';
                this.dom.completeTaskBtn.style.display = task.stato === 'Da Fare' ? 'inline-block' : 'none';
                // if(this.dom.deleteTaskBtn) this.dom.deleteTaskBtn.style.display = 'inline-block';

                // Carica il NUOVO storico
                this.fetchTaskHistory(taskId);

            } catch (error) {
                console.error("Errore nel caricare i dettagli del task:", error);
                return;
            }
        } else {
            this.dom.modalTitle.textContent = 'Nuovo Task';
            this.state.currentTask = null;
            this.dom.taskAssignee.value = this.state.currentUserProfile.id_personale;
            this.dom.completeTaskBtn.style.display = 'none';
            this.dom.reopenTaskBtn.style.display = 'none';
            // if(this.dom.deleteTaskBtn) this.dom.deleteTaskBtn.style.display = 'none';
            this.dom.saveTaskBtn.textContent = 'Crea Task';
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
        if (this.state.subcategoryChoicesInstance) {
            this.state.subcategoryChoicesInstance.destroy();
            this.state.subcategoryChoicesInstance = null;
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
        const sottocategoriaValue = !isCommessa ? this.state.subcategoryChoicesInstance.getValue(true) : null;

        const payload = {
            titolo: this.dom.taskTitle.value,
            descrizione: this.dom.taskDescription.value,
            id_assegnatario_fk: this.dom.taskAssignee.value || null,
            data_obiettivo: this.dom.taskDueDate.value || null,
            id_categoria_fk: this.dom.taskCategory.value,
            priorita: this.dom.taskPriority.value,
            id_commessa_fk: commessaId,
            sottocategoria: sottocategoriaValue,
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

    // --- NUOVE FUNZIONI PER COMMENTI/STORICO/AZIONI ---

    completeTask: async function() {
        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;

        if (!confirm('Sei sicuro di voler completare questo task?')) {
            return;
        }
        // Chiama la funzione di aggiornamento stato
        this.updateTaskStatus('Completato');
    },

    addCommentToHistory: async function() {
        const commentText = this.dom.taskCommentInput.value.trim();
        if (!commentText) {
            alert('Per favore, scrivi un commento.');
            return;
        }

        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;

        try {
            // Usa il NUOVO endpoint per lo storico
            const response = await apiFetch(`/api/tasks/${taskId}/storia`, {
                method: 'POST',
                body: JSON.stringify({
                    azione: 'COMMENTO', // Azione specifica
                    dettagli: commentText
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore durante l\'aggiunta del commento.');
            }

            this.dom.taskCommentInput.value = ''; // Resetta il campo input
            this.fetchTaskHistory(taskId); // Ricarica lo storico per mostrare il nuovo commento

        } catch (error) {
            console.error('Errore nell\'aggiunta del commento:', error);
            alert('Si è verificato un errore durante l\'aggiunta del commento.');
        }
    },

    fetchTaskHistory: async function(taskId) {
        try {
            // CORRETTO: Usa apiFetch, che gestisce URL base e token
            const response = await apiFetch(`/api/tasks/${taskId}/storia`); 
            if (!response.ok) {
                throw new Error('Errore nel recupero dello storico del task.');
            }

            const history = await response.json();
            this.dom.taskHistoryContainer.innerHTML = ''; // Pulisce il contenitore NUOVO

            if (!history || history.length === 0) {
                this.dom.taskHistoryContainer.innerHTML = '<p>Nessun evento registrato.</p>';
                return;
            }
            
            // Ordina lo storico dal più recente al più vecchio
            history.sort((a, b) => new Date(b.data_ora_azione) - new Date(a.data_ora_azione));

            history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.classList.add('history-item'); // Usa la nuova classe CSS
                const timestamp = new Date(item.data_ora_azione).toLocaleString('it-IT');
                
                const user = item.utente ? item.utente.nome_cognome : (item.id_utente_azione_fk ? 'Utente Sconosciuto' : 'Sistema');
                
                // HTML Semplificato per lo storico
                historyItem.innerHTML = `
                    <p style="margin: 0; font-size: 0.8em; color: #555;">
                        <strong style="color: #000;">${timestamp}</strong> - ${user}
                    </p>
                    <p style="margin: 4px 0 10px; font-size: 0.95em;">
                        <strong>${item.azione}:</strong> ${item.dettagli || 'Azione registrata.'}
                    </p>
                `;
                this.dom.taskHistoryContainer.appendChild(historyItem);
            });

        } catch (error) {
            console.error('Errore nel caricamento dello storico:', error);
            this.dom.taskHistoryContainer.innerHTML = '<p>Errore nel caricamento dello storico.</p>';
        }
    },

    // --- FUNZIONI DRAG & DROP ---

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