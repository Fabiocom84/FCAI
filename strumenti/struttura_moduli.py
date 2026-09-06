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

    Una definizione apre un blocco: la riga finisce con `{`, oppure le parentesi
    tonde restano aperte perche i parametri proseguono sotto. Una chiamata no.
    """
    r = re.sub(r"//.*$", "", riga).rstrip()
    return r.endswith('{') or r.count('(') > r.count(')')


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
    """
    livello, avviato = 0, False
    for i in range(inizio, len(righe)):
        r, k, dentro, fuga = righe[i], 0, None, False
        while k < len(r):
            c = r[k]
            if dentro:
                if fuga:
                    fuga = False
                elif c == '\\':
                    fuga = True
                elif c == dentro:
                    dentro = None
            elif c in '"\'`':
                dentro = c
            elif c == '/' and k + 1 < len(r) and r[k + 1] == '/':
                break                      # commento di riga: il resto non conta
            elif c == '{':
                livello += 1; avviato = True
            elif c == '}':
                livello -= 1
                if avviato and livello <= 0:
                    return i + 1           # riga di chiusura inclusa
            k += 1
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


if __name__ == '__main__':
    for percorso in [a for a in sys.argv[1:] if not a.startswith('--')]:
        metodi = analizza(percorso)
        if not metodi:
            print(f"{percorso}: nessun metodo riconosciuto (forma diversa?)")
            continue

        nomi = {m['nome'] for m in metodi}
        n_met = sum(1 for m in metodi if m['genere'] == 'metodo')
        n_fun = len(metodi) - n_met
        print(f"\n{'='*74}\n{percorso}  —  {n_met} metodi + {n_fun} funzioni di modulo\n{'='*74}")
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
