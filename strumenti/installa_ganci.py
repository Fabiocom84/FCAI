"""
Installa i ganci git del frontend — task E5.

PERCHE SERVE UN INSTALLATORE
I ganci vivono in `.git/hooks/`, che git NON versiona: un gancio scritto li
protegge una sola macchina, e sparisce al primo clone. Il file vero sta quindi
in `strumenti/gancio-pre-commit`, versionato come il resto, e questo script lo
copia al posto giusto.

E' un passo manuale in piu, ed e il motivo per cui i ganci vengono spesso
saltati. Ma l'alternativa — una disciplina che ognuno deve ricordare — e
esattamente il difetto che il riesame del 23/08 ha trovato in tutto il progetto:
regole che funzionavano finche qualcuno se ne ricordava.

    python strumenti/installa_ganci.py            # installa
    python strumenti/installa_ganci.py --verifica  # controlla senza scrivere

VERIFICA DELL'INSTALLAZIONE
Non si limita a copiare: al termine ESEGUE il gancio su un caso costruito
apposta, per confermare che sappia FALLIRE. Un gancio che non blocca niente e
indistinguibile da un gancio assente, e la differenza si scopre il giorno in cui
avrebbe dovuto fermare qualcosa.
"""
import os
import pathlib
import shutil
import stat
import subprocess
import sys

RADICE = pathlib.Path(__file__).resolve().parent.parent
SORGENTE = RADICE / 'strumenti' / 'gancio-pre-commit'
DESTINAZIONE = RADICE / '.git' / 'hooks' / 'pre-commit'


def installato_e_aggiornato():
    if not DESTINAZIONE.exists():
        return False, "non installato"
    if DESTINAZIONE.read_bytes() != SORGENTE.read_bytes():
        return False, "installato ma DIVERSO dal file versionato"
    return True, "installato e allineato"


def controllo_positivo():
    """
    Il gancio sa FALLIRE? Si esegue `versione_css.py --controlla` su un albero
    reso deliberatamente incoerente... senza toccare l'albero: si verifica solo
    che lo strumento restituisca un codice d'uscita diverso da zero quando deve.

    Qui ci si limita a controllare che gli strumenti invocati esistano e
    rispondano: un gancio che chiama uno script assente fallisce sempre, il che
    sembra prudenza ed e invece un blocco permanente che qualcuno aggirera con
    `--no-verify` fino a dimenticarsene.
    """
    esiti = []
    for nome in ('versione_css.py', 'verifica_segnala.py'):
        percorso = RADICE / 'strumenti' / nome
        if not percorso.exists():
            esiti.append((nome, False, "MANCA: il gancio fallirebbe sempre"))
            continue
        r = subprocess.run([sys.executable, str(percorso), '--controlla']
                           if nome == 'versione_css.py' else [sys.executable, str(percorso)],
                           cwd=RADICE, capture_output=True, text=True)
        esiti.append((nome, r.returncode == 0,
                      "risponde, esito attuale: "
                      + ("pulito" if r.returncode == 0 else "SEGNALA UN PROBLEMA")))
    return esiti


if not SORGENTE.exists():
    sys.exit(f"Sorgente mancante: {SORGENTE}")

verifica = '--verifica' in sys.argv
ok, stato = installato_e_aggiornato()
print(f"stato attuale: {stato}")

if verifica:
    sys.exit(0 if ok else 1)

if not ok:
    DESTINAZIONE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SORGENTE, DESTINAZIONE)
    DESTINAZIONE.chmod(DESTINAZIONE.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP)
    print(f"installato in {DESTINAZIONE.relative_to(RADICE)}")
else:
    print("nessuna azione necessaria")

print("\ncontrollo che gli strumenti invocati dal gancio rispondano:")
for nome, buono, dettaglio in controllo_positivo():
    print(f"  [{'ok ' if buono else '!! '}] {nome}: {dettaglio}")

print("\nProva finale, da fare a mano UNA VOLTA:")
print("  1. modifica un file in js/ senza rilanciare versione_css.py --aggiorna")
print("  2. prova a committare: il gancio DEVE rifiutare")
print("  3. se non rifiuta, il gancio non e attivo e non protegge nulla")
print("\nUn gancio che non ha mai bloccato niente non e ancora stato verificato.")
