// js/connessione-ui.js
//
// La barra "Online / Offline" condivisa da `quick-note` e `quick-record`.
//
// PERCHE' ESISTE
// Le due pagine avevano la stessa funzione `updateConnectionUI`, quindici righe
// **identiche tranne un messaggio**: «Offline — salvataggio locale» contro
// «Offline — le note verranno salvate in locale». Stessi id, stesse classi,
// stesso ramo. Misurate all'87% di somiglianza il 13/09/2026.
//
// Il prefisso `qn-` delle classi non e' un residuo da correggere: `quick-record.html`
// carica `quick-note.css` di proposito (riga 14), e le classi
// `.qn-connection-bar`, `.qn-connection-online` e `.qn-connection-offline` sono
// definite li' e solo li'. Verificato prima di toccare, perche' un prefisso di
// un'altra pagina dentro un file e' di solito il segno di una copia incompleta —
// qui era una condivisione voluta.
//
// PERCHE' UNA FABBRICA E NON UNA FUNZIONE CON PARAMETRO
// Le due pagine registrano l'ascoltatore cosi':
//
//     window.addEventListener('offline', updateConnectionUI);
//
// Passando la funzione per nome, il browser la invoca con l'**oggetto Event**
// come primo argomento. Se il messaggio fosse un parametro, la barra mostrerebbe
// `[object Event]` — e solo durante una disconnessione vera, cioe' nel momento
// in cui nessuno sta guardando il codice. Costruendo qui la funzione, quella che
// le pagine registrano non prende argomenti e i richiami esistenti non cambiano.
//
// NON FA CONTROLLI SUGLI ELEMENTI, ed e' una scelta. Se `connectionStatus`
// mancasse, oggi la pagina solleva subito un errore visibile in console. Un
// `if (!bar) return` lo renderebbe silenzioso: la barra resterebbe ferma su
// "Online" mentre il dispositivo e' scollegato, e chi salva una nota crederebbe
// che sia partita. Su queste due pagine, che esistono per funzionare offline,
// un guasto rumoroso e' preferibile a uno muto.

const BARRA = 'connectionStatus';
const ICONA = 'connectionIcon';
const TESTO = 'connectionText';

/**
 * Costruisce l'aggiornatore della barra per una pagina.
 *
 * @param {string} messaggioOffline  cosa leggere quando la rete manca.
 * @returns {() => void} da chiamare all'avvio e da registrare su
 *                       `online` / `offline`. Non prende argomenti.
 */
export function creaBarraConnessione(messaggioOffline) {
    return function aggiornaBarraConnessione() {
        const bar = document.getElementById(BARRA);
        const icon = document.getElementById(ICONA);
        const text = document.getElementById(TESTO);

        if (navigator.onLine) {
            bar.className = 'qn-connection-bar qn-connection-online';
            icon.textContent = '🟢';
            text.textContent = 'Online';
        } else {
            bar.className = 'qn-connection-bar qn-connection-offline';
            icon.textContent = '🟠';
            text.textContent = messaggioOffline;
        }
    };
}
