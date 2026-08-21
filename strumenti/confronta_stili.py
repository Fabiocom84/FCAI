"""
Confronta due rilievi di stili calcolati — verifica dei task 3.1 e 3.2.

COSA RISPONDE
«Dopo aver sostituito i colori con le variabili, è cambiato qualcosa?»
Non "sembra uguale": quale firma, quale proprietà, da quale valore a quale.

LE TRE CATEGORIE, CHE NON SONO LA STESSA COSA
Tenerle separate è tutto il valore di questo strumento. Mescolate, il confronto
sarebbe sempre rosso e verrebbe ignorato entro una settimana.

  COLORE CAMBIATO   stessa firma, stessa proprietà, valore diverso.
                    È il difetto che i task 3.1 e 3.2 non devono produrre.
                    -> fa fallire il confronto (uscita 1)

  FIRMA SPARITA O COMPARSA
                    non è un cambio di colore ma di struttura: qualcuno ha
                    toccato l'HTML o il nome di una classe. Nei task 3.1 e 3.2
                    non dovrebbe accadere, quindi va mostrato — ma è un altro
                    tipo di problema e va letto come tale.
                    -> fa fallire il confronto (uscita 1)

  CONTEGGIO DIVERSO stessa firma, stessi stili, numero di elementi diverso.
                    Sono i DATI che sono cambiati: una commessa in più nella
                    griglia, una notifica in meno. Non riguarda il CSS.
                    -> segnalato solo se richiesto, non fa fallire nulla

DUE PRECONDIZIONI CHE VENGONO VERIFICATE, NON PRESUPPOSTE
  * stessa LARGHEZZA di finestra. Le media query cambiano gli stili in base
    alla larghezza: confrontare un rilievo a 1440 px con uno a 1280 produrrebbe
    decine di differenze vere ma prive di significato, e il tempo si
    spenderebbe a inseguirle.
  * stesso TEMA. Confrontare il chiaro con lo scuro è un errore che, senza
    controllo, produce un elenco lunghissimo e plausibile.

Entrambe fanno uscire con codice 2 senza nemmeno iniziare il confronto: un
raffronto fatto su presupposti sbagliati è peggio di nessun raffronto, perché
sembra un risultato.

USO
    python3 confronta_stili.py PRIMA.json DOPO.json
    python3 confronta_stili.py cartella_prima/ cartella_dopo/   [--conteggi]

Con due cartelle confronta tutti i file con lo stesso nome e riepiloga.

USCITA
    0  nessuna differenza di stile
    1  differenze trovate
    2  i due rilievi non sono confrontabili (o mancano file)
"""

import json
import os
import sys


def carica(percorso):
    with open(percorso, encoding='utf-8') as f:
        return json.load(f)


def confrontabili(prima, dopo, nome):
    """Restituisce la lista dei motivi per cui NON sono confrontabili."""
    motivi = []
    if prima.get('larghezzaFinestra') != dopo.get('larghezzaFinestra'):
        motivi.append(
            f"larghezza finestra diversa: {prima.get('larghezzaFinestra')} "
            f"contro {dopo.get('larghezzaFinestra')} — le media query cambiano "
            f"gli stili con la larghezza, il confronto sarebbe privo di senso")
    if prima.get('tema') != dopo.get('tema'):
        motivi.append(
            f"tema diverso: {prima.get('tema')} contro {dopo.get('tema')}")
    if prima.get('pagina') != dopo.get('pagina'):
        motivi.append(
            f"pagina diversa: {prima.get('pagina')} contro {dopo.get('pagina')}")
    return motivi


def confronta(prima, dopo):
    """Restituisce (colori_cambiati, sparite, comparse, conteggi_diversi)."""
    a, b = prima.get('rilievo', {}), dopo.get('rilievo', {})

    sparite = sorted(set(a) - set(b))
    comparse = sorted(set(b) - set(a))

    colori, conteggi = [], []
    for firma in sorted(set(a) & set(b)):
        stili_a = a[firma].get('stili', {})
        stili_b = b[firma].get('stili', {})
        for prop in sorted(set(stili_a) | set(stili_b)):
            va = stili_a.get(prop, [])
            vb = stili_b.get(prop, [])
            if va != vb:
                colori.append((firma, prop, va, vb))
        if a[firma].get('elementi') != b[firma].get('elementi'):
            conteggi.append((firma, a[firma].get('elementi'),
                             b[firma].get('elementi')))
    return colori, sparite, comparse, conteggi


def _elenco(valori):
    return ', '.join(valori) if valori else '(assente)'


def rapporto(nome, prima, dopo, mostra_conteggi):
    """Stampa il rapporto per una coppia. Restituisce True se ci sono differenze."""
    colori, sparite, comparse, conteggi = confronta(prima, dopo)

    if not (colori or sparite or comparse):
        extra = f"  ({len(conteggi)} firme con conteggio diverso: dati)" if conteggi else ""
        print(f"OK   {nome}: nessuna differenza di stile{extra}")
        if mostra_conteggi and conteggi:
            for firma, na, nb in conteggi[:20]:
                print(f"       {firma}: {na} -> {nb} elementi")
        return False

    print(f"DIFF {nome}")

    if colori:
        print(f"  COLORI CAMBIATI ({len(colori)}) — e' il difetto da evitare")
        for firma, prop, va, vb in colori[:40]:
            print(f"    {firma}")
            print(f"      {prop}: {_elenco(va)}  ->  {_elenco(vb)}")
        if len(colori) > 40:
            print(f"    ... e altri {len(colori) - 40}")

    if sparite or comparse:
        print(f"  STRUTTURA ({len(sparite)} sparite, {len(comparse)} comparse)"
              " — non e' un cambio di colore: HTML o nomi di classe")
        for firma in sparite[:15]:
            print(f"    - {firma}")
        for firma in comparse[:15]:
            print(f"    + {firma}")

    if mostra_conteggi and conteggi:
        print(f"  CONTEGGI ({len(conteggi)}) — dati diversi, non riguarda il CSS")
        for firma, na, nb in conteggi[:15]:
            print(f"    {firma}: {na} -> {nb}")

    return True


def main():
    argomenti = [a for a in sys.argv[1:] if not a.startswith('--')]
    mostra_conteggi = '--conteggi' in sys.argv

    if len(argomenti) != 2:
        print(__doc__)
        return 2

    prima_p, dopo_p = argomenti

    if os.path.isdir(prima_p) != os.path.isdir(dopo_p):
        print("ERRORE: o due file, o due cartelle.")
        return 2

    if os.path.isfile(prima_p):
        coppie = [(os.path.basename(prima_p), prima_p, dopo_p)]
        mancanti = []
    else:
        nomi_a = {f for f in os.listdir(prima_p) if f.endswith('.json')}
        nomi_b = {f for f in os.listdir(dopo_p) if f.endswith('.json')}
        # Un file presente da una parte sola non e' una differenza di stile: e'
        # un rilievo che non e' stato fatto. Confonderlo con un esito
        # significherebbe dichiarare verificata una pagina mai guardata.
        mancanti = sorted(nomi_a ^ nomi_b)
        coppie = [(n, os.path.join(prima_p, n), os.path.join(dopo_p, n))
                  for n in sorted(nomi_a & nomi_b)]

    if mancanti:
        print(f"ATTENZIONE: {len(mancanti)} rilievi presenti da una parte sola, "
              f"quindi NON verificati:")
        for n in mancanti:
            print(f"  {n}")
        print()

    if not coppie:
        print("Nessuna coppia da confrontare.")
        return 2

    non_confrontabili = []
    con_differenze = []

    for nome, pa, pb in coppie:
        prima, dopo = carica(pa), carica(pb)
        motivi = confrontabili(prima, dopo, nome)
        if motivi:
            non_confrontabili.append((nome, motivi))
            continue
        if rapporto(nome, prima, dopo, mostra_conteggi):
            con_differenze.append(nome)

    if non_confrontabili:
        print(f"\nNON CONFRONTABILI ({len(non_confrontabili)}):")
        for nome, motivi in non_confrontabili:
            print(f"  {nome}")
            for m in motivi:
                print(f"    {m}")

    print(f"\nRIEPILOGO: {len(coppie)} coppie, "
          f"{len(con_differenze)} con differenze, "
          f"{len(non_confrontabili)} non confrontabili"
          + (f", {len(mancanti)} rilievi mancanti" if mancanti else ""))

    if non_confrontabili or mancanti:
        return 2
    return 1 if con_differenze else 0


if __name__ == '__main__':
    sys.exit(main())
