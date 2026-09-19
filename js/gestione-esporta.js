// js/gestione-esporta.js
//
// L'esportazione in XLSX della pagina Gestione, estratta da `gestione.js` il
// 19/09/2026 (task 4.4).
//
// PERCHE' PROPRIO QUESTO METODO
// La voce 4.4 della roadmap diceva che `renderTable`, `exportToXlsx`,
// `renderFilterPopup` e `createCellInput` fossero «400 righe che si chiamano
// fra loro», e concludeva che non ci fosse giuntura. Rimisurato con
// `strumenti/struttura_moduli.py`: **non si chiamano fra loro**. Sono quattro
// metodi grossi e indipendenti seduti vicini.
//
// `exportToXlsx` e' l'unico che sia una FOGLIA vera: un solo chiamante
// (`handleToolbarClick`) e una sola funzione chiamata (`getPropertyByString`,
// ora in `gestione-utili.js`). Per questo e' il primo taglio: il minimo
// rischio a parita' di righe spostate.
//
// COSA PRENDE INVECE DI `this`
// Quattro campi di stato — `currentView` arriva come `vista`, piu' `sortBy`,
// `sortOrder` e `activeFilters` dentro `stato` — e la configurazione della
// vista. Il resto se lo procura da se': il pulsante e il campo di ricerca dal
// DOM, i dati dal backend.
//
// NIENTE E' CAMBIATO NEL COMPORTAMENTO, e la scelta e' deliberata: gli
// `alert` e i `console.error` restano identici a prima. Sostituirli con
// `segnala` sarebbe la modifica giusta, ma farla dentro un'estrazione
// significa che un collaudo fallito non direbbe QUALE delle due l'ha rotta.

import { apiFetch } from './api-client.js';
import { getPropertyByString } from './gestione-utili.js';

/**
 * Scarica l'intera vista — non la sola pagina mostrata — e la salva in XLSX.
 *
 * @param {string} vista   la chiave della vista corrente, usata per il nome
 *                         del foglio e del file.
 * @param {object} config  la configurazione della vista: `columns`,
 *                         `apiEndpoint`, `idColumn`, ordinamenti predefiniti.
 * @param {object} stato   serve `sortBy`, `sortOrder` e `activeFilters`.
 */
export async function esportaInXlsx(vista, config, stato) {
    if (typeof XLSX === 'undefined') {
        alert('Libreria XLSX non caricata. Ricarica la pagina.');
        return;
    }

    if (!config) return;

    const btn = document.getElementById('downloadXlsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
        // Scarica TUTTI i dati (senza paginazione)
        // Usa il 'count' totale restituito dal server per decidere quando fermarsi,
        // evitando il bug dove chunk.length < limit anche se ci sono altri dati
        // (causato dal cap del backend inferiore al limit richiesto).
        let allData = [];
        let page = 1;
        const limit = 1000;
        let totalCount = null; // sarà valorizzato alla prima risposta

        while (true) {
            const params = new URLSearchParams({
                page: page,
                limit: limit,
                sortBy: stato.sortBy || config.defaultSortBy || config.columns[0].key,
                sortOrder: stato.sortOrder || config.defaultSortOrder || 'asc'
            });

            // Applica filtri attivi
            for (const key in stato.activeFilters) {
                stato.activeFilters[key].forEach(value => params.append(key, value));
            }

            const searchTerm = document.getElementById('filter-search-term')?.value || '';
            if (searchTerm) params.append('search', searchTerm);

            const res = await apiFetch(`${config.apiEndpoint}?${params.toString()}`);
            const json = await res.json();
            const chunk = json.data || (Array.isArray(json) ? json : []);

            // Al primo chunk, leggi il totale dal server
            if (totalCount === null) {
                totalCount = (json.count !== undefined && json.count !== null) ? json.count : chunk.length;
            }

            allData = allData.concat(chunk);
            if (btn) btn.textContent = `⏳ ${allData.length} / ${totalCount}`;

            // Ci fermiamo se abbiamo raggiunto il totale o se il chunk era vuoto
            if (chunk.length === 0 || allData.length >= totalCount) break;
            page++;
        }

        if (allData.length === 0) {
            alert('Nessun dato da esportare.');
            return;
        }

        // Flatten dei dati: risolve oggetti join (es. clienti.ragione_sociale -> Cliente)
        const flatData = allData.map(row => {
            const flat = {};
            for (const col of config.columns) {
                const label = col.label || col.key;
                if (col.type === 'foreignKey' && col.displayKey) {
                    flat[label] = getPropertyByString(row, col.displayKey) || '';
                } else if (col.formatter) {
                    flat[label] = col.formatter(row);
                } else {
                    const val = row[col.key];
                    flat[label] = (val !== null && val !== undefined) ? val : '';
                }
            }
            // Aggiungi ID
            flat['ID'] = row[config.idColumn] || '';
            return flat;
        });

        // Genera XLSX
        const ws = XLSX.utils.json_to_sheet(flatData);

        // Auto-width colonne
        const colWidths = Object.keys(flatData[0]).map(key => {
            const maxLen = Math.max(
                key.length,
                ...flatData.map(r => String(r[key] || '').length)
            );
            return { wch: Math.min(maxLen + 2, 50) };
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, vista);
        XLSX.writeFile(wb, `${vista}_export_${new Date().toISOString().slice(0, 10)}.xlsx`);

        console.log(`📥 Esportati ${allData.length} record per vista '${vista}'`);

    } catch (e) {
        console.error('Errore export XLSX:', e);
        alert('Errore durante l\'esportazione: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📥'; }
    }
}
