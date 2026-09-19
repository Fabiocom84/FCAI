// js/gestione-filtri.js
//
// Il popup dei filtri per colonna della pagina Gestione, estratto da
// `gestione.js` il 19/09/2026 (task 4.4, secondo taglio).
//
// PERCHE' QUESTI TRE INSIEME
// `openColumnFilterPopup` (42 righe), `renderFilterPopup` (97) e
// `closeColumnFilterPopup` (6) formano un sottosistema chiuso: si chiamano
// solo fra loro, e verso il resto del file hanno **una sola** dipendenza —
// ricaricare i dati dopo che un filtro e' cambiato. Misurato con
// `strumenti/struttura_moduli.py`.
//
// `renderFilterPopup` non e' esportata: era chiamata solo da
// `openColumnFilterPopup`, quindi qui diventa privata e sparisce dalla
// superficie di `App`. Ventotto metodi diventano venticinque.
//
// E' PIU' DELICATO DELL'ESTRAZIONE DI `exportToXlsx`, e va detto.
// Quella leggeva lo stato e usciva. Questa lo **scrive**: `activeFilters`
// cambia qui dentro. Per questo `stato` arriva come oggetto e non come copia
// dei campi — la scrittura deve avvenire sullo STESSO oggetto che gli altri
// ventiquattro metodi leggono. Passare `{...stato}` avrebbe funzionato in
// apparenza: il popup si sarebbe chiuso, la tabella si sarebbe ricaricata, e
// il filtro non avrebbe filtrato niente.

import { apiFetch } from './api-client.js';

/** Toglie il popup dal DOM, se c'e'. Nessuno stato, nessuna dipendenza. */
export function chiudiPopupFiltro() {
    const existingPopup = document.querySelector('.column-filter-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
}

/**
 * Apre il popup dei filtri sotto l'icona di una colonna.
 *
 * @param {object}   o
 * @param {Element}  o.iconElement   l'icona cliccata: da' la posizione.
 * @param {string}   o.columnKey     la colonna da filtrare.
 * @param {object}   o.config        configurazione della vista corrente.
 * @param {string}   o.vista         nome della vista, usato come nome tabella
 *                                   quando `config.tableName` non c'e'.
 * @param {object}   o.stato         l'oggetto di stato VERO: `activeFilters`
 *                                   viene modificato qui dentro.
 * @param {Function} o.ricaricaDati  da chiamare dopo aver cambiato un filtro.
 */
export async function apriPopupFiltro({ iconElement, columnKey, config, vista, stato, ricaricaDati }) {
    chiudiPopupFiltro();

    const columnConfig = config.columns.find(c => c.key === columnKey);
    const filterOptions = columnConfig.filterOptions;

    const popup = document.createElement('div');
    popup.className = 'column-filter-popup';
    popup.dataset.column = columnKey; // Memorizza la colonna a cui si riferisce
    document.body.appendChild(popup);

    const rect = iconElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 5 + window.scrollY}px`;
    popup.style.left = `${rect.right + window.scrollX - popup.offsetWidth}px`;
    popup.style.visibility = 'visible';
    popup.innerHTML = `<div class="loader-small"></div>`;

    try {
        let optionsData;
        // SE la colonna ha una configurazione di filtro avanzata, usala.
        if (filterOptions && filterOptions.apiEndpoint) {
            const response = await apiFetch(filterOptions.apiEndpoint);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            optionsData = await response.json();
        }
        // ALTRIMENTI, usa il vecchio metodo generico.
        else {
            const filterKey = filterOptions?.key || columnKey;
            const tableNameForApi = config.tableName || vista;
            const response = await apiFetch(`/api/distinct/${tableNameForApi}/${filterKey}`);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            optionsData = await response.json();
        }

        disegnaPopupFiltro(popup, optionsData, columnKey, filterOptions, stato, ricaricaDati);

    } catch (error) {
        console.error("Errore durante il recupero delle opzioni di filtro:", error);
        popup.innerHTML = `<div class="error-text">Errore filtri</div>`;
    }
}

/**
 * Riempie il popup: ricerca interna, caselle, pulsanti Applica e Pulisci.
 * Privata — la chiamava solo `apriPopupFiltro`.
 */
function disegnaPopupFiltro(popupElement, options, columnKey, filterOptions, stato, ricaricaDati) {
    const searchFilter = document.createElement('input');
    searchFilter.type = 'text';
    searchFilter.placeholder = 'Filtra opzioni...';
    searchFilter.className = 'filter-search-input';

    const optionsList = document.createElement('div');
    optionsList.className = 'filter-options-list';

    const filterKey = filterOptions?.key || columnKey;
    const activeFilterValues = (stato.activeFilters[filterKey] || []).map(String);

    options.forEach(option => {
        let value, text;

        // SE abbiamo opzioni complesse (ID + Testo), estrai i valori corretti.
        if (filterOptions && filterOptions.valueField && filterOptions.textField) {
            value = option[filterOptions.valueField];
            text = option[filterOptions.textField];
        }
        // ALTRIMENTI, valore e testo sono la stessa cosa.
        else {
            value = option;
            text = option;
        }

        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'filter-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-${columnKey}-${value}`;
        checkbox.value = value;
        checkbox.checked = activeFilterValues.includes(String(value));

        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.textContent = text;

        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(label);
        optionsList.appendChild(checkboxWrapper);
    });

    // La logica per la ricerca interna, i pulsanti e gli eventi rimane invariata...
    let searchTimeout;
    searchFilter.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase();
            optionsList.querySelectorAll('.filter-option').forEach(opt => {
                const label = opt.querySelector('label').textContent.toLowerCase();
                opt.style.display = label.includes(searchTerm) ? 'flex' : 'none';
            });
        }, 300);
    });

    const footer = document.createElement('div');
    footer.className = 'filter-popup-footer';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Applica';
    applyBtn.className = 'button button--primary';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Pulisci';
    clearBtn.className = 'button';

    applyBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const selectedOptions = Array.from(optionsList.querySelectorAll('input:checked')).map(cb => cb.value);

        if (selectedOptions.length > 0) {
            stato.activeFilters[filterKey] = selectedOptions;
        } else {
            delete stato.activeFilters[filterKey];
        }

        ricaricaDati();
        chiudiPopupFiltro();
    });

    clearBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        delete stato.activeFilters[filterKey];
        ricaricaDati();
        chiudiPopupFiltro();
    });

    footer.appendChild(clearBtn);
    footer.appendChild(applyBtn);

    popupElement.innerHTML = '';
    popupElement.appendChild(searchFilter);
    popupElement.appendChild(optionsList);
    popupElement.appendChild(footer);
}
