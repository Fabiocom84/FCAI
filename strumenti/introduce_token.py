"""
Task 3.1 — sostituisce i colori scritti a mano con riferimenti a variabili CSS.

COSA FA, ED È DELIBERATAMENTE POCO
Un token per ogni colore DISTINTO già presente, e nient'altro. Nessun
accorpamento, nessuna scelta cromatica, nessun nome inventato. Il criterio di
riuscita è che le pagine risultino **identiche**, e qualunque accorpamento —
anche fra due bianchi che differiscono di un punto su 255 — lo violerebbe.

I NOMI SONO DERIVATI DAL VALORE, NON DAL RUOLO
`--col-2a3a5a`, non `--bordo-scuro`. Sembra un peggioramento ed è una scelta:

  * un nome semantico è un'IPOTESI sull'intenzione di chi ha scritto quel
    colore, e in un file dove `#2a3a5a` compare 61 volte in file diversi
    l'intenzione non è documentata da nessuna parte;
  * un nome sbagliato è peggio di nessun nome, perché verrà creduto;
  * questo passaggio deve essere verificabile in modo meccanico, e un nome
    derivato dal valore lo è: si controlla che `--col-2a3a5a` valga `#2a3a5a`.

I nomi semantici arrivano nel task 6.6, insieme al consolidamento della
tavolozza, che è il momento in cui le scelte si fanno apposta. Per aiutarlo,
ogni token porta in commento quante volte è usato e su quali proprietà: è
l'informazione che serve a decidere, raccolta ora che è a costo zero.

COSA RESTA FUORI DA QUESTO PASSAGGIO
  * le funzioni `rgb()`/`rgba()` — 190 occorrenze, 59 distinte, quasi tutte
    ombre e velature. Hanno un canale alfa e si comportano diversamente;
    vanno affrontate a parte, dopo che questo passaggio è verificato.
  * i 229 colori scritti dentro il JavaScript, che nessuna variabile CSS può
    raggiungere: sono stili inline, e la correzione è di Fase 4.

Dichiararlo qui evita di credere completato un lavoro che copre il 90% delle
occorrenze e non il 100%.

IL BLOCCO `:root` VA IN UN FILE NUOVO, NON IN `style-v2.css`
Non per eleganza: per la cache. Le 21 pagine caricano `style-v2.css` con
parametri di versione incoerenti (13 senza alcun parametro, altre con `?v=2`,
`?v=6`, `?v=7`, `?v=8`), quindi una modifica a quel file può restare invisibile
a un browser che ne ha una copia. Un file mai esistito prima non può essere in
cache.

USO
    python3 introduce_token.py --analizza
        stampa la tabella dei token senza scrivere nulla

    python3 introduce_token.py --scrivi dark-mode.css [altri.css ...]
        genera css/variables.css e riscrive SOLO i file indicati
"""

import collections
import os
import re
import sys

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
VARIABILI = os.path.join(BASE, 'css', 'variables.css')

HEX = re.compile(r'#([0-9a-fA-F]{3,6})\b')
COMMENTO = re.compile(r'/\*.*?\*/', re.S)
DICHIARAZIONE = re.compile(r'([a-zA-Z-]+)\s*:\s*([^;{}]+)')


def normalizza(cifre):
    cifre = cifre.lower()
    if len(cifre) == 3:
        cifre = ''.join(c * 2 for c in cifre)
    return cifre if len(cifre) == 6 else None


def file_css():
    return sorted(f for f in os.listdir(BASE) if f.endswith('.css'))


USO_TOKEN = re.compile(r'var\(\s*--col-([0-9a-f]{6})\s*\)')


def inventario():
    """
    (conteggio per colore, proprietà per colore, file per colore).

    CONTA ANCHE I `var(--col-...)` GIÀ PRESENTI, e non è un dettaglio.

    Il 21/08/2026 questa funzione guardava solo gli esadecimali. Dopo aver
    convertito `dark-mode.css`, i suoi colori erano diventati `var()` e quindi
    invisibili all'inventario: alla conversione successiva `variables.css` è
    stato rigenerato con 248 token invece di 269, **eliminando i 21 usati solo
    dal tema scuro**. I `var()` di `dark-mode.css` sarebbero rimasti senza
    definizione, e un `var()` senza definizione non produce alcun errore: la
    proprietà risulta non valida e l'elemento eredita. Il tema scuro si sarebbe
    spento in silenzio.

    È lo stesso guasto contro cui lo strumento mette in guardia, prodotto dallo
    strumento stesso. La causa: uno strumento rieseguibile che legge il proprio
    output deve considerare **anche ciò che ha già trasformato**, altrimenti
    ogni esecuzione dimentica la precedente.
    """
    conta = collections.Counter()
    proprieta = collections.defaultdict(collections.Counter)
    file_di = collections.defaultdict(set)

    for nome in file_css():
        testo = open(os.path.join(BASE, nome), encoding='utf-8', errors='replace').read()
        # I commenti contengono valori vecchi: non vanno né contati né sostituiti.
        testo = COMMENTO.sub(lambda m: ' ' * len(m.group(0)), testo)
        for prop, valore in DICHIARAZIONE.findall(testo):
            for m in HEX.finditer(valore):
                c = normalizza(m.group(1))
                if not c:
                    continue
                conta[c] += 1
                proprieta[c][prop.lower()] += 1
                file_di[c].add(nome)
            for m in USO_TOKEN.finditer(valore):
                c = m.group(1)
                conta[c] += 1
                proprieta[c][prop.lower()] += 1
                file_di[c].add(nome)
    return conta, proprieta, file_di


def genera_variabili(conta, proprieta, file_di):
    righe = [
        "/*",
        " * Token di colore — task 3.1 della roadmap.",
        " *",
        " * GENERATO da strumenti/introduce_token.py. Non modificare a mano:",
        " * rigenerarlo, altrimenti il file e i CSS divergono in silenzio.",
        " *",
        " * Un token per ogni colore DISTINTO gia' presente nei CSS. Nessun",
        " * accorpamento: questo passaggio non deve cambiare l'aspetto di nulla.",
        " * I nomi derivano dal valore e non dal ruolo, perche' un nome semantico",
        " * sarebbe un'ipotesi sull'intenzione di chi ha scritto quel colore.",
        " *",
        " * I commenti riportano usi e proprieta' prevalenti: servono al task 6.6,",
        " * dove la tavolozza va consolidata e i nomi diventano semantici.",
        " *",
        f" * Token: {len(conta)}   Occorrenze sostituite: {sum(conta.values())}",
        " */",
        "",
        ":root {",
    ]
    for colore, n in sorted(conta.items(), key=lambda x: (-x[1], x[0])):
        props = ', '.join(f"{p}×{q}" for p, q in proprieta[colore].most_common(2))
        nfile = len(file_di[colore])
        righe.append(f"    --col-{colore}: #{colore};"
                     f"  /* {n} usi in {nfile} file — {props} */")
    righe.append("}")
    righe.append("")
    return '\n'.join(righe)


def fine_riga(percorso):
    """
    I fine riga del file, com'erano.

    La prima versione riscriveva tutto con `\\n`. Su un file con `\\r\\n` questo
    cambia OGNI riga, e git segnala 1736 righe modificate dove ne sono cambiate
    151: la revisione diventa impossibile, e la modifica vera si nasconde nel
    rumore. Un cambiamento invisibile nella resa può essere ben visibile in
    revisione, ed è lì che si trovano gli errori.
    """
    with open(percorso, 'rb') as f:
        grezzo = f.read()
    return '\r\n' if b'\r\n' in grezzo else '\n'


def riscrivi(nome, conta):
    """Sostituisce i colori con var(--col-...). Restituisce (testo, sostituzioni)."""
    percorso = os.path.join(BASE, nome)
    testo = open(percorso, encoding='utf-8', errors='replace').read()

    # I commenti si proteggono: un colore citato in un commento non colora nulla,
    # e sostituirlo trasformerebbe una nota storica in codice che sembra vivo.
    protetti = []

    def metti_via(m):
        protetti.append(m.group(0))
        return f"\x00{len(protetti) - 1}\x00"

    testo = COMMENTO.sub(metti_via, testo)

    sostituzioni = [0]

    def sostituisci(m):
        c = normalizza(m.group(1))
        if not c or c not in conta:
            return m.group(0)
        sostituzioni[0] += 1
        return f"var(--col-{c})"

    testo = HEX.sub(sostituisci, testo)
    testo = re.sub(r'\x00(\d+)\x00', lambda m: protetti[int(m.group(1))], testo)
    return testo, sostituzioni[0]


def main():
    if '--analizza' in sys.argv:
        conta, proprieta, file_di = inventario()
        print(f"token: {len(conta)}   occorrenze: {sum(conta.values())}")
        print(f"\n{'token':<18} {'usi':>4}  {'file':>4}  proprieta' prevalenti")
        for colore, n in sorted(conta.items(), key=lambda x: (-x[1], x[0]))[:30]:
            props = ', '.join(f"{p}×{q}" for p, q in proprieta[colore].most_common(2))
            print(f"--col-{colore:<12} {n:>4}  {len(file_di[colore]):>4}  {props}")
        print(f"... e altri {max(0, len(conta) - 30)}")
        return 0

    if '--scrivi' in sys.argv:
        bersagli = [a for a in sys.argv[sys.argv.index('--scrivi') + 1:]
                    if not a.startswith('--')]
        if not bersagli:
            print("ERRORE: indicare almeno un file da riscrivere.")
            return 2

        conta, proprieta, file_di = inventario()

        os.makedirs(os.path.dirname(VARIABILI), exist_ok=True)
        with open(VARIABILI, 'w', encoding='utf-8', newline='\n') as f:
            f.write(genera_variabili(conta, proprieta, file_di))
        print(f"scritto {VARIABILI}  ({len(conta)} token)")

        for nome in bersagli:
            percorso = os.path.join(BASE, nome)
            if not os.path.isfile(percorso):
                print(f"  {nome}: NON TROVATO, saltato")
                continue
            eol = fine_riga(percorso)
            testo, n = riscrivi(nome, conta)
            rimasti = len([m for m in HEX.finditer(COMMENTO.sub(' ', testo))])
            with open(percorso, 'w', encoding='utf-8', newline=eol) as f:
                f.write(testo)
            # `rimasti` deve essere zero: se non lo e', esiste una forma di
            # colore che il sostitutore non riconosce, e il file e' rimasto a
            # meta' senza che nulla lo segnali.
            stato = 'ok' if rimasti == 0 else f'ATTENZIONE: {rimasti} non sostituiti'
            print(f"  {nome}: {n} sostituzioni — {stato}")

        # GUARDIA FINALE — aggiunta dopo il guasto del 21/08/2026.
        #
        # Ogni `var(--col-...)` presente in QUALUNQUE file deve avere una
        # definizione. Questo controllo non serve a rassicurare: serve perche'
        # un `var()` senza definizione NON produce errori. La proprieta' risulta
        # non valida, l'elemento eredita, e il difetto si vede solo aprendo la
        # pagina giusta nel tema giusto.
        definiti = set(conta)
        orfani = collections.defaultdict(set)
        for nome in file_css():
            testo = open(os.path.join(BASE, nome), encoding='utf-8', errors='replace').read()
            for m in USO_TOKEN.finditer(COMMENTO.sub(' ', testo)):
                if m.group(1) not in definiti:
                    orfani[m.group(1)].add(nome)

        if orfani:
            print(f"\nERRORE: {len(orfani)} token usati ma NON definiti in variables.css.")
            for c, dove in sorted(orfani.items()):
                print(f"  --col-{c}  usato in: {', '.join(sorted(dove))}")
            print("Un var() senza definizione non da' errore: l'elemento eredita "
                  "e il colore sparisce in silenzio. NON distribuire.")
            return 2

        print(f"\nverifica: {len(definiti)} token definiti, nessun riferimento orfano.")
        return 0

    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
