"""
Verifica che ogni `segnala(X)` sia DENTRO un `catch (X)`.

PERCHE ESISTE — 06/09/2026
`collega_segnala.py` inseriva la chiamata sulla riga SUCCESSIVA a quella del
`console.*` trovato nel catch. Corretto quando il catch occupa piu righe;
sbagliato quando sta tutto su una sola:

    } catch (e) { console.error("...", e); }
    segnala(e);        // <- FUORI dal blocco: `e` non e definita

Il risultato e un `ReferenceError` a runtime, su una pagina che gli utenti
aprono ogni giorno. Non l'ha trovato nessun controllo: l'ha trovato Fabio
aprendo la pagina, dopo che la modifica era gia stata committata e distribuita.

Il difetto non e l'errore di confine — quelli capitano. Il difetto e che lo
strumento non aveva **nessuna verifica del proprio esito**: contava le
sostituzioni fatte, non se fossero valide. Contare quante volte si e scritto non
e verificare cosa si e scritto, ed e la terza volta in questa sessione che la
distinzione si paga.

Questo file e quel controllo, e va eseguito DOPO ogni passata del collegatore.

    python strumenti/verifica_segnala.py
"""
import pathlib
import re
import sys

RADICE = pathlib.Path(__file__).resolve().parent.parent

CHIAMATA = re.compile(r"(?<![\w.])segnala\s*\(\s*([A-Za-z_$][\w$]*)\s*\)")
CATCH = re.compile(r"\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{")


def blocchi_catch(testo):
    """[(variabile, offset_apertura, offset_chiusura)] per ogni catch del file."""
    trovati = []
    for m in CATCH.finditer(testo):
        i = m.end() - 1          # posizione della graffa di apertura
        livello = 0
        for j in range(i, len(testo)):
            if testo[j] == '{':
                livello += 1
            elif testo[j] == '}':
                livello -= 1
                if livello == 0:
                    trovati.append((m.group(1), i, j))
                    break
    return trovati


guasti, verificate = [], 0
for f in sorted((RADICE / 'js').glob('*.js')):
    testo = f.read_text(encoding='utf-8', errors='replace')
    if 'segnala(' not in testo:
        continue
    catch = blocchi_catch(testo)

    for m in CHIAMATA.finditer(testo):
        variabile, pos = m.group(1), m.start()
        riga = testo.count('\n', 0, pos) + 1

        # `api-client.js` definisce la funzione e la usa nella rete di
        # sicurezza, dove la variabile e `errore` e non viene da un catch.
        if f.name == 'api-client.js':
            continue

        dentro = [v for v, a, c in catch if a < pos < c]
        if not dentro:
            guasti.append((f.name, riga, variabile, 'FUORI da qualsiasi catch'))
        elif variabile not in dentro:
            guasti.append((f.name, riga, variabile,
                           f"dentro un catch, ma la variabile e '{dentro[-1]}'"))
        else:
            verificate += 1

print(f"chiamate a segnala() verificate corrette: {verificate}")
print(f"GUASTE: {len(guasti)}\n")
for nome, riga, var, motivo in guasti:
    print(f"  {nome}:{riga}  segnala({var})  ->  {motivo}")

print()
print("Controllo positivo — la sonda saprebbe riconoscere un caso guasto?")
prova = "function f(){ try { g(); } catch (e) { console.error(e); }\nsegnala(e);\n}"
c = blocchi_catch(prova)
m = CHIAMATA.search(prova)
fuori = not any(a < m.start() < ch for _, a, ch in c)
print(f"    su un caso costruito apposta: {'SI, lo vede' if fuori else 'NO — la sonda e cieca'}")

sys.exit(1 if guasti else 0)
