// js/indicatore-caricamento.js
//
// Una barra sottile in cima alla pagina, visibile finche' c'e' almeno una
// richiesta al backend in volo.
//
// PERCHE' UNO SOLO E GENERICO (13/09/2026, task 5.3)
// Nove pagine su ventuno non mostravano NIENTE durante il caricamento: schermo
// fermo, e l'utente che non sa se stia succedendo qualcosa o se sia rotto.
// `dashboard.html` fa otto chiamate senza un segnale.
//
// La strada per pagina — uno scheletro disegnato sulla forma di ogni contenuto —
// e' migliore da guardare, ma sono nove interventi diversi: contenitori diversi,
// percorsi di render diversi, e tre pagine il cui JavaScript non porta nemmeno
// il loro nome. Nove occasioni di sbagliare, e nove cose da mantenere.
//
// Qui invece il punto di passaggio esiste gia' ed e' uno solo: `apiFetch`, da
// cui dipendono 23 moduli su 34. E' lo stesso ragionamento della rete di
// sicurezza sugli errori in `api-client.js` — un rimedio generico al punto
// comune, che non sostituisce quelli specifici ma toglie il caso peggiore.
// Gli scheletri di `commesse` e `manutenzioni` restano e continuano a valere:
// una barra di tre pixel ci convive.
//
// COSA NON FA. Non misura l'avanzamento — non lo conosce — quindi non e' una
// barra di progresso ma un segnale di attivita': si riempie fino all'80% con un
// movimento che rallenta, e completa solo alla fine vera. Fingere una
// percentuale sarebbe peggio di non mostrarla.

const RITARDO_MS = 200;   // sotto questa soglia non si mostra nulla

let inVolo = 0;
let barra = null;
let timerComparsa = null;

/**
 * L'elemento, creato alla prima richiesta.
 *
 * Gli stili sono in linea di proposito: questo modulo deve funzionare su tutte
 * e ventuno le pagine, e i fogli di stile del progetto sono per pagina — lo
 * spinner esistente vive in `commesse.css` e `admin-training.css`, quindi non
 * e' disponibile altrove. Dipendere da una classe significherebbe aggiungerla
 * a ogni foglio, cioe' rifare per il CSS il lavoro per pagina che questo
 * modulo esiste per evitare.
 */
function elemento() {
    if (typeof document === 'undefined' || !document.body) return null;
    if (barra) return barra;
    barra = document.createElement('div');
    barra.id = 'indicatore-caricamento';
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-label', 'Caricamento in corso');
    barra.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'height:3px', 'width:0%',
        'background:var(--col-2563eb, #2563eb)',
        'z-index:99999', 'opacity:0',
        'transition:width .3s ease-out, opacity .2s',
        'pointer-events:none',
    ].join(';');
    document.body.appendChild(barra);
    return barra;
}

function mostra() {
    const el = elemento();
    if (!el) return;
    el.style.opacity = '1';
    el.style.width = '80%';   // si ferma qui: l'avanzamento vero non lo sappiamo
}

function nascondi() {
    const el = elemento();
    if (!el) return;
    el.style.width = '100%';
    setTimeout(() => {
        if (inVolo > 0) return;          // nel frattempo ne e' partita un'altra
        el.style.opacity = '0';
        setTimeout(() => { if (inVolo === 0) el.style.width = '0%'; }, 200);
    }, 200);
}

/** Da chiamare quando una richiesta parte. */
export function richiestaIniziata() {
    inVolo++;
    if (inVolo === 1 && timerComparsa === null) {
        // Il ritardo evita che ogni richiesta veloce produca un lampo: una
        // barra che compare e sparisce in centocinquanta millisecondi e' piu'
        // fastidiosa dell'assenza di barra.
        timerComparsa = setTimeout(() => { timerComparsa = null; if (inVolo > 0) mostra(); },
                                   RITARDO_MS);
    }
}

/** Da chiamare quando una richiesta finisce, riuscita o meno. */
export function richiestaFinita() {
    inVolo = Math.max(0, inVolo - 1);
    if (inVolo > 0) return;
    if (timerComparsa !== null) {
        // Finita prima della soglia: la barra non e' mai comparsa, e non deve.
        clearTimeout(timerComparsa);
        timerComparsa = null;
        return;
    }
    nascondi();
}

/** Solo per le prove: quante richieste risultano in volo. */
export function inCorso() {
    return inVolo;
}
