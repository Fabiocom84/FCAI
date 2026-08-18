// js/shared-ui.js

/**
 * Mostra un modale di conferma personalizzato.
 * @param {object} options - Opzioni per il modale (title, message, etc.)
 * @returns {Promise<boolean>} Risolve a true se l'utente conferma, false altrimenti.
 */
export function showModal(options) {
    return new Promise(resolve => {
        const modal = document.getElementById('universal-modal');
        const overlay = document.getElementById('universal-modal-overlay');
        const titleEl = document.getElementById('universal-modal-title');
        const messageEl = document.getElementById('universal-modal-message');
        const buttonsEl = document.getElementById('universal-modal-buttons');

        // Guard PRIMA di usare modal.querySelector — evita crash se markup mancante
        if (!modal || !overlay || !titleEl || !messageEl || !buttonsEl) {
            console.error('[showModal] Elementi del modale universale non trovati nel DOM.');
            // Fallback: usa confirm nativo del browser
            const ok = window.confirm((options.title ? options.title + '\n' : '') + (options.message || ''));
            return resolve(ok);
        }

        const headerEl = modal.querySelector('.modal-header') || titleEl.parentElement;

        // 1. Reset Stili Base
        if (headerEl !== modal) {
            headerEl.className = 'modal-header';
        } else {
            // Se header == modal, non toccare la classe, rimuovi solo eventuali classi extra aggiunte in precedenza
            headerEl.classList.remove('error-header');
        }
        titleEl.textContent = options.title || 'Attenzione';
        messageEl.textContent = options.message || '';
        buttonsEl.innerHTML = '';

        // 2. Gestione Tipo (Successo, Errore, Warning)
        let confirmBtnClass = 'std-btn std-btn--primary'; // Default Verde (Successo/Azione)
        if (options.type === 'error') {
            confirmBtnClass = 'std-btn std-btn--danger'; // Rosso
            headerEl.classList.add('error-header'); // Opzionale per CSS futuro
        } else if (options.type === 'warning') {
            confirmBtnClass = 'std-btn std-btn--warning'; // Giallo
        }

        // Sovrascrittura manuale classe
        if (options.confirmClass) confirmBtnClass = options.confirmClass;

        // 3. Creazione Pulsante Conferma
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'OK';
        confirmBtn.className = confirmBtnClass;
        confirmBtn.onclick = () => {
            overlay.style.display = 'none';
            resolve(true);
        };
        buttonsEl.appendChild(confirmBtn);

        // 4. Creazione Pulsante Annulla (se richiesto)
        if (options.cancelText) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = options.cancelText;
            cancelBtn.className = 'std-btn std-btn--ghost'; // Grigio/Bianco
            cancelBtn.onclick = () => {
                overlay.style.display = 'none';
                resolve(false);
            };
            buttonsEl.appendChild(cancelBtn);
        }

        overlay.style.display = 'flex';
    });
}

let feedbackModal, countdownInterval, closeTimeout, parentModalToClose;

// Esporta la funzione per renderla importabile
export function showSuccessFeedbackModal(title, message, parentModalId) {
    if (!feedbackModal) {
        feedbackModal = document.getElementById('success-feedback-modal');
    }
    if (!feedbackModal) {
        console.error("Elemento del modale di feedback non trovato!");
        return;
    }

    feedbackModal.querySelector('#feedback-modal-title').textContent = title;
    feedbackModal.querySelector('#feedback-modal-message').textContent = message;
    parentModalToClose = document.getElementById(parentModalId);

    const modalOverlay = document.getElementById('modalOverlay');
    feedbackModal.style.display = 'block';
    if (modalOverlay) modalOverlay.style.display = 'block';

    let seconds = 1;
    const countdownElement = feedbackModal.querySelector('#feedback-modal-countdown');
    countdownElement.textContent = `Questo messaggio si chiuderà tra ${seconds} secondi...`;

    countdownInterval = setInterval(() => {
        seconds--;
        countdownElement.textContent = seconds > 0 ? `Questo messaggio si chiuderà tra ${seconds} secondi...` : '';
        if (seconds <= 0) clearInterval(countdownInterval);
    }, 1000);

    closeTimeout = setTimeout(closeSuccessFeedbackModal, 1000);

    feedbackModal.querySelector('#feedback-modal-close-btn').onclick = closeSuccessFeedbackModal;
    feedbackModal.querySelector('[data-close-feedback]').onclick = closeSuccessFeedbackModal;
}

export function closeSuccessFeedbackModal() {
    clearInterval(countdownInterval);
    clearTimeout(closeTimeout);

    if (feedbackModal) feedbackModal.style.display = 'none';

    const modalOverlay = document.getElementById('modalOverlay');
    const parentModalCloseFunction = parentModalToClose ? window[`close${parentModalToClose.id.charAt(0).toUpperCase() + parentModalToClose.id.slice(1)}`] : null;

    if (parentModalCloseFunction) {
        parentModalCloseFunction();
    } else if (parentModalToClose) {
        parentModalToClose.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
    } else {
        if (modalOverlay) modalOverlay.style.display = 'none';
    }
}

/* =========================================================================
   AVVISI NON BLOCCANTI
   =========================================================================
   Comunicazione di un'operazione riuscita solo in parte: l'azione principale è
   andata a buon fine, qualcosa di accessorio no. Non è un errore — bloccare
   sarebbe sbagliato — ma non è nemmeno un successo silenzioso.

   Caso che ha motivato l'aggiunta (task 1.4): la creazione di una commessa
   esegue due effetti collaterali, l'indicizzazione per l'assistente AI e la
   creazione della task automatica in Gestione Attività. Se uno fallisce, la
   commessa è comunque creata e il backend risponde 201 con un campo `avvisi`.
   Una task mancante è lavoro che nessuno sta tracciando: va detto a chi ha
   appena creato la commessa, che è la persona in grado di rimediare subito.

   PERCHÉ NON RIUSA showToast()
   Ne esistono due copie identiche, in quick-note.js e quick-record.js, ma
   dipendono da due elementi (`qnToast`, `qnToastText`) presenti solo nel markup
   di quei widget: non funzionerebbero altrove. Questa versione costruisce da sé
   ciò che le serve. Le due copie andrebbero ricondotte qui quando si affronterà
   il frontend in modo organico.

   PERCHÉ GLI AVVISI NON SPARISCONO DA SOLI
   showToast() si nasconde dopo 3 secondi. Va bene per una conferma, non per un
   avviso che richiede un'azione: chi stava guardando altrove non lo vedrebbe
   mai, e l'informazione andrebbe persa proprio nel caso in cui serve.
   ========================================================================= */

const CHIAVE_AVVISI_RINVIATI = 'avvisi_in_sospeso';

/**
 * Conserva degli avvisi perché siano mostrati sulla PAGINA SUCCESSIVA.
 *
 * Serve quando l'operazione termina con un cambio pagina: mostrarli prima del
 * redirect equivale a non mostrarli. È il caso della creazione commessa, che
 * porta subito all'elenco.
 */
export function rinviaAvvisi(messaggi) {
    if (!messaggi || !messaggi.length) return;
    try {
        sessionStorage.setItem(CHIAVE_AVVISI_RINVIATI, JSON.stringify(messaggi));
    } catch (e) {
        // Se sessionStorage non è disponibile si perde l'avviso, non la pagina.
        console.warn('Avvisi non conservati:', e);
    }
}

/** Mostra un avviso non bloccante. Resta finché non viene chiuso. */
export function mostraAvviso(messaggio, tipo = 'avviso') {
    const contenitore = _contenitoreAvvisi();

    const elemento = document.createElement('div');
    elemento.className = `avviso avviso-${tipo}`;
    elemento.setAttribute('role', 'status');

    const testo = document.createElement('span');
    testo.textContent = messaggio;

    const chiudi = document.createElement('button');
    chiudi.type = 'button';
    chiudi.className = 'avviso-chiudi';
    chiudi.setAttribute('aria-label', 'Chiudi avviso');
    chiudi.textContent = '×';
    chiudi.addEventListener('click', () => elemento.remove());

    elemento.append(testo, chiudi);
    contenitore.appendChild(elemento);
    return elemento;
}

function _contenitoreAvvisi() {
    let contenitore = document.getElementById('contenitoreAvvisi');
    if (contenitore) return contenitore;

    if (!document.getElementById('stiliAvvisi')) {
        const stile = document.createElement('style');
        stile.id = 'stiliAvvisi';
        stile.textContent = `
            #contenitoreAvvisi { position: fixed; top: 1rem; right: 1rem;
                z-index: 9999; display: flex; flex-direction: column; gap: .5rem;
                max-width: min(420px, calc(100vw - 2rem)); }
            .avviso { display: flex; align-items: flex-start; gap: .75rem;
                padding: .75rem 1rem; border-radius: 8px; font-size: .9rem;
                line-height: 1.4; box-shadow: 0 4px 14px rgba(0,0,0,.15);
                background: #fff8e1; border-left: 4px solid #f0a500; color: #4a3600; }
            .avviso-errore { background: #fdecea; border-left-color: #d93025; color: #5f1b16; }
            .avviso-successo { background: #e8f5e9; border-left-color: #2e7d32; color: #1b3d1e; }
            .avviso-chiudi { margin-left: auto; background: none; border: none;
                font-size: 1.25rem; line-height: 1; cursor: pointer; color: inherit;
                opacity: .6; padding: 0; }
            .avviso-chiudi:hover { opacity: 1; }
        `;
        document.head.appendChild(stile);
    }

    contenitore = document.createElement('div');
    contenitore.id = 'contenitoreAvvisi';
    document.body.appendChild(contenitore);
    return contenitore;
}

/**
 * Mostra gli avvisi rinviati dalla pagina precedente, una volta sola.
 *
 * Viene invocata automaticamente all'import di questo modulo: così ogni pagina
 * che usa shared-ui.js li raccoglie senza doverlo prevedere. Standardizzare qui
 * evita che ogni pagina reinventi il proprio modo di mostrarli — che è il modo
 * in cui, in questo progetto, le implementazioni parallele hanno poi divergiuto.
 */
export function mostraAvvisiInSospeso() {
    let messaggi;
    try {
        const grezzo = sessionStorage.getItem(CHIAVE_AVVISI_RINVIATI);
        if (!grezzo) return;
        sessionStorage.removeItem(CHIAVE_AVVISI_RINVIATI);
        messaggi = JSON.parse(grezzo);
    } catch (e) {
        return;
    }
    (messaggi || []).forEach(m => mostraAvviso(m));
}

// `document` non esiste nel service worker, che pure importa questo file.
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mostraAvvisiInSospeso);
    } else {
        mostraAvvisiInSospeso();
    }
}
