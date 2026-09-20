"""Cerca gli identificatori chiamati e mai definiti: il difetto che sfugge a tutto il resto.

PERCHE ESISTE
Spostare una funzione da un file all'altro non produce MAI un errore di
sintassi. `node --check` passa, il commit passa, la distribuzione passa. Il
difetto si manifesta come `ReferenceError` alla prima esecuzione, su una pagina
che qualcuno apre — ed e gia successo il 06/09/2026 con otto chiamate a
`segnala()` finite fuori dal loro `catch`: arrivate in staging, trovate da Fabio
aprendo una pagina, non da un controllo.

    python strumenti/identificatori_irrisolti.py js/commesse.js js/commesse-geo.js
    python strumenti/identificatori_irrisolti.py js/*.js

NON E UN GANCIO PRE-COMMIT, ed e una scelta.
Restano falsi positivi noti (elencati sotto). Un controllo che blocca il commit
per un motivo sbagliato insegna a scavalcarlo con `--no-verify`, e da quel
momento non protegge piu nulla continuando a sembrare una protezione. Lo stesso
ragionamento sta scritto in `gancio-pre-commit`.

FALSI POSITIVI NOTI, e perche non li tolgo
  * parametri di funzione usati come callback, arrow o no: da
    `new Promise((resolve) => ...)` esce `resolve`, da
    `rimpiazzaGrafico(id, stato, costruisci)` esce `costruisci`. Sono nomi
    CHIAMATI la cui dichiarazione sta in una lista di parametri semplice, che
    lo strumento non legge. I parametri DESTRUTTURATI invece si', dal
    20/09/2026: quelli non erano una manciata stabile — ne nasceva uno per ogni
    estrazione, perche' e' cosi' che si passa il rientro (`ricaricaDati`,
    `apriIspettore`);
  * parole dentro commenti o stringhe ANNIDATI in una interpolazione `${...}`:
    la ripulitura tiene il codice interpolato — deve, perche li dentro ci sono
    riferimenti veri — e non lo ripulisce a sua volta. Da `style="...var(--col-x)"`
    dentro un template esce `var`.
Toglierli richiederebbe un parser JavaScript vero. Con una manciata di voci
stabili, elencarle e piu onesto che nasconderle dietro un filtro che un giorno
zittirebbe anche un caso vero.

RIFERIMENTO: l'08/09/2026, su tutti i `js/*.js`, le voci sono **15** — sei
`var`, cinque `resolve`, piu' `reject`, `fn`, `O`, `database`. Erano trenta
prima che venissero riconosciuti i metodi in forma abbreviata, la
destrutturazione, le classi e gli import predefiniti: quattro lacune dello
strumento, non del codice.

  *Ricontato il 19/09/2026 dopo la modifica a `ripulisci()`: totale ancora 15,
  invariato — che era la verifica che contava. Ma la scomposizione diceva
  «sette var» e sommava quindi a 16, uno in piu' del totale dichiarato due
  righe sopra. Corretta a sei. Un numero di riferimento con accanto una
  scomposizione che non torna invita a fidarsi del totale senza ricontarlo,
  che e' esattamente cio' contro cui il riferimento esiste.*

  *Rimisurato il 20/09/2026 su 45 moduli: **16 voci** — sei `var`, cinque
  `resolve`, piu' `reject`, `fn`, `O`, `database`, `costruisci`. Il riferimento
  ha fatto il suo lavoro alla lettera: la riga qui sotto diceva «sedici voci
  vogliono dire che ce n'e' una nuova», erano sedici, e la nuova era
  `costruisci` — famiglia gia' documentata (parametro-callback), non una classe
  nuova. Nello stesso giro hanno smesso di comparire `apriIspettore` e
  `ricaricaDati`, che erano invece una classe in crescita: la destrutturazione
  nelle liste di parametri, ora riconosciuta.*

  *Non provo a far quadrare 15 e 16 voce per voce: in mezzo ci sono nove moduli
  nuovi e una lacuna chiusa, e non so se `ricaricaDati` fosse gia' dentro il
  conteggio del 19/09 — `gestione-filtri.js` e' nato quel giorno. Il totale
  misurato oggi e' 16, la scomposizione qui sopra somma a 16, e quello e' il
  riferimento. Una riconciliazione ricostruita a posteriori sarebbe una
  ricostruzione, non una misura.*

Questo numero e' il riferimento, ed e' il motivo per cui vale la pena scriverlo:
**diciassette voci vogliono dire che ce n'e' una nuova**, e va guardata. Senza
un valore atteso, un elenco lungo si scorre e basta — che e' il modo in cui un
controllo smette di controllare pur continuando a girare.
"""
import pathlib
import re
import sys

GLOBALI = set("""window document console Math JSON Object Array String Number Boolean Date Promise
Map Set RegExp Error parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent
setTimeout setInterval clearTimeout clearInterval fetch alert confirm prompt localStorage
sessionStorage FormData URLSearchParams File FileReader Blob requestAnimationFrame Symbol Intl
queueMicrotask structuredClone navigator location history CustomEvent Event AbortController
if for while switch catch try return typeof new delete throw case function super this async
await else do void in of import
MediaRecorder Audio AudioContext Image Uint8Array Int8Array Float32Array ArrayBuffer
L Choices XLSX Chart Papa mammoth QRCode Leaflet""".split())


def ripulisci(t, tieni_stringhe=False):
    """Toglie commenti e testo delle stringhe, TENENDO il codice dentro ${...}.

    Senza questo passaggio il controllo legge `var(--col-888888)` dentro una
    stringa CSS e riporta `var` fra i non risolti, insieme a una quarantina di
    parole di commento. Un elenco cosi non e severo: e cieco, perche il caso
    vero ci sta dentro senza distinguersi.

    `tieni_stringhe=True` toglie SOLO i commenti, lasciando le stringhe intatte.
    Serve a chi deve leggere qualcosa che VIVE dentro una stringa — il percorso
    di un import, per esempio: `from './commesse-geo.js'` senza le stringhe
    diventa `from ''`, e un controllo sugli import che non vede piu' nessun
    import riporta «nessun guasto». Sarebbe un falso NEGATIVO al posto di un
    falso positivo, cioe' un peggioramento travestito da correzione.

    In entrambi i modi le RIGHE si conservano: al posto di cio' che viene tolto
    restano i suoi a capo. Chi usa questa funzione per segnalare un numero di
    riga — `controlla_pagine.py` lo fa per le chiavi duplicate — otterrebbe
    altrimenti numeri che non corrispondono al file, ed e' il genere di errore
    che manda a cercare nel punto sbagliato.
    """
    fuori, i, n = [], 0, len(t)
    while i < n:
        c = t[i]
        if c == '/' and i + 1 < n and t[i + 1] == '/':
            i = t.find('\n', i)
            i = n if i < 0 else i
        elif c == '/' and i + 1 < n and t[i + 1] == '*':
            j = t.find('*/', i + 2)
            fine = n if j < 0 else j + 2
            fuori.append('\n' * t.count('\n', i, fine))
            i = fine
        elif c in '"\'':
            inizio = i
            i += 1
            while i < n and t[i] != c:
                i += 2 if t[i] == '\\' else 1
            i = min(i + 1, n)
            fuori.append(t[inizio:i] if tieni_stringhe
                         else '\n' * t.count('\n', inizio, i))
        elif c == '`':
            inizio, interpolato = i, []
            i += 1
            while i < n and t[i] != '`':
                if t[i] == '\\':
                    i += 2
                elif t[i] == '$' and i + 1 < n and t[i + 1] == '{':
                    liv, i = 1, i + 2
                    while i < n and liv:            # il codice interpolato resta
                        if t[i] == '{':
                            liv += 1
                        elif t[i] == '}':
                            liv -= 1
                        if liv:
                            interpolato.append(t[i])
                        i += 1
                    interpolato.append(';')
                else:
                    i += 1
            i = min(i + 1, n)
            if tieni_stringhe:
                fuori.append(t[inizio:i])
            else:
                fuori.append(''.join(interpolato))
                mancanti = t.count('\n', inizio, i) - ''.join(interpolato).count('\n')
                fuori.append('\n' * max(0, mancanti))
        else:
            fuori.append(c)
            i += 1
    return ''.join(fuori)


def nomi_destrutturati(blocco):
    """I nomi LOCALI introdotti da un blocco di destrutturazione.

    Da `{ a, b: c, d = 1, ...resto }` rende `a`, `c`, `d`, `resto`. Conta il
    nome locale, non la chiave: in `b: c` e' `c` a esistere nello scope, ed e'
    `c` che potrebbe essere chiamato.

    Estratta il 20/09/2026, quando e' servita anche per le liste di parametri:
    la stessa manciata di righe scritta due volte significa che la prossima
    correzione ne raggiunge una sola. Prima non gestiva i valori predefiniti —
    da `{ d = 1 }` usciva il nome `d = 1`, che non corrisponde a niente — ne' il
    rest: due falsi positivi silenziosi in meno.
    """
    nomi = set()
    for pezzo in blocco.split(','):
        pezzo = pezzo.split('=')[0].strip()        # via il valore predefinito
        pezzo = pezzo.split(':')[-1].strip()       # rinomina: il locale e' a destra
        pezzo = pezzo.lstrip('.').strip()          # rest: `...resto` -> `resto`
        if pezzo:
            nomi.add(pezzo)
    return nomi


def irrisolti(sorgente):
    t = ripulisci(sorgente)
    definiti = set(re.findall(r'(?:^|\s)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', t))
    definiti |= set(re.findall(r'(?:let|const|var|class)\s+([A-Za-z_$][\w$]*)', t))
    definiti |= set(re.findall(r'([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s+)?(?:function|\()', t))
    # METODI IN FORMA ABBREVIATA — `handleViewChange() {` invece di
    # `handleViewChange: function () {`. Aggiunto l'08/09/2026: `gestione.js`
    # mescola i due stili, e senza questa riga lo strumento scambiava OGNI
    # definizione abbreviata per una chiamata a qualcosa di inesistente,
    # riportando 17 falsi positivi su un file solo. Un elenco cosi' non e'
    # severo, e' inutilizzabile: il caso vero ci starebbe dentro senza
    # distinguersi, che e' il difetto contro cui questo strumento esiste.
    definiti |= set(re.findall(r'^\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{', t, re.M))
    # DESTRUTTURAZIONE: `const { mostraAvviso } = await import('./shared-ui.js')`.
    # Senza, ogni nome preso cosi' risultava non definito — e uno di questi e'
    # proprio `mostraAvviso`, introdotto in `api-client.js` il 06/09 dallo stesso
    # lavoro che questo strumento doveva sorvegliare.
    for blocco in re.findall(r'(?:const|let|var)\s*\{([^}]*)\}\s*=', t):
        definiti |= nomi_destrutturati(blocco)
    # DESTRUTTURAZIONE NELLA LISTA DEI PARAMETRI: `function f({ a, b })`.
    # Il blocco qui sopra copre solo le DICHIARAZIONI. Aggiunto il 20/09/2026,
    # e il motivo per cui mancava e' che il difetto si vede solo quando uno di
    # quei nomi viene CHIAMATO — cioe' quando e' un callback. E' diventato
    # frequente da quando le estrazioni passano il rientro cosi': `ricaricaDati`
    # in `gestione-filtri.js`, `apriIspettore` in `attivita-carta.js`. Non e' una
    # manciata stabile di falsi positivi: ne nasce uno per ogni estrazione.
    #
    # I DUE SCHEMI ANCORANO A `function` E A `=>` di proposito. Un `{...}`
    # dentro una CHIAMATA — `apriPopupFiltro({ id, nome })` — NON va accettato:
    # li' la forma abbreviata significa che quei nomi devono gia' esistere nello
    # scope, e metterli fra i definiti nasconderebbe un caso vero.
    for blocco in re.findall(r'function\s*[A-Za-z_$]?[\w$]*\s*\(\s*\{([^}]*)\}', t):
        definiti |= nomi_destrutturati(blocco)
    for blocco in re.findall(r'\(\s*\{([^}]*)\}\s*\)\s*=>', t):
        definiti |= nomi_destrutturati(blocco)
    importati = set()
    for blocco in re.findall(r'import\s*\{([^}]*)\}', sorgente):
        importati |= {x.strip().split(' as ')[-1] for x in blocco.split(',') if x.strip()}
    # Import PREDEFINITO e di NAMESPACE: `import Legend from './legend.js'`,
    # `import * as X from ...`. Leggevo solo le graffe, quindi ogni nome
    # importato cosi' risultava non definito — `Legend` compariva come guasto in
    # due file mentre e' importato regolarmente in entrambi.
    importati |= set(re.findall(r"import\s+([A-Za-z_$][\w$]*)\s*(?:,|\s+from)", sorgente))
    importati |= set(re.findall(r"import\s+\*\s+as\s+([A-Za-z_$][\w$]*)", sorgente))
    chiamati = set(re.findall(r'(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(', t))
    return sorted(chiamati - definiti - importati - GLOBALI)


# Un controllo che non ho mai visto trovare qualcosa non dice nulla quando tace.
# Questo caso riproduce la dimenticanza tipica di un'estrazione: la funzione si
# sposta, la chiamata resta indietro senza l'import.
CASO_GUASTO = """
import { apiFetch } from './api-client.js';
function usata() { return apiFetch('/x'); }
function avvio() { usata(); spostataAltrove(); }
"""


def controllo_positivo():
    return 'spostataAltrove' in irrisolti(CASO_GUASTO)


# Il riconoscimento della destrutturazione nei PARAMETRI, aggiunto il
# 20/09/2026, puo' peccare per eccesso: una regola troppo larga smette di
# segnalare e nessuno se ne accorge, perche' un elenco piu' corto sembra un
# miglioramento. Questo caso prova i DUE versi su un file solo — `apriDettaglio`
# e' un parametro destrutturato e chiamato, e deve tacere; `scomparsa` non
# esiste da nessuna parte, e deve continuare a vedersi.
CASO_DESTRUTTURATO = """
export function crea({ task, apriDettaglio }) {
    apriDettaglio(task.id);
    scomparsa();
}
"""


def controllo_destrutturazione():
    voci = irrisolti(CASO_DESTRUTTURATO)
    return ('apriDettaglio' not in voci, 'scomparsa' in voci)


def stampa_controlli():
    """Esegue i controlli sulla sonda e dice se e' cieca. Rende True se regge.

    ESISTE PER LA CI, e la ragione e' un buco trovato il 20/09/2026. In
    `controlli.yml` il passo di questo strumento ha `continue-on-error: true`,
    giustissimo per l'ELENCO — che ha falsi positivi noti e non deve bloccare —
    ma cosi' viene ingoiato anche il codice d'uscita di un AUTOCONTROLLO
    fallito. La sonda potrebbe diventare cieca e la CI resterebbe verde.
    Separando i due passi, l'elenco resta informativo e la cecita' blocca.
    """
    ok = controllo_positivo()
    print("Controllo positivo — la sonda saprebbe riconoscere un caso guasto?")
    print("    su un caso costruito apposta: SI, lo vede" if ok else
          "    NO. La sonda e cieca: qualunque elenco non vale nulla.")

    tace, vede = controllo_destrutturazione()
    print("\nDestrutturazione nei parametri — nei due versi:")
    print(f"    su un callback destrutturato e chiamato, deve TACERE: {'SI' if tace else 'NO'}")
    print(f"    su un nome che non esiste, deve vederlo ancora:       {'SI' if vede else 'NO'}")
    if not (tace and vede):
        print("    La regola sui parametri e sbagliata: troppo larga zittisce i casi veri.")
    return ok and tace and vede


if __name__ == '__main__':
    # `--solo-controlli` non vuole file: serve al passo bloccante della CI.
    if '--solo-controlli' in sys.argv:
        sys.exit(0 if stampa_controlli() else 2)

    # I caratteri jolly si espandono QUI, e non e' pignoleria: bash li espande
    # prima di lanciare il programma, PowerShell no. La riga d'uso scritta in
    # testa a questo file — `js/*.js` — falliva quindi sulla macchina di chi lo
    # usa ogni giorno, con un `OSError: Invalid argument: 'js\*.js'` che non
    # nomina la causa. Un documento che descrive un comando che sulla macchina
    # del lettore non funziona e' la stessa forma di errore che questo progetto
    # insegue da giorni: espanderli qui la toglie di mezzo per entrambe le shell.
    percorsi = []
    for a in sys.argv[1:]:
        if a.startswith('--'):
            continue
        if any(x in a for x in '*?['):
            percorsi += sorted(str(p) for p in pathlib.Path().glob(a.replace('\\', '/')))
        else:
            percorsi.append(a)
    if not percorsi:
        sys.exit(__doc__)

    totale = 0
    for p in percorsi:
        ignoti = irrisolti(pathlib.Path(p).read_text(encoding='utf-8', errors='replace'))
        totale += len(ignoti)
        print(f"{p:<40} {', '.join(ignoti) if ignoti else 'nessuno'}")

    print()
    if not stampa_controlli():
        sys.exit(2)

    print(f"\n{totale} voci da esaminare a mano (vedi FALSI POSITIVI NOTI in testa al file).")
