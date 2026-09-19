"""Inventario del «scritto ma non collegato»: classi senza regola, regole senza classe.

PERCHE' ESISTE
Il 19/09/2026 si e' scoperto che l'intero tema visivo delle manutenzioni —
`.commesse-card--manutenzione`, `.card-mann-*`, `.tipo-filters`,
`.std-btn--orange` — non aveva **mai** renderizzato: 249 righe di
`commesse.css` erano annidate dentro un `@keyframes` mai chiuso. Le card
c'erano, le classi c'erano, l'aspetto no.

Non se ne era accorto nessuno per mesi, perche' quegli elementi portano anche
una classe generica (`commesse-card`, `std-btn`, `filter-btn`) che li rende
presentabili: mancava il colore, non l'impaginazione. E si e' trovato **per
caso**, misurando i bersagli per il dito.

`squilibri_css` in `controlla_pagine.py` ora copre quella causa specifica. Non
copre la DOMANDA piu' larga, che e' quella per cui questo file esiste:

    quante altre cose sono scritte e non arrivano?

In tre giorni, sulla stessa famiglia: `valida_allegato` scritta e non
collegata, il decoratore `richiede()` idem, `mostraAvviso` nel frontend idem,
tre client OpenAI senza il timeout che il quarto aveva, un alias `@property`
morto e rotto, due funzioni di modale irraggiungibili. Sei casi. Questo
strumento cerca il settimo prima che tocchi a qualcun altro trovarlo.

COSA GUARDA, nei due versi
  * **classi usate senza regola** — una funzione che esiste e non ha aspetto;
  * **regole che non colpiscono nulla** — CSS morto (regola 5).

DUE SCELTE CHE VANNO SPIEGATE

1. *Nel JavaScript le stringhe si TENGONO.* Le classi ci vivono dentro:
   `classList.add('card-mann-tipo-badge')`, i template che costruiscono HTML.
   E' l'opposto della pulizia usata per le chiavi duplicate, dove il rumore
   veniva proprio dalle stringhe. I commenti invece si tolgono in entrambi i
   casi: una classe *nominata in un commento* non e' una classe usata — ed e'
   l'errore che su questo progetto e' stato commesso cinque volte in tre
   giorni.

2. *I nomi costruiti a pezzi.* `className = 'status-badge status-' + stato`
   produce `status-wip` senza che quella stringa compaia da nessuna parte.
   Senza tenerne conto, decine di classi vive risulterebbero morte e l'elenco
   diventerebbe illeggibile — che e' il modo in cui un controllo smette di
   controllare pur continuando a girare. Quindi una classe CSS e' considerata
   **forse viva** se un frammento che termina per `-` o `_` trovato nel
   JavaScript ne e' un prefisso. E' un'euristica, ed e' dichiarata: preferisce
   tacere a sproposito piuttosto che gridare.

RIFERIMENTO: il 19/09/2026, primo giro utile, **103 classi senza regola** e
**83 regole senza classe**. Sono numeri da confrontare, non da azzerare:
restano falsi positivi noti. Se salgono, qualcosa e' cambiato e va guardato.

COSA HA TROVATO IL PRIMO GIORNO, oltre al rumore — due gruppi OMOGENEI, che
sono la firma di una funzione intera rimasta senza aspetto o di una rimossa a
meta':

  * `manutenzioni.css`: undici classi di un modale di modifica —
    `man-edit-modal`, `man-edit-modal-inner`, `man-edit-header`,
    `man-edit-form`, `man-edit-footer`, `man-edit-close`,
    `man-edit-toggle-row`, piu' `man-add-btn`, `man-home-btn`,
    `man-sidebar-title`, `man-sidebar-top`. Nessuna usata.

  * `commesse.css` e `style-v2.css`: tredici classi del modale di
    creazione/modifica commesse, **rimosso il 06/09/2026 insieme al suo
    markup e al suo JavaScript** — e il foglio di stile e' rimasto.
    `form-grid-2/3/4/media/notes`, `form-section`, `form-section-header`,
    `fields-grid`, `form-fields-wrapper`, `insert-form-container-new`,
    `modal-top-section`, `large-modal`, `close-modal-btn`.

Il secondo gruppo e' la ragione per cui questo strumento serve, ed e' anche
una critica a chi scrive: quella pulizia era stata fatta con attenzione,
documentata, e ha comunque lasciato indietro tredici regole. Nessuno se ne e'
accorto per tredici giorni perche' **il CSS morto non fa rumore** — a
differenza del codice morto, che prima o poi qualcuno chiama.

UNA CLASSE MORTA NON E' SEMPRE UN RESIDUO — verificato il 19/09/2026.
Il gruppo piu' promettente del primo giro, i sei `card-mann-*` di
`commesse.css`, si e' rivelato **una scelta deliberata**: stanno tutti in una
regola sola, con `display: none` e il commento «non piu' usati, mantenuti per
compatibilita'». Sono una rete, non uno scarto: se un percorso non migrato
riproducesse quegli elementi, resterebbero nascosti invece di comparire rotti.

Lo strumento aveva ragione sui fatti e torto sulla conclusione, ed e' la
ragione per cui il suo esito si legge e non si esegue. Quel che mancava era
un'altra cosa — **la condizione che permette di toglierle**, assente dal
commento: e' stata scritta ora. Un rinvio senza condizione e' un'omissione
travestita da decisione, e questo progetto lo ha gia' imparato altrove.

COME CANCELLARE CIO' CHE QUESTO STRUMENTO TROVA — provato il 19/09/2026 e
interrotto di proposito, con due ragioni misurate:

  1. *I nomi vicini ingannano.* `manutenzioni.css` definisce `.man-add-btn`
     (morta) a quattordici righe da `.man-add-btn-header` (VIVA, la usa
     `manutenzioni.html:29`). Cancellare guardando l'elenco invece del file
     avrebbe potuto prendere quella sbagliata.

  2. *Le regole morte e quelle vive sono ALTERNATE, non raggruppate.* In
     `commesse.css` il blocco del modale cancellato contiene, in mezzo,
     `.modal-body input[type="text"]` e `.form-group label`: `.modal-body` e'
     viva — la usa il modale della GeoMap, e dentro c'e' il campo «Filtra
     impianti». Toglierle come regione contigua romperebbe un campo che gli
     utenti usano.

Quindi: **una regola alla volta, con i confini letti nel file**, non per
corrispondenza di nome, e collaudo visivo sulle pagine toccate. Sono una
ventina di modifiche piccole e indipendenti: e' un lavoro da sessione propria,
non da coda di giornata. Il guadagno sono byte e leggibilita', non
comportamento — quindi non c'e' fretta, e la fretta e' l'unica cosa che puo'
trasformarlo in un guasto.

NON E' UN GANCIO PRE-COMMIT, e per la stessa ragione di
`identificatori_irrisolti`: ha falsi positivi noti (le librerie di terze
parti, le classi applicate da Choices.js e Leaflet). Un controllo che blocca
il commit per un motivo sbagliato insegna a scavalcarlo.

    python strumenti/classi_orfane.py
    python strumenti/classi_orfane.py --autoprova
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from identificatori_irrisolti import ripulisci   # noqa: E402

BASE = pathlib.Path(__file__).resolve().parent.parent

# Classi che arrivano da fuori: le applicano le librerie, non il nostro codice.
# Elencarle e' piu' onesto che filtrarle per prefisso, che un giorno
# nasconderebbe anche una classe nostra.
ESTERNE = re.compile(r'^(choices|leaflet|lm-|is-|has-|fa-|fas|far|fab)')


def _fogli():
    return sorted(BASE.glob('*.css')) + sorted((BASE / 'css').glob('*.css'))


def classi_definite():
    """Le classi che compaiono nei SELETTORI dei fogli di stile."""
    fuori = {}
    for f in _fogli():
        t = f.read_text(encoding='utf-8', errors='replace')
        t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
        # solo la parte di selettore, cioe' cio' che precede una graffa aperta
        for sel in re.findall(r'([^{}]+)\{', t):
            if sel.lstrip().startswith('@'):
                continue
            for c in re.findall(r'\.(-?[A-Za-z_][\w-]*)', sel):
                fuori.setdefault(c, set()).add(f.name)
    return fuori


def classi_usate():
    """Le classi nominate da HTML e JavaScript, con dove sono state viste.

    Restituisce anche i FRAMMENTI: pezzi di nome che il codice concatena
    (`'status-'`), necessari a non dichiarare morte le classi costruite.
    """
    usate, frammenti = {}, set()

    for p in sorted(BASE.glob('*.html')):
        t = re.sub(r'<!--.*?-->', '', p.read_text(encoding='utf-8', errors='replace'), flags=re.S)
        for attr in re.findall(r'class\s*=\s*["\']([^"\']*)["\']', t):
            for c in attr.replace('${', ' ${').split():
                if c.startswith('${'):
                    continue
                if re.fullmatch(r'-?[A-Za-z_][\w-]*', c):
                    usate.setdefault(c, set()).add(p.name)

    for p in sorted((BASE / 'js').glob('*.js')):
        # STRINGHE TENUTE, COMMENTI TOLTI: vedi la nota in testa al file.
        t = ripulisci(p.read_text(encoding='utf-8', errors='replace'), tieni_stringhe=True)

        # SOLO I POSTI DOVE UNA CLASSE PUO' STARE, non ogni parola di ogni
        # stringa. Il primo giro di questo strumento, il 19/09/2026,
        # raccoglieva qualunque parola: `session_token`, `id_commessa`,
        # `Content-Type`, `data_nascita` — chiavi di oggetti e id, non classi.
        # 321 voci di cui quasi nessuna vera: un elenco cosi' non si legge, e
        # un elenco che non si legge non protegge.
        candidati = []
        candidati += re.findall(r'''class\s*=\s*\\?["']([^"'\\]*)''', t)          # HTML nei template
        candidati += re.findall(r'''classList\.(?:add|remove|toggle|contains)\s*\(([^)]*)\)''', t)
        candidati += re.findall(r'''className\s*=\s*["'`]([^"'`]*)''', t)
        candidati += re.findall(r'''classList\s*=\s*["'`]([^"'`]*)''', t)

        # `classList.add('done')` cattura `'done'` CON le virgolette. La prima
        # stesura le tagliava insieme a tutto cio' che seguiva, riducendo la
        # voce a stringa vuota: per questo `done`, `selected`, `open`,
        # `status-wip` e `std-btn--orange` risultavano CSS morto. Qui si
        # estraggono le stringhe, non si tronca alle virgolette.
        estratte = []
        for c in candidati:
            dentro = re.findall(r'''["'`]([^"'`]+)["'`]''', c)
            estratte += dentro if dentro else [c]
        candidati = estratte

        for s in candidati:
            # I NOMI COSTRUITI. `card-mann-status-badge${isDone ? ' done' : ''}`
            # e' UNA classe piu' un pezzo calcolato: tagliare al `${` restituisce
            # il nome vero. Senza questo taglio la stessa classe compariva in
            # entrambi gli elenchi — «usata e senza regola» da una parte,
            # «definita e mai usata» dall'altra — che e' la firma di uno
            # strumento che si contraddice da solo.
            s = s.replace('${', ' ${')
            for pezzo in s.split():
                if pezzo.startswith('${'):
                    continue
                c = re.sub(r'''["'`,].*$''', '', pezzo).strip()
                # IL PREFISSO SI CONTROLLA PER PRIMO. `cell-color-` combacia
                # anche col modello di una classe, e finendo li' sporcava il
                # primo elenco (non e' una classe) E lasciava scoperto il
                # secondo (le `cell-color-blue` risultavano morte). Un token
                # che finisce per `-` o `_` e' meta' di un nome costruito.
                if re.fullmatch(r'[\w-]*[-_]', c):
                    frammenti.add(c)
                elif re.fullmatch(r'-?[A-Za-z_][\w-]*', c):
                    usate.setdefault(c, set()).add(p.name)

    return usate, frammenti


def nomi_citati():
    """Ogni parola che compare in HTML e JavaScript, commenti esclusi.

    DELIBERATAMENTE LARGO, e serve a una domanda sola: «questa regola CSS e'
    morta?». Li' l'errore da evitare e' dichiarare morto qualcosa di vivo —
    su questo progetto e' gia' successo, con `window[\\`close${id}\\`]`
    documentato come vivo quando non lo era, e con del codice dichiarato morto
    che non lo era.

    L'altra domanda — «questa classe ha un aspetto?» — vuole l'opposto, e usa
    `classi_usate()`, che guarda solo dove una classe puo' davvero stare.
    Usare un solo estrattore per entrambe e' stato l'errore della prima
    stesura: rendendolo piu' severo il primo elenco e' sceso da 321 a 124, e
    il secondo e' SALITO da 108 a 168, perche' la stessa severita' che toglie
    rumore da una parte inventa cadaveri dall'altra.
    """
    fuori = set()
    for p in sorted(BASE.glob('*.html')):
        t = re.sub(r'<!--.*?-->', '', p.read_text(encoding='utf-8', errors='replace'), flags=re.S)
        fuori |= set(re.findall(r'[A-Za-z_][\w-]*', t))
    for p in sorted((BASE / 'js').glob('*.js')):
        t = ripulisci(p.read_text(encoding='utf-8', errors='replace'), tieni_stringhe=True)
        fuori |= set(re.findall(r'[A-Za-z_][\w-]*', t))
    return fuori


def esamina():
    definite = classi_definite()
    usate, frammenti = classi_usate()
    citate = nomi_citati()

    senza_regola = {c: v for c, v in usate.items()
                    if c not in definite and not ESTERNE.match(c)
                    and re.search(r'[-_]', c)}          # i nomi composti sono i nostri

    def forse_costruita(c):
        return any(c.startswith(f) for f in frammenti)

    # Per i «CSS morti» si usa l'elenco LARGO: basta che il nome compaia da
    # qualche parte perche' la regola non sia dichiarata morta.
    senza_uso = {c: v for c, v in definite.items()
                 if c not in citate and not ESTERNE.match(c) and not forse_costruita(c)}

    return senza_regola, senza_uso, len(definite), len(usate)


CASI = [
    # (etichetta, css, html, classe cercata, deve_comparire_fra_le_senza_regola)
    ('classe_usata_senza_regola', '.altra { color: red; }',
     '<div class="tema-orfano-xyz"></div>', 'tema-orfano-xyz', True),
    ('classe_usata_E_definita', '.tema-presente-xyz { color: red; }',
     '<div class="tema-presente-xyz"></div>', 'tema-presente-xyz', False),
    ('classe_solo_in_un_commento_html', '.altra { color: red; }',
     '<!-- <div class="tema-commentato-xyz"></div> -->', 'tema-commentato-xyz', False),
]


def autoprova():
    import shutil
    import tempfile
    global BASE
    vero = BASE
    esiti = []
    for etichetta, css, html, classe, atteso in CASI:
        d = pathlib.Path(tempfile.mkdtemp())
        (d / 'js').mkdir()
        (d / 'css').mkdir()
        (d / 'prova.css').write_text(css, encoding='utf-8')
        (d / 'prova.html').write_text(html, encoding='utf-8')
        BASE = d
        try:
            senza_regola, _, _, _ = esamina()
        finally:
            BASE = vero
            shutil.rmtree(d, ignore_errors=True)
        visto = classe in senza_regola
        esiti.append((etichetta, visto == atteso, atteso))
    return esiti


if __name__ == '__main__':
    if '--autoprova' in sys.argv:
        print("Casi costruiti apposta, nei due versi:")
        for etichetta, ok, atteso in autoprova():
            print(f"   {'OK   ' if ok else 'ROTTO'} "
                  f"{'deve segnalare' if atteso else 'deve TACERE  '} {etichetta}")
        sys.exit(0 if all(e[1] for e in autoprova()) else 2)

    if not all(e[1] for e in autoprova()):
        sys.exit("Sonda inaffidabile sui casi costruiti. Nessun risultato vale. "
                 "Esegui --autoprova.")

    senza_regola, senza_uso, n_def, n_uso = esamina()

    print(f"{n_def} classi definite nei CSS, {n_uso} nominate da HTML e JavaScript.\n")

    print(f"── CLASSI USATE SENZA ALCUNA REGOLA CSS ({len(senza_regola)}) "
          f"─ una funzione che esiste e non ha aspetto")
    for c, dove in sorted(senza_regola.items()):
        print(f"   {c:<38} {', '.join(sorted(dove))[:60]}")

    print(f"\n── REGOLE CHE NON COLPISCONO NULLA ({len(senza_uso)}) ─ CSS morto, regola 5")
    for c, dove in sorted(senza_uso.items()):
        print(f"   {c:<38} {', '.join(sorted(dove))[:60]}")

    print("\nDa esaminare a mano: restano falsi positivi noti (classi applicate")
    print("dalle librerie, nomi costruiti in modi che l'euristica non copre).")
    print("Scrivere il numero di riferimento qui sopra quando sara' stabile.")
