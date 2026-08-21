/*
 * Rilievo degli stili calcolati — riferimento per i task 3.1 e 3.2.
 *
 * A COSA SERVE
 * I task 3.1 e 3.2 sostituiscono 1.954 colori scritti a mano con altrettanti
 * riferimenti a variabili CSS. Il criterio di accettazione è che NULLA cambi
 * aspetto. Questo file cattura, prima e dopo, il colore che il browser applica
 * davvero a ogni tipo di elemento: se il confronto è vuoto, la dimostrazione è
 * completa.
 *
 * PERCHÉ NON LE SCHERMATE
 * Un confronto fra immagini dice che una regione è diversa, non quale elemento
 * e quale proprietà. E produce differenze spurie per l'antialiasing dei testi,
 * un cursore che lampeggia, un grafico che si anima. Per una modifica che tocca
 * solo i colori è insieme troppo debole e troppo rumoroso.
 * Le schermate restano necessarie per i task 3.3 e 3.4, che possono spostare
 * gli elementi.
 *
 * LA SCELTA CHE RENDE IL RILIEVO UTILIZZABILE: SI RAGGRUPPA PER CLASSE
 * Registrare ogni singolo elemento sembra più preciso ed è invece inutile: le
 * griglie contengono centinaia di righe che dipendono dai DATI, e i dati
 * cambiano. Un riferimento del genere risulterebbe diverso il giorno dopo per
 * motivi che non c'entrano con il CSS, e imparerebbe a essere ignorato.
 *
 * Qui gli elementi vengono raggruppati per FIRMA — nome del tag più le sue
 * classi in ordine alfabetico — e per ciascuna firma si annota l'INSIEME dei
 * valori osservati. Cinquecento righe della stessa classe diventano una voce.
 * Il risultato dipende dal CSS e non dal contenuto del database.
 *
 * Si annota anche quanti elementi condividono ogni firma: non per confrontarlo
 * (varia con i dati) ma per accorgersi se una firma sparisce del tutto.
 *
 * PROPRIETÀ RILEVATE
 * Solo quelle che portano un colore. Le dimensioni non servono: i task 3.1 e
 * 3.2 non le toccano, e includerle riempirebbe il confronto di differenze
 * causate dalla larghezza della finestra.
 *
 * USO
 *   1. accedere all'applicazione nel browser
 *   2. aprire la pagina da rilevare
 *   3. incollare questo file nella console e chiamare  rilievoStili()
 *      oppure  rilievoStili({scarica: true})  per ottenere un file JSON
 *
 * Non modifica la pagina: legge soltanto.
 */

function rilievoStili(opzioni) {
    opzioni = opzioni || {};

    var PROPRIETA = [
        'color',
        'background-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'outline-color',
        'box-shadow',
        'fill',
        'stroke'
    ];

    // I valori completamente trasparenti sono la condizione predefinita di
    // quasi ogni elemento: registrarli riempirebbe il rilievo di righe che non
    // descrivono alcuna scelta di stile.
    var VUOTI = ['rgba(0, 0, 0, 0)', 'transparent', 'none', ''];

    function firma(el) {
        var classi = (el.getAttribute('class') || '')
            .trim().split(/\s+/).filter(Boolean).sort();
        return el.tagName.toLowerCase() + (classi.length ? '.' + classi.join('.') : '');
    }

    var raccolta = Object.create(null);
    var elementi = document.body ? document.body.querySelectorAll('*') : [];

    for (var i = 0; i < elementi.length; i++) {
        var el = elementi[i];

        // Un elemento non visibile non ha un aspetto da preservare, e i suoi
        // stili calcolati possono essere arbitrari.
        var calcolati = window.getComputedStyle(el);
        if (calcolati.display === 'none' || calcolati.visibility === 'hidden') continue;

        var chiave = firma(el);
        if (!raccolta[chiave]) raccolta[chiave] = { elementi: 0, stili: {} };
        raccolta[chiave].elementi++;

        for (var p = 0; p < PROPRIETA.length; p++) {
            var prop = PROPRIETA[p];
            var valore = calcolati.getPropertyValue(prop).trim();
            if (VUOTI.indexOf(valore) !== -1) continue;
            var insieme = raccolta[chiave].stili[prop] || (raccolta[chiave].stili[prop] = []);
            if (insieme.indexOf(valore) === -1) insieme.push(valore);
        }
    }

    // Ordinamento deterministico: senza, due rilievi identici produrrebbero file
    // diversi e il confronto segnalerebbe differenze inesistenti.
    var chiavi = Object.keys(raccolta).sort();
    var ordinato = Object.create(null);
    for (var k = 0; k < chiavi.length; k++) {
        var voce = raccolta[chiavi[k]];
        var props = Object.keys(voce.stili).sort();
        var stiliOrdinati = Object.create(null);
        for (var q = 0; q < props.length; q++) {
            stiliOrdinati[props[q]] = voce.stili[props[q]].slice().sort();
        }
        ordinato[chiavi[k]] = { elementi: voce.elementi, stili: stiliOrdinati };
    }

    var risultato = {
        pagina: location.pathname.replace(/^.*\//, '') || 'index.html',
        tema: document.documentElement.getAttribute('data-theme') || 'chiaro',
        larghezzaFinestra: window.innerWidth,
        firme: chiavi.length,
        elementiVisibili: elementi.length,
        rilievo: ordinato
    };

    if (opzioni.scarica) {
        var testo = JSON.stringify(risultato, null, 1);
        var blob = new Blob([testo], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'stili_' + risultato.pagina.replace('.html', '')
                   + '_' + risultato.tema + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    return risultato;
}
