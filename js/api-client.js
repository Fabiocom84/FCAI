// js/api-client.js

import { API_BASE_URL } from './config.js';

/**
 * Errore restituito dall'API: porta con sé codice e corpo.
 *
 * PERCHÉ ESISTE (22/08/2026)
 * Fino a questa data `apiFetch` restituiva la risposta anche sui 400, 404, 409 e
 * 500, lasciando a ogni chiamante il compito di controllare. Misurato: su 136
 * chiamate, **70 non controllavano** — e fra queste **26 erano scritture**
 * (12 PUT, 10 POST, 4 DELETE). Una scrittura fallita e ignorata significa che
 * l'utente crede di aver salvato qualcosa che non è stato salvato: nessun
 * messaggio, nessun segnale, il dato semplicemente non c'è.
 *
 * PERCHÉ L'ECCEZIONE PORTA IL CORPO
 * Sessantasei chiamanti mostrano un messaggio ricavato dalla risposta, leggendo
 * `.error` o `.message` (13 usi ciascuna). Un'eccezione generica trasformerebbe
 * «Esiste già una manutenzione con questo VO» in «errore imprevisto»: meglio del
 * silenzio, ma non di molto. Con `status` e `corpo` a bordo, i `catch` esistenti
 * possono continuare a dire la cosa giusta.
 */
export class ErroreApi extends Error {
    constructor(status, corpo, endpoint) {
        const testo = (corpo && (corpo.error || corpo.message))
            || `Richiesta non riuscita (HTTP ${status})`;
        super(testo);
        this.name = 'ErroreApi';
        this.status = status;
        this.corpo = corpo;
        this.endpoint = endpoint;
        // Marcatore per il ciclo di ritentativi: un 409 riprovato tre volte è
        // tre volte lo stesso rifiuto, con l'utente che aspetta per nulla.
        this.nonRitentare = true;
    }
}

/**
 * Rete di sicurezza: nessun errore dell'API deve restare invisibile.
 *
 * PERCHÉ QUI E NON IN `shared-ui.js`
 * Da quando `apiFetch` solleva, un chiamante che non intercetta produce una
 * promessa rifiutata e non gestita: senza rete, si torna al silenzio da cui
 * volevamo uscire. Il posto giusto è accanto a ciò che solleva — `api-client.js`
 * arriva a 19 pagine su 21, mentre `shared-ui.js` ne raggiunge 13 e proprio non
 * `admin-config.html`, che da sola contiene 6 delle 26 scritture non controllate.
 *
 * L'avviso si carica con un import dinamico: `shared-ui.js` non importa questo
 * file, ma un import statico creerebbe comunque un vincolo di caricamento fra
 * due moduli che devono restare indipendenti.
 *
 * NON SOSTITUISCE la gestione nei singoli punti: un messaggio generico è meglio
 * del nulla, non è la stessa cosa di «Esiste già una manutenzione con questo VO».
 */
if (typeof window !== 'undefined' && !window.__reteErroriApi) {
    window.__reteErroriApi = true;
    window.addEventListener('unhandledrejection', async (evento) => {
        const errore = evento.reason;
        if (!errore || errore.name !== 'ErroreApi') return;
        console.error(`[API non gestito] ${errore.status} su ${errore.endpoint}`, errore.corpo);
        try {
            const { mostraAvviso } = await import('./shared-ui.js');
            mostraAvviso(errore.message, 'errore');
            evento.preventDefault();   // gestito: non serve il rumore in console
        } catch (e) {
            // `shared-ui.js` non disponibile su questa pagina: meglio un avviso
            // spartano che nessun avviso.
            alert(errore.message);
            evento.preventDefault();
        }
    });
}

/** Legge il corpo dell'errore senza consumare la risposta né sollevare. */
async function corpoErrore(response) {
    try {
        return await response.clone().json();
    } catch (e) {
        try {
            const t = await response.clone().text();
            return t ? { message: t.slice(0, 300) } : null;
        } catch (e2) {
            return null;
        }
    }
}

export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('session_token');

    const headers = {
        ...options.headers
    };

    // Auto-detect JSON content type requirement
    // Se il body non è FormData e non è stato specificato altro Content-Type, assumiamo JSON
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // --- RETRY LOGIC (NUOVO) ---
    // Tentiamo la richiesta fino a 3 volte se fallisce per problemi di rete (non 4xx o 500 applicativi)
    // O se ritorna 502/503/504 (errori gateway/timeout)
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            const response = await fetch(url, config);

            // --- GESTIONE DISCONNESSIONE FORZATA ---
            //
            // 401 = non autenticato: la sessione non vale più, il logout è corretto.
            //
            // 403 = autenticato ma non autorizzato: la sessione è valida e va
            // CONSERVATA. Fino al 17/08/2026 anche il 403 provocava il logout, e
            // il difetto era invisibile perché il frontend chiamava Supabase
            // direttamente e i 403 non arrivavano quasi mai. Con i controlli di
            // ruolo introdotti nella Fase 0, ogni diniego legittimo di permesso
            // buttava fuori l'utente: chi apriva la pagina manutenzioni con un
            // ruolo diverso da Impiegato o Admin veniva disconnesso invece di
            // leggere "non autorizzato". Gli impiegati, che quel ruolo lo hanno,
            // accedono regolarmente.
            //
            // Unica eccezione: l'account disabilitato, che il middleware segnala
            // con 403 e `code: ACCOUNT_DISABLED`. Lì il logout è corretto, perché
            // la sessione non deve più valere. Si riconosce dal codice e non dal
            // testo del messaggio, che può cambiare senza preavviso.
            if (response.status === 401) {
                console.warn("Sessione non valida. Eseguo Logout.");
                localStorage.clear();
                window.location.replace('login.html');
                throw new Error("Sessione scaduta");
            }

            if (response.status === 403) {
                let codice = null;
                try {
                    codice = (await response.clone().json())?.code || null;
                } catch (e) {
                    // corpo non JSON: si tratta come un normale diniego di permesso
                }

                if (codice === 'ACCOUNT_DISABLED') {
                    console.warn("Account disabilitato. Eseguo Logout.");
                    localStorage.clear();
                    window.location.replace('login.html');
                    throw new Error("Accesso revocato");
                }

                // Diniego di permesso: la sessione resta valida, ma l'operazione
                // non si è compiuta. Va segnalato come errore, non restituito
                // come se fosse un esito qualsiasi.
                console.warn(`Operazione non autorizzata: ${response.status} su ${endpoint}`);
                throw new ErroreApi(403, await corpoErrore(response), endpoint);
            }

            // Se è un errore gateway temporaneo (502, 503, 504), lanciamo eccezione per fare retry
            if ([502, 503, 504].includes(response.status)) {
                try {
                    const errText = await response.clone().text();
                    console.error("🔥 Server Error Details (apiFetch):", errText);
                } catch (e) {
                    console.error("Could not read error body", e);
                }
                throw new Error(`Server Error ${response.status}`);
            }

            // Qualunque altro esito non riuscito diventa un'eccezione: 400, 404,
            // 409, 422, 500. Prima venivano restituiti come risposte normali, e
            // metà dei chiamanti non li guardava.
            if (!response.ok) {
                throw new ErroreApi(response.status, await corpoErrore(response), endpoint);
            }

            return response;

        } catch (error) {
            if (error.message === "Accesso revocato") {
                return new Promise(() => { });
            }

            // Gli errori applicativi non si ritentano: la risposta del server
            // non cambierebbe, e l'utente aspetterebbe tre volte lo stesso
            // rifiuto. Si ritenta solo ciò che può riuscire al secondo colpo:
            // guasti di rete e 502/503/504.
            if (error.nonRitentare) {
                throw error;
            }

            // Se abbiamo raggiunto i tentativi massimi, rilanciamo l'errore
            if (attempt >= MAX_RETRIES) {
                console.error(`API Fetch failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }

            // Backoff esponenziale: aspetta 500ms, 1000ms, ...
            const waitTime = 500 * Math.pow(2, attempt - 1);
            console.warn(`Tentativo ${attempt} fallito. Riprovo tra ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}

export async function publicApiFetch(endpoint, options = {}) {
    const headers = {
        ...options.headers
    };
    // Auto-detect JSON content type requirement
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const config = { ...options, headers };
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // --- RETRY LOGIC (COPIATA DA apiFetch) ---
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            const response = await fetch(url, config);

            // Se è un errore gateway temporaneo (502, 503, 504), lanciamo eccezione per fare retry
            if ([502, 503, 504].includes(response.status)) {
                try {
                    const errText = await response.clone().text();
                    console.error("🔥 Server Error Details (publicApiFetch):", errText);
                } catch (e) {
                    console.error("Could not read error body", e);
                }
                throw new Error(`Server Error ${response.status}`);
            }

            // Stessa regola di `apiFetch`: un esito non riuscito è un errore,
            // non una risposta da controllare a discrezione del chiamante.
            if (!response.ok) {
                throw new ErroreApi(response.status, await corpoErrore(response), endpoint);
            }

            return response;

        } catch (error) {
            if (error.nonRitentare) {
                throw error;
            }

            // Se abbiamo raggiunto i tentativi massimi, rilanciamo l'errore
            if (attempt >= MAX_RETRIES) {
                console.error(`Public API Fetch failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }

            // Backoff esponenziale: aspetta 500ms, 1000ms, ...
            const waitTime = 500 * Math.pow(2, attempt - 1);
            console.warn(`Public API Tentativo ${attempt} fallito. Riprovo tra ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}