/**
 * Prove eseguibili su `js/api-client.js`.
 *
 * PERCHE' ESISTE
 * Il frontend non ha mai avuto un test. Ogni verifica passava da qualcuno che
 * apriva le pagine, e il 06/09/2026 e' andata cosi': otto chiamate a
 * `segnala()` fuori dal proprio `catch` sono arrivate su staging e le ha
 * trovate Fabio aprendo una pagina.
 *
 * `controlla_pagine.py` copre la struttura — import, export, chiavi duplicate —
 * ma non esegue niente. Questo file esegue: sostituisce `window`,
 * `localStorage` e `fetch`, chiama le funzioni vere e guarda COSA FANNO.
 *
 * Serve `api-client.js` in particolare perche' e' il file da cui dipendono 23
 * moduli su 34: un suo difetto non rompe una pagina, le rompe tutte.
 *
 * COSA HA GIA' TROVATO, il primo giorno che e' esistito
 * Sul 401 il logout veniva eseguito TRE volte, con 500ms + 1000ms di attesa fra
 * l'uno e l'altro: `throw new Error("Sessione scaduta")` finiva nel ciclo dei
 * ritentativi, e nessuno gli aveva messo `nonRitentare`. Nessuna rilettura del
 * codice l'aveva notato in settimane; eseguirlo l'ha mostrato in un secondo,
 * stampando tre volte la stessa riga.
 *
 *     node prove/api-client.prova.mjs
 *
 * Non serve rete ne' credenziali: `fetch` e' finto.
 */

// ---- banco di prova -------------------------------------------------------

let redirect = null;
let ripulito = false;
let tentativi = 0;
let ultimaRichiesta = null;

globalThis.window = {
    location: { hostname: 'prova.locale', replace: (u) => { redirect = u; } },
    addEventListener: () => { },
};

globalThis.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = v; },
    removeItem(k) { delete this._d[k]; },
    clear() { ripulito = true; this._d = {}; },
};

function rispondiCon(stato) {
    globalThis.fetch = async (url, config) => {
        tentativi++;
        ultimaRichiesta = { url, headers: config.headers };
        return {
            ok: stato < 400,
            status: stato,
            clone: () => ({ json: async () => ({}), text: async () => 'corpo' }),
            json: async () => ({}),
            text: async () => 'corpo',
        };
    };
}

const { apiFetch, publicApiFetch } = await import('../js/api-client.js');

const esiti = [];

async function caso(nome, prepara, azione, atteso) {
    redirect = null; ripulito = false; tentativi = 0;
    localStorage._d = { session_token: 'TOKEN-DI-PROVA' };
    prepara();
    let errore = null;
    try { await azione(); } catch (e) { errore = e; }

    const osservato = {
        redirect,
        ripulito,
        tokenInviato: !!ultimaRichiesta?.headers?.Authorization,
        tentativi,
        errore: errore ? (errore.stato ?? errore.status ?? errore.message) : null,
    };
    const uguale = JSON.stringify(osservato) === JSON.stringify(atteso);
    esiti.push({ nome, uguale });
    console.log(`  ${uguale ? '✓' : '✗'} ${nome}`);
    if (!uguale) {
        console.log(`      atteso    ${JSON.stringify(atteso)}`);
        console.log(`      osservato ${JSON.stringify(osservato)}`);
    }
}

// ---- i casi ---------------------------------------------------------------

// Il motivo per cui `publicApiFetch` esiste. Una login sbagliata risponde 401:
// col trattamento normale l'utente vedrebbe la pagina ricaricarsi invece del
// messaggio "credenziali errate".
await caso('login sbagliato (401): nessun logout, nessun token, un solo tentativo',
    () => rispondiCon(401),
    () => publicApiFetch('/api/assistente-login', { method: 'POST', body: '{}' }),
    { redirect: null, ripulito: false, tokenInviato: false, tentativi: 1, errore: 401 });

// Il caso che ha trovato il difetto: prima erano 3 tentativi e 1,5 secondi.
await caso('sessione scaduta (401): logout, redirect, UN SOLO tentativo',
    () => rispondiCon(401),
    () => apiFetch('/api/ore'),
    { redirect: 'login.html', ripulito: true, tokenInviato: true, tentativi: 1, errore: 'Sessione scaduta' });

// Un diniego di permesso NON deve disconnettere: distinzione introdotta il
// 17/08/2026, quando ogni 403 legittimo buttava fuori l'utente.
await caso('permesso negato (403): la sessione RESTA valida',
    () => rispondiCon(403),
    () => apiFetch('/api/personale'),
    { redirect: null, ripulito: false, tokenInviato: true, tentativi: 1, errore: 403 });

await caso('errore gateway (503): ritentato fino a 3 volte',
    () => rispondiCon(503),
    () => apiFetch('/api/ore'),
    { redirect: null, ripulito: false, tokenInviato: true, tentativi: 3, errore: 'Server Error 503' });

// 404, 409, 422, 500 devono diventare eccezioni e NON essere ritentati: la
// risposta non cambierebbe e l'utente aspetterebbe tre volte lo stesso rifiuto.
await caso('errore applicativo (409): eccezione, un solo tentativo',
    () => rispondiCon(409),
    () => apiFetch('/api/commesse', { method: 'POST', body: '{}' }),
    { redirect: null, ripulito: false, tokenInviato: true, tentativi: 1, errore: 409 });

await caso('esito riuscito (200): token inviato, nessun effetto sulla sessione',
    () => rispondiCon(200),
    () => apiFetch('/api/ore'),
    { redirect: null, ripulito: false, tokenInviato: true, tentativi: 1, errore: null });

await caso('publicApiFetch non invia il token nemmeno se ce n\'e\' uno in memoria',
    () => rispondiCon(200),
    () => publicApiFetch('/api/assistente-login', { method: 'POST', body: '{}' }),
    { redirect: null, ripulito: false, tokenInviato: false, tentativi: 1, errore: null });

// ---- esito ----------------------------------------------------------------

const passati = esiti.filter(e => e.uguale).length;
console.log(`\n  ${passati}/${esiti.length} casi come attesi`);
process.exit(passati === esiti.length ? 0 : 1);
