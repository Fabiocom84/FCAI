// js/registratore-audio.js
//
// L'apertura del microfono, condivisa da `quick-note`, `quick-record` e
// `inserisci-dati`.
//
// PERCHE' ESISTE
// Le tre pagine avevano lo stesso blocco di tredici righe — permesso,
// scelta del formato, creazione del `MediaRecorder`, raccolta dei pezzi —
// copiato carattere per carattere. Le funzioni `startRecording` che lo
// contenevano erano state misurate al 63% di somiglianza: bassa, perche' la
// META' che segue e' UI genuinamente diversa (un modale, un pulsante
// push-to-talk, un cronometro). La duplicazione stava tutta nella prima meta',
// e solo quella viene unificata. La seconda resta dov'e', perche' e' diversa
// per ragioni vere.
//
// LA RAGIONE CHE CONTA PIU' DELLA METRICA
// Dentro quel blocco c'e' il ramo `audio/aac`. Il backend documenta che
// **Whisper non accetta l'aac** (`middleware/validation.py`, nota sul task
// 0.22): il frontend puo' produrre un formato che il servizio rifiuta, e
// l'errore arriva da OpenAI senza nominare la causa. Il difetto e' aperto e
// non e' ancora deciso come chiuderlo — va verificato su quale dispositivo
// l'aac venga davvero scelto. Quando si decidera', con tre copie andrebbero
// corretti tre file, e basterebbe dimenticarne uno perche' il difetto
// sopravviva su una pagina sola, che e' la forma piu' difficile da
// ricondurre alla causa.
//
// COSA NON FA
// Non gestisce l'errore: `getUserMedia` solleva e chi chiama decide cosa
// mostrare. Le tre pagine dicono cose diverse — un toast, un modale con
// l'istruzione su HTTPS — e uniformarle qui sarebbe una decisione di
// prodotto presa dentro un modulo tecnico.
//
// Non avvia la registrazione: `start()` lo chiama chi ha aperto il
// microfono, dopo aver preparato la propria interfaccia. Sono due momenti che
// le tre pagine separano diversamente.

/**
 * Il formato audio che questo browser sa registrare.
 *
 * L'ordine conta: `audio/mp4` e' provato prima perche' e' cio' che Safari su
 * iOS produce, e su quel browser e' l'unica scelta che funziona.
 *
 * IL RAMO `audio/aac` E' STATO TOLTO il 19/09/2026, e con una misura sotto.
 *
 * Le tre pagine avevano un terzo ramo: se `audio/mp4` non era supportato ma
 * `audio/aac` si', registravano in aac. **Whisper non accetta l'aac** — lo
 * documenta `middleware/validation.py` — quindi quella registrazione veniva
 * caricata, validata, inviata, e rifiutata da OpenAI con un errore che non
 * nomina la causa.
 *
 * Misurato sui log di produzione, 30 giorni, 836 righe di applicazione:
 * **due caricamenti audio, entrambi `audio/mp4`**. Zero aac. Due campioni
 * sono pochi per dichiarare morto un ramo, e non e' su quelli che poggia la
 * decisione: poggia sul fatto che **un dispositivo che scegliesse aac sarebbe
 * gia' rotto oggi**. Togliere il ramo non puo' peggiorare un caso
 * funzionante, perche' non ne esistono.
 *
 * Cosa cambia per un ipotetico dispositivo che supporti solo aac: prima
 * registrava e falliva da OpenAI dopo aver caricato il file; ora
 * `new MediaRecorder` solleva subito e l'utente vede l'errore del microfono.
 * Rotto in entrambi i casi, ma senza sprecare un caricamento — e il ramo che
 * lo teneva in vita faceva credere che quel dispositivo fosse supportato.
 */
export function formatoSupportato() {
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return 'audio/webm';
}

/**
 * Chiede il microfono e prepara un registratore.
 *
 * @returns {Promise<{registratore: MediaRecorder, pezzi: Blob[]}>}
 *          `pezzi` e' l'array in cui il registratore accumula l'audio: e' lo
 *          stesso oggetto, quindi chi lo riceve lo vede riempirsi.
 * @throws  quello che solleva `getUserMedia` — permesso negato, assenza di
 *          microfono, contesto non sicuro. Gestirlo spetta a chi chiama.
 */
export async function apriMicrofono() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const registratore = new MediaRecorder(stream, { mimeType: formatoSupportato() });
    const pezzi = [];

    registratore.ondataavailable = e => {
        if (e.data.size > 0) pezzi.push(e.data);
    };

    return { registratore, pezzi };
}
