"""Quali metodi sono raggiungibili dai punti d'ingresso, e quali no.

PERCHE ESISTE
«Sembra morto» e «e morto» sono due frasi diverse, e in questo progetto la
distanza fra le due e stata pagata piu volte. Cancellare codice vivo credendolo
morto e il modo piu rapido di rompere una pagina senza che nessun controllo se
ne accorga: il frontend non ha test, e un metodo mai chiamato e un metodo
chiamato da un punto che non ho guardato hanno lo stesso aspetto.

    python strumenti/raggiungibilita.py js/commesse.js --radici init

COME SBAGLIA, di proposito
Segue `this.X(` e anche `this.X` senza parentesi, perche un metodo passato come
callback (`addEventListener('click', this.aggiorna)`) e vivo quanto uno
chiamato. Sbaglia quindi verso il VIVO: puo dichiarare raggiungibile qualcosa
che non lo e, mai il contrario. Per la domanda «posso cancellarlo?» e l'unico
verso in cui convenga sbagliare.

NON VEDE, e vanno controllati a mano prima di cancellare:
  * `onclick="..."` scritti nell'HTML, sia nelle pagine sia nelle stringhe
    template generate dal JavaScript;
  * chiamate da altri file quando l'oggetto e esposto su `window`;
  * nomi costruiti a runtime (`this[nome]()`).
Il primo caso e reale in questo progetto: `renderCards` genera `onclick` inline.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from struttura_moduli import analizza  # noqa: E402


def grafo(voci):
    nomi = {v['nome'] for v in voci}
    return {v['nome']: {c for c in v['chiama'] if c in nomi and c != v['nome']} for v in voci}


def raggiungibili(archi, radici):
    visti, coda = set(), [r for r in radici if r in archi]
    while coda:
        n = coda.pop()
        if n in visti:
            continue
        visti.add(n)
        coda.extend(archi.get(n, ()) - visti)
    return visti


# Un controllo che non si e mai visto separare vivo da morto non dice nulla
# quando riporta «tutto raggiungibile».
CASO = {'avvio': {'usata'}, 'usata': set(), 'orfana': {'usataSoloDaOrfana'},
        'usataSoloDaOrfana': set()}


def controllo_positivo():
    r = raggiungibili(CASO, ['avvio'])
    return r == {'avvio', 'usata'}


if __name__ == '__main__':
    args = sys.argv[1:]
    radici = ['init']
    if '--radici' in args:
        i = args.index('--radici')
        radici = args[i + 1].split(',')
        args = args[:i]
    percorsi = [a for a in args if not a.startswith('--')]

    if not controllo_positivo():
        sys.exit("La sonda e cieca: sul caso di prova non separa vivo da morto.")

    for p in percorsi:
        voci = analizza(p) or []
        per_nome = {v['nome']: v for v in voci}
        archi = grafo(voci)
        vivi = raggiungibili(archi, radici)
        morti = sorted(set(per_nome) - vivi, key=lambda n: -per_nome[n]['righe'])

        righe_morte = sum(per_nome[n]['righe'] for n in morti)
        totale = sum(v['righe'] for v in voci)
        print(f"\n{'='*72}\n{p}   radici: {', '.join(radici)}\n{'='*72}")
        print(f"  raggiungibili: {len(vivi)}/{len(voci)}    "
              f"non raggiungibili: {len(morti)}  ({righe_morte} righe su {totale})")
        if morti:
            print(f"\n  {'metodo':<32}{'righe':>6}{'riga':>7}   chiamato da")
            for n in morti:
                v = per_nome[n]
                da = sorted(m for m in archi if n in archi[m]) or ['—']
                print(f"  {n:<32}{v['righe']:>6}{v['riga']:>7}   {', '.join(da[:4])}")
            print("\n  ATTENZIONE: prima di cancellare, cercare ciascun nome negli"
                  "\n  attributi onclick delle pagine E nelle stringhe template del JS.")
