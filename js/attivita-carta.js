// js/attivita-carta.js
//
// La carta di un'attivita' nella board Kanban, estratta da `attivita.js` il
// 20/09/2026 (task 4.7, primo taglio).
//
// PERCHE' QUESTA E' UNA GIUNTURA
// `createTaskCard` costruisce un elemento del DOM a partire da un oggetto
// `task` e lo restituisce. Non legge `this.dom`, non chiama API, e delle sue
// quattro dipendenze da `this` tre se ne vanno con lei o diventano parametri.
// Misurato con `strumenti/struttura_moduli.py`.
//
// E LA MISURA E' STATA POSSIBILE SOLO DOPO AVER AGGIUSTATO LO STRUMENTO.
// Fino al 20/09 `struttura_moduli` dichiarava che `createTaskCard` avesse UNA
// sola dipendenza in uscita. Ne aveva due: `isLate` non veniva riconosciuto
// come metodo, perche' definito con il corpo tutto su una riga, e le chiamate
// verso di lui sparivano dalla colonna. Progettare questa estrazione su quel
// numero avrebbe dimenticato un pezzo.
//
// IL TRASCINAMENTO STA TUTTO QUI DAL 22/09/2026, ed e' il motivo per cui
// `collegaTrascinamento` e' arrivata dopo la carta.
//
// Il 20/09 era uscita solo la carta. La zona di rilascio era rimasta in
// `attivita.js`, e le due meta' comunicavano attraverso un campo dello stato
// condiviso — `draggedTaskAssignee`, scritto su `dragstart` e riletto al
// rilascio. Un canale **che attraversava due file**: per tenerlo in piedi
// serviva passare l'oggetto di stato per riferimento, e una copia l'avrebbe
// interrotto in silenzio, aprendo il pannello di trasferimento con un
// assegnatario indefinito. Nessun errore in console, una persona sbagliata a
// schermo.
//
// Rimettendo insieme le due meta' quel problema non si documenta: **sparisce**.
// L'assegnatario trascinato e' ora `assegnatarioTrascinato`, una variabile di
// questo modulo, e nessuno fuori puo' romperla. Il campo condiviso non esiste
// piu'.
//
// `currentTask` invece resta di `attivita.js`, perche' lo leggono
// `renderTransferMode`, `executeTransfer` e altri. Ma non serve che sia questo
// modulo a scriverlo: lo passa al callback `apriTrasferimento`, e il
// proprietario lo deposita dove vuole. Cosi' il trascinamento non tocca stato
// condiviso per niente.
//
// LA CARTA NON RICEVE PIU' LO STATO, dal 25/09/2026.
// Finche' scriveva `draggedTaskAssignee` doveva ricevere l'oggetto vero. Tolta
// quella scrittura, restava una sola LETTURA — l'id di chi sta guardando — e
// passare l'intero oggetto di stato per leggere un campo e' largo: un parametro
// che dichiara di volere «lo stato» puo' leggere e scrivere qualunque cosa, e
// nessuno se ne accorge finche' non lo fa. Ora arriva `mioId`, e la firma dice
// da se' l'intera dipendenza di questo modulo verso il resto della pagina.
//
// COSA E' PRIVATO
// `inRitardo` era `isLate`, e il suo unico chiamante in tutto il repository era
// questo. Entra qui e sparisce dalla superficie di `TaskApp`, che passa da 26
// metodi a 24.

import { apiFetch } from './api-client.js';

// L'assegnatario della carta che si sta trascinando, depositato su `dragstart`
// e riletto al rilascio. Prima del 22/09/2026 era `state.draggedTaskAssignee`,
// cioe' un campo dello stato condiviso, perche' i due capi stavano in file
// diversi. Ora stanno qui, e questa variabile non e' raggiungibile da fuori.
let assegnatarioTrascinato = null;

// Colori dei tag di categoria, dal DB piu' le richieste arrivate dopo.
//
// STA QUI E NON DENTRO LA FUNZIONE dal 20/09/2026, in un commit separato da
// quello dell'estrazione. Era un letterale di 17 voci costruito a OGNI carta:
// con sessanta task in board, sessanta oggetti identici e buttati. Non viene
// mai modificato, quindi spostarlo non cambia comportamento — e' l'unica
// ragione per cui e' lecito farlo senza altre prove oltre a quelle
// dell'estrazione.
const COLORI_CATEGORIA = {
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

/**
 * Costruisce la carta di un'attivita' per la board.
 *
 * @param {object}   o
 * @param {object}   o.task           l'attivita', come arriva dall'API.
 * @param {number|string} o.mioId     l'id_personale di chi sta guardando la
 *                                    board: serve a distinguere le carte
 *                                    delegate da quelle in arrivo.
 * @param {Function} o.apriIspettore  riceve l'id del task quando si clicca.
 * @returns {HTMLElement} la carta, pronta da appendere.
 */
export function creaCartaAttivita({ task, mioId, apriIspettore }) {
    const el = document.createElement('div');

    // 1. Conversione sicura degli ID in numeri per evitare errori di confronto (String vs Int)
    const myId = parseInt(mioId, 10);
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
    const catName = task.categoria?.nome_categoria || 'Altro';

    // Normalizza nome per case-insensitive match se necessario (qui chiavi esatte)
    const badgeColor = COLORI_CATEGORIA[catName] || COLORI_CATEGORIA[catName.trim()] || '#9E9E9E';

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
            headerStyle = `background-color: ${COLORI_CATEGORIA['OP']}; color: white;`;
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
        ? `<i class="fas fa-lock" style="color:var(--col-999999); font-size:0.9em;" title="In carico a ${assigneeName}"></i>`
        : '';

    // Formattazione data scadenza
    const dateHtml = task.data_obiettivo
        ? `<div style="font-size:0.75em; color:${inRitardo(task.data_obiettivo) ? 'var(--col-e74c3c)' : 'var(--col-95a5a6)'}; display:flex; align-items:center; gap:4px;">
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

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--col-f0f0f0); padding-top:6px;">
             ${dateHtml}
             <span style="font-size:0.75em; color:var(--col-555555); font-weight:600; background:var(--col-f1f3f5); padding:2px 6px; border-radius:4px;">
                ${assigneeName}
             </span>
        </div>
    `;

    // 6. Event Listeners
    // Click apre sempre l'inspector
    el.addEventListener('click', () => apriIspettore(task.id_task));

    // Drag start solo se non è delegato fuori (locked)
    if (!isDelegatedOut) {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id_task);
            assegnatarioTrascinato = task.id_assegnatario_fk;
        });
    }

    return el;
}

/**
 * Rende una colonna della board una zona di rilascio.
 *
 * Era `setupDragDrop` in `attivita.js`, arrivata qui il 22/09/2026 per stare
 * dove sta l'altro capo del trascinamento. **Non riceve stato**: quello che
 * doveva scrivere lo passa a `apriTrasferimento`, e quello che doveva leggere
 * e' ora una variabile di questo modulo.
 *
 * @param {object}   o
 * @param {Element}  o.container          la colonna, con `dataset.statusKey`.
 * @param {Function} o.apriTrasferimento  riceve `{id_task, id_assegnatario_fk}`
 *                                        quando si rilascia in «Delegati».
 * @param {Function} o.ricaricaBoard      da chiamare dopo aver salvato, e anche
 *                                        in caso di errore per rimettere a
 *                                        posto lo spostamento gia' fatto a
 *                                        schermo.
 */
export function collegaTrascinamento({ container, apriTrasferimento, ricaricaBoard }) {
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
            apriTrasferimento({
                id_task: taskId,
                id_assegnatario_fk: assegnatarioTrascinato
            });
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
            await ricaricaBoard();

        } catch (error) {
            console.error("Errore Drop:", error);
            alert("Impossibile spostare il task. Ricarica la pagina.");
            await ricaricaBoard(); // Ripristina stato corretto in caso di errore
        }
    });
}

/**
 * La scadenza e' passata? Confronta con la mezzanotte di oggi.
 *
 * Privata: era `isLate` in `attivita.js`, e il suo unico chiamante in tutto il
 * repository era `createTaskCard`. Entra qui con lei.
 */
function inRitardo(dateStr) {
    return new Date(dateStr) < new Date().setHours(0, 0, 0, 0);
}
