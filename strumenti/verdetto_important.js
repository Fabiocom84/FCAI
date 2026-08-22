/*
 * Un verdetto per OGNI `!important`, anche quando l'elemento non esiste — task 3.4
 *
 * PERCHÉ SERVE
 * Il metodo precedente (`prova_senza_important.js`) toglie la priorità e guarda
 * cosa cambia nella pagina. È autorevole ma copre solo ciò che è **visibile
 * adesso, con i dati di adesso**: su `registro-presenze.css` ha potuto giudicare
 * 15 regole su 27, perché `.cell-color-red` non compariva nei dati del giorno e
 * il modale del dettaglio era chiuso.
 *
 * Una copertura parziale è insidiosa: la parte non coperta non si distingue da
 * quella funzionante, e "nessuna differenza" si legge come "tutti rimovibili".
 *
 * L'IDEA
 * Non si aspetta che l'elemento compaia: lo si **costruisce**. Per ogni regola
 * con `!important` si sintetizza un elemento che corrisponde al suo selettore,
 * lo si inserisce nel punto giusto dell'albero, e si chiede al browser CHI ALTRO
 * lo colpisce — con `elemento.matches(selettore)`, che è una risposta esatta e
 * non una somiglianza fra stringhe.
 *
 * Non serve nemmeno disegnare la pagina: la domanda è "quali regole competono",
 * e la risolve l'incrocio fra selettori e albero. Per questo è veloce anche su
 * pagine da 1454 elementi, dove misurare gli stili calcolati superava il tempo
 * massimo.
 *
 * IL CRITERIO
 * Un `!important` è NECESSARIO se esiste un'altra regola che:
 *   - imposta la stessa proprietà,
 *   - colpisce lo stesso elemento,
 *   - e vincerebbe senza di esso: specificità maggiore, oppure uguale ma
 *     dichiarata dopo.
 * Se nessuna lo fa, è superfluo.
 *
 * DOVE VA INSERITO L'ELEMENTO DI PROVA, E PERCHÉ CONTA
 * `.modal-body` da solo, appeso al `body`, non verrebbe colpito da
 * `#personnelDetailModal .modal-body`, e concluderemmo "nessuna competizione".
 * Sarebbe falso. Quindi si cerca nell'albero reale l'antenato più profondo che
 * soddisfa un prefisso del selettore, e si costruisce lì sotto solo il pezzo
 * mancante.
 *
 * TRE COSE CHE NON PUÒ DECIDERE, e che dichiara invece di nascondere
 *   1. pseudo-classi di stato (`:hover`, `:checked`...): l'elemento sintetico
 *      non può trovarcisi. Misurate: 6 dichiarazioni su 311.
 *   2. stili inline scritti dal JavaScript: un `!important` può esistere proprio
 *      per batterli, e nessuna analisi dei fogli di stile lo vede. Il progetto
 *      ne ha 229 (vedi Fase 4), quindi il caso è reale.
 *   3. regole di librerie esterne che il progetto non può modificare: la
 *      competizione è vera, ma la soluzione non è togliere il `!important`.
 *
 * USO
 *   verdettoImportant('registro-presenze.css')
 */

async function verdettoImportant(nomeFoglio) {
    function specificita(sel) {
        const s = sel.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, ' ');
        return [(s.match(/#[\w-]+/g) || []).length,
                (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length,
                (s.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length];
    }
    const maggiore = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
    const uguale = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

    // Catalogo di TUTTE le regole caricate, in ordine di dichiarazione: l'ordine
    // decide a parità di specificità, quindi va conservato.
    const tutte = [];
    let ordine = 0;
    for (const foglio of document.styleSheets) {
        const origine = (foglio.href || 'inline').split('/').pop().split('?')[0];
        const esterna = (foglio.href || '').includes('/libs/') || /^https?:/.test(foglio.href || '')
                        && !(foglio.href || '').includes(location.host);
        const percorri = (lista) => {
            for (const r of lista) {
                if (r.cssRules && r.cssRules.length) percorri(r.cssRules);
                if (!r.selectorText || !r.style || !r.style.getPropertyPriority) continue;
                const props = {};
                for (let i = 0; i < r.style.length; i++) {
                    props[r.style[i]] = r.style.getPropertyPriority(r.style[i]) === 'important';
                }
                for (const parte of r.selectorText.split(',').map(x => x.trim())) {
                    if (parte) tutte.push({ sel: parte, props, origine, esterna, ordine: ordine++,
                                            spec: specificita(parte) });
                }
            }
        };
        try { percorri(foglio.cssRules); } catch (e) { /* foglio non leggibile */ }
    }

    // --- costruzione dell'elemento di prova -------------------------------
    const contenitore = document.createElement('div');
    contenitore.style.cssText = 'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden';

    function componiUno(compound) {
        const tag = (compound.match(/^([a-zA-Z][\w-]*)/) || [, 'div'])[1];
        const el = document.createElement(tag);
        for (const m of compound.matchAll(/\.([\w-]+)/g)) el.classList.add(m[1]);
        const id = compound.match(/#([\w-]+)/);
        if (id) el.id = id[1] + '-prova';   // niente id duplicati nell'albero reale
        for (const m of compound.matchAll(/\[([\w-]+)(?:([~|^$*]?=)"?([^\]"]*)"?)?\]/g)) {
            el.setAttribute(m[1], m[3] !== undefined ? m[3] : '');
        }
        return el;
    }

    function costruisci(sel) {
        // pseudo-classi di stato: non riproducibili su un elemento sintetico
        if (/:(hover|focus|active|checked|disabled|invalid|valid|placeholder-shown|target)/.test(sel)) {
            return { nonProvabile: 'pseudo-classe di stato' };
        }
        const pulito = sel.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '');
        const parti = pulito.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
        if (!parti.length) return { nonProvabile: 'selettore vuoto dopo la pulizia' };

        // L'antenato più profondo che esiste già nell'albero reale: senza,
        // i selettori discendenti non troverebbero il contesto e daremmo per
        // "non contese" regole che invece competono.
        let radiceReale = null, daCostruire = parti;
        for (let i = parti.length - 1; i >= 1; i--) {
            const prefisso = parti.slice(0, i).join(' ');
            let trovato = null;
            try { trovato = document.querySelector(prefisso); } catch (e) {}
            if (trovato) { radiceReale = trovato; daCostruire = parti.slice(i); break; }
        }

        let cima = null, corrente = null;
        for (const compound of daCostruire) {
            const el = componiUno(compound);
            if (corrente) corrente.appendChild(el); else cima = el;
            corrente = el;
        }
        return { cima, foglia: corrente, radiceReale };
    }

    // --- verdetto ---------------------------------------------------------
    document.body.appendChild(contenitore);
    const esiti = [];

    for (const regola of tutte) {
        if (regola.origine !== nomeFoglio) continue;
        const conPriorita = Object.keys(regola.props).filter(p => regola.props[p]);
        if (!conPriorita.length) continue;

        const costr = costruisci(regola.sel);
        if (costr.nonProvabile) {
            for (const p of conPriorita)
                esiti.push({ sel: regola.sel, prop: p, verdetto: 'NON PROVABILE', motivo: costr.nonProvabile });
            continue;
        }

        const ospite = costr.radiceReale || contenitore;
        ospite.appendChild(costr.cima);
        const sonda = costr.foglia;

        for (const p of conPriorita) {
            const concorrenti = [];
            for (const altra of tutte) {
                if (altra === regola || !(p in altra.props)) continue;
                let colpisce = false;
                try { colpisce = sonda.matches(altra.sel); } catch (e) {}
                if (!colpisce) continue;
                const vince = altra.props[p] ? true
                    : maggiore(altra.spec, regola.spec)
                      || (uguale(altra.spec, regola.spec) && altra.ordine > regola.ordine);
                if (vince) concorrenti.push({ sel: altra.sel.slice(0, 46), da: altra.origine, esterna: altra.esterna });
            }
            esiti.push({
                sel: regola.sel.slice(0, 52), prop: p,
                verdetto: concorrenti.length ? 'NECESSARIO' : 'superfluo',
                concorrenti: concorrenti.slice(0, 3),
                daLibreria: concorrenti.some(c => c.esterna)
            });
        }

        costr.cima.remove();
    }

    contenitore.remove();

    const necessari = esiti.filter(e => e.verdetto === 'NECESSARIO');
    return {
        foglio: nomeFoglio,
        dichiarazioniEsaminate: esiti.length,
        necessari: necessari.length,
        superflui: esiti.filter(e => e.verdetto === 'superfluo').length,
        nonProvabili: esiti.filter(e => e.verdetto === 'NON PROVABILE').length,
        daLibreriaEsterna: necessari.filter(e => e.daLibreria).length,
        esiti
    };
}
