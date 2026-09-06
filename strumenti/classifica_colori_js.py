"""
Classifica i colori scritti nel JavaScript per COME vengono usati.

PERCHE NON BASTA CONTARLI
La Fase 3 ha misurato "229 colori nel JavaScript" e li ha rimandati alla Fase 4.
Quel numero dice quanto lavoro c'e, non che lavoro e: la conversione a
`var(--token)` NON e uniforme, e in tre casi e proprio sbagliata.

  style.background = '#fff'      -> `var(--x)` funziona
  `<div style="color:#fff">`     -> funziona (finisce in CSS)
  { backgroundColor: '#fff' }    -> DIPENDE: in un grafico su canvas NO,
                                    perche il canvas non risolve le variabili CSS
  if (colore === '#fff')         -> ROMPEREBBE: il confronto fallirebbe sempre,
                                    e in silenzio

L'ultimo caso e quello che conta. Una conversione a tappeto trasformerebbe un
confronto sempre vero in uno sempre falso senza produrre alcun errore: la
funzione smetterebbe di riconoscere il colore e nessuno saprebbe perche.

Questo strumento non converte niente. Produce l'elenco diviso per categoria, con
il contesto, cosi la conversione si decide guardando i casi invece di indovinare.

    python strumenti/classifica_colori_js.py            # riepilogo
    python strumenti/classifica_colori_js.py --dettaglio # ogni occorrenza
"""
import pathlib
import re
import sys
from collections import Counter, defaultdict

RADICE = pathlib.Path(__file__).resolve().parent.parent
COLORE = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)")

# L'ordine conta: la prima regola che corrisponde vince, e le piu pericolose
# stanno in cima. Meglio classificare per eccesso come "confronto" (che non si
# tocca) che lasciarne sfuggire uno.
REGOLE = [
    ('confronto — NON CONVERTIRE',
     re.compile(r"(===|!==|==|!=)\s*['\"`]?$|includes\(\s*['\"`]$|indexOf\(\s*['\"`]$")),
    ('canvas o grafico — verificare a mano',
     re.compile(r"(backgroundColor|borderColor|fillStyle|strokeStyle|pointBackgroundColor|"
                r"gridColor|tickColor|shadowColor)\s*[:=]\s*['\"`]?$")),
    ('assegnazione a style.*',
     re.compile(r"\.style\.[A-Za-z]+\s*=\s*['\"`]?$|setProperty\([^,]+,\s*['\"`]$")),
    ('dentro una stringa di markup',
     re.compile(r"(style\s*=\s*[\"'][^\"']*|<[a-z]+[^>]*)$", re.I)),
    # Chiave fra virgolette = DATO, non stile. Emerso il 05/09/2026 guardando
    # gli "altro": `attivita.js:200-218` mappa 16 colori Material su categorie di
    # attivita ('Milano', 'Qualita', 'Sicurezza'...). Non sono la tavolozza
    # dell'applicazione, sono identificatori visivi di dati. Trasformarli in
    # token gonfierebbe la tavolozza di 16 valori usati una volta ciascuno, e
    # renderebbe piu difficile — non piu facile — cambiare il colore di una
    # categoria. Distinti da 'proprieta di oggetto' proprio per questo: li la
    # chiave e un identificatore (`backgroundColor:`), qui e una stringa.
    ('mappa di colori su dati — probabilmente NON convertire',
     re.compile(r"['\"][^'\"]+['\"]\s*:\s*['\"`]$")),

    ('attributo SVG (fill / stroke)',
     re.compile(r"(fill|stroke|stop-color|flood-color)\s*=\s*[\"']$", re.I)),

    ('proprieta di oggetto',
     re.compile(r"[A-Za-z_$][\w$]*\s*:\s*['\"`]?$")),
]


def classifica(riga, inizio):
    prima = riga[:inizio].rstrip()
    for nome, schema in REGOLE:
        if schema.search(prima):
            return nome
    return 'altro — da guardare'


def analizza():
    """
    L'analisi sta in una funzione, e non al livello del modulo, perche
    `converte_colori_js` importa `classifica()` per NON ricopiare le regole.
    Con il codice al livello del modulo quell'import eseguiva l'intera analisi
    e ne stampava l'esito in mezzo all'output di un altro strumento: un modulo
    che fa qualcosa quando lo si importa non e riusabile, e' solo eseguibile
    due volte.
    """
    conteggio = Counter()
    per_file = defaultdict(Counter)
    per_colore = Counter()
    dettagli = defaultdict(list)

    for f in sorted((RADICE / 'js').glob('*.js')):
        testo = f.read_text(encoding='utf-8', errors='replace')
        for n, riga in enumerate(testo.splitlines(), 1):
            # Le righe di commento non producono comportamento.
            spoglia = riga.strip()
            if spoglia.startswith('//') or spoglia.startswith('*'):
                continue
            for m in COLORE.finditer(riga):
                categoria = classifica(riga, m.start())
                conteggio[categoria] += 1
                per_file[f.name][categoria] += 1
                per_colore[m.group(0).lower()] += 1
                dettagli[categoria].append((f.name, n, m.group(0), riga.strip()[:110]))

    totale = sum(conteggio.values())
    print(f"colori nel JavaScript: {totale} occorrenze, "
          f"{len(per_colore)} valori distinti, {len(per_file)} file\n")

    print("PER CATEGORIA D'USO")
    for cat, n in conteggio.most_common():
        print(f"  {n:4d}  {cat}")

    print("\nI DIECI FILE PIU CARICHI")
    for nome, c in sorted(per_file.items(), key=lambda x: -sum(x[1].values()))[:10]:
        print(f"  {sum(c.values()):4d}  {nome}")

    print("\nI QUINDICI VALORI PIU RIPETUTI")
    for col, n in per_colore.most_common(15):
        print(f"  {n:4d}  {col}")

    rischiosi = conteggio.get('confronto — NON CONVERTIRE', 0)
    print(f"\n{'='*70}")
    if rischiosi:
        print(f"ATTENZIONE: {rischiosi} occorrenze sono in un CONFRONTO.")
        print("Convertirle a `var(--x)` non produrrebbe un errore: produrrebbe un")
        print("confronto che fallisce sempre. Vanno lasciate stare, o va cambiato")
        print("cio con cui si confrontano — che e una modifica diversa.")
        for f, n, col, riga in dettagli['confronto — NON CONVERTIRE']:
            print(f"    {f}:{n}  {col}\n       {riga}")
    else:
        print("Nessuna occorrenza in un confronto: la conversione non ha")
        print("quel rischio in questo momento. Ricontrollare dopo ogni modifica.")

    if '--dettaglio' in sys.argv:
        for cat in conteggio:
            print(f"\n{'='*70}\n{cat}\n{'='*70}")
            for f, n, col, riga in dettagli[cat]:
                print(f"  {f}:{n}  {col}\n     {riga}")


if __name__ == '__main__':
    analizza()
