"""
Divide il rilievo aggregato nei singoli file confrontabili.

PERCHÉ IL RILIEVO NASCE AGGREGATO
Il rilievo si esegue dal browser, caricando le 21 pagine in un iframe: una sola
esecuzione, un solo file scaricato. Comodo da produrre, scomodo da confrontare —
`confronta_stili.py` lavora su un file per pagina e per tema, così una differenza
si legge sulla pagina che la contiene invece che dentro un documento da 772 KB.

PERCHÉ UN FILE PER PAGINA E NON UN FILE SOLO
Con un file unico, git segnalerebbe "modificato" per qualunque cambiamento e non
si potrebbe vedere QUALI pagine sono cambiate senza aprirlo. Con 42 file, la
lista dei file modificati è già la risposta.

USO
    python3 dividi_rilievo.py rilievo_stili_riferimento.json [cartella_uscita]

Cartella predefinita: `segretario-ai-frontend/riferimento-stili/`.

I file escono con nome `stili_<pagina>_<tema>.json`, che è il nome su cui
`confronta_stili.py` accoppia il prima e il dopo.
"""

import json
import os
import sys

PREDEFINITA = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'riferimento-stili')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    sorgente = sys.argv[1]
    destinazione = sys.argv[2] if len(sys.argv) > 2 else PREDEFINITA
    destinazione = os.path.abspath(destinazione)

    with open(sorgente, encoding='utf-8') as f:
        documento = json.load(f)

    temi = [t for t in ('chiaro', 'scuro') if t in documento]
    if not temi:
        print("ERRORE: il documento non contiene né 'chiaro' né 'scuro'. "
              "Non è un rilievo aggregato.")
        return 2

    os.makedirs(destinazione, exist_ok=True)

    scritti = 0
    larghezze = set()
    for tema in temi:
        for pagina, rilievo in sorted(documento[tema].items()):
            larghezze.add(rilievo.get('larghezzaFinestra'))
            nome = f"stili_{pagina.replace('.html', '')}_{tema}.json"
            percorso = os.path.join(destinazione, nome)
            # `sort_keys` e `indent`: senza, due rilievi identici potrebbero
            # produrre file diversi e git segnalerebbe modifiche inesistenti.
            with open(percorso, 'w', encoding='utf-8') as f:
                json.dump(rilievo, f, ensure_ascii=False, indent=1, sort_keys=True)
            scritti += 1

    print(f"scritti {scritti} file in {destinazione}")
    print(f"generato il : {documento.get('generato', '(non indicato)')}")
    print(f"origine     : {documento.get('origine', '(non indicata)')}")

    # Una larghezza sola è la precondizione di ogni confronto futuro: se qui ce
    # ne fossero due, il rilievo è già inutilizzabile e va rifatto, invece di
    # scoprirlo al primo confronto fra qualche settimana.
    if len(larghezze) == 1:
        print(f"larghezza   : {larghezze.pop()} px (unica, come deve essere)")
    else:
        print(f"ATTENZIONE: larghezze diverse nello stesso rilievo: "
              f"{sorted(x for x in larghezze if x is not None)}")
        print("Le media query cambiano gli stili con la larghezza: questo "
              "rilievo non è confrontabile e va rifatto.")
        return 2

    return 0


if __name__ == '__main__':
    sys.exit(main())
