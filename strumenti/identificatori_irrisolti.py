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
  * parametri di arrow function (`new Promise((resolve) => ...)` da `resolve`);
  * parole dentro commenti o stringhe ANNIDATI in una interpolazione `${...}`:
    la ripulitura tiene il codice interpolato — deve, perche li dentro ci sono
    riferimenti veri — e non lo ripulisce a sua volta. Da `style="...var(--col-x)"`
    dentro un template esce `var`.
Toglierli richiederebbe un parser JavaScript vero. Con una manciata di voci
stabili, elencarle e piu onesto che nasconderle dietro un filtro che un giorno
zittirebbe anche un caso vero.

RIFERIMENTO: l'08/09/2026, su tutti i `js/*.js`, le voci sono **15** — sette
`var`, cinque `resolve`, piu' `reject`, `fn`, `O`, `database`. Erano trenta
prima che venissero riconosciuti i metodi in forma abbreviata, la
destrutturazione, le classi e gli import predefiniti: quattro lacune dello
strumento, non del codice.

Questo numero e' il riferimento, ed e' il motivo per cui vale la pena scriverlo:
**sedici voci vogliono dire che ce n'e' una nuova**, e va guardata. Senza un
valore atteso, un elenco lungo si scorre e basta — che e' il modo in cui un
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


def ripulisci(t):
    """Toglie commenti e testo delle stringhe, TENENDO il codice dentro ${...}.

    Senza questo passaggio il controllo legge `var(--col-888888)` dentro una
    stringa CSS e riporta `var` fra i non risolti, insieme a una quarantina di
    parole di commento. Un elenco cosi non e severo: e cieco, perche il caso
    vero ci sta dentro senza distinguersi.
    """
    fuori, i, n = [], 0, len(t)
    while i < n:
        c = t[i]
        if c == '/' and i + 1 < n and t[i + 1] == '/':
            i = t.find('\n', i)
            i = n if i < 0 else i
        elif c == '/' and i + 1 < n and t[i + 1] == '*':
            j = t.find('*/', i + 2)
            i = n if j < 0 else j + 2
        elif c in '"\'':
            i += 1
            while i < n and t[i] != c:
                i += 2 if t[i] == '\\' else 1
            i += 1
        elif c == '`':
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
                            fuori.append(t[i])
                        i += 1
                    fuori.append(';')
                else:
                    i += 1
            i += 1
        else:
            fuori.append(c)
            i += 1
    return ''.join(fuori)


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
        for pezzo in blocco.split(','):
            pezzo = pezzo.strip()
            if pezzo:
                definiti.add(pezzo.split(':')[-1].strip())
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


if __name__ == '__main__':
    percorsi = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not percorsi:
        sys.exit(__doc__)

    totale = 0
    for p in percorsi:
        ignoti = irrisolti(pathlib.Path(p).read_text(encoding='utf-8', errors='replace'))
        totale += len(ignoti)
        print(f"{p:<40} {', '.join(ignoti) if ignoti else 'nessuno'}")

    print("\nControllo positivo — la sonda saprebbe riconoscere un caso guasto?")
    if controllo_positivo():
        print("    su un caso costruito apposta: SI, lo vede")
    else:
        print("    NO. La sonda e cieca: qualunque risultato qui sopra non vale nulla.")
        sys.exit(2)

    print(f"\n{totale} voci da esaminare a mano (vedi FALSI POSITIVI NOTI in testa al file).")
