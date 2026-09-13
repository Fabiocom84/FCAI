// js/leaflet-comune.js
//
// Le due cose che servono a chiunque usi Leaflet in questo progetto: caricarlo
// quando serve davvero, e costruire il segnaposto.
//
// PERCHE' ESISTE (13/09/2026)
// Erano duplicate fra `commesse-geo.js` e `nuova-commessa.js`. Non «simili»:
// `loadLeafletLazy` era identica al 100%, riga per riga; `getMarkerIcon`
// differiva solo per dove teneva la copia dell'icona — una variabile di modulo
// contro `this._markerIcon` — e per una guardia `typeof L !== 'undefined'` che
// una delle due aveva e l'altra no. L'SVG era lo stesso carattere per carattere.
//
// Il costo della duplicazione non e' lo spazio: sono trenta righe. E' che una
// correzione al caricamento di Leaflet va fatta in due posti, e la seconda volta
// ci si dimentica. In questo progetto e' gia' successo con `publicApiFetch`, che
// portava scritto «RETRY LOGIC (COPIATA DA apiFetch)» e nel frattempo aveva
// perso una modifica arrivata solo all'originale.
//
// Delle due versioni e' stata tenuta quella con la guardia su `L`, che e' la
// piu' difensiva: se la libreria non e' ancora caricata restituisce `null`
// invece di sollevare.

let _promessaCaricamento = null;

/**
 * Carica Leaflet (CSS e JS) alla prima richiesta, una volta sola.
 *
 * Risparmia circa 198 KB di analisi dal percorso critico di caricamento della
 * pagina: la mappa la apre una minoranza degli utenti, e chi non la apre non
 * deve pagarla.
 */
export function loadLeafletLazy() {
    if (_promessaCaricamento) return _promessaCaricamento;
    _promessaCaricamento = new Promise((resolve) => {
        if (typeof L !== 'undefined') { resolve(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/libs/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'js/libs/leaflet.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
    return _promessaCaricamento;
}

let _icona = null;

/**
 * Il segnaposto, come SVG in linea.
 *
 * Non dipende dai PNG esterni che Leaflet non riesce a risolvere senza un
 * bundler. Costruito alla prima richiesta, quando `L` esiste.
 */
export function getMarkerIcon() {
    if (!_icona && typeof L !== 'undefined') {
        _icona = L.divIcon({
            className: '',
            html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
                <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z"
                      fill="#2563eb" stroke="#1d4ed8" stroke-width="1.5"/>
                <circle cx="12.5" cy="12.5" r="5" fill="white"/>
            </svg>`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
        });
    }
    return _icona;
}
