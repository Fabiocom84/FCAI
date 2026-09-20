// js/dashboard-grafici.js
//
// Le fabbriche di grafici della Dashboard, estratte da `dashboard.js` il
// 20/09/2026 (task 4.6, secondo taglio).
//
// PERCHE' IL REGISTRO ARRIVA COME `stato` E NON COME `stato.chartInstances`
// Questa e' la decisione che regge tutto il modulo, e non e' una preferenza.
// `disegnaGrafici` comincia cosi':
//
//     Object.values(stato.chartInstances).forEach(c => c && c.destroy());
//     stato.chartInstances = {};        // <-- RIASSEGNAZIONE
//
// La seconda riga non svuota l'oggetto: ne mette uno NUOVO. Il registro quindi
// **cambia identita' a ogni aggiornamento**. Un modulo che ricevesse
// `chartInstances` e se lo tenesse — per esempio col pattern a fabbrica di
// `connessione-ui.js`, che qui verrebbe naturale — continuerebbe a scrivere
// dentro l'oggetto vecchio.
//
// E non fallirebbe subito, che e' il motivo per cui va scritto qui. Al SECONDO
// aggiornamento `disegnaGrafici` scorrerebbe il registro nuovo, lo troverebbe
// vuoto, non distruggerebbe niente, e `new Chart(el)` arriverebbe su una tela
// che ha ancora un grafico vivo attaccato: «Canvas is already in use».
//
// Ricevendo `stato` e dereferenziando `stato.chartInstances` a ogni uso, il
// problema non si pone: si legge sempre il registro corrente.
//
// E' la stessa scelta di `gestione-filtri.js` per il motivo OPPOSTO. La'
// il pericolo era passare una copia dello stato e scrivere in un oggetto che
// nessun altro legge; qui e' tenersi l'originale dopo che e' stato sostituito.
// In entrambi i casi la regola che funziona e' la stessa: si passa l'oggetto
// di stato, non il campo.
//
// DA DOVE ARRIVA `Chart`, visto che non c'e' un import
// Chart.js e' caricato con un tag `<script>` globale in `dashboard.html`, non
// come modulo: `Chart` e' una variabile globale del browser. Non c'e' un
// import da cercare, e non e' una dimenticanza. Lo strumento
// `identificatori_irrisolti.py` lo sa — `Chart` e' nella sua lista `GLOBALI`.
//
// COSA E' PRIVATO E PERCHE'
// `creaGraficoBarre`, `creaGraficoImpilato` e `tavolozza` le chiamava solo
// `disegnaGrafici`, quindi restano qui dentro. `creaGraficoTorta` e
// `creaGraficoBarreOrizzontali` sono esportate perche' le chiama anche
// `renderCommessaAnalysis`, che e' rimasta in `dashboard.js`.

/**
 * Ridisegna i grafici della vista Sintesi, distruggendo i precedenti.
 *
 * @param {object} charts  il ramo `charts` della risposta analytics.
 * @param {object} stato   l'oggetto di stato VERO: `chartInstances` viene
 *                         riassegnato qui dentro (vedi il commento in testa).
 */
export function disegnaGrafici(charts, stato) {
    // Cleanup
    Object.values(stato.chartInstances).forEach(c => c && c.destroy());
    stato.chartInstances = {};
    if (!charts) return;

    const mapData = (list) => ({
        labels: list ? list.map(i => i.label) : [],
        values: list ? list.map(i => i.value) : []
    });

    // Charts per "Sintesi Risorse"
    creaGraficoBarre('chartTimeBar', mapData(charts.time_trend), stato);
    creaGraficoTorta('chartUserPie', mapData(charts.by_user), stato);
    creaGraficoBarreOrizzontali('chartUserBar', mapData(charts.by_user), stato);

    // Stacked Charts (Cross Data)
    creaGraficoImpilato('chartCrossMacroUser', charts.cross_macro_user, 'user', 'category', stato);
    creaGraficoImpilato('chartCrossLavUser', charts.cross_lav_user, 'user', 'category', stato);

    // HR Charts
    creaGraficoTorta('chartAbsenceUser', mapData(charts.absence_by_user), stato);
    creaGraficoBarre('chartAbsenceTrend', mapData(charts.absence_trend), stato, '#e74c3c');
}

/**
 * Grafico a ciambella. Esportata: la chiama anche `renderCommessaAnalysis`.
 */
export function creaGraficoTorta(id, d, stato) {
    rimpiazzaGrafico(id, stato, () => {
        if (!d.labels.length) return null;
        return {
            type: 'doughnut',
            data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: tavolozza(d.labels.length) }] },
            options: { responsive: true, plugins: { legend: { position: 'left', labels: { boxWidth: 10 } } } }
        };
    });
}

/**
 * Barre orizzontali. Esportata: la chiama anche `renderCommessaAnalysis`.
 */
export function creaGraficoBarreOrizzontali(id, d, stato, color = '#3498db') {
    rimpiazzaGrafico(id, stato, () => {
        if (!d.labels.length) return null;
        return {
            type: 'bar',
            data: { labels: d.labels, datasets: [{ label: 'Ore', data: d.values, backgroundColor: color }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        };
    });
}

/**
 * Barre verticali. Privata: la chiama solo `disegnaGrafici`.
 *
 * NON HA LA GUARDIA SUI DATI, e non e' una dimenticanza di questa riscrittura:
 * non l'aveva nemmeno `createBarChart`, sola fra le quattro. Con dati vuoti
 * disegna un grafico vuoto, mentre le altre tre escono e **lasciano a schermo
 * quello del filtro precedente**. Conservata com'era: e' un'asimmetria da
 * decidere, non da correggere di nascosto dentro un refactoring — e a guardarla
 * bene la piu' sospetta delle due condotte e' quella delle altre tre, perche'
 * un grafico vecchio che resta sotto un filtro nuovo si legge come se fosse il
 * risultato del filtro nuovo.
 */
function creaGraficoBarre(id, d, stato, color = '#2ecc71') {
    rimpiazzaGrafico(id, stato, () => ({
        type: 'bar',
        data: { labels: d.labels, datasets: [{ label: 'Ore', data: d.values, backgroundColor: color }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    }));
}

/** Barre impilate, con pivot dei dati. Privata: la chiama solo `disegnaGrafici`. */
function creaGraficoImpilato(id, rawData, xKey, stackKey, stato) {
    rimpiazzaGrafico(id, stato, () => {
        if (!rawData || !rawData.length) return null;

        // 1. Get Unique X Labels (Users)
        const labels = [...new Set(rawData.map(d => d[xKey]))].slice(0, 10); // Limit to top 10 users?

        // 2. Get Unique Stacks (Categories)
        const categories = [...new Set(rawData.map(d => d[stackKey]))];

        // 3. Build Datasets
        const datasets = categories.map((cat, i) => {
            return {
                label: cat,
                data: labels.map(label => {
                    const item = rawData.find(d => d[xKey] === label && d[stackKey] === cat);
                    return item ? item.value : 0;
                }),
                backgroundColor: tavolozza(categories.length)[i]
            };
        });

        return {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } }
            }
        };
    });
}

// PERCHE' ESISTE `rimpiazzaGrafico` — 20/09/2026, in un commit separato da
// quello dell'estrazione, perche' un diff che e' sia un trasloco sia una
// riscrittura non e' rileggibile da nessuno.
//
// Le quattro fabbriche ripetevano la stessa danza: prendi la tela, distruggi il
// grafico che c'era, registra quello nuovo. **Non si unifica per accorciare il
// file** — misurato, il conto delle righe eseguibili e' in pari. Si unifica
// perche' quel protocollo esisteva in quattro copie, ed e' la forma in
// miniatura di `publicApiFetch`: una copia dichiarata di `apiFetch` che
// **divergeva gia'**, perche' il ramo 403 aggiunto il 17/08/2026 non le era mai
// arrivato. Quattro copie di tre righe divergono allo stesso modo, solo piu'
// tardi e su qualcosa di meno visibile.
//
// UNA DIFFERENZA DI COMPORTAMENTO, nominata e non nascosta dentro il
// refactoring. Nell'originale `createStackedChart` distruggeva il grafico
// precedente **prima** di calcolare i propri dati; qui la configurazione si
// costruisce prima, e la distruzione avviene solo se c'e' qualcosa con cui
// rimpiazzare. Si vede solo se la costruzione solleva un'eccezione: prima
// restava una tela vuota, ora resta il grafico vecchio. E' voluta — non si
// distrugge cio' che non si e' in grado di sostituire — ma e' un cambiamento,
// non un refactoring puro.

/**
 * La danza comune alle quattro fabbriche: trova la tela, chiede al chiamante la
 * configurazione, distrugge il grafico che c'era e registra quello nuovo.
 *
 * L'ordine non e' arbitrario. `costruisci()` viene chiamata **prima** della
 * distruzione, cosi' un `null` (dati vuoti) fa uscire senza toccare il registro:
 * e' il comportamento che avevano le tre fabbriche con la guardia sui dati, dove
 * il grafico precedente resta a schermo. Conservato tale e quale, benche' sia
 * proprio la condotta piu' discutibile delle due (vedi `creaGraficoBarre`).
 *
 * @param {string}   id          id della tela nel DOM.
 * @param {object}   stato       l'oggetto di stato: `chartInstances` viene letto
 *                               e scritto qui, e va dereferenziato a ogni uso
 *                               (vedi il commento in testa al file).
 * @param {Function} costruisci  restituisce la configurazione Chart.js, oppure
 *                               `null` se non c'e' niente da disegnare.
 */
function rimpiazzaGrafico(id, stato, costruisci) {
    const el = document.getElementById(id);
    if (!el) return;

    const config = costruisci();
    if (!config) return;

    if (stato.chartInstances[id]) {
        stato.chartInstances[id].destroy();
        delete stato.chartInstances[id];
    }
    stato.chartInstances[id] = new Chart(el, config);
}

/**
 * Tavolozza ciclica. Privata: era `getColors`, e la usano `creaGraficoTorta` e
 * `creaGraficoImpilato` — nominate, perche' «le due qui sopra» ha smesso di
 * essere vero nel momento in cui `rimpiazzaGrafico` si e' infilato in mezzo.
 */
function tavolozza(count) {
    const pal = ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f', '#2ecc71', '#34495e', '#e67e22', '#1abc9c', '#7f8c8d'];
    return Array(count).fill().map((_, i) => pal[i % pal.length]);
}
