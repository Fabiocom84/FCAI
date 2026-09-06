"""
Inventario delle LETTURE dal backend, classificate per cosa succede se falliscono.

PERCHE IL NUMERO "44 letture senza controllo" NON BASTA PIU
Quel conteggio e della Fase 4 iniziale, quando `apiFetch` non sollevava e una
lettura fallita spariva in silenzio. Dopo il task 4.0 non e piu cosi: la rete di
sicurezza in `api-client.js` mostra un avviso a ogni promessa rifiutata. Le 44
non sono piu invisibili — sono generiche.

Quindi il lavoro che resta NON e "renderle visibili". E trovare quelle in cui il
fallimento produce un risultato PLAUSIBILE invece di un'assenza:

    const duplicati = await leggiDuplicati().catch(() => []);
    if (!duplicati.length) mostra('Nessun duplicato');   // <- FALSO

Il task 4.0c ne aveva trovate tre con questa forma, tutte e tre corrette. La
domanda aperta e se ce ne siano altre. Questo strumento non lo decide: prepara
l'elenco perche la domanda si possa porre guardando i casi.

CLASSIFICAZIONE, dal piu pericoloso al meno:

  ripiego silenzioso   il fallimento produce un valore d'uso (lista vuota,
                       oggetto vuoto, null) e l'esecuzione prosegue come se il
                       dato fosse arrivato. E' la forma da guardare.
  catch che avvisa     mostra qualcosa all'utente: si puo migliorare il
                       messaggio, ma non mente.
  catch che registra   solo `console.*`: l'utente non sa nulla, ma nemmeno
                       riceve un dato falso. La rete della 4.0 non interviene,
                       perche l'eccezione e stata catturata.
  scoperta             nessun catch: dal task 4.0 la rete mostra un avviso
                       generico. Corretta ma imprecisa.

    python strumenti/inventario_letture.py
    python strumenti/inventario_letture.py --dettaglio
"""
import pathlib
import re
import sys
from collections import Counter, defaultdict

RADICE = pathlib.Path(__file__).resolve().parent.parent

# Le chiamate di lettura, nelle due forme usate nel progetto.
LETTURA = re.compile(
    r"(apiFetch|apiClient\.get)\s*\(\s*[`'\"]([^`'\"]+)"
)

RIPIEGO = re.compile(r"catch\s*\([^)]*\)\s*(=>\s*)?\{?\s*(return\s+)?(\[\s*\]|\{\s*\}|null|''|\"\")")
AVVISA = re.compile(r"mostraAvviso|alert\(|showToast|textContent\s*=|innerHTML\s*=")
REGISTRA = re.compile(r"console\.(log|error|warn|debug)")


def contesto(righe, i, dopo=14):
    """Le righe successive alla chiamata: e li che sta la gestione."""
    return '\n'.join(righe[i:i + dopo])


def corpo_del_catch(righe, i, entro=40):
    """
    SOLO il corpo del `catch`, non tutto cio che segue la chiamata.

    CORRETTO IL 06/09/2026, dopo aver letto tre casi a mano. La prima stesura
    analizzava una finestra di 14 righe dopo la chiamata, che contiene ANCHE il
    percorso di successo: un `innerHTML = ...` nel ramo felice faceva sembrare
    che il `catch` avvisasse l'utente. La divisione 15 / 7 che ne usciva era
    quindi priva di significato — misurava la presenza di aggiornamenti
    dell'interfaccia da qualche parte, non nella gestione dell'errore.

    E' lo stesso difetto che lo strumento serve a cercare: un segnale letto
    dove non e, e scambiato per una risposta.
    """
    for j in range(i, min(i + entro, len(righe))):
        m = re.search(r"\bcatch\s*\([^)]*\)\s*\{", righe[j])
        if not m:
            continue
        # Da qui fino alla chiusura della graffa, contando i livelli.
        pezzo, livello, iniziato = [], 0, False
        for k in range(j, min(j + entro, len(righe))):
            testo = righe[k] if k > j else righe[k][m.end() - 1:]
            for ch in testo:
                if ch == '{':
                    livello += 1; iniziato = True
                elif ch == '}':
                    livello -= 1
            pezzo.append(testo)
            if iniziato and livello <= 0:
                return '\n'.join(pezzo)
        return '\n'.join(pezzo)
    return None


voci = []
for f in sorted((RADICE / 'js').glob('*.js')):
    righe = f.read_text(encoding='utf-8', errors='replace').splitlines()
    for i, riga in enumerate(righe):
        spoglia = riga.strip()
        if spoglia.startswith('//') or spoglia.startswith('*'):
            continue
        m = LETTURA.search(riga)
        if not m:
            continue

        # Solo le letture: le scritture hanno method: POST/PUT/DELETE vicino.
        blocco = contesto(righe, i, 6)
        if re.search(r"method\s*:\s*['\"](POST|PUT|PATCH|DELETE)", blocco):
            continue

        seguito = contesto(righe, i)
        catch = corpo_del_catch(righe, i)

        if catch is None:
            classe = 'scoperta — la rete della 4.0 avvisa'
        elif RIPIEGO.search(catch):
            classe = 'ripiego silenzioso — DA GUARDARE'
        elif AVVISA.search(catch):
            classe = 'il catch avvisa l utente'
        elif REGISTRA.search(catch):
            # Il caso peggiore che resti: catturando, impedisce alla rete della
            # 4.0 di intervenire, e `console.error` l'utente non lo vede.
            classe = 'MUTO — cattura e registra soltanto'
        else:
            classe = 'catch di altro tipo'

        voci.append((classe, f.name, i + 1, m.group(2)[:44], riga.strip()[:100]))

conteggio = Counter(v[0] for v in voci)
per_file = Counter(v[1] for v in voci)

print(f"letture dal backend: {len(voci)} in {len(per_file)} file\n")
for c in ('ripiego silenzioso — DA GUARDARE', 'MUTO — cattura e registra soltanto',
          'catch di altro tipo', 'il catch avvisa l utente',
          'scoperta — la rete della 4.0 avvisa'):
    if conteggio.get(c):
        print(f"  {conteggio[c]:3d}  {c}")

print("\nFILE PIU CARICHI")
for nome, n in per_file.most_common(8):
    print(f"  {n:3d}  {nome}")

sospette = [v for v in voci if v[0].startswith(('ripiego', 'MUTO'))]
print(f"\n{'='*72}")
if sospette:
    print(f"{len(sospette)} letture con RIPIEGO SILENZIOSO — vanno lette una per una.")
    print("Il ripiego non e sbagliato di per se: degradare invece di bloccare e")
    print("una scelta corretta. E sbagliato quando il valore di ripiego e")
    print("INDISTINGUIBILE da una risposta legittima, perche allora l'utente")
    print("conclude qualcosa di falso invece di sapere che il controllo non e")
    print("stato fatto.\n")
    for _, file, n, endpoint, riga in sospette:
        print(f"  {file}:{n}  {endpoint}\n     {riga}")
else:
    print("Nessun ripiego silenzioso rilevato dallo schema. NON significa che non")
    print("ce ne siano: significa che non hanno questa forma testuale.")

if '--dettaglio' in sys.argv:
    dett = defaultdict(list)
    for v in voci:
        dett[v[0]].append(v)
    for c, elenco in dett.items():
        print(f"\n{'='*72}\n{c}\n{'='*72}")
        for _, file, n, endpoint, riga in elenco:
            print(f"  {file}:{n}  {endpoint}\n     {riga}")
