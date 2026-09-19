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

# La pulizia non viene riscritta qui: e' la stessa di `identificatori_irrisolti`,
# che la mantiene da quando esiste. Due copie della stessa logica divergono, e
# quella che diverge in silenzio e' sempre la copia meno usata.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from identificatori_irrisolti import ripulisci   # noqa: E402

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

# RIDOTTA DA 14 NOMI A 2, il 19/09/2026, dopo averlo misurato.
#
# Conteneva `http`, `https`, `style`, `background`, `color`, `width`, `height`,
# `margin`, `padding`, `border`, `display`, `font`: nessuna di queste e' una
# parola JavaScript. Erano **proprieta' CSS e URL dentro le stringhe**, che a
# quattro spazi di rientro hanno la forma `    color: rosso` — identica a una
# chiave. La lista non era una regola: era la cicatrice di un controllo che
# leggeva il sorgente grezzo, compilata guardando cosa usciva.
#
# Ora le chiavi si cercano sul codice ripulito dalle stringhe, e la misura dice
# che senza alcuna esclusione le segnalazioni sono ZERO. Tolte.
#
# Restano `default` e `case` perche' sono l'unico caso che la pulizia NON puo'
# risolvere: sono JavaScript vero, non testo dentro una stringa, e uno `switch`
# rientrato di quattro spazi li mette esattamente nella forma di una chiave.
# Oggi non compaiono; restano perche' un giorno un riordino potrebbe portarceli.
NON_CHIAVI = {'default', 'case'}


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

    # DUE LIVELLI DI PULIZIA, e la differenza non e' un dettaglio.
    #
    # `codice` toglie i commenti e TIENE le stringhe: il percorso di un import
    # vive dentro una stringa, e togliendola `from './x.js'` diventa `from ''`.
    # Un controllo sugli import che non vede piu' nessun import riporta
    # «nessun guasto»: sarebbe un falso NEGATIVO al posto di un falso positivo,
    # cioe' un peggioramento travestito da correzione.
    #
    # `nudo` toglie anche le stringhe, e serve alle chiavi duplicate: li' il
    # rumore VIENE dalle stringhe — una regola CSS dentro un template ha la
    # forma `    color: rosso`, identica a una chiave a quattro spazi.
    codice = {n: ripulisci(t, tieni_stringhe=True) for n, t in src.items()}
    nudo = {n: ripulisci(t) for n, t in src.items()}

    # 1 e 2: gli import si risolvono?
    for nome, testo in sorted(codice.items()):
        for dest, nomi in importa(testo):
            if dest not in src:
                guasti.append(f"{nome}: importa './{dest}', che non esiste")
                continue
            mancanti = nomi - esportati(codice[dest])
            for x in sorted(mancanti):
                guasti.append(f"{nome}: importa {{{x}}} da './{dest}', che non lo esporta")

    # 2b: un `export { X }` dove X non e' definito nel modulo.
    #
    # Aggiunto dopo aver provato lo strumento sui guasti VERI del 06/09 invece
    # che solo su casi costruiti: e' esattamente quello che e' successo
    # estraendo la geo — la funzione cancellata, il suo nome rimasto
    # nell'elenco degli export. E' un SyntaxError e la pagina non parte affatto,
    # ma il controllo precedente non lo vedeva perche' guardava solo chi importa.
    # Sul codice ripulito, e qui il verso dell'errore si rovescia: una
    # definizione NOMINATA IN UN COMMENTO — «la vecchia `caricaMappa` stava
    # qui» — contava come definizione e zittiva la segnalazione di un export
    # rimasto orfano. Non un falso allarme: un guasto vero reso invisibile.
    for nome, testo in sorted(codice.items()):
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

    # 3: chiavi duplicate, sul codice senza stringhe (vedi sopra)
    for nome, testo in sorted(nudo.items()):
        for chiave, prima, poi in chiavi_duplicate(testo):
            guasti.append(f"{nome}: '{chiave}' definita due volte (righe {prima} e {poi}); "
                          f"la seconda sovrascrive la prima in silenzio")

    # 4: ogni pagina ha almeno un punto d'ingresso, e i suoi file esistono
    for pagina in sorted(BASE.glob('*.html')):
        for m in TAG.finditer(pagina.read_text(encoding='utf-8', errors='replace')):
            if m.group('file') not in src:
                guasti.append(f"{pagina.name}: il tag punta a js/{m.group('file')}, che non esiste")
    return guasti


def squilibri_div():
    """`<div>` aperti e chiusi che non tornano, pagina per pagina.

    NON BLOCCA IL COMMIT, ed e' una scelta. Un `<div>` non chiuso viene chiuso
    dal browser da qualche parte, e la pagina che gli utenti vedono funziona
    GRAZIE a quel recupero: «correggere» il markup puo' cambiare il rendering.
    Non e' un difetto da sistemare di corsa, e' un lavoro che vuole una verifica
    visiva pagina per pagina.

    Serve invece a renderli VISIBILI e a impedire che se ne aggiungano altri
    senza accorgersene: al 13/09/2026 sono tre — chat.html +1, commesse.html -1,
    dashboard.html +1 — e un quarto vorrebbe dire che qualcosa e' cambiato.
    """
    fuori = []
    for pagina in sorted(BASE.glob('*.html')):
        t = re.sub(r'<!--.*?-->', '', pagina.read_text(encoding='utf-8', errors='replace'), flags=re.S)
        b = len(re.findall(r'<div\b', t)) - len(re.findall(r'</div>', t))
        if b:
            fuori.append((pagina.name, b))
    return fuori


# Ogni caso: (etichetta, {file: contenuto}, spia, DEVE_TROVARLO)
#
# I casi con `False` sono nati il 19/09/2026 e sono la meta' che mancava. Fino a
# quel giorno l'autoprova chiedeva solo «trova i guasti veri?», mai «tace sui
# guasti finti?» — e una sonda che non e' mai stata vista tacere e' cieca quanto
# una che non e' mai stata vista parlare.
#
# La spinta e' arrivata dal collaudo di un rilascio, lo stesso giorno: tre
# segnalazioni su tre erano stringhe trovate DENTRO I MIEI COMMENTI —
# `inline-flex` nella riga in cui spiegavo di averlo TOLTO, `agileViewLegend`
# dentro il commento che documenta la rimozione del pulsante. Cercare una parola
# in un file che contiene anche la prosa su quella parola non e' una verifica.
#
# Il caso `export_definito_SOLO_in_un_commento` e' l'altro verso, ed e' il piu'
# grave dei due: prima del 19/09 una definizione nominata in un commento contava
# come definizione, quindi un export rimasto orfano — che e' un SyntaxError e
# impedisce alla pagina di caricarsi — passava inosservato.
CASI = [
    ('import_di_file_inesistente',
     {'a.js': "import { x } from './non-c-e.js';"},
     'non esiste', True),

    ('import_di_nome_non_esportato',
     {'a.js': "import { manca } from './b.js';\n", 'b.js': "export function c() {}\n"},
     'non lo esporta', True),

    ('chiave_duplicata',
     {'a.js': "const A = {\n    tizio: function () { return 1; },\n"
              "    caio: 2,\n    tizio: function () { return 3; }\n};"},
     'due volte', True),

    ('export_definito_SOLO_in_un_commento',
     {'a.js': "// una volta qui c'era: function orfana() {}\nexport { orfana };\n"},
     "esporta 'orfana'", True),

    ('import_finto_dentro_un_commento',
     {'a.js': "// prima era: import { x } from './non-c-e.js';\nexport const y = 1;\n"},
     'non esiste', False),

    ('chiave_finta_dentro_una_stringa',
     {'a.js': "const A = {\n    stile: `\n    tizio: uno;\n    tizio: due;\n`,\n};"},
     'due volte', False),
]


def autoprova():
    """Ogni controllo, in entrambe le direzioni: deve parlare, e deve tacere.

    Un controllo che non si e' mai visto trovare qualcosa non dice nulla quando
    riporta «nessun guasto» — ed e' la regola che questo progetto ha imparato
    piu' volte, l'ultima con quattro test di sicurezza rimasti verdi per un
    giorno intero senza verificare niente.

    Il verso opposto vale quanto il primo: un controllo che segnala a sproposito
    viene disattivato, o peggio si impara a ignorarlo — e da quel momento non
    protegge piu' nulla continuando a sembrare una difesa.
    """
    import shutil
    import tempfile
    global BASE
    vero = BASE
    esiti = []
    for etichetta, file, spia, atteso in CASI:
        d = pathlib.Path(tempfile.mkdtemp())
        (d / 'js').mkdir()
        for nome, contenuto in file.items():
            (d / 'js' / nome).write_text(contenuto, encoding='utf-8')
        BASE = d
        try:
            trovati = esamina()
        finally:
            BASE = vero
            shutil.rmtree(d, ignore_errors=True)
        visto = any(spia in g for g in trovati)
        esiti.append((etichetta, visto == atteso, atteso, trovati))
    return esiti


if __name__ == '__main__':
    if '--autoprova' in sys.argv:
        print("Ogni controllo in entrambe le direzioni — deve parlare, e deve tacere:")
        esiti = autoprova()
        for etichetta, ok, atteso, trovati in esiti:
            verso = 'deve trovarlo ' if atteso else 'deve TACERE  '
            print(f"   {'OK   ' if ok else 'ROTTO'} {verso} {etichetta:<36} "
                  f"{trovati[0] if trovati else '(nessuna segnalazione)'}")
        sys.exit(0 if all(e[1] for e in esiti) else 2)

    if not all(e[1] for e in autoprova()):
        sys.exit("Sonda inaffidabile: sui casi costruiti apposta non si comporta "
                 "come deve — o non trova i guasti, o ne segnala di inesistenti. "
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

    squilibri = squilibri_div()
    if squilibri:
        print(f"\n  nota, non bloccante — <div> sbilanciati in {len(squilibri)} pagine:")
        for nome, b in squilibri:
            print(f"      {nome}: {b:+d}")
        print("  Un <div> non chiuso viene chiuso dal browser, e la pagina funziona")
        print("  grazie a quel recupero: correggerlo puo' cambiare il rendering, e")
        print("  vuole una verifica visiva. Elencati perche' non se ne aggiungano altri.")
