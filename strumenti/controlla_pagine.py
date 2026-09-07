"""Verifica che ogni pagina possa caricarsi: import, export, chiavi duplicate.

PERCHE ESISTE
Il frontend non ha test. Ogni verifica passa da qualcuno che apre le pagine a
mano, e il 06/09/2026 e' andata cosi': otto chiamate a `segnala()` fuori dal
proprio `catch` sono arrivate su staging, e le ha trovate Fabio aprendo una
pagina. Nessun controllo le aveva viste, perche' spostare codice fra file non
produce MAI un errore di sintassi.

COSA CONTROLLA, e perche' proprio questo
Tre difetti che il refactoring produce davvero, tutti a falsi positivi zero
per costruzione — non stimati, ma verificati sul codice reale:

  1. un `import` che punta a un file inesistente;
  2. un `import { X }` dove il modulo di destinazione non esporta piu' `X`
     (SyntaxError al caricamento: la pagina non parte affatto);
  3. due proprieta' con la STESSA chiave nello stesso oggetto letterale.

Il terzo e' il piu' interessante, ed e' il motivo per cui questo strumento non
e' un doppione di un collaudo in browser. `dashboard.js` aveva
`renderSidebarFilters` e `renderGrid` definiti due volte, con corpi DIVERSI: la
seconda chiave sovrascrive la prima in silenzio, quindi 51 righe non giravano e
chi le avesse modificate non avrebbe visto alcun effetto. Nessun errore, nessun
avviso, nessuna console che dica niente. Un browser headless non lo troverebbe
mai; qui e' una riga di codice.

COSA NON CONTROLLA, e va detto
Non apre le pagine, non esegue niente, non vede problemi di comportamento. Il
commutatore Mappa/Lista rotto da uno stile inline — trovato lo stesso giorno —
resta invisibile a questo strumento come a qualunque altro che non guardi.
Copre cio' che il refactoring rompe, non cio' che il codice sbaglia.

    python strumenti/controlla_pagine.py
    python strumenti/controlla_pagine.py --autoprova
"""
import os
import pathlib
import re
import sys

BASE = pathlib.Path(__file__).resolve().parent.parent


def moduli():
    return {p.name: p.read_text(encoding='utf-8', errors='replace')
            for p in (BASE / 'js').glob('*.js')}


IMPORT_DA = re.compile(r"""import\s+(?P<clausola>[^'"]*?)\s*from\s*['"]\./(?P<file>[\w.-]+\.js)['"]""")
IMPORT_DIN = re.compile(r"""import\(\s*['"]\./(?P<file>[\w.-]+\.js)['"]""")
TAG = re.compile(r'<script[^>]*type="module"[^>]*src="js/(?P<file>[\w.-]+\.js)')


def nomi_importati(clausola):
    """I nomi dentro `{ a, b as c }`. Ignora default e namespace: non ci
    interessano, e trattarli come nomi produrrebbe falsi positivi."""
    m = re.search(r'\{([^}]*)\}', clausola)
    if not m:
        return set()
    fuori = set()
    for pezzo in m.group(1).split(','):
        pezzo = pezzo.strip()
        if pezzo:
            fuori.add(pezzo.split(' as ')[0].strip())
    return fuori


def esportati(sorgente):
    """I nomi che un modulo esporta, sia `export function X` sia `export { X }`."""
    n = set(re.findall(r'export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([\w$]+)', sorgente))
    for blocco in re.findall(r'export\s*\{([^}]*)\}', sorgente):
        for pezzo in blocco.split(','):
            pezzo = pezzo.strip()
            if pezzo:
                n.add(pezzo.split(' as ')[-1].strip())
    return n


def importa(sorgente):
    """(file, nomi) per ogni import statico, piu' i file degli import dinamici."""
    fuori = [(m.group('file'), nomi_importati(m.group('clausola')))
             for m in IMPORT_DA.finditer(sorgente)]
    fuori += [(m.group('file'), set()) for m in IMPORT_DIN.finditer(sorgente)]
    return fuori


CHIAVE = re.compile(r'^    ([A-Za-z_$][\w$]*)\s*:', re.M)
# Parole che a quattro spazi di rientro somigliano a una chiave ma non lo sono
# (etichette, `default:` in uno switch, proprieta' CSS in una stringa).
NON_CHIAVI = {'default', 'case', 'http', 'https', 'style', 'background', 'color',
              'width', 'height', 'margin', 'padding', 'border', 'display', 'font'}


def chiavi_duplicate(sorgente):
    """Chiavi ripetute nello stesso oggetto letterale di primo livello.

    Si limita al rientro di quattro spazi — la forma degli `App = {...}` di
    questo progetto — perche' distinguere oggetti annidati richiederebbe un
    parser vero, e un controllo che segnala a sproposito viene disattivato.
    """
    visti, dup = {}, []
    for m in CHIAVE.finditer(sorgente):
        n = m.group(1)
        if n in NON_CHIAVI:
            continue
        riga = sorgente[:m.start()].count('\n') + 1
        if n in visti:
            dup.append((n, visti[n], riga))
        else:
            visti[n] = riga
    return dup


def esamina():
    src = moduli()
    guasti = []

    # 1 e 2: gli import si risolvono?
    for nome, testo in sorted(src.items()):
        for dest, nomi in importa(testo):
            if dest not in src:
                guasti.append(f"{nome}: importa './{dest}', che non esiste")
                continue
            mancanti = nomi - esportati(src[dest])
            for x in sorted(mancanti):
                guasti.append(f"{nome}: importa {{{x}}} da './{dest}', che non lo esporta")

    # 2b: un `export { X }` dove X non e' definito nel modulo.
    #
    # Aggiunto dopo aver provato lo strumento sui guasti VERI del 06/09 invece
    # che solo su casi costruiti: e' esattamente quello che e' successo
    # estraendo la geo — la funzione cancellata, il suo nome rimasto
    # nell'elenco degli export. E' un SyntaxError e la pagina non parte affatto,
    # ma il controllo precedente non lo vedeva perche' guardava solo chi importa.
    for nome, testo in sorted(src.items()):
        definiti = set(re.findall(
            r'(?:^|\s)(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([\w$]+)', testo))
        definiti |= set(re.findall(r'import\s*\{([^}]*)\}', testo)[0].split(',')) \
            if re.findall(r'import\s*\{([^}]*)\}', testo) else set()
        for blocco in re.findall(r'export\s*\{([^}]*)\}', testo):
            for pezzo in blocco.split(','):
                x = pezzo.strip().split(' as ')[0].strip()
                if x and x not in {d.strip().split(' as ')[0].strip() for d in definiti}:
                    guasti.append(f"{nome}: esporta '{x}', che non e' definito nel modulo "
                                  f"(SyntaxError: la pagina non si carica)")

    # 3: chiavi duplicate
    for nome, testo in sorted(src.items()):
        for chiave, prima, poi in chiavi_duplicate(testo):
            guasti.append(f"{nome}: '{chiave}' definita due volte (righe {prima} e {poi}); "
                          f"la seconda sovrascrive la prima in silenzio")

    # 4: ogni pagina ha almeno un punto d'ingresso, e i suoi file esistono
    for pagina in sorted(BASE.glob('*.html')):
        for m in TAG.finditer(pagina.read_text(encoding='utf-8', errors='replace')):
            if m.group('file') not in src:
                guasti.append(f"{pagina.name}: il tag punta a js/{m.group('file')}, che non esiste")
    return guasti


CASI = {
    'import_di_file_inesistente': ("import { x } from './non-c-e.js';", 'non esiste'),
    'import_di_nome_non_esportato': None,      # costruito sotto, servono due file
    'chiave_duplicata': ("const A = {\n    tizio: function () { return 1; },\n"
                         "    caio: 2,\n    tizio: function () { return 3; }\n};", 'due volte'),
}


def autoprova():
    """Ogni controllo, su un caso guasto costruito apposta.

    Un controllo che non si e' mai visto trovare qualcosa non dice nulla quando
    riporta «nessun guasto» — ed e' la regola che questo progetto ha imparato
    piu' volte, l'ultima con quattro test di sicurezza rimasti verdi per un
    giorno intero senza verificare niente.
    """
    import shutil
    import tempfile
    global BASE
    vero = BASE
    esiti = []
    for etichetta, caso in [('import_di_file_inesistente', CASI['import_di_file_inesistente']),
                            ('chiave_duplicata', CASI['chiave_duplicata']),
                            ('import_di_nome_non_esportato', ('IMPORT_NOME', 'non lo esporta'))]:
        d = pathlib.Path(tempfile.mkdtemp())
        (d / 'js').mkdir()
        if caso[0] == 'IMPORT_NOME':
            (d / 'js' / 'a.js').write_text("import { manca } from './b.js';\n", encoding='utf-8')
            (d / 'js' / 'b.js').write_text("export function c() {}\n", encoding='utf-8')
        else:
            (d / 'js' / 'a.js').write_text(caso[0], encoding='utf-8')
        BASE = d
        try:
            trovati = esamina()
        finally:
            BASE = vero
            shutil.rmtree(d, ignore_errors=True)
        visto = any(caso[1] in g for g in trovati)
        esiti.append((etichetta, visto, trovati))
    return esiti


if __name__ == '__main__':
    if '--autoprova' in sys.argv:
        print("Ogni controllo, su un caso guasto costruito apposta:")
        esiti = autoprova()
        for etichetta, visto, trovati in esiti:
            print(f"   {'OK   ' if visto else 'CIECO'} {etichetta:<32} "
                  f"{trovati[0] if trovati else '(non ha trovato nulla)'}")
        sys.exit(0 if all(e[1] for e in esiti) else 2)

    if not all(e[1] for e in autoprova()):
        sys.exit("Sonda cieca: su casi costruiti apposta non trova i guasti. "
                 "Nessun risultato ha valore. Esegui --autoprova.")

    guasti = esamina()
    if guasti:
        print(f"✗ {len(guasti)} problemi che impediscono a una pagina di caricarsi:\n")
        for g in guasti:
            print(f"   {g}")
        sys.exit(1)

    n_mod = len(moduli())
    n_pag = len(list(BASE.glob('*.html')))
    print(f"✓ {n_mod} moduli, {n_pag} pagine: import risolti, export presenti, "
          f"nessuna chiave duplicata.")
    print("  (non apre le pagine: i problemi di comportamento restano fuori portata)")
