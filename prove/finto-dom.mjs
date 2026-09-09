/**
 * Un DOM finto, ridotto all'osso.
 *
 * PERCHE' NON jsdom
 * Sulla macchina del proprietario non c'e' `node`, quindi non c'e' `npm`, e la
 * CI e' stata costruita apposta per non dipendere da installazioni locali.
 * Aggiungere una dipendenza per provare quattro funzioni sarebbe una
 * complicazione che nessuno terra' aggiornata.
 *
 * COSA COPRE E COSA NO — va saputo prima di fidarsi di una prova che passa.
 * Qui non c'e' rendering, non c'e' layout, non c'e' propagazione di eventi.
 * `element.style.display = 'none'` scrive in un oggetto, non nasconde niente.
 * Serve a rispondere a domande di LOGICA — «quale funzione viene chiamata?»,
 * «con quale nome?» — non a domande di aspetto. Il commutatore Mappa/Lista
 * rotto da uno stile inline, trovato il 06/09, resterebbe invisibile anche qui.
 */

export function elemento(id = '', attributi = {}) {
    const el = {
        id,
        style: {},
        textContent: '',
        innerHTML: '',
        className: '',
        onclick: null,
        dataset: {},
        _figli: new Map(),
        classList: {
            _v: new Set(),
            add(c) { this._v.add(c); },
            remove(c) { this._v.delete(c); },
            contains(c) { return this._v.has(c); },
        },
        querySelector(sel) {
            if (!this._figli.has(sel)) this._figli.set(sel, elemento(sel));
            return this._figli.get(sel);
        },
        querySelectorAll() { return []; },
        addEventListener() { },
        appendChild() { },
        remove() { },
        ...attributi,
    };
    return el;
}

/**
 * Installa `document`, `sessionStorage`, `localStorage` e `window` globali.
 * @param {object} elementiPerId  mappa id -> elemento (usa `elemento()`)
 * @returns {object} `registro`, con cio' che e' stato osservato
 */
export function installa(elementiPerId = {}) {
    const registro = { creati: [], chiamate: [] };

    globalThis.document = {
        readyState: 'complete',
        head: elemento('head'),
        body: elemento('body'),
        getElementById(id) {
            registro.chiamate.push(`getElementById(${id})`);
            return elementiPerId[id] ?? null;
        },
        querySelector(sel) { return elementiPerId[sel] ?? null; },
        querySelectorAll() { return []; },
        createElement(tag) {
            const el = elemento('', { tagName: tag });
            registro.creati.push(tag);
            return el;
        },
        addEventListener() { },
    };

    const deposito = () => ({
        _d: {},
        getItem(k) { return this._d[k] ?? null; },
        setItem(k, v) { this._d[k] = String(v); },
        removeItem(k) { delete this._d[k]; },
        clear() { this._d = {}; },
    });
    globalThis.sessionStorage = deposito();
    globalThis.localStorage = deposito();

    globalThis.window = globalThis.window ?? {};
    Object.assign(globalThis.window, {
        location: { hostname: 'prova.locale', replace() { } },
        addEventListener() { },
        confirm: () => true,
    });

    return registro;
}
