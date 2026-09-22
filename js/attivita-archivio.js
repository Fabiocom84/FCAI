// js/attivita-archivio.js
//
// Il modale dell'archivio dei task completati, estratto da `attivita.js` il
// 22/09/2026 (task 4.7, terzo taglio).
//
// PERCHE' E' UNA GIUNTURA
// `openArchive` erano 60 righe con **zero** accessi a `this.state` e **zero**
// letture da `this.dom`: apre un modale, chiede una pagina all'API, disegna un
// elenco. Tutti gli elementi se li prende da se' con `document.getElementById`.
// Misurato con `strumenti/struttura_moduli.py`.
//
// LA RICORSIONE DIVENTA INTERNA, ed e' il guadagno vero.
// Il pulsante «Cerca» e il tasto Invio richiamavano `this.openArchive(query)`,
// cioe' passavano da `TaskApp` per tornare in un metodo che riguarda solo
// questo modale. Qui la funzione richiama se stessa e quel giro esterno
// sparisce: `TaskApp` non ha piu' motivo di conoscere l'archivio, tranne che
// per aprirlo la prima volta.
//
// L'UNICA DIPENDENZA VERSO FUORI e' aprire l'ispettore quando si clicca un
// task archiviato, e arriva come callback `apriIspettore`.
//
// NOTA SU `onclick` E NON `addEventListener`, conservato com'era.
// I tre gestori qui dentro — ricerca, Invio, click sull'elenco — usano
// l'assegnazione diretta a `onclick`/`onkeydown`. E' deliberato e il commento
// originale lo diceva: questa funzione viene richiamata a ogni ricerca, sugli
// **stessi** elementi del modale, che non vengono ricreati. Con
// `addEventListener` i gestori si accumulerebbero a ogni ricerca; con
// l'assegnazione diretta l'ultimo sostituisce il precedente. Non e' pigrizia,
// e' la forma giusta per un elemento che sopravvive al ridisegno.

import { apiFetch } from './api-client.js';

/**
 * Apre il modale dell'archivio e ne disegna il contenuto.
 *
 * @param {object}   o
 * @param {string}   [o.query]        filtro di ricerca; vuoto = tutto.
 * @param {Function} o.apriIspettore  riceve l'id del task quando se ne clicca
 *                                    uno nell'elenco. Il modale si chiude da
 *                                    se' prima di chiamarlo.
 */
export async function apriArchivio({ query = '', apriIspettore }) {
    const container = document.getElementById('archiveTasksContainer');
    const modal = document.getElementById('archiveModal');
    modal.style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';

    container.innerHTML = 'Caricamento...';

    // Gli elementi del modale non vengono ricreati: si riassegna il gestore,
    // non se ne aggiunge un altro. Vedi la nota in testa al file.
    const btnSearch = document.getElementById('btnArchiveSearch');
    const inpSearch = document.getElementById('inpArchiveSearch');

    btnSearch.onclick = () => apriArchivio({ query: inpSearch.value, apriIspettore });
    inpSearch.onkeydown = (e) => {
        if (e.key === 'Enter') apriArchivio({ query: inpSearch.value, apriIspettore });
    };

    try {
        // Se c'è una query, la passiamo
        const qs = query ? `&q=${encodeURIComponent(query)}` : '';
        const res = await apiFetch(`/api/tasks/completed?page=1${qs}`);
        const tasks = await res.json();

        // Render HTML
        container.innerHTML = tasks.length
            ? tasks.map(t => `
                <div class="archive-task-item" data-task="${t.id_task}" style="cursor:pointer;">
                    <div class="archive-task-title" style="pointer-events:none;">
                        <i class="fas fa-check-circle" style="color:var(--col-2ecc71);"></i>
                        ${t.titolo}
                    </div>
                    <div class="archive-task-date" style="pointer-events:none;">
                        <i class="far fa-calendar-alt"></i>
                        ${new Date(t.data_ultima_modifica).toLocaleDateString()}
                    </div>
                    <div style="font-size:0.8rem; color:var(--col-666666); pointer-events:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                       ${t.descrizione || ''}
                    </div>
                </div>`).join('')
            : `
                <div class="empty-archive">
                    <i class="fas fa-folder-open fa-3x"></i>
                    <p>${query ? 'Nessun risultato trovato.' : 'Nessun task completato in archivio.'}</p>
                </div>`;

        // Click su un task archiviato: chiude il modale e passa la palla fuori.
        container.onclick = (e) => {
            const item = e.target.closest('.archive-task-item');
            if (item) {
                const tId = item.dataset.task;
                // Chiudi modale (stile e overlay)
                modal.style.display = 'none';
                document.getElementById('modalOverlay').style.display = 'none';
                // Apri ispettore
                apriIspettore(tId);
            }
        };

    } catch (e) {
        container.innerHTML = '<div class="empty-archive" style="color:var(--col-e74c3c)"><i class="fas fa-exclamation-triangle"></i> Errore caricamento archivi: ' + e.message + '</div>';
    }
}
