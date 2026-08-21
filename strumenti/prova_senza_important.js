/*
 * Quali `!important` di un foglio stanno reggendo qualcosa? — task 3.4
 *
 * IL PROBLEMA CHE RISOLVE
 * Restano 375 `!important`, di cui 296 su proprietà di impaginazione. Sapere
 * quali siano davvero necessari non è deducibile leggendo il CSS: il
 * 21/08/2026 tre analisi statiche di fila hanno dato risposte sbagliate, e
 * sempre per lo stesso motivo — indovinavano quali regole competono invece di
 * chiederlo. In CSS la competizione avviene fra selettori DIVERSI che colpiscono
 * lo stesso elemento, e nessun confronto testuale può ricostruirla.
 *
 * L'IDEA
 * Non si modifica il file e non si rilascia niente. Si carica la pagina, si
 * misura, si toglie la priorità alle dichiarazioni **nel CSSOM già caricato**,
 * si rimisura. La differenza è la risposta, ed è quella vera: l'ha calcolata il
 * motore di rendering, non io.
 *
 * Il ciclo "modifica il file, rilascia su staging, aspetta, misura" costava
 * dieci minuti per file e richiedeva di mettere online uno stato rotto. Questo
 * costa pochi secondi e non tocca nulla: la modifica vive nella pagina e sparisce
 * chiudendola.
 *
 * COSA MISURA
 * Colore e impaginazione insieme — un `!important` su `display` non cambia un
 * colore, e guardare solo i colori direbbe "nessuna differenza" su una pagina
 * che si è scomposta.
 *
 * `width` e `height` sono ESCLUSI di proposito: dipendono dal contenuto, e una
 * riga in più nella griglia li farebbe cambiare senza che il CSS c'entri.
 * Restano le proprietà che descrivono una scelta e non un risultato.
 *
 * NON DIMOSTRA CHE SIA SICURO RIMUOVERLI
 * Misura una pagina, con i dati che ha in quel momento, in uno stato soltanto:
 * niente elementi al passaggio del mouse, niente modali aperti, niente
 * validazioni scattate. Un `!important` che regge solo lo stato di errore di un
 * campo risulterà qui "non necessario". È un filtro che restringe il lavoro, non
 * una garanzia — la conferma resta il rilievo completo dopo la modifica.
 *
 * USO
 *   provaSenzaImportant('attivita.css')
 *   provaSenzaImportant('attivita.css', {pagina: '/attivita.html'})
 *
 * Se `pagina` non è indicata, si prova quella corrente.
 */

async function provaSenzaImportant(nomeFoglio, opzioni) {
    opzioni = opzioni || {};

    const COLORE = ['color', 'background-color', 'border-top-color', 'border-right-color',
        'border-bottom-color', 'border-left-color', 'box-shadow', 'fill', 'stroke'];
    const IMPAGINAZIONE = ['display', 'position', 'float', 'overflow', 'box-sizing',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
        'border-radius', 'flex-direction', 'align-items', 'justify-content',
        'text-align', 'font-size', 'font-weight', 'z-index'];
    const PROPRIETA = COLORE.concat(IMPAGINAZIONE);
    const VUOTI = ['rgba(0, 0, 0, 0)', 'transparent', 'none', ''];

    function misura(doc, win) {
        const out = {};
        for (const el of doc.body.querySelectorAll('*')) {
            const c = win.getComputedStyle(el);
            if (c.display === 'none' || c.visibility === 'hidden') continue;
            const cl = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort();
            const firma = el.tagName.toLowerCase() + (cl.length ? '.' + cl.join('.') : '');
            out[firma] = out[firma] || {};
            for (const p of PROPRIETA) {
                const v = c.getPropertyValue(p).trim();
                if (VUOTI.includes(v)) continue;
                (out[firma][p] = out[firma][p] || new Set()).add(v);
            }
        }
        const piatto = {};
        for (const k of Object.keys(out).sort()) {
            piatto[k] = {};
            for (const p of Object.keys(out[k]).sort()) piatto[k][p] = [...out[k][p]].sort().join(' | ');
        }
        return piatto;
    }

    // Si lavora in un iframe anche quando la pagina è quella corrente: così la
    // pagina dell'operatore non viene alterata, e l'esperimento si può ripetere.
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1440px;height:900px;border:0';
    f.src = opzioni.pagina || location.pathname;
    document.body.appendChild(f);
    await new Promise(ok => { f.onload = ok; setTimeout(ok, 15000); });
    await new Promise(r => setTimeout(r, opzioni.attesa || 1800));

    const d = f.contentDocument, w = f.contentWindow;
    const prima = misura(d, w);

    let tolte = 0, fogliTrovati = 0;
    const dichiarazioni = [];
    for (const s of d.styleSheets) {
        if (!(s.href || '').includes(nomeFoglio)) continue;
        fogliTrovati++;
        const scorri = (lista) => {
            for (const r of lista) {
                if (r.cssRules) { scorri(r.cssRules); continue; }
                if (!r.style) continue;
                const props = [];
                for (let i = 0; i < r.style.length; i++) props.push(r.style[i]);
                for (const p of props) {
                    if (r.style.getPropertyPriority(p) !== 'important') continue;
                    dichiarazioni.push({ selettore: r.selectorText, proprieta: p });
                    r.style.setProperty(p, r.style.getPropertyValue(p), '');
                    tolte++;
                }
            }
        };
        try { scorri(s.cssRules); } catch (e) { /* foglio non leggibile */ }
    }

    // Il ricalcolo degli stili è sincrono, ma un frame di margine evita di
    // misurare uno stato intermedio.
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 100)));
    const dopo = misura(d, w);
    f.remove();

    if (!fogliTrovati) {
        return { errore: `nessun foglio caricato corrisponde a "${nomeFoglio}"` };
    }

    const cambiamenti = [];
    for (const firma of new Set([...Object.keys(prima), ...Object.keys(dopo)])) {
        const a = prima[firma] || {}, b = dopo[firma] || {};
        for (const p of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (a[p] !== b[p]) {
                cambiamenti.push({
                    firma, proprieta: p,
                    prima: a[p] || '(assente)', dopo: b[p] || '(assente)',
                    tipo: COLORE.includes(p) ? 'colore' : 'impaginazione'
                });
            }
        }
    }

    return {
        foglio: nomeFoglio,
        pagina: opzioni.pagina || location.pathname,
        dichiarazioniSenzaPriorita: tolte,
        firmeToccate: new Set(cambiamenti.map(c => c.firma)).size,
        cambiamenti: cambiamenti.length,
        diColore: cambiamenti.filter(c => c.tipo === 'colore').length,
        diImpaginazione: cambiamenti.filter(c => c.tipo === 'impaginazione').length,
        // Se è zero, NON significa "si possono rimuovere tutti": significa
        // "nessuno serve in QUESTO stato della pagina". Vedi la nota in testa.
        dettaglio: cambiamenti
    };
}
