// js/inserimento-ore-copia.js
//
// «Copia la giornata precedente» dell'inserimento ore da telefono, estratto da
// `inserimento-ore-mobile.js` il 22/09/2026 (task 4.5, primo taglio).
//
// PERCHE' QUESTO E' UNA GIUNTURA IN UN FILE CHE NON NE HA
// `inserimento-ore-mobile.js` e' l'unico dei tre file del 4.5-4.7 in cui «un
// solo grappolo» e' vero: `handleSave` ha 18 accessi di stato e 21 al DOM,
// `startEdit` 15 e 24, `initChoices` 20 di stato, `attachListeners` 28 al DOM.
// Misurato con `strumenti/struttura_moduli.py`.
//
// Questi tre metodi erano l'eccezione: 162 righe che si chiamavano **solo fra
// loro**, con otto accessi di stato in tutto, tutti in LETTURA, e una sola
// dipendenza verso l'esterno — ricaricare l'elenco dopo aver copiato.
//
// PERCHE' ARRIVANO VALORI E NON L'OGGETTO DI STATO, al contrario di
// `gestione-filtri.js` e `attivita-carta.js`.
// Quei due SCRIVONO lo stato, quindi devono ricevere l'oggetto vero: una copia
// li avrebbe rotti in silenzio. Qui non si scrive niente — si leggono tre
// campi: quale giorno, se si e' in modalita' amministratore, e per chi. Un
// parametro per ciascuno e' piu' stretto e dice da se' cosa serve.
//
// UNA DIFFERENZA DI COMPORTAMENTO, nominata e non nascosta.
// `_executeCopy` rileggeva `state.currentDate` al momento dell'ESECUZIONE,
// cioe' dopo che l'utente ha premuto «Copia» nel modale di conferma. Qui la
// data e' quella del momento in cui il modale e' stato APERTO. La differenza si
// vedrebbe solo se il giorno cambiasse con il modale aperto, e il modale e' una
// sovrapposizione a schermo intero: non e' raggiungibile. Ed e' anche piu'
// corretta — il modale dice «copiare 3 attivita' da Venerdi'?» e deve copiarle
// dove le stavi guardando. Ma resta un cambiamento, non un trasloco puro.

import { apiFetch, segnala } from './api-client.js';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio',
    'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/**
 * Cerca l'ultimo giorno lavorativo con ore registrate e propone di copiarlo.
 *
 * @param {object}   o
 * @param {string}   o.data          il giorno di destinazione (`YYYY-MM-DD`).
 * @param {boolean}  o.modoAdmin     se si sta inserendo per conto di un altro.
 * @param {number}   [o.idUtente]    per chi, quando `modoAdmin` e' vero.
 * @param {Element}  [o.pulsante]    il pulsante da disabilitare durante il giro.
 * @param {Function} o.ricaricaOre   da chiamare dopo la copia, con la data.
 */
export async function copiaGiornataPrecedente({ data, modoAdmin, idUtente, pulsante, ricaricaOre }) {
    if (!data) return;

    if (pulsante) pulsante.disabled = true;

    try {
        // 1. Chiedi al backend il giorno precedente con ore
        let url = `/api/ore/previous-workday/${data}`;
        if (modoAdmin) url += `?userId=${idUtente}`;

        const res = await apiFetch(url);
        if (!res.ok) throw new Error('Errore ricerca giorno precedente');

        const risposta = await res.json();

        if (!risposta.source_date || !risposta.records || risposta.records.length === 0) {
            mostraModale('Nessun Dato',
                'Non è stato trovato nessun giorno lavorativo precedente con ore registrate (ultimi 60 giorni).',
                [{ text: 'OK', class: 'save-button' }]
            );
            return;
        }

        // 2. Formatta data sorgente per visualizzazione
        const srcDate = new Date(risposta.source_date + 'T00:00:00');
        const srcLabel = `${GIORNI[srcDate.getDay()]} ${srcDate.getDate()} ${MESI[srcDate.getMonth()]}`;

        // 3. Calcola totale ore
        const totalOre = risposta.records.reduce((sum, r) => {
            return sum + (r.ore || 0) + (r.ore_viaggio_andata || 0) + (r.ore_viaggio_ritorno || 0);
        }, 0);

        // 4. Modale di conferma
        mostraModale('📋 Copia Ore',
            `Copiare <strong>${risposta.records.length} attività</strong> (${totalOre}h) da <strong>${srcLabel}</strong>?`,
            [
                { text: 'Annulla', class: 'cancel-button' },
                {
                    text: 'Copia', class: 'save-button',
                    onClick: () => eseguiCopia({
                        records: risposta.records, data, modoAdmin, idUtente, pulsante, ricaricaOre
                    })
                }
            ]
        );

    } catch (e) {
        console.error('❌ Errore copyPreviousWorkday:', e);
        segnala(e);
        mostraModale('Errore',
            'Impossibile recuperare il giorno precedente: ' + e.message,
            [{ text: 'OK', class: 'save-button' }]
        );
    } finally {
        if (pulsante) pulsante.disabled = false;
    }
}

/**
 * Scrive i record sul giorno di destinazione, uno per uno.
 *
 * Privata: la chiama solo il pulsante «Copia» del modale di conferma.
 * Prosegue anche se un record fallisce, e conta: una copia parziale va detta,
 * non trasformata in un errore che nasconde le righe riuscite.
 */
async function eseguiCopia({ records, data, modoAdmin, idUtente, pulsante, ricaricaOre }) {
    if (pulsante) {
        pulsante.disabled = true;
        pulsante.querySelector('span').textContent = '⏳';
    }

    let successCount = 0;
    let errorCount = 0;

    for (const rec of records) {
        try {
            const payload = {
                data,
                id_commessa: rec.id_commessa_fk,
                id_componente: rec.id_componente_fk,
                id_macro_categoria: rec.id_macro_categoria_fk,
                ore: rec.ore || 0,
                note: rec.note || '',
                ore_viaggio_andata: rec.ore_viaggio_andata || 0,
                ore_viaggio_ritorno: rec.ore_viaggio_ritorno || 0,
                str_mattina_dalle: rec.str_mattina_dalle,
                str_mattina_alle: rec.str_mattina_alle,
                str_pomeriggio_dalle: rec.str_pomeriggio_dalle,
                str_pomeriggio_alle: rec.str_pomeriggio_alle,
                assenza_mattina_dalle: rec.assenza_mattina_dalle,
                assenza_mattina_alle: rec.assenza_mattina_alle,
                assenza_pomeriggio_dalle: rec.assenza_pomeriggio_dalle,
                assenza_pomeriggio_alle: rec.assenza_pomeriggio_alle,
                stato: 0
            };

            if (modoAdmin) {
                payload.id_personale_override = idUtente;
            }

            const postRes = await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
            if (postRes.ok) {
                successCount++;
            } else {
                errorCount++;
                console.error('Errore copia record:', await postRes.text());
            }
        } catch (e) {
            errorCount++;
            console.error('Errore copia record:', e);
        }
    }

    // Ripristina pulsante
    if (pulsante) {
        pulsante.disabled = false;
        pulsante.querySelector('span').textContent = '📋';
    }

    // Refresh lista
    ricaricaOre(data);

    // Feedback
    if (errorCount === 0) {
        mostraModale('✅ Copia Completata',
            `${successCount} attività copiate con successo.`,
            [{ text: 'OK', class: 'save-button' }]
        );
    } else {
        mostraModale('⚠️ Copia Parziale',
            `${successCount} copiate, ${errorCount} fallite.`,
            [{ text: 'OK', class: 'save-button' }]
        );
    }
}

/**
 * Riempie e mostra il modale universale con i pulsanti richiesti.
 *
 * Privata: era `_showCopyModal`, e i suoi unici chiamanti sono le due funzioni
 * qui sopra. Non tocca ne' stato ne' `dom`: prende gli elementi per id.
 */
function mostraModale(title, messageHtml, buttons) {
    const overlay = document.getElementById('universal-modal');
    const titleEl = document.getElementById('universal-modal-title');
    const bodyEl = document.getElementById('universal-modal-body');
    const footerEl = document.getElementById('universal-modal-footer');
    const closeBtn = document.getElementById('universal-modal-close');

    if (!overlay) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = messageHtml;
    footerEl.innerHTML = '';

    const closeModal = () => { overlay.style.display = 'none'; };
    closeBtn.onclick = closeModal;

    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.textContent = b.text;
        btn.className = b.class || 'save-button';
        btn.style.cssText = 'padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem;';
        if (b.class === 'cancel-button') {
            btn.style.background = 'var(--col-e2e8f0)';
            btn.style.color = 'var(--col-4a5568)';
        }
        btn.onclick = () => {
            closeModal();
            if (b.onClick) b.onClick();
        };
        footerEl.appendChild(btn);
    });

    overlay.style.display = 'flex';
}
