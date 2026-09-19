// js/gestione-utili.js
//
// Le uniche due funzioni PURE di `gestione.js`: non leggono lo stato, non
// toccano il DOM, non chiamano il backend. Dipendono solo dai propri
// argomenti, e per questo si possono spostare senza riscrivere nulla intorno.
//
// PERCHE' UN MODULO PER DODICI RIGHE
// Non per fare numero. `getPropertyByString` e' usata da **quattro** metodi —
// `renderTable`, `exportToXlsx`, `handleEditRow` e `formatCellValue` — e
// l'estrazione di `exportToXlsx` in un file proprio doveva o portarsela via
// (rompendo gli altri tre) o duplicarla. Un posto comune evita entrambe le
// cose, ed e' il presupposto delle estrazioni successive, non il loro
// risultato.
//
// Misurate con `strumenti/struttura_moduli.py` il 19/09/2026: 3 e 9 righe,
// zero accessi a stato, DOM e API.

/**
 * Legge una proprieta' annidata seguendo un percorso puntato.
 *
 *     getPropertyByString({a: {b: 1}}, 'a.b')  ->  1
 *     getPropertyByString({a: null},   'a.b')  ->  null
 *
 * Il `current &&` ferma la discesa al primo anello mancante invece di
 * sollevare: le righe che arrivano dal backend hanno chiavi esterne non
 * risolte, ed e' normale che un pezzo del percorso sia nullo.
 */
export function getPropertyByString(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Il valore da mostrare in una cella: il formattatore della colonna se c'e',
 * altrimenti la proprieta' indicata.
 *
 * `displayKey` esiste perche' la colonna su cui si ORDINA e quella che si
 * MOSTRA non sempre coincidono — si ordina per `id_cliente_fk` e si mostra
 * `clienti.ragione_sociale`.
 */
export function formatCellValue(col, rowData) {
    if (col.formatter) {
        return col.formatter(rowData);
    }
    const displayKey = col.displayKey || col.key;
    return getPropertyByString(rowData, displayKey) || '';
}
