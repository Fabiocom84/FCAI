/**
 * Prove sulla chiusura dei modali in `js/shared-ui.js`.
 *
 * STORIA DI QUESTO FILE, che e' il motivo per cui vale la pena leggerlo.
 *
 * Nato il 09/09/2026 per coprire un richiamo per NOME COSTRUITO:
 * `closeSuccessFeedbackModal` cercava la funzione di chiusura del modale padre
 * come <code>window[`close${id}`]</code>, legando il nome di tre funzioni
 * all'`id` del rispettivo modale senza che nessuna ricerca testuale potesse
 * mostrarlo. Cercando le globali da eliminare (task 4.9), quelle tre erano
 * state classificate DUE volte come rimovibili.
 *
 * Il 10/09 e' emerso che quel meccanismo **non e' mai stato eseguito**: delle
 * sei chiamate a `showSuccessFeedbackModal` nel progetto, zero passavano un id.
 * Il 09/09 avevo misurato che il richiamo POTEVA raggiungere tre nomi e avevo
 * riferito che li raggiungeva, senza guardare i chiamanti.
 *
 * E non era una funzionalita' dimenticata: ogni modale si chiude gia' da se',
 * in due righe esplicite. Quindi e' stata rimossa, non cablata.
 *
 * Le prove che restano fanno due cose diverse:
 *   1. descrivono il comportamento attuale, che e' semplice;
 *   2. **impediscono al meccanismo di rientrare** — sono i due casi in fondo, e
 *      sono la ragione principale per cui questo file sopravvive alla rimozione.
 *
 *     node prove/shared-ui-modali.prova.mjs
 */
import { readFileSync } from 'node:fs';
import { elemento, installa } from './finto-dom.mjs';

const esiti = [];

function verifica(nome, condizione, dettaglio = '') {
    esiti.push({ nome, ok: !!condizione });
    console.log(`  ${condizione ? '✓' : '✗'} ${nome}`);
    if (!condizione && dettaglio) console.log(`      ${dettaglio}`);
}

const shared = await import('../js/shared-ui.js');

// ---------------------------------------------------------------------------
// 1. Comportamento attuale: chiude se stesso e la sovrapposizione, e basta.
// ---------------------------------------------------------------------------
{
    const feedback = elemento('success-feedback-modal');
    const overlay = elemento('modalOverlay');
    const altro = elemento('chatModal');
    installa({ 'success-feedback-modal': feedback, modalOverlay: overlay, chatModal: altro });

    shared.showSuccessFeedbackModal('Fatto', 'Salvato');
    verifica('si mostra', feedback.style.display === 'block', `display=${feedback.style.display}`);

    shared.closeSuccessFeedbackModal();
    verifica('chiude se stesso e la sovrapposizione',
        feedback.style.display === 'none' && overlay.style.display === 'none',
        `feedback=${feedback.style.display} overlay=${overlay.style.display}`);
    verifica('NON tocca altri modali della pagina',
        altro.style.display === undefined,
        `chatModal risulta toccato: ${altro.style.display}`);
}

// ---------------------------------------------------------------------------
// 2. `feedbackModal` e' memorizzato al primo uso e mai riletto. Comportamento
//    reale, emerso scrivendo queste prove: se una pagina sostituisse
//    `#success-feedback-modal` nel DOM, `shared-ui.js` continuerebbe a usare
//    quello vecchio e il messaggio smetterebbe di comparire senza un errore.
//    Oggi non capita — quel modale sta nel markup statico — ed e' documentato
//    qui invece che da scoprire un domani.
// ---------------------------------------------------------------------------
{
    const overlay = elemento('modalOverlay');
    const nuovo = elemento('success-feedback-modal');
    installa({ 'success-feedback-modal': nuovo, modalOverlay: overlay });

    shared.showSuccessFeedbackModal('Secondo', 'msg');
    verifica('sostituendo l\'elemento nel DOM, continua a usare quello vecchio',
        nuovo.style.display === undefined,
        `il nuovo elemento e' stato usato: ${nuovo.style.display}`);
    shared.closeSuccessFeedbackModal();
}

// ---------------------------------------------------------------------------
// 3. GUARDIA: niente ricerche per nome costruito in shared-ui.js.
//
//    Vincolano il nome di una funzione a un attributo dell'HTML senza che
//    nessuna ricerca testuale possa mostrarlo. In questo progetto e' gia'
//    costato due classificazioni sbagliate con gli strumenti in mano.
// ---------------------------------------------------------------------------
{
    const src = readFileSync(new URL('../js/shared-ui.js', import.meta.url), 'utf8');
    const senzaCommenti = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    verifica('shared-ui.js non cerca funzioni con window[...]',
        !/window\s*\[/.test(senzaCommenti),
        'trovato un accesso dinamico a window: ' +
        (senzaCommenti.match(/window\s*\[[^\]]{0,50}\]/) || [''])[0]);
}

// ---------------------------------------------------------------------------
// 4. GUARDIA: nessuno passa un terzo argomento a showSuccessFeedbackModal.
//
//    Il parametro non esiste piu'. Se qualcuno lo ripassasse, JavaScript lo
//    ignorerebbe in silenzio e chi l'ha scritto crederebbe che il modale padre
//    si chiuda. Questo caso lo dice ad alta voce.
// ---------------------------------------------------------------------------
{
    const { readdirSync } = await import('node:fs');
    const cartella = new URL('../js/', import.meta.url);
    let colpevoli = [];
    for (const f of readdirSync(cartella).filter(n => n.endsWith('.js'))) {
        const t = readFileSync(new URL(f, cartella), 'utf8');
        for (const m of t.matchAll(/showSuccessFeedbackModal\s*\(([^;]{0,200}?)\)\s*;/gs)) {
            let liv = 0, virgole = 0;
            for (const c of m[1]) {
                if ('([{'.includes(c)) liv++;
                else if (')]}'.includes(c)) liv--;
                else if (c === ',' && liv === 0) virgole++;
            }
            if (virgole >= 2) colpevoli.push(`${f}: ${m[1].slice(0, 60)}`);
        }
    }
    verifica('nessuna chiamata passa un id di modale padre',
        colpevoli.length === 0, colpevoli.join(' | '));
}

// ---------------------------------------------------------------------------

const passati = esiti.filter(e => e.ok).length;
console.log(`\n  ${passati}/${esiti.length} casi come attesi`);
process.exit(passati === esiti.length ? 0 : 1);
