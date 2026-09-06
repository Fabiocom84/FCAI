"""
Sostituisce i colori scritti nel JavaScript con i token gia esistenti.

COSA FA, E SOPRATTUTTO COSA NON FA
Converte SOLO le occorrenze che soddisfano entrambe le condizioni:

  1. stanno in una posizione dove `var(--x)` viene risolto dal browser
     (markup, `style.*`, `cssText`, attributi SVG);
  2. il loro valore ha GIA un token in `css/variables.css`.

Non inventa token nuovi. La Fase 3 ne ha prodotti 305 partendo dal CSS, con
resa verificata identica su 42 combinazioni di pagina: quei valori sono gia
stati misurati, e riusarli e una sostituzione dimostrabile. Crearne di nuovi da
qui sarebbe una decisione di tavolozza travestita da lavoro meccanico.

DUE CATEGORIE RESTANO FUORI, E IL MOTIVO E DIVERSO PER CIASCUNA

  grafici (Chart.js)  IMPOSSIBILE. Il canvas non risolve le variabili CSS:
                      `fillStyle = 'var(--x)'` non produce un errore, produce
                      un colore nero o trasparente. Il difetto piu insidioso
                      possibile — silenzioso e visibile solo guardando.
                      Convertibili in futuro leggendo il valore con
                      `getComputedStyle`, che e una modifica diversa.

  mappe su dati       SBAGLIATO. `attivita.js:200-218` associa 16 colori
                      Material a categorie di attivita. Non sono la tavolozza
                      dell'applicazione: sono identificatori di dati. Renderli
                      token gonfierebbe la tavolozza di 16 valori usati una
                      volta, e renderebbe piu difficile cambiare il colore di
                      una categoria.

LE REGOLE DI CLASSIFICAZIONE NON SONO RICOPIATE: si importano da
`classifica_colori_js`. Due copie della stessa regola sono due occasioni di
divergere, ed e il difetto che questo progetto ha gia incontrato in
`post_restore_grants.sql` (tre copie dello stesso elenco) e in `permessi.py`
(quattro helper per la stessa domanda).

    python strumenti/converte_colori_js.py            # mostra, non tocca
    python strumenti/converte_colori_js.py --applica  # scrive
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from classifica_colori_js import COLORE, classifica  # noqa: E402

RADICE = pathlib.Path(__file__).resolve().parent.parent

# Solo queste. L'elenco e CHIUSO: una categoria nuova non diventa convertibile
# per distrazione, deve essere aggiunta qui da qualcuno che ci ha pensato.
CATEGORIE_CONVERTIBILI = {
    'dentro una stringa di markup',
    'assegnazione a style.*',
    'attributo SVG (fill / stroke)',
}

# `cssText` e i ternari che alimentano `style` finiscono in 'altro' perche il
# classificatore guarda solo cio che precede il colore. Li si riconosce dalla
# riga intera, ed e l'unica eccezione ammessa alla regola qui sopra.
ALTRO_MA_CONVERTIBILE = re.compile(r"\.style\b|cssText|setProperty\(")


def normalizza(c):
    c = c.strip().lower().replace(' ', '')
    if c.startswith('#') and len(c) == 4:
        c = '#' + ''.join(x * 2 for x in c[1:])
    return c


def carica_token():
    testo = (RADICE / 'css' / 'variables.css').read_text(encoding='utf-8', errors='replace')
    return {normalizza(v): n for n, v in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", testo)}


def eol(testo_grezzo: bytes) -> str:
    """
    Il file va riscritto con le SUE terminazioni di riga.

    Lezione della Fase 3: scrivere con `newline='\\n'` ha trasformato file CRLF
    in differenze che coprivano l'intero file, rendendo impossibile distinguere
    la modifica reale dal rumore.
    """
    return '\r\n' if b'\r\n' in testo_grezzo else '\n'


def converti(applica=False):
    token = carica_token()
    totale = saltati_categoria = saltati_senza_token = 0
    per_file = {}

    for f in sorted((RADICE / 'js').glob('*.js')):
        grezzo = f.read_bytes()
        fine_riga = eol(grezzo)
        righe = grezzo.decode('utf-8', errors='replace').replace('\r\n', '\n').split('\n')
        cambi = []

        for i, riga in enumerate(righe):
            spoglia = riga.strip()
            if spoglia.startswith('//') or spoglia.startswith('*'):
                continue

            nuova, spostamento = riga, 0
            for m in COLORE.finditer(riga):
                categoria = classifica(riga, m.start())
                ammessa = (categoria in CATEGORIE_CONVERTIBILI
                           or (categoria.startswith('altro')
                               and ALTRO_MA_CONVERTIBILE.search(riga)))
                if not ammessa:
                    saltati_categoria += 1
                    continue

                nome = token.get(normalizza(m.group(0)))
                if not nome:
                    saltati_senza_token += 1
                    continue

                sostituto = f"var({nome})"
                a, b = m.start() + spostamento, m.end() + spostamento
                nuova = nuova[:a] + sostituto + nuova[b:]
                spostamento += len(sostituto) - (m.end() - m.start())
                totale += 1
                cambi.append((i + 1, m.group(0), nome, categoria))

            righe[i] = nuova

        if cambi:
            per_file[f.name] = cambi
            if applica:
                f.write_bytes(fine_riga.join(righe).encode('utf-8'))

    return totale, saltati_categoria, saltati_senza_token, per_file


applica = '--applica' in sys.argv
n, sc, st, per_file = converti(applica)

print(f"{'APPLICATE' if applica else 'DA APPLICARE (nessun file toccato)'}: "
      f"{n} sostituzioni in {len(per_file)} file\n")
for nome, cambi in sorted(per_file.items(), key=lambda x: -len(x[1])):
    print(f"  {len(cambi):3d}  {nome}")

print(f"\nNON convertite:")
print(f"  {sc:3d}  categoria esclusa (grafici, mappe su dati, confronti)")
print(f"  {st:3d}  posizione convertibile ma il valore non ha un token")
print(f"\nControllo: {n} + {sc} + {st} = {n + sc + st} occorrenze totali")

if not applica:
    print("\nRilancia con --applica per scrivere.")
