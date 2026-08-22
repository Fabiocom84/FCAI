"""
Inventario dei colori nei CSS — base misurata per i task 3.1, 3.2 e 6.6.

PERCHÉ ESISTE
La roadmap chiedeva di «estrarre le custom properties da style-v2.css». Non ce
n'è nessuna: i colori sono 1.954 valori scritti a mano. Prima di introdurre dei
token bisogna sapere quali sono, quanti sono davvero distinti e a cosa servono —
e bisogna poterlo rifare dopo ogni modifica, invece di fidarsi di un conteggio
fatto una volta.

COSA MISURA
  1. quante dichiarazioni contengono un colore, e in quali proprietà
  2. quanti colori distinti restano dopo aver normalizzato la scrittura
     (#fff e #ffffff sono lo stesso colore scritto in due modi)
  3. quanti token servirebbero al variare della tolleranza percettiva
  4. il profilo di dark-mode.css, che ha una tavolozza propria

LA TOLLERANZA NON È UN DETTAGLIO TECNICO, È LA DECISIONE
A tolleranza 0 ogni colore distinto diventa un token: l'aspetto delle pagine non
cambia di un pixel, ma i token sono 269. Alzandola, colori quasi identici
vengono accorpati e i token calano — al prezzo di cambiare, di poco, come appare
qualcosa.

    task 3.1 (meccanico)  -> tolleranza 0. Il criterio è "prima e dopo
                             identici", e accorpare violerebbe proprio quello.
    task 6.6 (di scelta)  -> tolleranza alta. Lì le differenze sono attese e
                             vengono riviste una per una.

Il numero prodotto qui serve a decidere con cognizione, non a suggerire che una
tolleranza sia "giusta".

USO
    python3 segretario-ai-frontend/strumenti/inventario_colori.py [cartella_css]

Non modifica nulla: legge e stampa.
"""

import collections
import math
import os
import re
import sys

PREDEFINITA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

DICHIARAZIONE = re.compile(r'([a-zA-Z-]+)\s*:\s*([^;{}]+)', re.S)
HEX = re.compile(r'#([0-9a-fA-F]{3,8})\b')
RGB = re.compile(r'rgba?\(([^)]*)\)')
COMMENTO = re.compile(r'/\*.*?\*/', re.S)


def normalizza(cifre):
    """`#FFF` e `#ffffff` sono lo stesso colore: qui diventano la stessa chiave."""
    cifre = cifre.lower()
    if len(cifre) in (3, 4):
        cifre = ''.join(c * 2 for c in cifre)
    return '#' + cifre


def leggi(cartella):
    """Restituisce la lista di (file, proprietà, colore)."""
    triple = []
    for nome in sorted(f for f in os.listdir(cartella) if f.endswith('.css')):
        percorso = os.path.join(cartella, nome)
        testo = open(percorso, encoding='utf-8', errors='replace').read()
        # I commenti contengono spesso vecchi valori: contarli gonfierebbe
        # l'inventario con colori che non colorano nulla.
        testo = COMMENTO.sub(' ', testo)
        for prop, valore in DICHIARAZIONE.findall(testo):
            prop = prop.lower()
            for m in HEX.finditer(valore):
                triple.append((nome, prop, normalizza(m.group(1))))
            for m in RGB.finditer(valore):
                parti = [p.strip() for p in m.group(1).replace('/', ',').split(',')]
                triple.append((nome, prop, 'rgba(' + ','.join(parti) + ')'))
    return triple


def _rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def distanza(a, b):
    """
    Approssimazione percettiva "redmean".

    La distanza euclidea sui canali RGB tratta due blu quasi uguali come
    lontani quanto un verde e un rosso altrettanto distanti nei numeri, mentre
    l'occhio no. Questa formula pesa i canali in modo più simile alla
    percezione, e non richiede librerie esterne.
    """
    r1, g1, b1 = _rgb(a)
    r2, g2, b2 = _rgb(b)
    media_rosso = (r1 + r2) / 2
    dr, dg, db = r1 - r2, g1 - g2, b1 - b2
    return math.sqrt((2 + media_rosso / 256) * dr * dr
                     + 4 * dg * dg
                     + (2 + (255 - media_rosso) / 256) * db * db)


def raggruppa(colori_ordinati, soglia):
    """
    Raggruppa partendo dai colori PIÙ USATI.

    L'ordine conta: il rappresentante di ogni gruppo è il colore più diffuso,
    quindi il consolidamento tende verso ciò che è già prevalente invece che
    verso un valore arbitrario incontrato per primo.
    """
    rappresentanti = []
    membri = collections.defaultdict(list)
    for c in colori_ordinati:
        for r in rappresentanti:
            if distanza(c, r) <= soglia:
                membri[r].append(c)
                break
        else:
            rappresentanti.append(c)
            membri[c].append(c)
    return rappresentanti, membri


def main():
    cartella = sys.argv[1] if len(sys.argv) > 1 else PREDEFINITA
    triple = leggi(cartella)

    colori = collections.Counter(c for _, _, c in triple)
    esadecimali = collections.Counter(
        {c: n for c, n in colori.items() if c.startswith('#') and len(c) == 7})

    print(f"dichiarazioni con colore : {len(triple)}")
    print(f"colori distinti          : {len(colori)}"
          f"  (esadecimali {len(esadecimali)}, funzioni rgb "
          f"{len(colori) - len(esadecimali)})")

    grezzi = set()
    for nome in sorted(f for f in os.listdir(cartella) if f.endswith('.css')):
        testo = open(os.path.join(cartella, nome), encoding='utf-8',
                     errors='replace').read()
        grezzi.update('#' + m.group(1) for m in HEX.finditer(testo))
    print(f"effetto della normalizzazione: {len(grezzi)} -> {len(esadecimali)} "
          f"({len(grezzi) - len(esadecimali)} scritture doppie dello stesso colore)")

    ordinati = [c for c, _ in esadecimali.most_common()]
    totale = sum(esadecimali.values())

    print("\nQUANTI TOKEN, AL VARIARE DELLA TOLLERANZA")
    print(f"{'soglia':>7} {'token':>6}   note")
    for soglia in (0, 5, 10, 15, 20, 30, 40, 60):
        rap, _ = raggruppa(ordinati, soglia)
        nota = ''
        if soglia == 0:
            nota = '<- task 3.1: nessun cambiamento visivo'
        elif soglia == 60:
            nota = 'accorpa colori distinguibili a occhio'
        print(f"{soglia:>7} {len(rap):>6}   {nota}")

    uso = collections.defaultdict(collections.Counter)
    for _, prop, c in triple:
        uso[c][prop] += 1

    SOGLIA = 15
    rap, membri = raggruppa(ordinati, SOGLIA)
    print(f"\nI 25 GRUPPI PIÙ USATI (soglia {SOGLIA}) — la proprietà prevalente")
    print("suggerisce il ruolo, e quindi il nome del token")
    for r in rap[:25]:
        occorrenze = sum(esadecimali[m] for m in membri[r])
        props = collections.Counter()
        for m in membri[r]:
            props.update(uso[m])
        principali = ', '.join(f"{p}×{n}" for p, n in props.most_common(3))
        print(f"  {r}  {occorrenze:>4} usi   [{principali}]")
        assorbiti = [m for m in membri[r] if m != r]
        if assorbiti:
            coda = ' …' if len(assorbiti) > 8 else ''
            print(f"             assorbe: {', '.join(assorbiti[:8])}{coda}")

    # ------------------------------------------------------------------
    per_file = collections.defaultdict(set)
    for nome, _, c in triple:
        per_file[nome].add(c)
    scuro = per_file.get('dark-mode.css', set())
    chiaro = set().union(*[v for k, v in per_file.items()
                           if k != 'dark-mode.css']) if per_file else set()

    print(f"\nDARK-MODE.CSS")
    print(f"  colori distinti      : {len(scuro)}")
    print(f"  solo nel tema scuro  : {len(scuro - chiaro)}")
    print(f"  condivisi col chiaro : {len(scuro & chiaro)}")
    conta_scuro = collections.Counter(c for f, _, c in triple if f == 'dark-mode.css')
    prop_scuro = collections.defaultdict(collections.Counter)
    for f, p, c in triple:
        if f == 'dark-mode.css':
            prop_scuro[c][p] += 1
    print("  i più usati:")
    for c, n in conta_scuro.most_common(8):
        principali = ', '.join(f"{k}×{v}" for k, v in prop_scuro[c].most_common(2))
        print(f"    {c:<24} {n:>3} usi  [{principali}]")


if __name__ == '__main__':
    main()
