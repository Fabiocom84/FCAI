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
// PERCHE' `stato` ARRIVA PER RIFERIMENTO, e qui la ragione e' piu' forte che
// nel popup dei filtri di `gestione.js`.
// `draggedTaskAssignee` non e' uno stato che la carta usa per se': e' un
// **canale fra due metodi diversi**. La carta lo scrive su `dragstart`; quando
// si rilascia il task, `setupDragDrop` lo rilegge per costruire `currentTask`:
//
//     stato.currentTask = { …, id_assegnatario_fk: stato.draggedTaskAssignee };
//     renderTransferMode();
//
// Con una copia dello stato il canale si interrompe in silenzio: il pannello di
// trasferimento si aprirebbe lo stesso, mostrando un assegnatario corrente
// **indefinito**. Non un errore in console — una persona sbagliata a schermo.
//
// COSA E' PRIVATO
// `inRitardo` era `isLate`, e il suo unico chiamante in tutto il repository era
// questo. Entra qui e sparisce dalla superficie di `TaskApp`, che passa da 26
// metodi a 24.

/**
 * Costruisce la carta di un'attivita' per la board.
 *
 * @param {object}   o
 * @param {object}   o.task           l'attivita', come arriva dall'API.
 * @param {object}   o.stato          l'oggetto di stato VERO: si legge
 *                                    `currentUserProfile` e si SCRIVE
 *                                    `draggedTaskAssignee` (vedi il commento in
 *                                    testa: e' un canale verso `setupDragDrop`).
 * @param {Function} o.apriIspettore  riceve l'id del task quando si clicca.
 * @returns {HTMLElement} la carta, pronta da appendere.
 */
export function creaCartaAttivita({ task, stato, apriIspettore }) {
    const el = document.createElement('div');

    // 1. Conversione sicura degli ID in numeri per evitare errori di confronto (String vs Int)
    const myId = parseInt(stato.currentUserProfile.id_personale, 10);
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
            stato.draggedTaskAssignee = task.id_assegnatario_fk;
        });
    }

    return el;
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
