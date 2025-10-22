// js/attivita.js
// Versione 2.0 - Architettura a due modali (Creazione / Dettaglio)

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const TaskApp = {
    dom: {},
    state: {
        tasks: { da_fare_organizzato: {}, completati_recenti: [] },
        personale: [],
        initData: { categorie: [], commesse: [], etichette: [] },
        currentUserProfile: null,
        currentTask: null, // Task attualmente visualizzato nel modale DETTAGLIO
        archivePage: 1,
        archiveTasks: [],
        isLoadingArchive: false,
        canLoadMore: true,
        // Istanze Choices per il MODALE FORM
        formCommessaChoices: null,
        formSubcategoryChoices: null,
    },

    // =================================================================
    // == 1. INIZIALIZZAZIONE E CARICAMENTO DATI                     ==
    // =================================================================

    init: async function() {
        // --- PROFILO UTENTE ---
        this.state.currentUserProfile = JSON.parse(localStorage.getItem('user_profile'));

        // --- DOM PRINCIPALE ---
        this.dom.addTaskBtn = document.getElementById('addTaskBtn');
        this.dom.modalOverlay = document.getElementById('modalOverlay');
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');
        this.dom.daFareContent = document.getElementById('daFareContent');
        this.dom.completatiContainer = document.querySelector('#completatiContainer .tasks-container');

        // --- DOM MODALE 1: CREAZIONE / MODIFICA FORM (#taskModal) ---
        this.dom.formModal = document.getElementById('taskModal');
        this.dom.formCloseBtn = this.dom.formModal.querySelector('[data-close-create]');
        this.dom.formModalTitle = this.dom.formModal.querySelector('#modalTitle');
        this.dom.taskForm = document.getElementById('taskForm');
        this.dom.taskId = document.getElementById('taskId');
        this.dom.taskTitle = document.getElementById('taskTitle');
        this.dom.taskDescription = document.getElementById('taskDescription');
        this.dom.taskAssignee = document.getElementById('taskAssignee');
        this.dom.taskDueDate = document.getElementById('taskDueDate');
        this.dom.taskCategory = document.getElementById('taskCategory');
        this.dom.taskPriority = document.getElementById('taskPriority');
        this.dom.taskSubcategory = document.getElementById('taskSubcategory');
        this.dom.taskCommessa = document.getElementById('taskCommessa');
        this.dom.commessaSubcategoryContainer = document.getElementById('commessaSubcategoryContainer');
        this.dom.textSubcategoryContainer = document.getElementById('textSubcategoryContainer');
        this.dom.saveTaskBtn = document.getElementById('saveTaskBtn');
        
        // --- DOM MODALE 2: DETTAGLIO (#taskDetailModal) ---
        this.dom.detailModal = document.getElementById('taskDetailModal');
        this.dom.detailCloseBtn = this.dom.detailModal.querySelector('[data-close-detail]');
        this.dom.detailModalTitle = document.getElementById('detailModalTitle');
        this.dom.detailReadOnlyContainer = document.getElementById('taskDetailReadOnlyContainer');
        this.dom.detailCommentInput = document.getElementById('detailTaskCommentInput');
        this.dom.detailHistoryContainer = document.getElementById('detailTaskHistoryContainer');
        this.dom.detailAddCommentBtn = document.getElementById('detailAddCommentBtn');
        this.dom.detailCompleteTaskBtn = document.getElementById('detailCompleteTaskBtn');
        this.dom.detailReopenTaskBtn = document.getElementById('detailReopenTaskBtn');
        this.dom.detailOpenEditBtn = document.getElementById('detailOpenEditBtn');

        // --- DOM ARCHIVIO ---
        this.dom.openArchiveBtn = document.getElementById('openArchiveBtn');
        this.dom.archiveModal = document.getElementById('archiveModal');
        this.dom.closeArchiveBtn = this.dom.archiveModal.querySelector('[data-close-archive]');
        this.dom.archiveTasksContainer = document.getElementById('archiveTasksContainer');
        this.dom.loadMoreBtn = document.getElementById('loadMoreBtn');
        this.dom.archiveLoader = document.getElementById('archiveLoader');

        // --- AVVIO ---
        await this.loadInitialData();
        this.addEventListeners();
    },

    loadInitialData: async function() {
        try {
            // Carica tutti i dati in parallelo
            const [tasksRes, personaleRes, initDataRes, etichetteRes] = await Promise.all([
                this.loadTasks(), // Carica i task (già gestisce l'admin filter)
                apiFetch('/api/personale/'),
                apiFetch('/api/tasks/init-data'),
                apiFetch('/api/get-etichette')
            ]);
            
            // Popola lo stato
            this.state.tasks = tasksRes;
            const personaleData = await personaleRes.json();
            this.state.initData = await initDataRes.json();
            this.state.personale = personaleData.data;
            this.state.initData.etichette = await etichetteRes.json();

            // Inizializza UI
            this.setupAdminFilter();
            this.populateStaticDropdowns(); // Popola i dropdown che non cambiano
            this.renderBoard();

        } catch (error) {
            console.error("Errore nel caricamento dei dati iniziali:", error);
            this.dom.daFareContent.innerHTML = `<p class="error-text">Impossibile caricare i dati.</p>`;
        }
    },
    
    loadTasks: async function() {
        try {
            const params = new URLSearchParams();
            const selectedUserId = this.dom.adminUserFilter.value;
            // Aggiunge il filtro solo se l'admin ha selezionato un utente specifico
            if (this.state.currentUserProfile?.is_admin && selectedUserId) {
                params.append('id_utente_filtro', selectedUserId);
            }
            const res = await apiFetch(`/api/tasks/?${params.toString()}`);
            if (!res.ok) throw new Error('Errore di rete nel caricamento task');
            return await res.json();
        } catch (error) {
             console.error("Errore nel caricamento dei task:", error);
             this.dom.daFareContent.innerHTML = `<p class="error-text">Impossibile caricare i task.</p>`;
             return { da_fare_organizzato: {}, completati_recenti: [] }; // Ritorna stato vuoto
        }
    },

    // =================================================================
    // == 2. GESTIONE EVENTI (EVENT LISTENERS)                       ==
    // =================================================================

    addEventListeners: function() {
        // Overlay (chiude entrambi i modali)
        this.dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.dom.modalOverlay) {
                this.closeFormModal();
                this.closeDetailModal();
            }
        });

        // Azioni Principali
        this.dom.addTaskBtn.addEventListener('click', () => this.openFormModal()); // Apre Modale 1 (Creazione)
        this.dom.adminUserFilter.addEventListener('change', () => this.refreshBoard());

        // Modale 1 (Creazione/Modifica Form)
        this.dom.formCloseBtn.addEventListener('click', () => this.closeFormModal());
        this.dom.saveTaskBtn.addEventListener('click', () => this.handleSaveTask());
        this.dom.taskCategory.addEventListener('change', () => this.toggleSubcategoryField());

        // Modale 2 (Dettaglio)
        this.dom.detailCloseBtn.addEventListener('click', () => this.closeDetailModal());
        this.dom.detailOpenEditBtn.addEventListener('click', () => this.switchToEditMode());
        this.dom.detailAddCommentBtn.addEventListener('click', () => this.addComment());
        this.dom.detailCompleteTaskBtn.addEventListener('click', () => this.completeTask());
        this.dom.detailReopenTaskBtn.addEventListener('click', () => this.updateTaskStatus('Da Fare'));

        // Archivio
        this.dom.openArchiveBtn.addEventListener('click', () => this.openArchiveModal());
        this.dom.closeArchiveBtn.addEventListener('click', () => this.closeArchiveModal());
        this.dom.loadMoreBtn.addEventListener('click', () => this.loadCompletedTasks());
    },

    // =================================================================
    // == 3. RENDER BACHECA E CARD "POST-IT"                         ==
    // =================================================================

    refreshBoard: async function() {
        this.state.tasks = await this.loadTasks();
        this.renderBoard();
    },

    renderBoard: function() {
        this.dom.daFareContent.innerHTML = '';
        this.dom.completatiContainer.innerHTML = '';

        // Render "Da Fare" (organizzato per categorie)
        const organizedTasks = this.state.tasks.da_fare_organizzato || {};
        if (Object.keys(organizedTasks).length === 0) {
            this.dom.daFareContent.innerHTML = '<p class="empty-column-text">Nessun task da fare.</p>';
        } else {
            for (const category in organizedTasks) {
                const group = document.createElement('div');
                group.className = 'subcategory-group';
                
                const header = document.createElement('h3');
                header.className = 'subcategory-header';
                header.textContent = category;
                group.appendChild(header);
                
                const tasksContainer = document.createElement('div');
                tasksContainer.className = 'tasks-container';
                tasksContainer.dataset.statusContainer = 'Da Fare'; // Per D&D
                
                organizedTasks[category].forEach(task => {
                    tasksContainer.appendChild(this.createTaskCard(task));
                });
                
                group.appendChild(tasksContainer);
                this.dom.daFareContent.appendChild(group);
            }
        }

        // Render "Completati Recenti"
        const recentTasks = this.state.tasks.completati_recenti || [];
        if (recentTasks.length === 0) {
             this.dom.completatiContainer.innerHTML = '<p class="empty-column-text">Nessun task completato di recente.</p>';
        } else {
            recentTasks.forEach(task => {
                this.dom.completatiContainer.appendChild(this.createTaskCard(task));
            });
        }
        
        // Ri-attacca i listener per il Drag & Drop
        this.addDragDropListeners();
    },

    /**
     * Crea la card "Post-it"
     */
    createTaskCard: function(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id_task;
        
        // Applica classe per colore priorità
        if (task.priorita) {
            card.classList.add(`priority-${task.priorita.toLowerCase()}`);
        } else {
            card.classList.add('priority-media'); // Default
        }

        // Draggable solo se "Da Fare"
        if (task.stato === 'Da Fare') {
            card.draggable = true;
            card.addEventListener('dragstart', (e) => this.handleDragStart(e));
            card.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
        }

        // Contenuto (solo titolo)
        card.innerHTML = `<h4>${task.titolo}</h4>`;
        
        // Evento Click: Apre il MODALE 2 (Dettaglio)
        card.addEventListener('click', () => this.openDetailModal(task.id_task));
        
        return card;
    },

    // =================================================================
    // == 4. LOGICA MODALI (CREAZIONE E DETTAGLIO)                   ==
    // =================================================================

    /**
     * Apre il MODALE 1 (Form) per Creare un nuovo task
     */
    openFormModal: function(taskId = null) {
        this.dom.taskForm.reset();
        this.dom.taskId.value = '';
        this.state.currentTask = null;

        // Inizializza i dropdown dinamici
        this.initializeCommessaChoices();
        this.initializeSubcategoryChoices();
        
        // Imposta i valori di default per la CREAZIONE
        if (!taskId) {
            this.dom.formModalTitle.textContent = 'Nuovo Task';
            this.dom.saveTaskBtn.textContent = 'Crea Task';
            // Pre-seleziona l'utente corrente come assegnatario
            this.dom.taskAssignee.value = this.state.currentUserProfile.id_personale;
            this.dom.taskPriority.value = 'Media';
            this.toggleSubcategoryField(); // Controlla categoria (es. per 'Commessa')
        } 
        // Se stiamo MODIFICANDO (chiamato da switchToEditMode)
        else {
            this.dom.formModalTitle.textContent = 'Modifica Dati Task';
            this.dom.saveTaskBtn.textContent = 'Salva Modifiche';
            this.dom.taskId.value = taskId;
            // Carica i dati del task nel form
            this.populateForm(taskId);
        }
        
        // Apri il modale
        this.dom.formModal.style.display = 'block';
        this.dom.modalOverlay.style.display = 'block';
    },

    /**
     * Popola il MODALE 1 (Form) quando si è in modalità Modifica
     */
    populateForm: async function(taskId) {
        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            if (!res.ok) throw new Error('Task non trovato');
            const task = await res.json();
            
            this.dom.taskTitle.value = task.titolo;
            this.dom.taskCategory.value = task.id_categoria_fk;
            
            this.toggleSubcategoryField(); // Attiva il campo giusto (Commessa o Testo)
            
            if (task.id_commessa_fk) {
                this.formCommessaChoices.setChoiceByValue(String(task.id_commessa_fk));
            } else if (task.sottocategoria) {
                // Imposta il valore per il choices di testo
                this.formSubcategoryChoices.setChoiceByValue(task.sottocategoria);
            }
            
            this.dom.taskDescription.value = task.descrizione || '';
            this.dom.taskAssignee.value = task.id_assegnatario_fk || '';
            this.dom.taskDueDate.value = task.data_obiettivo ? task.data_obiettivo.split('T')[0] : '';
            this.dom.taskPriority.value = task.priorita || 'Media';

        } catch (error) {
            console.error("Errore nel caricamento dati per modifica:", error);
            this.closeFormModal();
            showModal({ title: 'Errore', message: 'Impossibile caricare i dati del task per la modifica.' });
        }
    },
    
    closeFormModal: function() {
        this.dom.formModal.style.display = 'none';
        // Chiudi l'overlay solo se anche l'altro modale è chiuso
        if (this.dom.detailModal.style.display !== 'block') {
            this.dom.modalOverlay.style.display = 'none';
        }
        // Distrugge le istanze Choices per evitare memory leak
        if (this.formCommessaChoices) {
            this.formCommessaChoices.destroy();
            this.formCommessaChoices = null;
        }
        if (this.formSubcategoryChoices) {
            this.formSubcategoryChoices.destroy();
            this.formSubcategoryChoices = null;
        }
    },

    /**
     * Apre il MODALE 2 (Dettaglio)
     */
    openDetailModal: async function(taskId) {
        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            if (!res.ok) throw new Error('Task non trovato');
            
            const task = await res.json();
            this.state.currentTask = task; // Salva task corrente per le azioni
            
            // Popola titolo
            this.dom.detailModalTitle.textContent = task.titolo;
            
            // Popola blocco "Read-Only"
            this.dom.detailReadOnlyContainer.innerHTML = `
                <p><strong>Categoria:</strong> ${task.categoria?.nome_categoria || 'N/D'}</p>
                ${task.commessa ? `<p><strong>Commessa:</strong> ${task.commessa.impianto} (${task.commessa.codice_commessa})</p>` : ''}
                ${task.sottocategoria ? `<p><strong>Dettaglio:</strong> ${task.sottocategoria}</p>` : ''}
                <p><strong>Assegnato a:</strong> ${task.assegnatario?.nome_cognome || 'Non Assegnato'}</p>
                <p><strong>Scadenza:</strong> ${task.data_obiettivo ? new Date(task.data_obiettivo).toLocaleDateString('it-IT') : 'Nessuna'}</p>
                <div class="description-block">
                    <strong>Descrizione:</strong>
                    <p>${task.descrizione || 'Nessuna descrizione.'}</p>
                </div>
            `;
            
            // Pulisci e popola storico e commenti
            this.dom.detailCommentInput.value = '';
            this.renderHistoryAndComments(task.task_storia || [], task.task_commenti || []);
            
            // Gestisci visibilità bottoni azione
            this.dom.detailCompleteTaskBtn.style.display = task.stato === 'Da Fare' ? 'inline-block' : 'none';
            this.dom.detailReopenTaskBtn.style.display = task.stato === 'Completato' ? 'inline-block' : 'none';
            
            // Apri il modale
            this.dom.detailModal.style.display = 'block';
            this.dom.modalOverlay.style.display = 'block';
            
        } catch (error) {
            console.error("Errore nel caricare i dettagli del task:", error);
            showModal({ title: 'Errore', message: 'Impossibile caricare i dettagli del task.' });
        }
    },
    
    closeDetailModal: function() {
        this.dom.detailModal.style.display = 'none';
        if (this.dom.formModal.style.display !== 'block') {
            this.dom.modalOverlay.style.display = 'none';
        }
        this.state.currentTask = null; // Rimuovi il task corrente
    },

    /**
     * Passa dal Modale 2 (Dettaglio) al Modale 1 (Form Modifica)
     */
    switchToEditMode: function() {
        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;
        
        this.closeDetailModal();
        this.openFormModal(taskId); // Apri il form in modalità modifica
    },

    // =================================================================
    // == 5. LOGICA AZIONI (Salva, Commenta, Completa)               ==
    // =================================================================

    handleSaveTask: async function() {
        const taskId = this.dom.taskId.value; // Legge dall'hidden input del form
        const selectedCategory = this.state.initData.categorie.find(c => c.id_categoria == this.dom.taskCategory.value);
        const isCommessa = selectedCategory && selectedCategory.nome_categoria.toLowerCase() === 'commessa';

        // Prende i valori dai choices corretti
        const commessaId = isCommessa ? this.formCommessaChoices.getValue(true) : null;
        const sottocategoriaValue = !isCommessa ? this.formSubcategoryChoices.getValue(true) : null;

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
        
        // Validazione base
        if (!payload.titolo || !payload.id_categoria_fk) {
            showModal({ title: 'Attenzione', message: 'Titolo e Categoria sono obbligatori.' });
            return;
        }

        try {
            this.dom.saveTaskBtn.disabled = true;
            this.dom.saveTaskBtn.textContent = 'Salvataggio...';

            if (taskId) {
                // Modalità Modifica (PUT)
                await apiFetch(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                // Modalità Creazione (POST)
                await apiFetch('/api/tasks/', { method: 'POST', body: JSON.stringify(payload) });
            }
            
            this.closeFormModal();
            await this.refreshBoard(); // Ricarica e renderizza la bacheca

        } catch (error) {
            console.error("Errore nel salvataggio del task:", error);
            showModal({ title: 'Errore', message: `Salvataggio fallito: ${error.message}` });
        } finally {
            this.dom.saveTaskBtn.disabled = false;
            // Il testo del bottone verrà reimpostato alla prossima apertura del modale
        }
    },
    
    /**
     * Aggiunge un commento (chiamato solo dal Modale 2 Dettaglio)
     */
    addComment: async function() {
        const commentText = this.dom.detailCommentInput.value.trim();
        if (!commentText) {
            showModal({ title: 'Attenzione', message: 'Per favore, scrivi un commento.' });
            return;
        }

        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;

        try {
            this.dom.detailAddCommentBtn.disabled = true;
            const response = await apiFetch(`/api/tasks/${taskId}/commenti`, {
                method: 'POST',
                body: JSON.stringify({ testo_commento: commentText })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore aggiunta commento.');
            }

            const newComment = await response.json(); 
            this.dom.detailCommentInput.value = ''; // Resetta l'input

            // Aggiorna lo stato locale e renderizza solo lo storico (più veloce)
            this.state.currentTask.task_commenti.push(newComment);
            this.renderHistoryAndComments(
                this.state.currentTask.task_storia,
                this.state.currentTask.task_commenti
            );

        } catch (error) {
            console.error('Errore nell\'aggiunta del commento:', error);
            showModal({ title: 'Errore', message: `Impossibile aggiungere il commento: ${error.message}` });
        } finally {
            this.dom.detailAddCommentBtn.disabled = false;
        }
    },

    /**
     * Completa un task (chiamato solo dal Modale 2 Dettaglio)
     */
    completeTask: async function() {
        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;

        const confirmed = await showModal({
            title: 'Conferma Completamento',
            message: 'Sei sicuro di voler completare questo task?',
            confirmText: 'Completa',
            cancelText: 'Annulla'
        });

        if (confirmed) {
            this.updateTaskStatus('Completato');
        }
    },
    
    /**
     * Helper per cambiare lo stato (Completato o Da Fare)
     */
    updateTaskStatus: async function(newStatus) {
        const taskId = this.state.currentTask?.id_task;
        if (!taskId) return;
        try {
            await apiFetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ stato: newStatus })
            });
            this.closeDetailModal(); // Chiude il modale dettaglio
            await this.refreshBoard(); // Ricarica la bacheca
        } catch(error) {
            console.error(`Errore nell'aggiornare lo stato a ${newStatus}:`, error);
            showModal({ title: 'Errore', message: 'Impossibile aggiornare lo stato del task.' });
        }
    },

    /**
     * Renderizza la lista combinata di storico e commenti
     * (Usato solo dal Modale 2 Dettaglio)
     */
    renderHistoryAndComments: function(history, comments) {
        const container = this.dom.detailHistoryContainer;
        container.innerHTML = ''; // Pulisce il contenitore

        const combinedList = [];
        (history || []).forEach(item => {
            combinedList.push({
                type: 'history',
                date: new Date(item.data_ora_azione),
                user: item.utente ? item.utente.nome_cognome : 'Sistema',
                action: item.azione,
                details: item.dettagli
            });
        });

        (comments || []).forEach(item => {
            combinedList.push({
                type: 'comment',
                date: new Date(item.data_creazione),
                user: item.autore ? item.autore.nome_cognome : 'Utente',
                action: 'COMMENTO',
                details: item.testo_commento
            });
        });

        // Ordina l'array combinato (dal più recente)
        combinedList.sort((a, b) => b.date - a.date);

        if (combinedList.length === 0) {
            container.innerHTML = '<p class="empty-column-text">Nessun evento registrato.</p>';
            return;
        }

        combinedList.forEach(item => {
            if (isNaN(item.date.getTime())) {
                console.warn("Data non valida rilevata:", item);
                return; // Salta item con date non valide
            }
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            const timestamp = item.date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
            const detailsClass = item.type === 'comment' ? 'history-comment-details' : 'history-details';
            
            historyItem.innerHTML = `
                <p style="margin: 0; font-size: 0.8em; color: #555;">
                    <strong style="color: #000;">${timestamp}</strong> - ${item.user}
                </p>
                <p style="margin: 4px 0 10px; font-size: 0.95em;">
                    <strong>${item.action}:</strong> <span class="${detailsClass}">${item.details || ''}</span>
                </p>
            `;
            container.appendChild(historyItem);
        });
    },

    // =================================================================
    // == 6. HELPERS (Dropdown, Filtri, D&D)                         ==
    // =================================================================

    // Inizializza i dropdown statici del form (Categoria, Assegnatario)
    populateStaticDropdowns: function() {
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

    // Inizializza il dropdown (Choices.js) per le Commesse
    initializeCommessaChoices: function() {
        if (this.formCommessaChoices) this.formCommessaChoices.destroy();
        
        this.formCommessaChoices = new Choices(this.dom.taskCommessa, {
            searchEnabled: true, removeItemButton: true, itemSelectText: 'Seleziona',
            searchPlaceholderValue: 'Digita per cercare...', placeholder: true,
            placeholderValue: 'Seleziona una commessa...',
        });
        const commesseOptions = this.state.initData.commesse.map(c => ({
            value: c.id_commessa,
            label: `${c.impianto} (${c.codice_commessa || 'N/D'})`
        }));
        this.formCommessaChoices.setChoices(commesseOptions, 'value', 'label', false);
    },

    // Inizializza il dropdown (Choices.js) per la Sottocategoria (Etichette)
    initializeSubcategoryChoices: function() {
        if (this.formSubcategoryChoices) this.formSubcategoryChoices.destroy();
        
        this.formSubcategoryChoices = new Choices(this.dom.taskSubcategory, {
            searchEnabled: true, removeItemButton: true, itemSelectText: 'Seleziona',
            searchPlaceholderValue: 'Digita per cercare...', placeholder: true,
            placeholderValue: 'Seleziona o digita dettaglio...', allowHTML: false,
        });
        const etichetteOptions = this.state.initData.etichette.map(e => ({
            value: e.label,
            label: e.label
        }));
        this.formSubcategoryChoices.setChoices(etichetteOptions, 'value', 'label', false);
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

    setupAdminFilter: function() {
        if (this.state.currentUserProfile?.is_admin) {
            this.dom.adminFilterContainer.style.display = 'flex';
            const select = this.dom.adminUserFilter;
            select.innerHTML = '<option value="">Mostra Tutti</option>';
            const usersWithAccess = this.state.personale.filter(p => p.puo_accedere);
            usersWithAccess.forEach(p => {
                const isCurrentUser = p.id_personale === this.state.currentUserProfile.id_personale;
                select.innerHTML += `<option value="${p.id_personale}" ${isCurrentUser ? 'selected' : ''}>
                    ${p.nome_cognome} ${isCurrentUser ? '(Tu)' : ''}
                </option>`;
            });
            // Aggiungi un'opzione "solo i miei" se non è già selezionato
            if (!usersWithAccess.find(p => p.id_personale === this.state.currentUserProfile.id_personale)) {
                 select.innerHTML += `<option value="${this.state.currentUserProfile.id_personale}" selected>Solo i miei</option>`;
            }
        }
    },

    // --- LOGICA DRAG & DROP ---
    addDragDropListeners: function() {
        const containers = document.querySelectorAll('.tasks-container');
        containers.forEach(container => {
            container.addEventListener('dragover', this.handleDragOver);
            container.addEventListener('drop', (e) => this.handleDrop(e));
        });
    },

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
        if (!draggedElement) return;
        
        draggedElement.classList.remove('dragging');

        const dropContainer = e.target.closest('.tasks-container');
        if (dropContainer) {
            const newStatus = dropContainer.dataset.statusContainer;
            if (newStatus && newStatus !== 'Da Fare') { // Permetti solo drop in "Completati"
                try {
                    await apiFetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ stato: newStatus })
                    });
                    await this.refreshBoard();
                } catch (error) {
                    console.error("Errore durante l'aggiornamento dello stato:", error);
                    this.renderBoard(); // Ripristina la bacheca in caso di errore
                }
            }
        }
    },
    
    // --- FUNZIONI ARCHIVIO (Invariate) ---
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
        if (this.dom.formModal.style.display !== 'block' && this.dom.detailModal.style.display !== 'block') {
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
            if (completedTasks.length < 15) { // 15 è il limite impostato nel backend
                this.state.canLoadMore = false;
            }
            this.state.archiveTasks.push(...completedTasks);
            this.renderArchive(completedTasks); // Passa solo i nuovi task
            this.state.archivePage++;
        } catch (error) {
            console.error("Errore nel caricamento dei task completati:", error);
        } finally {
            this.state.isLoadingArchive = false;
            this.dom.archiveLoader.style.display = 'none';
            if (this.state.canLoadMore) {
                this.dom.loadMoreBtn.style.display = 'inline-block';
            } else {
                this.dom.loadMoreBtn.style.display = 'none';
            }
        }
    },

    renderArchive: function(newTasks) {
        // Appende solo i nuovi task invece di ricreare tutto
        const fragment = document.createDocumentFragment();
        newTasks.forEach(task => {
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
        this.dom.archiveTasksContainer.appendChild(fragment);
    },
};

// Avvio dell'applicazione
document.addEventListener('DOMContentLoaded', () => {
    TaskApp.init();
});