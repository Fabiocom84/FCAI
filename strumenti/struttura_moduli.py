"""
Misura la struttura interna dei file grossi, per decidere DOVE tagliare.

PERCHE NON BASTA CONTARE LE RIGHE
La roadmap propone di dividere `commesse.js` in "grid, detail, filters, form".
E' una proposta ragionevole scritta senza guardare il file. Guardandolo, il
grosso del contenuto e un solo oggetto letterale

    const App = { state: {...}, dom: {...}, metodo() {...}, ... }

Quindi non si spezza un file: si spezza un oggetto. Ogni metodo che usa
`this.state`, `this.dom` o chiama `this.altroMetodo()` porta con se un legame
che va sciolto esplicitamente, e il costo del taglio dipende da quanti sono e
come sono distribuiti — non da quante righe ci sono.

DUE ERRORI DA CUI QUESTO STRUMENTO E' USCITO, il 06/09/2026
La prima versione guardava SOLO dentro l'oggetto, cioe solo le righe rientrate
di quattro spazi. Su questa base ho riferito che «commesse.js non ha giunture
naturali». Era falso: sotto l'oggetto c'erano 489 righe di funzioni di modulo —
l'intero sottosistema mappe — che non toccano `App`, non usano `this`, e hanno
il proprio stato. Era gia un modulo: gli mancava il file. Uno strumento che
guarda in un posto solo non riporta «non ho guardato altrove»: riporta
«non c'e», e la differenza fra le due frasi era il lavoro di una giornata.

La stessa versione misurava la lunghezza come distanza fino al metodo
successivo, e scambiava una CHIAMATA rientrata (`    fai();`) per una
definizione. Insieme, i due difetti producevano numeri gonfiati di 10-25 volte
e due «metodi isolati, estraibili subito» che erano righe di chiamata. La
regola che ne resta: un numero prodotto da uno strumento va guardato finche non
diventa implausibile — `updateCoordsDisplay` a 302 righe per stampare due
coordinate lo era, e l'ho scritto in una relazione prima di verificarlo.

COSA MISURA
Per ogni metodo di primo livello: lunghezza, quali parti dello stato tocca, e
quali altri metodi chiama. Da qui si vedono i grappoli — insiemi di metodi che
parlano fra loro e poco con il resto — che sono i tagli a costo minore.

    python strumenti/struttura_moduli.py js/commesse.js
    python strumenti/struttura_moduli.py js/commesse.js --grappoli
"""
import pathlib
import re
import sys
from collections import defaultdict

# L'USCITA DEVE REGGERE UNA PIPE — aggiunto il 19/09/2026, terzo strumento
# della famiglia a prenderlo. Python scrive nella codifica ANSI del sistema,
# PowerShell legge la pipe in quella OEM: i caratteri fuori ASCII arrivano
# trasformati. Qui il trattino lungo del titolo diventava `ù`.
# La soluzione non e' forzare UTF-8 — renderebbe illeggibili le accentate —
# ma usare ASCII in uscita; `errors='replace'` resta solo come rete, perche'
# sostituire un carattere e' sempre meglio che morire a meta' di un elenco.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(errors='replace')

# Metodo di un oggetto letterale, rientrato di 4 spazi:
#   nome: function (...)   |   nome: async function   |   nome(...) {   |   async nome(
# Parole chiave di JavaScript che a quattro spazi di rientro somigliano a un
# metodo: `if (`, `for (`, `setTimeout(`. Senza questa esclusione lo strumento
# contava 60 metodi in `commesse.js` dove sono 25 — e un conteggio gonfiato
# avrebbe fatto sembrare il file piu frammentato di quanto sia, cioe piu facile
# da dividere. Corretto il 06/09/2026, guardando l'output invece del numero.
NON_METODI = {
    'if', 'else', 'for', 'while', 'switch', 'catch', 'try', 'return', 'do',
    'setTimeout', 'setInterval', 'requestAnimationFrame', 'queueMicrotask',
    'function', 'await', 'typeof', 'new', 'delete', 'throw', 'case', 'with',
}

METODO = re.compile(
    r"^    (?:(?P<a>async)\s+)?(?P<nome>[A-Za-z_$][\w$]*)\s*"
    r"(?::\s*(?:async\s+)?(?:function\s*)?\(|\()"
)

# Funzione di modulo: primo livello, fuori dall'oggetto.
FUNZIONE = re.compile(r"^(?:async\s+)?function\s+(?P<nome>[A-Za-z_$][\w$]*)\s*\(")


def scorri(riga, tonde=0):
    """Rende i caratteri di CODICE di una riga, ciascuno con la profondita di
    tonde a cui si trova. Salta stringhe, template literal e commenti di riga.

    ESISTE PER NON AVERE DUE COPIE DI QUESTA LOGICA. La distinzione fra codice e
    stringa e' sottile — apici, virgolette, backtick, la fuga con `\\` — e
    serviva sia a `fine_metodo` sia, dal 20/09/2026, ad `apre_un_blocco`.
    Scriverla due volte significa che la prossima correzione ne raggiunge una
    sola: e' il modo in cui `publicApiFetch` ha divergito da `apiFetch`.

    LIMITE NOTO, non corretto qui: `dentro` riparte a ogni riga, quindi una
    stringa aperta su una riga e chiusa su quella dopo non e' inseguita fra le
    due. Oggi non produce risposte sbagliate su questo repository — verificato a
    mano su `createTaskCard`, dove le graffe tornano in pari riga per riga — ma
    e' fortuna, non progetto. Inseguirla cambierebbe il comportamento su tutti i
    file insieme, quindi e' un lavoro a parte con le sue prove.
    """
    dentro, fuga, k = None, False, 0
    while k < len(riga):
        c = riga[k]
        if dentro:
            if fuga:
                fuga = False
            elif c == '\\':
                fuga = True
            elif c == dentro:
                dentro = None
        elif c in '"\'`':
            dentro = c
        elif c == '/' and k + 1 < len(riga) and riga[k + 1] == '/':
            return                         # commento di riga: il resto non conta
        else:
            if c == '(':
                tonde += 1
            elif c == ')':
                tonde -= 1
            yield c, tonde
        k += 1


def apre_un_blocco(riga):
    """Distingue una DEFINIZIONE da una CHIAMATA.

    `    updateMapFromInputs();` e `    updateMapFromInputs() {` sono identiche
    per l'espressione regolare: stesso rientro, stesso nome, stessa parentesi.
    La prima e una chiamata dentro un'altra funzione, la seconda sarebbe un
    metodo abbreviato. Senza questo controllo lo strumento ha riportato come
    "metodi isolati, estraibili subito" due righe che erano chiamate — mentre le
    funzioni vere stanno 3 righe sotto, a livello di modulo, e non sono metodi
    di nessun oggetto. Estrarre "il metodo updateCoordsDisplay" avrebbe spostato
    una riga di chiamata lasciando la definizione dov'era.

    REGOLA: e' una definizione se un `{` compare a profondita ZERO di tonde.
    Oppure se le tonde restano aperte, perche i parametri proseguono sotto.

    CORRETTA IL 20/09/2026. Diceva: «la riga finisce con `{`, oppure le tonde
    restano aperte». Un metodo che apre E CHIUDE il corpo sulla stessa riga non
    soddisfa nessuna delle due —

        isLate: function (d) { return new Date(d) < new Date(); },

    — e sparisce dall'elenco dei metodi. Da li' tre effetti a catena: il
    conteggio dei metodi scende di uno; ogni colonna «chiama» perde le chiamate
    verso di lui, perche' la stampa tiene solo i nomi riconosciuti come metodi;
    e `raggiungibilita.py`, che costruisce il grafo su questa funzione, non lo ha
    come nodo — quindi cio' che e' raggiungibile SOLO attraverso di lui risulta
    morto. E' la direzione di danno del difetto del 06/09.

    NON chiude nessun falso positivo, e va detto perche' avevo scritto il
    contrario prima di verificarlo. Su `apriPopupFiltro({ id: 1 });` la regola
    vecchia rispondeva gia' `False`, correttamente: non finisce con `{` e ha una
    tonda aperta e una chiusa. Cercato un caso in cui la vecchia dicesse `True`
    a torto e la nuova `False`: non l'ho trovato. Il guadagno e' uno solo — i
    metodi con il corpo su una riga — piu' il fatto che la regola guarda la
    profondita invece del carattere finale, che e' una ragione di solidita' e non
    una correzione di un guasto osservato.
    """
    tonde = 0
    for c, tonde in scorri(riga):
        if c == '{' and tonde <= 0:
            return True
    return tonde > 0


def fine_metodo(righe, inizio):
    """Fine REALE del metodo, per conteggio di graffe.

    PERCHE NON BASTA "fino al metodo successivo"
    La prima stesura misurava la lunghezza come distanza fino al metodo
    riconosciuto successivo. Quella distanza assorbe tutto cio che sta in mezzo
    e che lo strumento non riconosce: proprieta, oggetti di configurazione,
    codice fuori dall'oggetto. Il risultato erano numeri gonfiati e non
    confrontabili — `getOptimizedImageUrl` risultava di 180 righe per costruire
    un URL, e `updateCoordsDisplay` di 302 righe per scrivere due coordinate.
    Numeri del genere, presi per buoni, avrebbero fatto stimare l'estrazione
    dieci volte piu costosa di quanto e, cioe avrebbero scoraggiato di fare la
    cosa giusta. Corretto il 06/09/2026.

    Le graffe dentro stringhe, template literal e commenti non contano: sono la
    ragione per cui un conteggio ingenuo sbaglia proprio sui metodi che
    costruiscono HTML, che qui sono i piu lunghi.

    NEMMENO LE GRAFFE DENTRO LA LISTA DEI PARAMETRI, ed e' costato caro.
    `fetchData: async function (opts = {}) {` ha un valore predefinito a graffe:
    il conteggio ingenuo apriva e chiudeva su `{}` e dichiarava il metodo lungo
    UNA riga. Tutte le chiamate nel suo corpo — `updateKPIs`, `renderCharts`,
    `renderSidebarFilters`, `fetchGroups` — sparivano dal grafo, e
    `raggiungibilita.py` le riportava come codice morto. Quattro metodi vivi
    dichiarati morti, in un file da cui stavo per proporre cancellazioni.

    E' il verso di errore pericoloso, ed e' l'opposto di quello che avevo
    scritto nella docstring di `raggiungibilita.py`: «sbaglia verso il vivo,
    mai il contrario». Non era una misura, era una convinzione. Corretto il
    06/09/2026 contando anche le tonde: le graffe valgono solo a profondita'
    zero di parentesi, cioe' fuori dalla lista dei parametri.
    """
    livello, tonde, avviato = 0, 0, False
    for i in range(inizio, len(righe)):
        # `tonde` attraversa le righe; la distinzione codice/stringa la fa
        # `scorri`, che dal 20/09/2026 e' condivisa con `apre_un_blocco`.
        for c, tonde in scorri(righe[i], tonde):
            if c == '{' and tonde <= 0:
                livello += 1
                avviato = True
            elif c == '}' and tonde <= 0:
                livello -= 1
                if avviato and livello <= 0:
                    return i + 1           # riga di chiusura inclusa
    return len(righe)


def analizza(percorso):
    righe = pathlib.Path(percorso).read_text(encoding='utf-8', errors='replace').splitlines()

    inizi = [(i, m.group('nome'), 'metodo') for i, r in enumerate(righe)
             if (m := METODO.match(r)) and m.group('nome') not in NON_METODI
             and apre_un_blocco(r)]
    # Le funzioni di modulo sono uno strato SEPARATO, che la prima versione dello
    # strumento non vedeva affatto: guardava solo il rientro di 4 spazi, cioe
    # solo dentro l'oggetto. In `commesse.js` quello strato contiene l'intero
    # sottosistema mappe — ed e li che sta la giuntura vera del file.
    inizi += [(i, m.group('nome'), 'funzione') for i, r in enumerate(righe)
              if (m := FUNZIONE.match(r))]
    inizi.sort()
    if not inizi:
        return None

    voci = []
    for k, (i, nome, genere) in enumerate(inizi):
        limite = inizi[k + 1][0] if k + 1 < len(inizi) else len(righe)
        fine = min(fine_metodo(righe, i), limite)
        corpo = '\n'.join(righe[i:fine])
        voci.append({
            'nome': nome,
            'genere': genere,
            'riga': i + 1,
            'righe': fine - i,
            'stato': len(re.findall(r"this\.state\b", corpo)),
            'dom': len(re.findall(r"this\.dom\b", corpo)),
            # Un metodo chiama con `this.x()`, una funzione di modulo con `x()`.
            'chiama': sorted(
                {m for m in re.findall(r"this\.([A-Za-z_$][\w$]*)\s*\(", corpo)} |
                {m for m in re.findall(r"(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(", corpo)
                 if m not in NON_METODI and m != nome}
            ),
            'api': len(re.findall(r"apiFetch|apiClient\.", corpo)),
        })
    return voci


# --- GUARDIA DI REGRESSIONE ---
def controllo_misura():
    """Verifica che `fine_metodo` misuri davvero, su casi costruiti apposta.

    Esiste per un difetto preciso: un parametro con valore predefinito a graffe
    (`function (opts = {})`) faceva risultare il metodo lungo UNA riga, e le
    chiamate nel suo corpo sparivano dal grafo. Su `dashboard.js` questo ha
    prodotto 390 righe di codice vivo dichiarate morte — in un file da cui
    stavo per proporre cancellazioni.

    Il caso `graffe_nei_parametri` e' quel difetto. Se un giorno torna verde
    per caso, gli altri due dicono se la sonda sia ancora capace di misurare.
    """
    import tempfile
    casi = {
        'semplice': ("""const A = {
    breve: function () {
        return 1;
    },
    altro: function () { return 2; }
};""", 'breve', 3),
        'graffe_nei_parametri': ("""const A = {
    conDefault: async function (opts = {}) {
        const x = opts.a;
        this.altro();
        return x;
    },
    altro: function () { return 2; }
};""", 'conDefault', 5),
        'graffe_in_stringa': ("""const A = {
    conHtml: function () {
        const s = `<div style="a:{b}">`;
        return s;
    },
    altro: function () { return 2; }
};""", 'conHtml', 4),
    }
    esiti = []
    for nome, (sorgente, metodo, atteso) in casi.items():
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                         encoding='utf-8') as f:
            f.write(sorgente)
            percorso = f.name
        v = [x for x in (analizza(percorso) or []) if x['nome'] == metodo]
        ottenuto = v[0]['righe'] if v else None
        esiti.append((nome, atteso, ottenuto, ottenuto == atteso))
    return esiti


def controllo_definizioni():
    """Verifica che `apre_un_blocco` distingua definizione e chiamata, nelle DUE
    direzioni: righe che DEVE riconoscere e righe su cui DEVE tacere.

    PERCHE' IN DUE DIREZIONI. `controllo_misura` qui sopra prova solo le
    lunghezze, e per due settimane non ha visto che un metodo con il corpo tutto
    su una riga non veniva riconosciuto affatto — perche' una lunghezza
    sbagliata la si misura, un metodo ASSENTE dall'elenco no: l'elenco sembra
    completo. Una sonda mai vista trovare qualcosa non prova niente, e una mai
    vista tacere e' cieca allo stesso modo.

    Il caso `corpo_tutto_su_una_riga` e' il difetto del 20/09/2026, ed era
    `isLate` in `attivita.js`. Il caso `chiamata_con_oggetto` e' il falso
    positivo opposto, ed e' la forma di `apriPopupFiltro({...})`.
    """
    casi = [
        ('corpo_sulla_riga_dopo',      '    breve: function () {',                      True),
        ('corpo_tutto_su_una_riga',    '    isLate: function (d) { return d < 1; },',   True),
        ('metodo_abbreviato',          '    breve() {',                                 True),
        ('parametri_che_proseguono',   '    lunga: function (a,',                       True),
        ('graffe_nei_parametri',       '    conDefault: function (opts = {}) {',        True),
        ('chiamata_semplice',          '    aggiorna();',                               False),
        ('chiamata_con_oggetto',       '    apriPopupFiltro({ id: 1 });',               False),
        ('chiamata_con_arrow',         '    lista.forEach(x => { usa(x); });',          False),
        ('graffa_dentro_una_stringa',  "    testo = '{';",                              False),
        ('graffa_dentro_un_commento',  '    aggiorna(); // apre un blocco {',           False),
    ]
    esiti = []
    for nome, riga, atteso in casi:
        ottenuto = apre_un_blocco(riga)
        esiti.append((nome, atteso, ottenuto, ottenuto == atteso))
    return esiti


if __name__ == '__main__':
    if '--autoprova' in sys.argv:
        # Le guardie si eseguono UNA volta e si stampa cio' che ha deciso l'esito.
        # Prima erano due chiamate separate, una per stampare e una per decidere:
        # funzionava, ma stampava un esito e ne giudicava un altro.
        misura = controllo_misura()
        definizioni = controllo_definizioni()

        print("Controllo che la sonda sappia misurare:")
        for nome, atteso, ottenuto, ok in misura:
            print(f"   {'OK  ' if ok else 'ROTTO'} {nome:<24} atteso {atteso}, ottenuto {ottenuto}")

        print("\nControllo che distingua una definizione da una chiamata, nei due versi:")
        for nome, atteso, ottenuto, ok in definizioni:
            verso = 'deve riconoscerla' if atteso else 'deve TACERE      '
            print(f"   {'OK  ' if ok else 'ROTTO'} {verso}  {nome:<26} ottenuto {ottenuto}")

        sys.exit(0 if all(e[3] for e in misura + definizioni) else 2)

    for percorso in [a for a in sys.argv[1:] if not a.startswith('--')]:
        metodi = analizza(percorso)
        if not metodi:
            print(f"{percorso}: nessun metodo riconosciuto (forma diversa?)")
            continue

        nomi = {m['nome'] for m in metodi}
        n_met = sum(1 for m in metodi if m['genere'] == 'metodo')
        n_fun = len(metodi) - n_met
        print(f"\n{'='*74}\n{percorso}  -  {n_met} metodi + {n_fun} funzioni di modulo\n{'='*74}")
        print(f"{'nome':<34}{'righe':>6}{'stato':>7}{'dom':>5}{'api':>5}  chiama")
        for m in sorted(metodi, key=lambda x: -x['righe']):
            interni = [c for c in m['chiama'] if c in nomi]
            segno = ' ' if m['genere'] == 'metodo' else 'ƒ'
            print(f"{segno} {m['nome']:<32}{m['righe']:>6}{m['stato']:>7}{m['dom']:>5}{m['api']:>5}  "
                  f"{', '.join(interni[:4])}{'…' if len(interni) > 4 else ''}")

        # I metodi che NON toccano ne stato ne dom sono i piu facili da estrarre:
        # funzioni pure travestite da metodi.
        puri = [m for m in metodi if m['stato'] == 0 and m['dom'] == 0
                and not [c for c in m['chiama'] if c in nomi]]
        print(f"\n  metodi SENZA legami (estraibili subito): {len(puri)}")
        for m in puri:
            print(f"      {m['nome']} ({m['righe']} righe, riga {m['riga']})")

        if '--grappoli' in sys.argv:
            # Un grappolo: metodi che si chiamano fra loro e non altrove.
            vicini = defaultdict(set)
            for m in metodi:
                for c in m['chiama']:
                    if c in nomi:
                        vicini[m['nome']].add(c)
                        vicini[c].add(m['nome'])
            visti, gruppi = set(), []
            for m in metodi:
                if m['nome'] in visti:
                    continue
                coda, gruppo = [m['nome']], set()
                while coda:
                    n = coda.pop()
                    if n in gruppo:
                        continue
                    gruppo.add(n); visti.add(n)
                    coda.extend(vicini[n] - gruppo)
                gruppi.append(gruppo)
            print(f"\n  GRAPPOLI (insiemi che si chiamano solo fra loro): {len(gruppi)}")
            for g in sorted(gruppi, key=len, reverse=True):
                r = sum(m['righe'] for m in metodi if m['nome'] in g)
                print(f"      {len(g):2d} metodi, {r:5d} righe: {', '.join(sorted(g)[:6])}"
                      f"{'…' if len(g) > 6 else ''}")
