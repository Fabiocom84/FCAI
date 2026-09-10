// js/commesse-geo.js
//
// MAPPA GLOBALE delle commesse, estratta da `commesse.js` il 06/09/2026.
// Mostra tutte le commesse su una mappa a schermo intero con elenco laterale
// filtrabile. Ingressi: `setupGeoMapControls()` e `openGeoMap()`.
// Stato di modulo: `geoMap`, `geoMarkersLayer`, `allGeoCommesse`.
//
// PERCHE' QUI E NON IN commesse.js
// Non per lunghezza: questo codice non tocca l'oggetto `App`. Nessun `this`,
// nessun `App.state`, nessun `App.dom` — ha il proprio stato, e il legame con
// la pagina passa da due punti soli (`setupGeoMapControls` chiamata in
// `App.addEventListeners`, e `window.openGeoMap`). Era gia' un modulo: gli
// mancava solo il file.
//
// `window.openGeoMap` resta un globale perche' l'HTML delle card lo invoca da
// un attributo `onclick` inline, generato in `renderCards`. Finche' quella
// stringa esiste, togliere il globale rompe il pulsante Mappa senza che nulla
// lo segnali: `onclick` fallisce in silenzio se la funzione non c'e'.
//
// Il file nasceva con una seconda funzionalita', la geocodifica del form di
// creazione commessa. E' stata rimossa lo stesso giorno: agiva sui campi
// lat/lon di un modale che nessuno apriva piu' da quando `nuova-commessa.html`
// l'ha sostituito. `loadLeafletLazy` e `getMarkerIcon` restano perche' li usa
// anche la mappa globale.

import { apiFetch, segnala } from './api-client.js';
import { showModal } from './shared-ui.js';

// Carica Leaflet CSS+JS on-demand (lazy) al primo utilizzo della mappa.
// Risparmia ~198KB di parsing JS/CSS dal critical path di caricamento pagina.
let _leafletLoadPromise = null;
function loadLeafletLazy() {
    if (_leafletLoadPromise) return _leafletLoadPromise;
    _leafletLoadPromise = new Promise((resolve) => {
        if (typeof L !== 'undefined') { resolve(); return; }
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = 'css/libs/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'js/libs/leaflet.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
    return _leafletLoadPromise;
}

// SVG inline per il marker: non dipende da PNG esterni che Leaflet non riesce a
// risolvere in contesto vanilla (no bundler). Creato lazy al primo utilizzo.
let _leafletMarkerIcon = null;
function getMarkerIcon() {
    if (!_leafletMarkerIcon && typeof L !== 'undefined') {
        _leafletMarkerIcon = L.divIcon({
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
    return _leafletMarkerIcon;
}






// --- GEO MAP FEATURE ---
// Stato del sottosistema. `impostaVistaMobile` e `saltaProssimoAdattamento`
// stavano su `window` fino al 10/09/2026 (task 4.9): non per farsi trovare da
// fuori — nessun altro file li legge — ma solo per attraversare due funzioni
// di questo stesso modulo. Una variabile di modulo fa la stessa cosa senza
// mettere due nomi nello spazio globale di ogni pagina.
let impostaVistaMobile = null;
let saltaProssimoAdattamento = false;
let geoMap = null;
let geoMarkersLayer = null;
let allGeoCommesse = []; // Cache for filtering locally

function setupGeoMapControls() {
    const btnOpenGeoMap = document.getElementById('btn-open-geomap');
    const geoModal = document.getElementById('geoMapModal');
    const geoOverlay = document.getElementById('geoMapModalOverlay');
    const btnCloseGeo = document.getElementById('closeGeoMapBtn');

    if (btnOpenGeoMap) {
        btnOpenGeoMap.addEventListener('click', async () => {
            if (geoModal) geoModal.style.display = 'block';
            if (geoOverlay) geoOverlay.style.display = 'block';
            await loadLeafletLazy();
            setTimeout(() => { initGeoMap(); loadGeoMapData(); }, 200);
        });
    }

    function closeGeoMap() {
        if (geoModal) geoModal.style.display = 'none';
        if (geoOverlay) geoOverlay.style.display = 'none';
    }

    if (btnCloseGeo) btnCloseGeo.addEventListener('click', closeGeoMap);
    if (geoOverlay) geoOverlay.addEventListener('click', closeGeoMap);

    // Mobile Toggles
    const btnShowMap = document.getElementById('btn-show-map');
    const btnShowList = document.getElementById('btn-show-list');
    const modalContent = document.querySelector('#geoMapModal .modal-content');

    const setMobileView = (view) => {
        // view = 'map' or 'list'
        if (view === 'map') {
            modalContent.classList.remove('view-list');
            modalContent.classList.add('view-map');
            if (btnShowMap) btnShowMap.classList.add('active');
            if (btnShowList) btnShowList.classList.remove('active');
            if (geoMap) setTimeout(() => geoMap.invalidateSize(), 150);
        } else {
            modalContent.classList.remove('view-map');
            modalContent.classList.add('view-list');
            if (btnShowList) btnShowList.classList.add('active');
            if (btnShowMap) btnShowMap.classList.remove('active');
        }
    };

    if (btnShowMap) btnShowMap.addEventListener('click', () => setMobileView('map'));
    if (btnShowList) btnShowList.addEventListener('click', () => setMobileView('list'));

    // Sidebar Search
    const searchInput = document.getElementById('geomap-search-labels');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.geomap-label-item');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                const dataset = item.dataset.search || '';
                // Search in text content AND dataset (names)
                item.style.display = (text.includes(term) || dataset.includes(term)) ? 'flex' : 'none';
            });
        });
    }

    // Expose for sidebar
    impostaVistaMobile = setMobileView;
}

function initGeoMap() {
    if (geoMap) {
        geoMap.invalidateSize();
        return;
    }

    if (typeof L === 'undefined') return;

    // Use a different container ID: geoMapFullContainer
    geoMap = L.map('geoMapFullContainer').setView([41.8719, 12.5674], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(geoMap);

    geoMarkersLayer = L.layerGroup().addTo(geoMap);

    // Default Mobile View: Map
    const modalContent = document.querySelector('#geoMapModal .modal-content');
    if (modalContent && window.innerWidth <= 768) {
        modalContent.classList.add('view-map');
    }
}

async function loadGeoMapData() {
    try {
        const res = await apiFetch('/api/commesse/geo-map');
        if (res.ok) {
            allGeoCommesse = await res.json();
            renderGeoMapSidebar(); // Build filters
            renderGeoMapMarkers(allGeoCommesse); // Show all initially
        }
    } catch (e) {
        console.error("GeoMap Fetch Error", e);
        segnala(e);
    }
}

function renderGeoMapMarkers(list) {
    if (!geoMarkersLayer) return;
    geoMarkersLayer.clearLayers();

    if (list.length === 0) return;

    const bounds = L.latLngBounds();

    // Icona arancione per posizioni approssimative (SVG inline, no PNG esterni)
    const orangeIcon = L.divIcon({
        className: '',
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
            <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z"
                  fill="var(--col-e67e22)" stroke="var(--col-d35400)" stroke-width="1.5"/>
            <circle cx="12.5" cy="12.5" r="5" fill="white"/>
        </svg>`,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
    });

    list.forEach(c => {
        if (c.latitudine && c.longitudine) {
            const markerOptions = c.posizione_esatta ? { icon: getMarkerIcon() } : { icon: orangeIcon };
            const marker = L.marker([c.latitudine, c.longitudine], markerOptions);

            // Build Popup
            let popupContent = `<div style="font-family: Roboto, sans-serif;">`;
            popupContent += `<b style="color:var(--col-2c3e50); font-size:1.1em;">${c.impianto || 'Impianto'}</b>`;
            if (!c.posizione_esatta) {
                popupContent += ` <span style="font-size:1.2em;" title="Posizione Approssimativa">⚠️</span>`;
            }
            popupContent += `<br>`;
            if (c.clienti && c.clienti.ragione_sociale) {
                popupContent += `<span style="color:var(--col-7f8c8d); font-size:0.9em;">${c.clienti.ragione_sociale}</span><br>`;
            }
            // Helper Link
            //  popupContent += `<a href="#" style="color:#3498db; text-decoration:none; font-size:0.85em; margin-top:5px; display:inline-block;">Vedi Dettaglio</a>`;
            popupContent += `</div>`;

            marker.bindPopup(popupContent);
            geoMarkersLayer.addLayer(marker);
            bounds.extend([c.latitudine, c.longitudine]);
        }
    });

    if (list.length > 0 && !saltaProssimoAdattamento) {
        geoMap.fitBounds(bounds, { padding: [50, 50] });
    }
    // Reset flag immediately after check so next manual open works
    saltaProssimoAdattamento = false;
}

function renderGeoMapSidebar() {
    const listContainer = document.getElementById('geomap-labels-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    // Sort by Impianto Name
    const sortedList = [...allGeoCommesse].sort((a, b) => {
        const nameA = (a.impianto || '').toLowerCase();
        const nameB = (b.impianto || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    let activeItem = null;

    // Helper to create items
    const createItem = (commessa) => {
        const div = document.createElement('div');
        div.className = 'geomap-label-item';
        // Put searchable content in dataset if needed, or rely on textContent
        const impianto = commessa.impianto || 'Impianto Sconosciuto';
        const cliente = commessa.clienti?.ragione_sociale || '';

        // Custom search handling logic will look at textContent
        div.style.cssText = 'padding: 12px 15px; cursor: pointer; border-bottom: 1px solid var(--col-eeeeee); display: flex; flex-direction: column; transition: background 0.2s;';

        div.innerHTML = `
            <span style="font-weight:500; color:var(--col-2c3e50); font-size: 0.95em;">${impianto}</span>
            <span style="font-size: 0.8em; color:var(--col-7f8c8d); margin-top: 2px;">${cliente}</span>
        `;

        div.onmouseover = () => { if (div !== activeItem) div.style.background = '#f5f6fa'; };
        div.onmouseout = () => { if (div !== activeItem) div.style.background = 'transparent'; };

        div.onclick = () => {
            if (activeItem) activeItem.style.background = 'transparent';
            activeItem = div;
            div.style.background = '#e1f5fe'; // Selected

            // Auto-switch to map on mobile
            if (window.innerWidth <= 768 && impostaVistaMobile) {
                impostaVistaMobile('map');
            }

            // Fly to marker
            if (geoMap && commessa.latitudine && commessa.longitudine) {
                // If zoom is low, zoom in. If already distinct, maybe keep zoom? 
                // Suggestion: Fly to specific high zoom
                geoMap.flyTo([commessa.latitudine, commessa.longitudine], 16, {
                    duration: 1.5
                });

                // Open popup if marker exists in layer
                geoMarkersLayer.eachLayer(layer => {
                    const latlng = layer.getLatLng();
                    // Check coords with small tolerance
                    const tolerance = 0.00001;
                    if (Math.abs(latlng.lat - commessa.latitudine) < tolerance &&
                        Math.abs(latlng.lng - commessa.longitudine) < tolerance) {

                        layer.openPopup();
                    }
                });
            }
        };
        return div;
    };

    sortedList.forEach(c => {
        listContainer.appendChild(createItem(c));
    });
}

// [NEW] EXPOSED FUNCTION FOR QUICK ACTIONS
function openGeoMap(commessaId, lat, lon, encImpianto, encCliente) {
    // 1. Check coordinates validity
    if (!lat || !lon || lat === 'null' || lon === 'null') {
        showModal({ title: "Info", message: "Questa commessa non ha coordinate geografiche impostate." });
        return;
    }

    // Decode names (if passed)
    const impianto = encImpianto ? decodeURIComponent(encImpianto) : 'Impianto';
    const cliente = encCliente ? decodeURIComponent(encCliente) : '';

    // 2. Open Modal
    const btnOpenGeoMap = document.getElementById('btn-open-geomap');
    if (btnOpenGeoMap) {
        saltaProssimoAdattamento = true; // [FIX] Prevent fitBounds from resetting view
        btnOpenGeoMap.click();
    }

    // 3. Wait for Map Init and Transition
    setTimeout(() => {
        if (geoMap) {
            // CRITICAL: Fix Leaflet render issues when showing hidden map
            geoMap.invalidateSize();

            // 4. Fly to coords
            geoMap.flyTo([lat, lon], 16, { duration: 1.0 });

            // 5. Add Explicit Marker (Red/Highlighted)
            setTimeout(() => {
                if (geoMarkersLayer) {
                    const highlightMarker = L.marker([lat, lon], {
                        icon: getMarkerIcon(),
                        zIndexOffset: 1000
                    }).addTo(geoMap);

                    let popupContent = `<div style="font-family: Roboto, sans-serif;">`;
                    popupContent += `<b style="color:var(--col-2c3e50); font-size:1.1em;">${impianto}</b><br>`;
                    if (cliente) {
                        popupContent += `<span style="color:var(--col-7f8c8d); font-size:0.9em;">${cliente}</span><br>`;
                    }
                    popupContent += `</div>`;

                    highlightMarker.bindPopup(popupContent).openPopup();
                }
            }, 300);
        }
    }, 600);
}

// Expose to App scope if needed, or window
window.openGeoMap = openGeoMap;

export { setupGeoMapControls, openGeoMap };
