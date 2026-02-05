// js/attivita.js
// Versione 9.0 - Logic: Delegation Flow, Read-Only Locks, Incoming Highlights

import { apiFetch } from './api-client.js';

const TaskApp = {
    state: {
        boardData: { todo: [], doing: [], review: [], done: [] },
        initData: { categorie: [], commesse: [], etichette: [] },
        personale: [],
        currentUserProfile: null,
        currentTask: null,
        choicesInstances: [],
        columnsConfig: [
            { key: 'todo', label: 'Da Fare', status: 'Da Fare', colorClass: 'todo' },
            { key: 'doing', label: 'In Corso', status: 'In Corso', colorClass: 'doing' },
            { key: 'review', label: 'Delegati / Monitoraggio', status: 'In Revisione', colorClass: 'review' },
            { key: 'done', label: 'Completato', status: 'Completato', colorClass: 'done' }
        ]
    },

    dom: {},

    // =================================================================
    // == 1. INIT & LOAD                                              ==
    // =================================================================

    init: async function () {
        console.log("🚀 Init Attività...");

        const profileStr = localStorage.getItem('user_profile');
        if (!profileStr) { window.location.replace('login.html'); return; }

        this.state.currentUserProfile = JSON.parse(profileStr);
        const user = this.state.currentUserProfile;

        // Check Admin
        const isAdmin = (user.is_admin === true || user.is_admin === "true" || user.is_admin === 1);

        // Check Ruolo Impiegato
        let roleName = "";
        if (user.ruoli) {
            if (Array.isArray(user.ruoli) && user.ruoli.length > 0) roleName = user.ruoli[0].nome_ruolo;
            else if (typeof user.ruoli === 'object') roleName = user.ruoli.nome_ruolo;
        }
        const isImpiegato = (roleName && roleName.toLowerCase().trim() === 'impiegato');

        if (!isAdmin && !isImpiegato) {
            alert("Accesso non autorizzato.");
            window.location.replace('index.html');
            return;
        }

        // Cache DOM
        this.dom.taskView = document.getElementById('taskView');
        this.dom.inspectorBody = document.getElementById('inspectorBody');
        this.dom.adminFilterContainer = document.getElementById('adminFilterContainer');
        this.dom.adminUserFilter = document.getElementById('adminUserFilter');

        // Pulsanti
        this.dom.btnNew = document.getElementById('addTaskBtn');
        this.dom.btnEdit = document.getElementById('inspectorEditBtn');
        this.dom.btnDelete = document.getElementById('inspectorDeleteBtn');
        this.dom.btnComplete = document.getElementById('inspectorCompleteBtn');
        this.dom.btnTransfer = document.getElementById('inspectorTransferBtn');
        this.dom.btnBell = document.getElementById('inspectorBellBtn');

        // VISIBILITÀ FILTRO ADMIN
        if (this.dom.adminFilterContainer) {
            this.dom.adminFilterContainer.style.display = isAdmin ? 'flex' : 'none';
        }

        await this.loadInitialData();
        this.addEventListeners();
    },

    loadInitialData: async function () {
        try {
            // 1. Carichiamo PRIMA i metadati (Personale e Categorie)
            const [personaleRes, initDataRes, etichetteRes] = await Promise.all([
                apiFetch('/api/personale/'),
                apiFetch('/api/tasks/init-data'),
                apiFetch('/api/get-etichette')
            ]);

            this.state.personale = (await personaleRes.json()).data;
            this.state.initData = await initDataRes.json();
            this.state.initData.etichette = await etichetteRes.json();

            // 2. Se Admin, configuriamo il filtro ORA (prima di chiamare i task)
            if (this.dom.adminFilterContainer.style.display !== 'none') {
                this.setupAdminFilter();
            }

            // 3. SOLO ORA scarichiamo i Task (così il filtro è già impostato)
            await this.refreshBoard();

        } catch (error) {
            console.error("Init Error:", error);
        }
    },

    fetchBoardData: async function () {
        const params = new URLSearchParams();
        // Aggiungi filtro utente solo se il filtro è visibile (quindi è admin)
        if (this.dom.adminFilterContainer && this.dom.adminFilterContainer.style.display !== 'none') {
            const filterUser = this.dom.adminUserFilter?.value;
            if (filterUser) params.append('id_utente_filtro', filterUser);
        }

        return apiFetch(`/api/tasks/?${params.toString()}`);
    },

    // =================================================================
    // == 2. RENDER KANBAN BOARD                                      ==
    // =================================================================

    renderKanbanBoard: function () {
        this.dom.taskView.innerHTML = '';
        this.state.columnsConfig.forEach(col => {
            const columnEl = document.createElement('div');
            columnEl.className = 'task-column';
            columnEl.dataset.status = col.status; // Label per API (es. 'Da Fare')

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
        if (arcBtn) arcBtn.addEventListener('click', () => this.openArchive());
    },

    createTaskCard: function (task) {
        const el = document.createElement('div');

        // 1. Conversione sicura degli ID in numeri per evitare errori di confronto (String vs Int)
        const myId = parseInt(this.state.currentUserProfile.id_personale, 10);
        const taskCreatorId = parseInt(task.id_creatore_fk, 10);
        const taskAssigneeId = parseInt(task.id_assegnatario_fk, 10);

        // 2. Logica Ruoli
        const isCreator = (taskCreatorId === myId);
        const isAssignee = (taskAssigneeId === myId);

        // SCENARIO DELEGANTE (Monitoraggio): 
        // L'ho creato io, NON ce l'ho io in carico, e non è ancora finito.
        // -> Vedo il task "grigino" con il lucchetto.
        const isDelegatedOut = isCreator && !isAssignee && task.stato !== 'Completato';

        // SCENARIO DESTINATARIO (In Arrivo): 
        // Ce l'ho io in carico, MA non l'ho creato io.
        // -> Vedo il task evidenziato in blu con banner.
        const isIncoming = isAssignee && !isCreator;

        // 3. Assegnazione Classi CSS
        el.className = `task-card priority-${(task.priorita || 'Media').toLowerCase()}`;
        el.dataset.taskId = task.id_task;
        el.dataset.assigneeId = task.id_assegnatario_fk;

        if (isDelegatedOut) {
            el.classList.add('delegated-out');
            el.draggable = false; // Impedisce trascinamento fisico
        } else {
            el.draggable = true; // Abilita trascinamento
        }

        if (isIncoming) {
            el.classList.add('incoming-task');
        }

        // 4. Preparazione Contenuti (Tags, Nomi, Date)
        // 4. Preparazione Contenuti (Tags, Nomi, Date)
        // [MODIFIED] Gestione Colori Categorie
        const catName = task.categoria?.nome_categoria || 'Altro';

        // Mappa Colori (Basata su DB + Richieste)
        const catColors = {
            'Milano': '#607D8B',       // Blue Grey
            'Qualità': '#9C27B0',      // Purple
            'Sicurezza': '#FF9800',    // Orange
            'Produzione': '#2196F3',   // Blue
            'OP': '#009688',           // Teal
            'Trevignano': '#795548',   // Brown
            'Acquisti': '#4CAF50',     // Green
            'Altro': '#9E9E9E',        // Grey
            'Commessa': '#3F51B5',     // Indigo
            'Montaggi': '#FF5722',     // Deep Orange
            'Rozzano': '#673AB7',      // Deep Purple
            'Fontanafredda': '#00BCD4',// Cyan
            'Generale': '#607D8B',     // Blue Grey
            'Amministrazione': '#E91E63', // Pink
            'Tecnico': '#3F51B5',      // Indigo
            'Commerciale': '#8BC34A'   // Light Green
        };
        // Normalizza nome per case-insensitive match se necessario (qui chiavi esatte)
        const badgeColor = catColors[catName] || catColors[catName.trim()] || '#9E9E9E';

        let headerText = catName;
        let headerClass = 'cat-tag';
        let headerStyle = `background-color: ${badgeColor}; color: white;`;

        if (task.commessa) {
            headerText = task.commessa.codice_commessa;
            headerClass = 'commessa-tag';
            // Se è OP/Commessa, usiamo il colore OP o manteniamo lo stile Commessa?
            // L'utente vuole distinguere le categorie. 
            // Se è OP, ha senso usare il colore OP (Teal) per il tag, anche se mostra il codice commessa.
            if (catName.toUpperCase() === 'OP') {
                headerStyle = `background-color: ${catColors['OP']}; color: white;`;
            }
        }

        // Recupero nomi per visualizzazione
        const creatorName = task.creatore?.nome_cognome?.split(' ')[0] || '?';
        const assigneeName = task.assegnatario?.nome_cognome?.split(' ')[0] || '';

        // Elementi Visivi Speciali
        // Banner evidente se il task arriva da un altro
        const incomingAlert = isIncoming
            ? `<div class="incoming-alert"><i class="fas fa-arrow-down"></i> Da ${creatorName}</div>`
            : '';

        // Lucchetto se sto solo monitorando
        const lockIcon = isDelegatedOut
            ? `<i class="fas fa-lock" style="color:#999; font-size:0.9em;" title="In carico a ${assigneeName}"></i>`
            : '';

        // Formattazione data scadenza
        const dateHtml = task.data_obiettivo
            ? `<div style="font-size:0.75em; color:${this.isLate(task.data_obiettivo) ? '#e74c3c' : '#95a5a6'}; display:flex; align-items:center; gap:4px;">
                 <i class="far fa-calendar"></i> ${new Date(task.data_obiettivo).toLocaleDateString()}
               </div>`
            : '<div></div>';

        // 5. Costruzione HTML Card
        el.innerHTML = `
            ${incomingAlert}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span class="${headerClass}" style="${headerStyle}">${headerText}</span>
                ${lockIcon}
            </div>
            
            <h4 style="margin: 5px 0 10px 0; font-size:0.95em; line-height:1.4;">${task.titolo}</h4>
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f0f0f0; padding-top:6px;">
                 ${dateHtml}
                 <span style="font-size:0.75em; color:#555; font-weight:600; background:#f1f3f5; padding:2px 6px; border-radius:4px;">
                    ${assigneeName}
                 </span>
            </div>
        `;

        // 6. Event Listeners
        // Click apre sempre l'inspector
        el.addEventListener('click', () => this.renderInspectorView(task.id_task));

        // Drag start solo se non è delegato fuori (locked)
        if (!isDelegatedOut) {
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', task.id_task);
                this.state.draggedTaskAssignee = task.id_assegnatario_fk;
            });
        }

        return el;
    },

    setupDragDrop: function (container) {
        // Drag Over
        container.addEventListener('dragover', e => {
            e.preventDefault();
            container.classList.add('drag-over');
        });

        // Drag Leave
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });

        // DROP EVENT
        container.addEventListener('drop', async e => {
            e.preventDefault();
            container.classList.remove('drag-over');

            const taskId = e.dataTransfer.getData('text/plain');
            if (!taskId) return; // Sicurezza

            const targetColumn = container.closest('.task-column');
            if (!targetColumn) return;

            const newStatusKey = container.dataset.statusKey; // es: 'todo', 'doing'
            const newStatusLabel = targetColumn.dataset.status; // es: 'Da Fare'

            // --- INTERCEZIONE DRAG VERSO COLONNA 'review' (Delegati) ---
            if (newStatusKey === 'review') {
                this.state.currentTask = {
                    id_task: taskId,
                    id_assegnatario_fk: this.state.draggedTaskAssignee
                };
                this.renderTransferMode();
                return;
            }

            try {
                // TRUCCO VISIVO: Spostiamo la card nel DOM *subito*, senza aspettare il server.
                const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
                if (card) {
                    container.appendChild(card); // La sposta nella nuova colonna visivamente
                }

                // Ora chiamiamo il server per salvare
                await apiFetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ stato: newStatusLabel })
                });

                // Infine sincronizziamo i dati veri (silenziosamente)
                await this.refreshBoard();

            } catch (error) {
                console.error("Errore Drop:", error);
                alert("Impossibile spostare il task. Ricarica la pagina.");
                await this.refreshBoard(); // Ripristina stato corretto in caso di errore
            }
        });
    },

    isLate: function (dateStr) { return new Date(dateStr) < new Date().setHours(0, 0, 0, 0); },

    // =================================================================
    // == 3. INSPECTOR: VIEW MODE (VISUALIZZAZIONE)                   ==
    // =================================================================

    renderInspectorView: async function (taskId) {
        this.dom.inspectorBody.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        this.toggleToolbar(false);

        try {
            const res = await apiFetch(`/api/tasks/${taskId}`);
            const task = await res.json();
            this.state.currentTask = task;

            // --- LOGICA PERMESSI TOOLBAR ---
            const myId = this.state.currentUserProfile.id_personale;
            const isAssignee = (task.id_assegnatario_fk === myId);
            // Calcolo Admin sicuro
            const isAdmin = (this.state.currentUserProfile.is_admin === true ||
                this.state.currentUserProfile.is_admin === "true" ||
                this.state.currentUserProfile.is_admin === 1);

            const canEdit = isAssignee || isAdmin;

            this.toggleToolbar(canEdit);

            const isDone = task.stato === 'Completato';
            this.dom.btnComplete.innerHTML = isDone ? '<i class="fas fa-undo"></i> Riapri' : '<i class="fas fa-check"></i> Chiudi';
            this.dom.btnComplete.title = isDone ? "Riapri Task" : "Segna come Completato";
            this.dom.btnComplete.classList.toggle('btn-complete', !isDone);
            this.dom.btnComplete.classList.toggle('btn-transfer', isDone);

            // --- MODIFICA ETICHETTA COMMESSA ---
            // Cerchiamo l'etichetta formattata (Cliente | Impianto...) nella lista caricata all'init
            let commessaLabel = null;
            if (task.id_commessa_fk) {
                // Cerchiamo nell'array etichette scaricato da /api/get-etichette
                const found = this.state.initData.etichette.find(e => e.id === task.id_commessa_fk);
                if (found) {
                    commessaLabel = found.label; // Usa la formattazione completa
                } else if (task.commessa) {
                    // Fallback se la commessa è archiviata (non è in get-etichette) ma abbiamo i dati base
                    commessaLabel = `${task.commessa.impianto} (${task.commessa.codice_commessa})`;
                }
            }
            // -----------------------------------

            const html = `
                <h2 class="detail-title">${task.titolo}</h2>
                <div class="read-only-box">
                    <div class="detail-grid">
                        <div class="detail-item"><strong>Stato</strong> <span>${task.stato}</span></div>
                        <div class="detail-item"><strong>Priorità</strong> <span>${task.priorita}</span></div>
                        <div class="detail-item"><strong>Categoria</strong> <span>${task.categoria?.nome_categoria}</span></div>
                        <div class="detail-item"><strong>Assegnato</strong> <span>${task.assegnatario?.nome_cognome}</span></div>
                        
                        ${commessaLabel ? `<div class="detail-item" style="grid-column: span 2;"><strong>Commessa</strong> <span>${commessaLabel}</span></div>` : ''}
                        
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
                    
                    <div class="comment-box">
                        <textarea id="inpComment" placeholder="Scrivi un commento..." rows="1"></textarea>
                        <button id="btnSendComment" class="btn-send"><i class="fas fa-paper-plane"></i></button>
                    </div>

                    <div id="inspectorHistory" class="history-list"></div>
                </div>
            `;
            this.dom.inspectorBody.innerHTML = html;

            document.getElementById('btnSendComment').addEventListener('click', () => this.postComment());

            this.renderHistory(task.task_storia, task.task_commenti);

        } catch (e) { this.dom.inspectorBody.innerHTML = `<p style="color:red; text-align:center;">Errore caricamento: ${e.message}</p>`; }
    },

    toggleToolbar: function (enable) {
        this.dom.btnEdit.disabled = !enable;
        this.dom.btnDelete.disabled = !enable;
        this.dom.btnComplete.disabled = !enable;
        this.dom.btnTransfer.disabled = !enable;
        // Bell and New are always enabled
    },

    // =================================================================
    // == 4. INSPECTOR: MODALITÀ TRASFERIMENTO (CON MESSAGGIO)        ==
    // =================================================================

    // =================================================================
    // == 4. INSPECTOR: TRANSFER MODE (Aggiornato con std-btn)        ==
    // =================================================================

    renderTransferMode: function () {
        if (!this.state.currentTask) return;
        this.toggleToolbar(false);

        const currentAssignee = this.state.currentTask.id_assegnatario_fk;

        const html = `
            <h2 class="detail-title">Invia / Trasferisci Task</h2>
            <div style="padding: 20px 0;">
                <label style="display:block; margin-bottom:5px; font-weight:600; color:#444;">Seleziona il nuovo assegnatario:</label>
                <div class="styled-select-wrapper" style="margin-bottom:15px;">
                    <select id="transferUserSelect" class="inp-select">
                        <option value="" disabled selected>-- Seleziona Persona --</option>
                        ${this.state.personale
                .filter(p => p.puo_accedere && p.id_personale != currentAssignee)
                .map(p => `<option value="${p.id_personale}">${p.nome_cognome}</option>`)
                .join('')}
                    </select>
                </div>

                <label style="display:block; margin-bottom:5px; font-weight:600; color:#444;">Messaggio per il destinatario *:</label>
                <textarea id="transferMessage" rows="3" class="inp-area" placeholder="Spiega perché stai inviando questo task o cosa deve fare..."></textarea>
                <small style="color:#888;">Questo messaggio verrà salvato come commento e inviato come notifica.</small>
            </div>
            <div class="form-actions">
                <button id="btnCancelTransfer" class="std-btn std-btn--ghost">Annulla</button>
                <button id="btnConfirmTransfer" class="std-btn std-btn--primary">Conferma Invio</button>
            </div>
        `;
        this.dom.inspectorBody.innerHTML = html;

        document.getElementById('btnCancelTransfer').addEventListener('click', () => {
            if (this.state.currentTask.titolo) this.renderInspectorView(this.state.currentTask.id_task);
            else this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Trasferimento annullato.</p></div>';
        });

        document.getElementById('btnConfirmTransfer').addEventListener('click', () => this.executeTransfer());
    },

    executeTransfer: async function () {
        const newAssignee = document.getElementById('transferUserSelect').value;
        const message = document.getElementById('transferMessage').value;

        if (!newAssignee) return alert("Seleziona un assegnatario.");
        if (!message || !message.trim()) return alert("Inserisci un messaggio obbligatorio per il destinatario.");

        // UI Feedback
        const btn = document.getElementById('btnConfirmTransfer');
        btn.textContent = "Invio in corso...";
        btn.disabled = true;

        try {
            // 1. Aggiorna Task (Cambia Assegnatario + Forza Stato 'In Revisione')
            const payload = {
                id_assegnatario_fk: newAssignee,
                stato: 'In Revisione'
            };

            await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, {
                method: 'PUT', body: JSON.stringify(payload)
            });

            // 2. Invia Messaggio come Commento
            const commentText = `➡️ **TRASFERITO:** ${message}`;
            await apiFetch(`/api/tasks/${this.state.currentTask.id_task}/commenti`, {
                method: 'POST', body: JSON.stringify({ testo_commento: commentText })
            });

            await this.refreshBoard();

            // Ricarica la vista dettaglio per conferma
            this.renderInspectorView(this.state.currentTask.id_task);
        } catch (e) {
            alert('Errore trasferimento: ' + e.message);
            btn.textContent = "Conferma Invio";
            btn.disabled = false;
        }
    },

    // =================================================================
    // == 5. INSPECTOR: MODALITÀ NOTIFICHE (Checklist & Std Style)    ==
    // =================================================================

    renderNotificationsMode: async function () {
        this.dom.inspectorBody.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        this.toggleToolbar(false); // Nasconde i bottoni standard della toolbar

        try {
            // Recupera solo le notifiche non lette (o le ultime N in base al backend)
            const res = await apiFetch(`/api/tasks/notifiche`);
            const notes = await res.json();

            // --- CASO 1: NESSUNA NOTIFICA ---
            if (notes.length === 0) {
                this.dom.inspectorBody.innerHTML = `
                    <h2 class="detail-title">Notifiche</h2>
                    <div class="empty-state">
                        <i class="far fa-bell-slash fa-3x"></i>
                        <p>Non hai nuove notifiche.</p>
                        <small style="color:#999;">Tutti i messaggi precedenti sono stati letti.</small>
                        <div style="margin-top: 20px;">
                            <button id="btnCloseNotes" class="std-btn std-btn--ghost">Indietro</button>
                        </div>
                    </div>`;

                document.getElementById('btnCloseNotes').addEventListener('click', () => {
                    if (this.state.currentTask && this.state.currentTask.id_task) {
                        this.renderInspectorView(this.state.currentTask.id_task);
                    } else {
                        this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Seleziona un task.</p></div>';
                    }
                });
                return;
            }

            // --- CASO 2: LISTA NOTIFICHE ---

            // Generazione HTML della lista
            const listHtml = notes.map(n => `
                <div class="notification-item-wrapper ${n.letto ? 'read' : 'unread'}" id="notif-${n.id_notifica}">
                    <!-- A. Area Contenuto (Clicca per segnare letto) -->
                    <div class="notification-content" data-action="mark-read" data-id="${n.id_notifica}">
                        <div class="notif-header">
                            <span class="notif-type">${n.tipo_notifica}</span> 
                            <span class="notif-date">${new Date(n.data_creazione).toLocaleDateString()}</span>
                        </div>
                        <div class="notif-msg">${n.messaggio}</div>
                        <small>Da: ${n.sender ? n.sender.nome_cognome : 'Sistema'}</small>
                    </div>
                    
                    <!-- B. Pulsante Azione (Vai al Task) -->
                    <button class="btn-go-to-task" data-action="go-task" data-task="${n.id_task_fk}" title="Vai al Task">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `).join('');

            // Struttura completa pannello
            const html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <h2 class="detail-title" style="margin:0;">Le tue Notifiche</h2>
                    <button id="btnMarkAll" class="std-btn std-btn--blue" style="font-size:0.75em; padding:4px 10px; min-height:auto;">
                        <i class="fas fa-check-double"></i> Segna tutte lette
                    </button>
                </div>
                
                <div class="notification-list" id="notifList">
                    ${listHtml}
                </div>
                
                <div class="form-actions">
                     <button id="btnCloseNotes" class="std-btn std-btn--ghost">Chiudi</button>
                </div>
            `;
            this.dom.inspectorBody.innerHTML = html;

            // --- EVENT LISTENER ---

            // 1. Chiudi Pannello
            document.getElementById('btnCloseNotes').addEventListener('click', () => {
                if (this.state.currentTask && this.state.currentTask.id_task) {
                    this.renderInspectorView(this.state.currentTask.id_task);
                } else {
                    this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Seleziona un task.</p></div>';
                }
            });

            // 2. Segna tutte come lette
            document.getElementById('btnMarkAll').addEventListener('click', async () => {
                // Feedback visivo immediato
                const unreadItems = document.querySelectorAll('.notification-item-wrapper.unread');
                unreadItems.forEach(el => {
                    el.classList.remove('unread');
                    el.classList.add('read');
                });

                // Chiamate API (Loop sulle note caricate)
                for (const n of notes) {
                    if (!n.letto) {
                        // Non usiamo await per non bloccare l'UI, lasciamo andare in background
                        apiFetch(`/api/tasks/notifiche/leggi/${n.id_notifica}`, { method: 'PUT' }).catch(console.error);
                    }
                }
            });

            // 3. Gestione Click sulla Lista (Event Delegation)
            const listContainer = document.getElementById('notifList');
            listContainer.addEventListener('click', async (e) => {

                // A. Click su "Vai al Task" (Freccia)
                const btnGo = e.target.closest('[data-action="go-task"]');
                if (btnGo) {
                    const taskId = btnGo.dataset.task;
                    // Prima segna come letta la notifica relativa (opzionale, ma consigliato)
                    const wrapper = btnGo.closest('.notification-item-wrapper');
                    const notifId = wrapper.querySelector('[data-action="mark-read"]').dataset.id;
                    apiFetch(`/api/tasks/notifiche/leggi/${notifId}`, { method: 'PUT' }).catch(console.error);

                    // Poi naviga
                    await this.renderInspectorView(taskId);
                    return;
                }

                // B. Click sul Contenuto (Segna come letto)
                const contentDiv = e.target.closest('[data-action="mark-read"]');
                if (contentDiv) {
                    const wrapper = contentDiv.closest('.notification-item-wrapper');

                    // Agisci solo se è ancora non letta
                    if (wrapper.classList.contains('unread')) {
                        // Update UI
                        wrapper.classList.remove('unread');
                        wrapper.classList.add('read');

                        // Update DB
                        const notifId = contentDiv.dataset.id;
                        try {
                            await apiFetch(`/api/tasks/notifiche/leggi/${notifId}`, { method: 'PUT' });
                        } catch (err) {
                            console.error("Errore aggiornamento notifica", err);
                            // Revert UI in caso di errore critico (opzionale)
                            wrapper.classList.add('unread');
                        }
                    }
                }
            });

        } catch (e) {
            this.dom.inspectorBody.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Errore caricamento notifiche: ${e.message}</p>`;
        }
    },

    // =================================================================
    // == 6. INSPECTOR: EDIT / CREATE FORM (Aggiornato con std-btn)   ==
    // =================================================================

    renderInspectorForm: function (task = null) {
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
                            <option value="Bassa" ${vals.prio == 'Bassa' ? 'selected' : ''}>🟢 Bassa</option>
                            <option value="Media" ${vals.prio == 'Media' ? 'selected' : ''}>🟡 Media</option>
                            <option value="Alta" ${vals.prio == 'Alta' ? 'selected' : ''}>🔴 Alta</option>
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
                    <button id="btnCancel" class="std-btn std-btn--ghost">Annulla</button>
                    <button id="btnSave" class="std-btn std-btn--primary">Salva</button>
                </div>
            </form>
        `;
        this.dom.inspectorBody.innerHTML = html;

        this.populateFormDropdowns(vals);

        document.getElementById('btnCancel').addEventListener('click', () => {
            if (isEdit) this.renderInspectorView(vals.id);
            else {
                this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-tasks fa-3x"></i><p>Seleziona un task o creane uno nuovo.</p></div>';
                this.toggleToolbar(false);
            }
        });
        document.getElementById('btnSave').addEventListener('click', () => this.saveTask());
        document.getElementById('inpCat').addEventListener('change', () => this.toggleSubField());
    },

    populateFormDropdowns: function (vals) {
        const cat = document.getElementById('inpCat');
        cat.innerHTML = '<option value="" disabled selected>Seleziona...</option>';
        this.state.initData.categorie.forEach(c => {
            cat.innerHTML += `<option value="${c.id_categoria}" ${vals.cat == c.id_categoria ? 'selected' : ''}>${c.nome_categoria}</option>`;
        });

        const ass = document.getElementById('inpAss');
        this.state.personale.filter(p => p.puo_accedere).forEach(p => {
            ass.innerHTML += `<option value="${p.id_personale}" ${vals.ass == p.id_personale ? 'selected' : ''}>${p.nome_cognome}</option>`;
        });

        this.state.choicesInstances.forEach(c => c.destroy());
        this.state.choicesInstances = [];

        const commChoice = new Choices('#inpComm', {
            choices: this.state.initData.commesse.map(c => ({ value: c.id_commessa, label: `${c.impianto} (${c.codice_commessa})`, selected: vals.comm == c.id_commessa })),
            searchEnabled: true, itemSelectText: ''
        });

        const subChoice = new Choices('#inpSub', {
            choices: this.state.initData.etichette.map(e => ({ value: e.label, label: e.label, selected: vals.sub == e.label })),
            searchEnabled: true, itemSelectText: ''
        });

        this.state.choicesInstances.push(commChoice, subChoice);
        this.toggleSubField();
    },

    toggleSubField: function () {
        const val = document.getElementById('inpCat').value;
        const cat = this.state.initData.categorie.find(c => c.id_categoria == val);
        const name = cat ? cat.nome_categoria.toUpperCase() : '';

        // [MODIFIED] Commessa o OP abilitano il tag commessa
        const isTarget = (name === 'OP' || name === 'COMMESSA');

        // wrapComm = Commessa Dropdown ("Tag" commessa)
        // wrapSub = Dettaglio Dropdown ("Tag" generico)

        // Logica richiesta:
        // "Se op o commessa -> abilita selezione tag (commessa), altrimenti azzerare su null e disabilitare"

        const wrapComm = document.getElementById('wrapComm');
        const wrapSub = document.getElementById('wrapSub');

        if (isTarget) {
            wrapComm.style.display = 'block';
            wrapSub.style.display = 'none';
        } else {
            wrapComm.style.display = 'none';
            wrapSub.style.display = 'block';

            // Azzerare selezione commessa
            if (this.state.choicesInstances[0]) {
                this.state.choicesInstances[0].removeActiveItems();
                this.state.choicesInstances[0].setChoiceByValue('');
            }
        }
    },

    saveTask: async function () {
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
        } catch (e) { alert(e.message); }
    },

    // =================================================================
    // == 7. UTILS & EVENT LISTENERS                                  ==
    // =================================================================

    addEventListeners: function () {
        this.dom.btnNew.addEventListener('click', () => this.renderInspectorForm(null));
        this.dom.btnEdit.addEventListener('click', () => { if (this.state.currentTask) this.renderInspectorForm(this.state.currentTask); });
        this.dom.btnDelete.addEventListener('click', () => this.deleteTask());
        this.dom.btnComplete.addEventListener('click', () => this.toggleCompleteStatus());
        this.dom.btnTransfer.addEventListener('click', () => this.renderTransferMode());
        this.dom.btnBell.addEventListener('click', () => this.renderNotificationsMode());

        if (this.state.currentUserProfile.is_admin) {
            this.dom.adminFilterContainer.style.display = 'flex';
            this.dom.adminUserFilter.addEventListener('change', () => this.refreshBoard());
        }

        document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', (e) => {
            if (e.target.dataset.closeArchive !== undefined) {
                document.getElementById('archiveModal').style.display = 'none';
                document.getElementById('modalOverlay').style.display = 'none';
            }
        }));
    },

    refreshBoard: async function () {
        // NON svuotiamo this.state.boardData o l'HTML qui.
        // Aspettiamo che il server risponda.
        try {
            const res = await this.fetchBoardData(); // Scarica i dati grezzi (Response object)
            // Se fetchBoardData usa apiFetch, res è l'oggetto Response.
            // Se usa direttamente i dati (dipende dalla tua implementazione), adatta qui.
            // Assumendo che fetchBoardData ritorni la Response:
            const data = await res.json();

            // Ora che abbiamo i dati sicuri, aggiorniamo lo stato
            this.state.boardData = data;

            // E ridisegniamo la board (qui avverrà il cambio HTML)
            this.renderKanbanBoard();
        } catch (error) {
            console.error("Errore refresh board:", error);
            // Se fallisce, non facciamo nulla: l'utente continua a vedere i vecchi dati
            // invece di una pagina bianca.
        }
    },

    setupAdminFilter: function () {
        const sel = this.dom.adminUserFilter;
        if (!sel) return;

        sel.innerHTML = '<option value="all">Tutti gli utenti</option>';

        this.state.personale
            .filter(p => p.puo_accedere && p.attivo)
            .sort((a, b) => a.nome_cognome.localeCompare(b.nome_cognome))
            .forEach(p => {
                sel.innerHTML += `<option value="${p.id_personale}">${p.nome_cognome}</option>`;
            });

        // IMPOSTAZIONE DEFAULT: Utente Loggato
        // Se l'utente loggato è nella lista, lo selezioniamo. Altrimenti resta "Tutti".
        const myId = this.state.currentUserProfile.id_personale;
        if (sel.querySelector(`option[value="${myId}"]`)) {
            sel.value = myId;
        }
    },

    postComment: async function () {
        const txt = document.getElementById('inpComment').value;
        if (!txt) return;
        await apiFetch(`/api/tasks/${this.state.currentTask.id_task}/commenti`, { method: 'POST', body: JSON.stringify({ testo_commento: txt }) });
        this.renderInspectorView(this.state.currentTask.id_task);
    },

    toggleCompleteStatus: function () {
        if (!this.state.currentTask) return;
        const newStatus = this.state.currentTask.stato === 'Completato' ? 'Da Fare' : 'Completato';
        this.updateStatus(newStatus);
    },

    updateStatus: async function (status) {
        await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, { method: 'PUT', body: JSON.stringify({ stato: status }) });
        this.refreshBoard();
        this.renderInspectorView(this.state.currentTask.id_task);
    },

    deleteTask: async function () {
        if (!confirm("Eliminare definitivamente questo task?")) return;
        try {
            await apiFetch(`/api/tasks/${this.state.currentTask.id_task}`, { method: 'DELETE' });
            this.dom.inspectorBody.innerHTML = '<div class="empty-state"><i class="fas fa-trash-alt fa-3x"></i><p>Task eliminato con successo.</p></div>';
            this.toggleToolbar(false);
            this.refreshBoard();
        } catch (e) {
            alert("Errore eliminazione: " + e.message);
        }
    },

    renderHistory: function (history = [], comments = []) {
        const combined = [...history.map(h => ({ ...h, type: 'h', d: h.data_azione })), ...comments.map(c => ({ ...c, type: 'c', d: c.data_creazione }))].sort((a, b) => new Date(b.d) - new Date(a.d));
        document.getElementById('inspectorHistory').innerHTML = combined.map(x => {
            const date = new Date(x.d).toLocaleDateString() + ' ' + new Date(x.d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const user = x.type === 'h' ? x.utente?.nome_cognome : x.autore?.nome_cognome;

            const isAction = x.type === 'h' && (x.azione === 'CAMBIO STATO' || x.azione === 'RIASSEGNATO' || x.azione === 'CREATO');
            const itemClass = isAction ? 'history-item action' : (x.type === 'c' ? 'history-item comment' : 'history-item');

            return x.type === 'c'
                ? `<div class="${itemClass}"><strong>${user}</strong> <small>${date}</small><br>${x.testo_commento}</div>`
                : `<div class="${itemClass}"><small>${date} - ${user}</small><br><strong>${x.azione}</strong>: ${x.dettagli || ''}</div>`;
        }).join('');
    },

    openArchive: async function () {
        const container = document.getElementById('archiveTasksContainer');
        document.getElementById('archiveModal').style.display = 'flex';
        document.getElementById('modalOverlay').style.display = 'block';
        container.innerHTML = 'Caricamento...';
        try {
            const res = await apiFetch(`/api/tasks/completed?page=1`);
            const tasks = await res.json();
            container.innerHTML = tasks.length
                ? tasks.map(t => `
                    <div class="archive-task-item">
                        <div class="archive-task-title">
                            <i class="fas fa-check-circle" style="color:#2ecc71;"></i> 
                            ${t.titolo}
                        </div>
                        <div class="archive-task-date">
                            <i class="far fa-calendar-alt"></i> 
                            ${new Date(t.data_ultima_modifica).toLocaleDateString()}
                        </div>
                    </div>`).join('')
                : `
                    <div class="empty-archive">
                        <i class="fas fa-folder-open fa-3x"></i>
                        <p>Nessun task completato in archivio.</p>
                        <small>I task completati appariranno qui.</small>
                    </div>`;
        } catch (e) { container.innerHTML = '<div class="empty-archive" style="color:#e74c3c"><i class="fas fa-exclamation-triangle"></i> Errore caricamento archivi.</div>'; }
    }
};

document.addEventListener('DOMContentLoaded', () => TaskApp.init());