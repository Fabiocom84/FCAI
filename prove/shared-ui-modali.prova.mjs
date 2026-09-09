/**
 * Prove sulla chiusura dei modali in `js/shared-ui.js`.
 *
 * PERCHE' ESISTE
 * `closeSuccessFeedbackModal` chiama la funzione di chiusura del modale padre
 * per un nome COSTRUITO dall'id dell'elemento:
 *
 *     window[`close${id-con-iniziale-maiuscola}`]
 *
 * La stringa `closeChatModal` non compare in nessun punto del progetto: il
 * legame fra questa riga e le tre funzioni che raggiunge non e' trovabile con
 * una ricerca testuale. Cercando le globali da eliminare (task 4.9) quelle tre
 * risultavano rimovibili, e sono state classificate male DUE volte prima che il
 * legame venisse fuori.
 *
 * Rimuoverle avrebbe rotto la chiusura del modale padre **in silenzio**, perche'
 * il ramo di riserva qui sotto fa comunque qualcosa di plausibile: nasconde
 * l'elemento a mano. Nessun errore, nessun avviso, e un collaudo che dice
 * "sembra funzionare".
 *
 * Queste prove trasformano quella convenzione in qualcosa che si rompe
 * rumorosamente. Sono la precondizione dichiarata nella roadmap per il punto 1
 * del task 4.9 — sostituire il richiamo per nome con un registro esplicito.
 *
 *     node prove/shared-ui-modali.prova.mjs
 */
import { elemento, installa } from './finto-dom.mjs';

const esiti = [];

function verifica(nome, condizione, dettaglio = '') {
    esiti.push({ nome, ok: !!condizione });
    console.log(`  ${condizione ? '✓' : '✗'} ${nome}`);
    if (!condizione && dettaglio) console.log(`      ${dettaglio}`);
}

/** Prepara un DOM finto con il modale di feedback e un modale padre. */
function scena(idPadre) {
    const feedback = elemento('success-feedback-modal');
    const padre = elemento(idPadre);
    const overlay = elemento('modalOverlay');
    installa({ 'success-feedback-modal': feedback, [idPadre]: padre, modalOverlay: overlay });
    return { feedback, padre, overlay };
}

const shared = await import('../js/shared-ui.js');

// ---------------------------------------------------------------------------
// 1. Il nome viene costruito dall'id, e la funzione trovata viene chiamata.
// ---------------------------------------------------------------------------
{
    const { padre, overlay } = scena('chatModal');
    let chiamata = 0;
    globalThis.window.closeChatModal = () => { chiamata++; };

    shared.showSuccessFeedbackModal('Fatto', 'Salvato', 'chatModal');
    shared.closeSuccessFeedbackModal();

    verifica('id="chatModal" fa chiamare window.closeChatModal',
        chiamata === 1, `chiamate osservate: ${chiamata}`);
    verifica('quando la trova, NON nasconde il padre a mano (lo fa la funzione)',
        padre.style.display !== 'none' && overlay.style.display !== 'none',
        `padre=${padre.style.display} overlay=${overlay.style.display}`);
    delete globalThis.window.closeChatModal;
}

// ---------------------------------------------------------------------------
// 2. La maiuscola conta: `insertDataModal` -> `closeInsertDataModal`.
//    Se qualcuno cambiasse il calcolo del nome, questo caso lo direbbe.
// ---------------------------------------------------------------------------
{
    scena('insertDataModal');
    let giusta = 0, sbagliata = 0;
    globalThis.window.closeInsertDataModal = () => { giusta++; };
    globalThis.window.closeinsertDataModal = () => { sbagliata++; };

    shared.showSuccessFeedbackModal('Fatto', 'Salvato', 'insertDataModal');
    shared.closeSuccessFeedbackModal();

    verifica('l\'iniziale viene resa maiuscola: closeInsertDataModal',
        giusta === 1 && sbagliata === 0, `giusta=${giusta} sbagliata=${sbagliata}`);
    delete globalThis.window.closeInsertDataModal;
    delete globalThis.window.closeinsertDataModal;
}

// ---------------------------------------------------------------------------
// 3. IL CASO CHE CONTA: se la funzione NON esiste, il codice non fallisce —
//    nasconde l'elemento a mano. E' il ramo che rende invisibile il guasto, ed
//    e' esattamente cio' che sarebbe successo togliendo quelle globali.
// ---------------------------------------------------------------------------
{
    const { padre, overlay } = scena('trainingModal');
    // nessuna window.closeTrainingModal definita
    shared.showSuccessFeedbackModal('Fatto', 'Salvato', 'trainingModal');
    shared.closeSuccessFeedbackModal();

    verifica('senza la funzione non solleva errori: il guasto resta silenzioso',
        padre.style.display === 'none' && overlay.style.display === 'none',
        `padre=${padre.style.display} overlay=${overlay.style.display}`);
}

// ---------------------------------------------------------------------------
// 4. Senza modale padre: si chiude solo la sovrapposizione.
// ---------------------------------------------------------------------------
{
    const feedback = elemento('success-feedback-modal');
    const overlay = elemento('modalOverlay');
    installa({ 'success-feedback-modal': feedback, modalOverlay: overlay });

    shared.showSuccessFeedbackModal('Fatto', 'Salvato', null);
    shared.closeSuccessFeedbackModal();

    verifica('senza modale padre chiude la sovrapposizione',
        overlay.style.display === 'none',
        `overlay=${overlay.style.display}`);

    // Il caso qui sopra e' nato sbagliato: dava per scontato che anche
    // `feedback.style.display` diventasse 'none'. Non succede, e la ragione e'
    // comportamento reale che vale la pena fissare qui invece di aggirare.
    verifica('il modale di feedback e\' MEMORIZZATO al primo uso e mai riletto',
        feedback.style.display === undefined,
        `il nuovo elemento risulta toccato: ${feedback.style.display}`);
}

// ---------------------------------------------------------------------------
// 5b. Conseguenza della memorizzazione: se la pagina sostituisce l'elemento
//     `#success-feedback-modal` nel DOM, `shared-ui.js` continua a usare quello
//     vecchio — che non e' piu' attaccato a niente. Il messaggio di conferma
//     smette di comparire e nessun errore lo dice. Oggi non capita, perche' quel
//     modale sta nel markup statico e nessuno lo ricrea: e' un rischio
//     documentato, non un difetto vivo.
// ---------------------------------------------------------------------------
{
    const vecchio = elemento('success-feedback-modal');
    const overlay = elemento('modalOverlay');
    installa({ 'success-feedback-modal': vecchio, modalOverlay: overlay });
    shared.showSuccessFeedbackModal('Primo', 'msg', null);
    shared.closeSuccessFeedbackModal();

    const nuovo = elemento('success-feedback-modal');
    installa({ 'success-feedback-modal': nuovo, modalOverlay: overlay });
    shared.showSuccessFeedbackModal('Secondo', 'msg', null);

    verifica('sostituendo l\'elemento nel DOM, continua a usare quello vecchio',
        nuovo.style.display === undefined,
        `il nuovo elemento e' stato usato: ${nuovo.style.display}`);
    shared.closeSuccessFeedbackModal();
}

// ---------------------------------------------------------------------------
// 5. I TRE NOMI CHE OGGI ESISTONO DAVVERO. Questo caso non prova il codice:
//    prova la CORRISPONDENZA fra gli id usati nel progetto e i nomi definiti.
//    Se qualcuno rinomina un modale o una funzione, senza toccare l'altro capo,
//    qui si rompe — che e' l'unico posto in cui possa rompersi rumorosamente.
// ---------------------------------------------------------------------------
{
    const coppie = [
        ['chatModal', 'closeChatModal'],
        ['insertDataModal', 'closeInsertDataModal'],
        ['trainingModal', 'closeTrainingModal'],
    ];
    const { readFileSync } = await import('node:fs');
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

    for (const [id, atteso] of coppie) {
        const calcolato = `close${id.charAt(0).toUpperCase() + id.slice(1)}`;
        verifica(`id "${id}" -> ${calcolato}, ed e' definita in main.js`,
            calcolato === atteso && new RegExp(`window\\.${atteso}\\s*=`).test(main),
            `calcolato=${calcolato}, definita=${new RegExp(`window\\.${atteso}\\s*=`).test(main)}`);
    }
}

// ---------------------------------------------------------------------------

const passati = esiti.filter(e => e.ok).length;
console.log(`\n  ${passati}/${esiti.length} casi come attesi`);
process.exit(passati === esiti.length ? 0 : 1);
