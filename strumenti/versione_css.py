"""
Il parametro `?v=` di CSS e JavaScript, derivato dal CONTENUTO.

IL PROBLEMA
I browser mettono in cache i fogli di stile. Se l'indirizzo non cambia, una
modifica può restare invisibile agli utenti per un tempo imprevedibile e diverso
per ciascuno. Il 21/08/2026 questo era già accaduto: le 21 pagine avevano
parametri incoerenti — 13 senza alcun parametro, le altre con `?v=2`, `?v=6`,
`?v=7`, `?v=8` — e durante una verifica la stessa pagina serviva metà file nuovi
e metà vecchi.

Risolto versionando tutti i collegamenti a `?v=3.9`. Ma resta un compito da
ricordare: **alzare quel numero a ogni modifica dei CSS**. Un compito che si
dimentica, e il cui fallimento è silenzioso.

LA SOLUZIONE
Il parametro diventa un'impronta del contenuto dei CSS. Se i file non cambiano,
l'impronta non cambia e la cache resta valida — che è il comportamento
desiderato. Se cambia anche un carattere, l'indirizzo cambia da sé.

Non è più qualcosa da ricordare: è qualcosa da **verificare**, e la verifica sta
nel comando `--controlla`, da mettere nella procedura di rilascio.

PERCHÉ NON UN VERO SISTEMA DI COMPILAZIONE
Il sito è statico e servito da Vercel senza passaggi di build. Introdurne uno per
questo solo scopo aggiungerebbe una dipendenza e un modo di rompersi. Questo
script fa una cosa sola, si legge in due minuti, e non richiede nulla di
installato.

USO
    python3 strumenti/versione_css.py --controlla
        esce con 1 se le pagine non portano l'impronta corrente.
        DA ESEGUIRE PRIMA DI OGNI RILASCIO.

    python3 strumenti/versione_css.py --aggiorna
        riscrive il parametro in tutte le pagine.
"""

import hashlib
import os
import re
import sys

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# Solo i CSS del progetto: le librerie in `css/libs` hanno una loro politica di
# cache e non cambiano con il nostro lavoro.
def file_css():
    fogli = [f for f in sorted(os.listdir(BASE)) if f.endswith('.css')]
    cartella_css = os.path.join(BASE, 'css')
    if os.path.isdir(cartella_css):
        fogli += [f'css/{f}' for f in sorted(os.listdir(cartella_css)) if f.endswith('.css')]
    return fogli


def file_js():
    """
    Gli script del progetto, escluse le librerie di terze parti.

    AGGIUNTO IL 22/08/2026, DOPO UN GUASTO
    Lo strumento versionava solo i CSS. Rilasciata su staging la modifica ad
    `api-client.js` — quella che fa sollevare le chiamate fallite — il browser ha
    continuato a servire **la copia precedente dalla cache**: il codice nuovo non
    girava, e la pagina sembrava funzionare perché si comportava esattamente come
    prima. È lo stesso difetto dei CSS del giorno prima, sull'altra metà dei file.

    Le librerie in `js/libs` non cambiano con il nostro lavoro e hanno una loro
    politica di cache: versionarle costringerebbe a riscaricarle senza motivo.
    """
    cartella = os.path.join(BASE, 'js')
    if not os.path.isdir(cartella):
        return []
    return [f'js/{f}' for f in sorted(os.listdir(cartella)) if f.endswith('.js')]


def _impronta(nomi):
    """
    Impronta del contenuto di un insieme di file.

    Include i NOMI oltre al contenuto: se un file venisse rinominato senza che il
    testo cambi, l'insieme sarebbe diverso e la cache andrebbe comunque
    invalidata.

    I FINE RIGA VENGONO NORMALIZZATI PRIMA DI CALCOLARE L'IMPRONTA.
    Il progetto ha un `.gitattributes` (18/08/2026) che tiene LF nel repository e
    converte in locale: lo stesso file ha quindi byte diversi su Windows e su
    Linux. Senza questa normalizzazione l'impronta dipenderebbe da DOVE viene
    calcolata — il controllo passerebbe su una macchina e fallirebbe sull'altra,
    e le pagine verrebbero riscritte a ogni cambio di ambiente.

    Scoperto provando a modificare e ripristinare un file: dopo `git checkout`
    l'impronta risultava diversa da prima, pur essendo il file «lo stesso».
    """
    h = hashlib.sha256()
    for nome in nomi:
        h.update(nome.encode('utf-8'))
        with open(os.path.join(BASE, nome), 'rb') as f:
            h.update(f.read().replace(b'\r\n', b'\n'))
    return h.hexdigest()[:8]


# Due impronte distinte invece di una sola: così una modifica al JavaScript non
# costringe a riscaricare anche i fogli di stile, e viceversa.
def impronta():
    return _impronta(file_css())


def impronta_js():
    return _impronta(file_js())


def pagine():
    return [f for f in sorted(os.listdir(BASE)) if f.endswith('.html')]


LINK = re.compile(r'(href=")((?:css/)?[a-zA-Z0-9._-]+\.css)(\?[^"]*)?(")')
SCRIPT = re.compile(r'(src=")(js/[a-zA-Z0-9._-]+\.js)(\?[^"]*)?(")')


def scorri(testo, locali_css, versione_css, locali_js, versione_js, riscrivi):
    """Restituisce (nuovo_testo, riferimenti_totali, riferimenti_da_aggiornare)."""
    totali, da_aggiornare = [0], [0]

    def fabbrica(locali, versione):
        def sostituisci(m):
            percorso = m.group(2)
            if percorso not in locali:
                return m.group(0)
            totali[0] += 1
            atteso = f'?v={versione}'
            if m.group(3) != atteso:
                da_aggiornare[0] += 1
            return f'{m.group(1)}{percorso}{atteso}{m.group(4)}' if riscrivi else m.group(0)
        return sostituisci

    nuovo = LINK.sub(fabbrica(locali_css, versione_css), testo)
    nuovo = SCRIPT.sub(fabbrica(locali_js, versione_js), nuovo)
    return nuovo, totali[0], da_aggiornare[0]


def main():
    if '--controlla' not in sys.argv and '--aggiorna' not in sys.argv:
        print(__doc__)
        return 2

    riscrivi = '--aggiorna' in sys.argv
    versione = impronta()
    versione_js = impronta_js()
    locali = set(file_css())
    locali_js = set(file_js())

    totali = fuori_passo = toccate = 0
    disallineate = []
    for nome in pagine():
        percorso = os.path.join(BASE, nome)
        testo = open(percorso, encoding='utf-8', errors='replace').read()
        nuovo, n, k = scorri(testo, locali, versione, locali_js, versione_js, riscrivi)
        totali += n
        fuori_passo += k
        if k:
            disallineate.append((nome, k))
        if riscrivi and nuovo != testo:
            # `newline=''` conserva i fine riga esistenti: senza, git segnalerebbe
            # l'intero file come modificato e la revisione diventerebbe illeggibile.
            open(percorso, 'w', encoding='utf-8', newline='').write(nuovo)
            toccate += 1

    print(f"impronta CSS       : {versione}   ({len(locali)} fogli)")
    print(f"impronta JavaScript: {versione_js}   ({len(locali_js)} script)")
    print(f"riferimenti totali : {totali} in {len(pagine())} pagine")

    if riscrivi:
        print(f"pagine aggiornate  : {toccate}")
        return 0

    if fuori_passo:
        print(f"\nDISALLINEATI: {fuori_passo} riferimenti non portano l'impronta corrente")
        for nome, k in disallineate[:10]:
            print(f"  {nome}: {k}")
        print("\nI file sono cambiati ma le pagine puntano ancora alla versione "
              "precedente.\nGli utenti con quella copia in cache NON riceverebbero "
              "le modifiche:\nil codice nuovo non girerebbe, e la pagina sembrerebbe "
              "funzionare perche'\nsi comporta esattamente come prima.\n"
              "Rimedio:  python3 strumenti/versione_css.py --aggiorna")
        return 1

    print("\nallineati: ogni collegamento porta l'impronta del contenuto attuale.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
