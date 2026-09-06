"""
Collega `segnala()` alle letture che catturano l'errore e non lo mostrano.

IL PROBLEMA, MISURATO
`inventario_letture.py` conta 68 letture dal backend. Di queste, **33 catturano
l'errore e scrivono solo in console**: catturandolo disinnescano la rete di
sicurezza del task 4.0, che interviene solo sulle promesse NON gestite. Il
risultato e che l'utente non vede niente — non per mancanza di una difesa, ma
perche il codice la spegne prima che scatti.

COSA FA QUESTO STRUMENTO
Aggiunge `segnala(e);` accanto al `console.*` gia presente nel `catch`, e
l'import se manca. **Non cambia il flusso**: il codice attorno continua a
comportarsi esattamente come prima, in piu l'utente vede il messaggio — che dal
task 4.0 e quello del backend, non un generico.

QUATTRO SONO ESCLUSE DI PROPOSITO, e l'elenco e chiuso:
i contatori dei contrassegni e i sondaggi di stato girano in sottofondo, e un
avviso a ogni singhiozzo di rete sarebbe rumore che insegna a ignorare gli
avvisi. Il silenzio li e una scelta — e da oggi e scritta, invece di essere
indistinguibile da una dimenticanza.

    python strumenti/collega_segnala.py            # mostra, non tocca
    python strumenti/collega_segnala.py --applica  # scrive
"""
import pathlib
import re
import sys

RADICE = pathlib.Path(__file__).resolve().parent.parent

# ELENCO CHIUSO delle letture in SOTTOFONDO: file -> righe da lasciare mute.
# Aggiungere qui significa dichiarare "il silenzio e voluto", non "non ci ho
# pensato". La differenza fra le due, in un file, e questo elenco.
IN_SOTTOFONDO = {
    'main.js': {238, 265},          # contatori dei contrassegni
    'attivita.js': {555},           # sondaggio delle notifiche
    'admin-training.js': {119},     # stato dell'addestramento, in polling
}

LETTURA = re.compile(r"(apiFetch|apiClient\.get)\s*\(")
APERTURA_CATCH = re.compile(r"\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{")
REGISTRA = re.compile(r"console\.(log|error|warn|debug)\s*\(")
# Stessa espressione di `inventario_letture.py`: se il catch aggiorna
# l'interfaccia, l'utente e gia informato.
AVVISA = re.compile(r"mostraAvviso|alert\(|showToast|textContent\s*=|innerHTML\s*=")
# Il `;?` finale fa parte della corrispondenza: senza, la sostituzione ne
# aggiungeva un secondo (`...js';;`). Innocuo per JavaScript, ma un diff che
# contiene rumore rende piu difficile vedere la modifica vera — ed e la ragione
# per cui in Fase 3 si e insistito sulle terminazioni di riga.
IMPORT_CLIENT = re.compile(r"^[ \t]*import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]*api-client[^'\"]*)['\"]\s*;?", re.M)


def eol(grezzo: bytes) -> str:
    return '\r\n' if b'\r\n' in grezzo else '\n'


def trova_catch(righe, i, entro=40):
    """(indice della riga del catch, nome della variabile) oppure None."""
    for j in range(i, min(i + entro, len(righe))):
        m = APERTURA_CATCH.search(righe[j])
        if m:
            return j, m.group(1)
    return None


def fine_del_catch(righe, j, entro=40):
    """
    Indice dell'ultima riga del corpo del `catch`.

    CORRETTO IL 06/09/2026. La prima stesura contava le graffe dall'INIZIO della
    riga del catch. Ma i catch qui sono scritti `} catch (e) {`: quella graffa di
    chiusura iniziale portava il livello a -1, la successiva lo riportava a 0, e
    il corpo risultava concluso sulla stessa riga. Conseguenza: il `console.error`
    della riga seguente non veniva visto, e lo strumento trovava 10 punti invece
    di 29 — senza segnalare nulla, perche "nessun console.* nel catch" e una
    condizione perfettamente legittima.

    Un difetto di CONFINE, il secondo in un'ora dopo quello del classificatore.
    Entrambi trovati confrontando il numero prodotto con quello atteso: se avessi
    creduto al 10, avrei "completato" il lavoro lasciandone fuori due terzi.

    Ora si parte dalla graffa di APERTURA del catch, non dall'inizio della riga.
    """
    m = APERTURA_CATCH.search(righe[j])
    inizio = m.end() - 1 if m else 0
    livello, iniziato = 0, False
    for k in range(j, min(j + entro, len(righe))):
        testo = righe[k][inizio:] if k == j else righe[k]
        for ch in testo:
            if ch == '{':
                livello += 1; iniziato = True
            elif ch == '}':
                livello -= 1
        if iniziato and livello <= 0:
            return k
    return min(j + entro, len(righe)) - 1


def elabora(applica=False):
    aggiunte, saltate_sottofondo, gia_a_posto = 0, 0, 0
    per_file = {}

    for f in sorted((RADICE / 'js').glob('*.js')):
        if f.name == 'api-client.js':
            continue
        grezzo = f.read_bytes()
        fine_riga = eol(grezzo)
        righe = grezzo.decode('utf-8', errors='replace').replace('\r\n', '\n').split('\n')

        da_inserire = []   # (indice_riga, testo)
        for i, riga in enumerate(righe):
            s = riga.strip()
            if s.startswith('//') or s.startswith('*') or not LETTURA.search(riga):
                continue
            # SOLO LE LETTURE. Le scritture sono gia state esaminate una per una
            # dal task 4.0c, che ne ha lasciate tre mute con motivazione scritta
            # (un involucro il cui mestiere e sollevare, due segnature di
            # notifica in sottofondo). Applicare qui a tappeto sovrascriverebbe
            # decisioni prese guardando i casi — e le sovrascriverebbe in
            # silenzio, senza che nessuno se ne accorga rileggendo il diff.
            #
            # Senza questo filtro lo strumento trovava 75 punti invece di 29:
            # il numero era due volte e mezzo l'atteso, ed e cosi che il difetto
            # e emerso.
            if re.search(r"method\s*:\s*['\"](POST|PUT|PATCH|DELETE)",
                         '\n'.join(righe[i:i + 6])):
                continue

            if (i + 1) in IN_SOTTOFONDO.get(f.name, set()):
                saltate_sottofondo += 1
                continue

            trovato = trova_catch(righe, i)
            if not trovato:
                continue                      # scoperta: ci pensa la rete
            j, variabile = trovato
            k = fine_del_catch(righe, j)
            corpo = '\n'.join(righe[j:k + 1])

            if 'segnala(' in corpo:
                gia_a_posto += 1
                continue
            if not REGISTRA.search(corpo):
                continue                      # non e "muta": ha altra gestione

            # Se il catch AVVISA GIA l'utente, non si aggiunge nulla: due
            # messaggi per un solo errore sono rumore, e il rumore insegna a
            # ignorare gli avvisi — che e il modo piu efficace di disfare il
            # lavoro del task 4.0.
            #
            # Senza questo filtro lo strumento contava 52 punti invece di 33:
            # la differenza erano esattamente i `catch` che l'inventario
            # classifica come "avvisa l'utente". Terzo scarto fra numero
            # prodotto e numero atteso in un'ora, e terza volta che il confronto
            # ha trovato il difetto prima che lo trovasse un utente.
            if AVVISA.search(corpo):
                gia_a_posto += 1
                continue

            # Si inserisce SUBITO DOPO la prima riga di console.*, per stare
            # accanto alla registrazione invece che in fondo a rami che
            # potrebbero uscire prima.
            for r in range(j, k + 1):
                if REGISTRA.search(righe[r]):
                    rientro = re.match(r"\s*", righe[r]).group(0)
                    da_inserire.append((r + 1, f"{rientro}segnala({variabile});"))
                    aggiunte += 1
                    break

        if not da_inserire:
            continue

        for pos, testo in sorted(da_inserire, reverse=True):
            righe.insert(pos, testo)

        # L'import: si aggiunge a quello esistente da api-client, se c'e.
        testo = fine_riga.join(righe) if False else '\n'.join(righe)
        m = IMPORT_CLIENT.search(testo)
        if m and 'segnala' not in m.group(1):
            nomi = [n.strip() for n in m.group(1).split(',') if n.strip()] + ['segnala']
            testo = testo[:m.start()] + f"import {{ {', '.join(nomi)} }} from '{m.group(2)}';" + testo[m.end():]
        elif not m:
            testo = "import { segnala } from './api-client.js';\n" + testo

        per_file[f.name] = len(da_inserire)
        if applica:
            f.write_bytes(fine_riga.join(testo.split('\n')).encode('utf-8'))

    return aggiunte, saltate_sottofondo, gia_a_posto, per_file


applica = '--applica' in sys.argv
n, sf, gia, per_file = elabora(applica)

print(f"{'APPLICATE' if applica else 'DA APPLICARE (nessun file toccato)'}: "
      f"{n} chiamate a segnala() in {len(per_file)} file\n")
for nome, c in sorted(per_file.items(), key=lambda x: -x[1]):
    print(f"  {c:3d}  {nome}")

print(f"\nNON toccate:")
print(f"  {sf:3d}  in sottofondo, silenzio VOLUTO (elenco chiuso nello strumento)")
print(f"  {gia:3d}  gia collegate")
if not applica:
    print("\nRilancia con --applica per scrivere.")
