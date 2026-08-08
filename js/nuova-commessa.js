// js/nuova-commessa.js — Logica pagina creazione commessa standalone
import { apiFetch } from './api-client.js';
import { IsAdmin, CurrentUser } from './core-init.js';
import { showModal } from './shared-ui.js';

// Carica Leaflet CSS+JS on-demand (lazy) al primo utilizzo della mappa.
let _leafletLoadPromise = null;
function loadLeafletLazy() {
    if (_leafletLoadPromise) return _leafletLoadPromise;
    _leafletLoadPromise = new Promise((resolve) => {
        if (typeof L !== 'undefined') { resolve(); return; }
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = 'css/libs/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'js/libs/leaflet.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
    return _leafletLoadPromise;
}

// ── Mappa Leaflet (geocoding sezione) ──
let _map = null;
let _currentMarker = null;

const App = {
    state: {
        tipo: 'COMPLETA',       // tipo corrente
        locked: false,          // tipo non modificabile
        mode: 'new',            // 'new' | 'edit'
        editId: null,           // ID commessa in modifica
        returnTo: 'commesse',   // pagina di ritorno
        preCommessaId: null,
        voValid: null,
        voCheckTimeout: null,
        choicesCliente: null,
        choicesMacro: null,
        choicesModello: null,
        choicesUbicazione: null,
        voConfirmPending: false,
    },

    dom: {
        form: null,
        btnCompleta: null,
        btnManutenzione: null,
        typeBadge: null,
        tipoHidden: null,
        voInput: null,
        voFeedback: null,
        saveBtn: null,
        backBtn: null,
        cancelBtn: null,
        lockedNote: null,
        voConfirmOverlay: null,
        voConfirmMessage: null,
        voConfirmOk: null,
        voConfirmCancel: null,
    },

    async init() {
        // Legge params URL
        const params = new URLSearchParams(window.location.search);
        const tipoParam = (params.get('tipo') || 'COMPLETA').toUpperCase();
        this.state.locked = params.get('locked') === 'true';
        this.state.returnTo = params.get('from') || 'commesse';
        this.state.mode = params.get('mode') || 'new';
        this.state.editId = params.get('id') ? parseInt(params.get('id')) : null;

        // In modalità edit, il tipo è sempre locked
        if (this.state.mode === 'edit') {
            this.state.locked = true;
        }

        // Se non admin e tipo non locked come manutenzione → redirect
        if (!IsAdmin) {
            const ruolo = CurrentUser?.ruoli?.[0]?.nome_ruolo || CurrentUser?.ruolo || '';
            const isImpiegato = ruolo.toLowerCase().trim() === 'impiegato';
            if (!isImpiegato) {
                window.location.replace('index.html');
                return;
            }
            // Impiegato può solo creare/modificare manutenzioni
            if (tipoParam === 'COMPLETA') {
                this.state.locked = true;
                this.state.tipo = 'MANUTENZIONE';
            } else {
                this.state.tipo = tipoParam;
                this.state.locked = true;
            }
        } else {
            this.state.tipo = tipoParam;
        }

        this._bindDom();
        this._bindEvents();
        await this._loadInitData();
        this._applyTipo(this.state.tipo, false);

        // Carica dati in modifica
        if (this.state.mode === 'edit' && this.state.editId) {
            await this._loadEditData(this.state.editId);
        }
    },

    _bindDom() {
        this.dom.form = document.getElementById('nuovaCommessaForm');
        this.dom.btnCompleta = document.getElementById('btnCompleta');
        this.dom.btnManutenzione = document.getElementById('btnManutenzione');
        this.dom.typeBadge = document.getElementById('typeBadge');
        this.dom.tipoHidden = document.getElementById('tipoCommessaHidden');
        this.dom.voInput = document.getElementById('voInput');
        this.dom.voFeedback = document.getElementById('voFeedback');
        this.dom.saveBtn = document.getElementById('saveBtn');
        this.dom.backBtn = document.getElementById('backBtn');
        this.dom.cancelBtn = document.getElementById('cancelBtn');
        this.dom.lockedNote = document.getElementById('lockedNote');
        this.dom.voConfirmOverlay = document.getElementById('voConfirmOverlay');
        this.dom.voConfirmMessage = document.getElementById('voConfirmMessage');
        this.dom.voConfirmOk = document.getElementById('voConfirmOk');
        this.dom.voConfirmCancel = document.getElementById('voConfirmCancel');
    },

    _bindEvents() {
        // Tipo toggle buttons
        this.dom.btnCompleta.addEventListener('click', () => {
            if (!this.state.locked) this._applyTipo('COMPLETA');
        });
        this.dom.btnManutenzione.addEventListener('click', () => {
            if (!this.state.locked) this._applyTipo('MANUTENZIONE');
        });

        // VO input — check doppioni con debounce
        this.dom.voInput.addEventListener('input', () => {
            clearTimeout(this.state.voCheckTimeout);
            const vo = this.dom.voInput.value.trim();
            if (vo.length < 4) {
                this.dom.voFeedback.textContent = '';
                this.dom.voFeedback.className = 'nc-vo-feedback';
                this.state.voValid = null;
                return;
            }
            this.dom.voFeedback.textContent = '⏳ Verifica in corso...';
            this.dom.voFeedback.className = 'nc-vo-feedback checking';
            this.state.voCheckTimeout = setTimeout(() => this._checkVo(vo), 600);
        });

        // Upload immagine
        const uploadWidget = document.getElementById('uploadWidget');
        const imageInput = document.getElementById('imageInput');
        const removeBtn = document.getElementById('removeImageBtn');
        const previewContainer = document.getElementById('imagePreviewContainer');
        const preview = document.getElementById('imagePreview');

        uploadWidget.addEventListener('click', () => imageInput.click());
        uploadWidget.addEventListener('dragover', e => { e.preventDefault(); uploadWidget.style.borderColor = '#3498db'; });
        uploadWidget.addEventListener('dragleave', () => { uploadWidget.style.borderColor = ''; });
        uploadWidget.addEventListener('drop', e => {
            e.preventDefault();
            uploadWidget.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file) this._showPreview(file, preview, previewContainer, uploadWidget);
        });
        imageInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this._showPreview(file, preview, previewContainer, uploadWidget);
        });
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                imageInput.value = '';
                preview.src = '';
                previewContainer.style.display = 'none';
                uploadWidget.style.display = 'flex';
            });
        }

        // Back/Cancel
        this.dom.backBtn.addEventListener('click', () => this._goBack());
        this.dom.cancelBtn.addEventListener('click', () => this._goBack());

        // VO Confirm modal
        this.dom.voConfirmCancel.addEventListener('click', () => {
            this.dom.voConfirmOverlay.style.display = 'none';
            this.state.voConfirmPending = false;
        });
        this.dom.voConfirmOk.addEventListener('click', () => {
            this.dom.voConfirmOverlay.style.display = 'none';
            this.state.voConfirmPending = false;
            this._submitForm();
        });

        // Setup Geocodifica (solo sezione COMPLETA)
        this._setupGeocodingControls();

        // Form submit
        this.dom.form.addEventListener('submit', async e => {
            e.preventDefault();
            await this._handleSubmit();
        });
    },

    _showPreview(file, preview, previewContainer, uploadWidget) {
        const reader = new FileReader();
        reader.onload = ev => {
            preview.src = ev.target.result;
            previewContainer.style.display = 'block';
            uploadWidget.style.display = 'none';
        };
        reader.readAsDataURL(file);
    },

    _applyTipo(tipo, animate = true) {
        this.state.tipo = tipo;
        this.dom.tipoHidden.value = tipo;

        // Toggle active state on buttons
        this.dom.btnCompleta.classList.toggle('active', tipo === 'COMPLETA');
        this.dom.btnManutenzione.classList.toggle('active', tipo === 'MANUTENZIONE');

        // Badge header
        this.dom.typeBadge.textContent = tipo === 'COMPLETA' ? 'COMPLETA' : 'MANUTENZIONE';
        this.dom.typeBadge.classList.toggle('manutenzione', tipo === 'MANUTENZIONE');

        // Titolo pagina (h1 + document.title)
        const isEdit = this.state.mode === 'edit';
        const verb = isEdit ? 'MODIFICA' : 'NUOVA';
        const noun = tipo === 'COMPLETA' ? 'COMMESSA' : 'MANUTENZIONE';
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = `${verb} ${noun}`;
        document.title = `${verb.charAt(0) + verb.slice(1).toLowerCase()} ${noun.charAt(0) + noun.slice(1).toLowerCase()} — Segretario AI`;

        // Save button color
        this.dom.saveBtn.classList.toggle('manutenzione', tipo === 'MANUTENZIONE');

        // Sezioni solo-completa
        const onlyCompleta = document.querySelectorAll('.only-completa');
        const onlyManutenzione = document.querySelectorAll('.only-manutenzione');

        onlyCompleta.forEach(el => el.style.display = tipo === 'COMPLETA' ? '' : 'none');
        onlyManutenzione.forEach(el => el.style.display = tipo === 'MANUTENZIONE' ? '' : 'none');

        // Placeholder impianto adattivo
        const impiantoInput = document.getElementById('nomeImpianto');
        if (impiantoInput) {
            impiantoInput.placeholder = tipo === 'MANUTENZIONE'
                ? 'Es. Ricambi pompa / Assistenza valvole'
                : 'Es. Magazzino Automatico';
        }

        // Locked state
        if (this.state.locked) {
            this.dom.btnCompleta.classList.add('locked');
            this.dom.btnManutenzione.classList.add('locked');
            this.dom.lockedNote.style.display = this.state.mode === 'edit' ? 'none' : 'block';
        }
    },

    async _loadInitData() {
        try {
            const res = await apiFetch('/api/commesse/init-data');
            const data = await res.json();

            // ── PATTERN CORRETTO: init Choices vuoto, poi setChoices() ──
            // (inizializzare Choices DOPO innerHTML causa la lista vuota)

            // 1. Clienti — endpoint dedicato (init-data restituisce clienti:[] per ottimizzazione)
            const clienteSelect = document.getElementById('clienteSelect');
            clienteSelect.innerHTML = '';
            this.state.choicesCliente = new Choices(clienteSelect, {
                searchEnabled: true,
                itemSelectText: '',
                placeholderValue: 'Cerca cliente...',
                shouldSort: false,
                noResultsText: 'Nessun cliente trovato',
                noChoicesText: 'Caricamento...',
            });

            // 2. Macro categorie
            const macroSelect = document.getElementById('macroSelect');
            macroSelect.innerHTML = '';
            this.state.choicesMacro = new Choices(macroSelect, {
                searchEnabled: true,
                itemSelectText: '',
                removeItemButton: true,
                placeholderValue: 'Seleziona...',
                shouldSort: false,
            });
            if (data.macros && data.macros.length > 0) {
                this.state.choicesMacro.setChoices(
                    data.macros.map(m => ({ value: String(m.id_macro_categoria), label: m.nome })),
                    'value', 'label', true
                );
            }

            // 3. Modelli (solo per COMPLETA)
            const modelloSelect = document.getElementById('modelloSelect');
            if (modelloSelect) {
                modelloSelect.innerHTML = '';
                this.state.choicesModello = new Choices(modelloSelect, {
                    searchEnabled: true, itemSelectText: '', placeholderValue: 'Nessun modello', shouldSort: false
                });
                if (data.modelli && data.modelli.length > 0) {
                    this.state.choicesModello.setChoices(
                        [{ value: '', label: 'Nessun modello', placeholder: true },
                         ...data.modelli.map(m => ({ value: String(m.id_modello), label: m.nome_modello }))],
                        'value', 'label', true
                    );
                }
            }

            // 4. Ubicazioni (solo per COMPLETA) — default: armadio
            const ubicazioneSelect = document.getElementById('ubicazioneSelect');
            if (ubicazioneSelect) {
                ubicazioneSelect.innerHTML = '';
                this.state.choicesUbicazione = new Choices(ubicazioneSelect, {
                    searchEnabled: false, itemSelectText: '', shouldSort: false
                });
                if (data.ubicazioni && data.ubicazioni.length > 0) {
                    const ubicChoices = data.ubicazioni.map(u => ({
                        value: String(u.id_ubicazione), label: u.nome_ubicazione
                    }));
                    this.state.choicesUbicazione.setChoices(
                        [{ value: '', label: 'Seleziona...', placeholder: true }, ...ubicChoices],
                        'value', 'label', true
                    );
                    // Default: prima opzione che contiene 'armadio'
                    const armadio = data.ubicazioni.find(
                        u => u.nome_ubicazione?.toLowerCase().includes('armadio')
                    );
                    if (armadio) {
                        this.state.choicesUbicazione.setChoiceByValue(String(armadio.id_ubicazione));
                    }
                }
            }

            // 5. Clienti — caricamento SEPARATO da /clienti-options
            //    (init-data restituisce intenzionalmente clienti:[] per performance)
            this._loadClientiOptions();

        } catch (e) {
            console.error('Errore caricamento init-data:', e);
        }
    },

    // Carica clienti dall'endpoint dedicato (lazy, non blocca init)
    async _loadClientiOptions() {
        try {
            const res = await apiFetch('/api/commesse/clienti-options');
            if (!res.ok) throw new Error('Errore clienti-options');
            const clients = await res.json();

            if (this.state.choicesCliente && clients && clients.length > 0) {
                const sorted = clients
                    .slice()
                    .sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale))
                    .map(c => ({ value: String(c.id_cliente), label: c.ragione_sociale }));

                this.state.choicesCliente.setChoices(
                    [{ value: '', label: 'Seleziona cliente...', placeholder: true }, ...sorted],
                    'value', 'label', true
                );

                // Se siamo in modalità edit, ri-applica la selezione ora che le opzioni esistono
                if (this.state.mode === 'edit' && this._pendingClienteId) {
                    try {
                        this.state.choicesCliente.setChoiceByValue(
                            [this._pendingClienteId, String(this._pendingClienteId)]
                        );
                    } catch(e) { /* ignora */ }
                    this._pendingClienteId = null;
                }
            }
        } catch (e) {
            console.error('Errore caricamento clienti:', e);
            if (this.state.choicesCliente) {
                this.state.choicesCliente.setChoices(
                    [{ value: '', label: 'Errore caricamento clienti', placeholder: true }],
                    'value', 'label', true
                );
            }
        }
    },

    async _checkVo(vo) {
        if (this.state.tipo !== 'MANUTENZIONE') {
            this.state.voValid = true;
            this.dom.voFeedback.textContent = '';
            return;
        }
        try {
            const res = await apiFetch(`/api/commesse/check-vo?vo=${encodeURIComponent(vo)}`);
            const data = await res.json();

            if (data.blocked) {
                this.state.voValid = false;
                this.dom.voFeedback.textContent = `⛔ VO già usato in un'altra manutenzione`;
                this.dom.voFeedback.className = 'nc-vo-feedback blocked';
            } else if (data.needs_confirm) {
                this.state.voValid = 'warn';
                this.dom.voFeedback.textContent = `⚠️ Esiste una commessa completa con questo VO — conferma richiesta`;
                this.dom.voFeedback.className = 'nc-vo-feedback warning';
            } else {
                this.state.voValid = true;
                this.dom.voFeedback.textContent = `✓ VO disponibile`;
                this.dom.voFeedback.className = 'nc-vo-feedback ok';
            }
        } catch (e) {
            this.state.voValid = null;
            this.dom.voFeedback.textContent = '';
        }
    },

    async _handleSubmit() {
        // Validazione base
        const impianto = document.getElementById('nomeImpianto').value.trim();
        const cliente = document.getElementById('clienteSelect').value;
        if (!impianto || !cliente) {
            alert('Compila i campi obbligatori: Nome Impianto e Cliente.');
            return;
        }

        // VO check per manutenzioni
        if (this.state.tipo === 'MANUTENZIONE') {
            const vo = this.dom.voInput.value.trim();
            if (!vo) {
                alert("L'Ordine di Vendita (VO) è obbligatorio per le manutenzioni.");
                return;
            }
            if (this.state.voValid === false) {
                alert('Questo VO è già usato in un\'altra manutenzione. Inserisci un VO diverso.');
                return;
            }
            if (this.state.voValid === 'warn') {
                // Mostra modale di conferma
                this.dom.voConfirmMessage.textContent =
                    `Attenzione: esiste già una commessa completa con VO "${vo}". È insolito avere sia una commessa completa che una manutenzione con lo stesso VO. Vuoi procedere comunque?`;
                this.dom.voConfirmOverlay.style.display = 'flex';
                return; // attende conferma
            }
        }

        this._submitForm();
    },

    async _submitForm() {
        this.dom.saveBtn.disabled = true;
        this.dom.saveBtn.innerHTML = `<span>⏳ Salvataggio...</span>`;

        const isEdit = this.state.mode === 'edit';
        const id = this.state.editId;

        try {
            let res;

            if (isEdit && this.state.tipo === 'MANUTENZIONE') {
                // ── MANUTENZIONE EDIT: JSON PUT su /api/manutenzioni/{id} ──
                const payload = {
                    id_cliente_fk: parseInt(document.getElementById('clienteSelect').value) || null,
                    impianto:      document.getElementById('nomeImpianto').value.trim(),
                    vo:            document.getElementById('voInput').value.trim(),
                    note:          document.getElementById('noteTextarea').value.trim(),
                    visibile_officina: document.getElementById('visibileOfficina')?.checked ?? true,
                    ids_macro_categorie_attive: this.state.choicesMacro
                        ? this.state.choicesMacro.getValue(true).map(Number)
                        : [],
                };
                res = await apiFetch(`/api/manutenzioni/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // ── COMMESSA COMPLETA (new o edit): FormData POST/PUT su /api/commesse ──
                const formData = new FormData(this.dom.form);

                // Macro: ricava dal Choices multi-select
                const macroValues = this.state.choicesMacro
                    ? this.state.choicesMacro.getValue(true).map(Number)
                    : Array.from(document.getElementById('macroSelect').selectedOptions).map(o => parseInt(o.value));
                formData.delete('ids_macro_categorie_attive');
                formData.append('ids_macro_categorie_attive', JSON.stringify(macroValues));

                // Nome cliente (per titolo task manutenzione)
                const nomeCliente = this.state.choicesCliente?.getValue()?.label || '';
                formData.set('nome_cliente', nomeCliente);

                const method = isEdit ? 'PUT' : 'POST';
                const url = isEdit
                    ? `/api/commesse/${id}`
                    : `/api/commesse/`;

                res = await apiFetch(url, {
                    method,
                    body: formData
                });
            }

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Errore durante il salvataggio');

            // Successo → redirect
            if (this.state.tipo === 'MANUTENZIONE') {
                window.location.href = isEdit
                    ? `manutenzioni.html?selected=${id}`
                    : `manutenzioni.html?new=${result.id_commessa}`;
            } else {
                window.location.href = 'commesse.html';
            }

        } catch (e) {
            console.error('Errore submit:', e);
            alert(`Errore: ${e.message}`);
            this.dom.saveBtn.disabled = false;
            this.dom.saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>SALVA</span>`;
        }
    },

    // ── CARICAMENTO DATI IN MODIFICA ──
    async _loadEditData(id) {
        try {
            const endpoint = this.state.tipo === 'MANUTENZIONE'
                ? `/api/manutenzioni/${id}`
                : `/api/commesse/${id}`;
            const res = await apiFetch(endpoint);
            if (!res.ok) throw new Error('Commessa non trovata');
            const raw = await res.json();

            // Le API di manutenzioni wrappano in {commessa: {...}}
            const data = raw.commessa ?? raw;

            // Campi testuali
            const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
            set('nomeImpianto',  data.nome_commessa ?? data.impianto ?? '');
            set('voInput',       data.vo ?? data.vo_offerta ?? '');
            set('matricolaInput',   data.matricola ?? '');
            set('rifTecnicoInput',  data.riferimento_tecnico ?? '');
            set('luogoInput',    data.paese ?? data.luogo ?? '');
            set('provinciaInput',data.provincia ?? '');
            set('annoInput',     data.anno ?? '');
            set('noteTextarea',  data.note ?? data.descrizione ?? '');
            set('latitudine',    data.latitudine ?? '');
            set('longitudine',   data.longitudine ?? '');

            // Posizione esatta
            const posEl = document.getElementById('posizione_esatta');
            if (posEl) posEl.checked = !!data.posizione_esatta;

            // Visibile officina (solo manutenzioni)
            const visEl = document.getElementById('visibileOfficina');
            if (visEl) visEl.checked = data.visibile_officina !== false;

            // Cliente (Choices.js) — potrebbe non essere ancora caricato (clienti-options è asincrono)
            if (data.id_cliente_fk) {
                const clientId = data.id_cliente_fk;
                if (this.state.choicesCliente) {
                    try {
                        // Prova subito (se i clienti sono già stati caricati)
                        this.state.choicesCliente.setChoiceByValue([clientId, String(clientId)]);
                    } catch(e) { /* opzioni non ancora disponibili */ }
                }
                // Salva l'ID in attesa che _loadClientiOptions completi
                this._pendingClienteId = clientId;
            }


            // Modello (Choices.js)
            if (this.state.choicesModello && data.id_modello_fk) {
                try { this.state.choicesModello.setChoiceByValue([data.id_modello_fk, String(data.id_modello_fk)]); }
                catch(e) { console.warn('Errore set modello:', e); }
            }

            // Macro (Choices.js multi-select)
            if (this.state.choicesMacro && data.ids_macro_categorie_attive) {
                try {
                    const vals = Array.isArray(data.ids_macro_categorie_attive)
                        ? data.ids_macro_categorie_attive
                        : [data.ids_macro_categorie_attive];
                    this.state.choicesMacro.setChoiceByValue(vals.flatMap(v => [v, String(v)]));
                } catch(e) { console.warn('Errore set macro:', e); }
            }

            // Ubicazione (Choices.js)
            if (this.state.choicesUbicazione && data.id_ubicazione_fk) {
                try { this.state.choicesUbicazione.setChoiceByValue(String(data.id_ubicazione_fk)); }
                catch(e) { console.warn('Errore set ubicazione:', e); }
            }

            // Se c'è immagine, mostra info nel widget upload
            if (data.immagine) {
                const uploadText = document.getElementById('uploadText');
                const previewContainer = document.getElementById('imagePreviewContainer');
                if (uploadText) uploadText.textContent = 'Immagine presente (caricare per sostituire)';
                if (previewContainer) previewContainer.style.display = 'block';
            }

        } catch(e) {
            console.error('Errore caricamento dati modifica:', e);
            showModal({ title: 'Errore', message: `Impossibile caricare i dati: ${e.message}` });
        }
    },

    _goBack() {
        if (this.state.returnTo === 'manutenzioni') {
            window.location.href = this.state.editId
                ? `manutenzioni.html?selected=${this.state.editId}`
                : 'manutenzioni.html';
        } else {
            window.location.href = 'commesse.html';
        }
    },

    // ── GEOCODIFICA ──
    _setupGeocodingControls() {
        const btnCalc = document.getElementById('btn-calc-geo');
        const btnMap  = document.getElementById('btn-open-map');
        const btnConfirm = document.getElementById('confirmMapBtn');
        const btnClose   = document.getElementById('closeMapBtn');
        const mapModal   = document.getElementById('mapModal');
        const mapOverlay = document.getElementById('mapModalOverlay');

        const openMap = async () => {
            if (mapModal) { mapModal.style.display = 'flex'; }
            if (mapOverlay) { mapOverlay.style.display = 'block'; }
            await loadLeafletLazy();
            setTimeout(() => this._initMap(), 120);
        };
        const closeMap = () => {
            if (mapModal) mapModal.style.display = 'none';
            if (mapOverlay) mapOverlay.style.display = 'none';
        };

        // Calcola coordinate da Città/Provincia
        if (btnCalc) {
            btnCalc.addEventListener('click', async () => {
                const city = document.getElementById('luogoInput')?.value?.trim();
                const prov = document.getElementById('provinciaInput')?.value?.trim() || '';
                if (!city) {
                    showModal({ title: 'Attenzione', message: 'Inserisci almeno il Luogo (Città) per calcolare le coordinate.' });
                    return;
                }
                const orig = btnCalc.innerHTML;
                btnCalc.innerHTML = '<span>⏳...</span>';
                btnCalc.disabled = true;
                try {
                    const res = await apiFetch(`/api/geocoding/lookup?city=${encodeURIComponent(city)}&province=${encodeURIComponent(prov)}`);
                    if (res.ok) {
                        const d = await res.json();
                        openMap();
                        setTimeout(() => {
                            if (_map) { _map.invalidateSize(); }
                            const ll = [d.lat, d.lon];
                            if (_map) _map.setView(ll, 15);
                            this._placeMarker(ll);
                            // Geocodifica = posizione approssimativa
                            const chk = document.getElementById('posizione_esatta');
                            if (chk) chk.checked = false;
                        }, 150);
                    } else {
                        showModal({ title: 'Non trovato', message: 'Impossibile trovare le coordinate per questo luogo.' });
                    }
                } catch(e) {
                    showModal({ title: 'Errore', message: 'Errore durante la geocodifica.' });
                } finally {
                    btnCalc.innerHTML = orig;
                    btnCalc.disabled = false;
                }
            });
        }

        // Apri mappa manualmente
        if (btnMap) btnMap.addEventListener('click', openMap);

        // Chiudi mappa
        if (btnClose) btnClose.addEventListener('click', closeMap);
        if (mapOverlay) mapOverlay.addEventListener('click', closeMap);

        // Conferma posizione da mappa
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                if (_currentMarker) {
                    const ll = _currentMarker.getLatLng();
                    document.getElementById('latitudine').value = ll.lat.toFixed(6);
                    document.getElementById('longitudine').value = ll.lng.toFixed(6);
                    const chk = document.getElementById('posizione_esatta');
                    if (chk) chk.checked = true; // selezione manuale = esatta
                    closeMap();
                } else {
                    showModal({ title: 'Info', message: 'Seleziona un punto sulla mappa cliccando.' });
                }
            });
        }
    },

    _initMap() {
        if (typeof L === 'undefined') { console.error('Leaflet non caricato'); return; }
        if (_map) { _map.invalidateSize(); this._updateMapFromInputs(); return; }

        _map = L.map('mapContainer').setView([41.8719, 12.5674], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '© OpenStreetMap'
        }).addTo(_map);
        _map.on('click', (e) => this._placeMarker(e.latlng));
        this._updateMapFromInputs();
    },

    _updateMapFromInputs() {
        const lat = parseFloat(document.getElementById('latitudine')?.value);
        const lon = parseFloat(document.getElementById('longitudine')?.value);
        if (!isNaN(lat) && !isNaN(lon) && _map) {
            _map.setView([lat, lon], 13);
            this._placeMarker([lat, lon]);
        }
    },


    // SVG inline: elimina la dipendenza dai PNG di Leaflet (non risolvibili in contesto vanilla)
    _getMarkerIcon() {
        if (!this._markerIcon) {
            this._markerIcon = L.divIcon({
                className: '',
                html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
                    <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z"
                          fill="#2563eb" stroke="#1d4ed8" stroke-width="1.5"/>
                    <circle cx="12.5" cy="12.5" r="5" fill="white"/>
                </svg>`,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
            });
        }
        return this._markerIcon;
    },

    _placeMarker(latlng) {
        if (!_map) return;
        if (_currentMarker) {
            _currentMarker.setLatLng(latlng);
        } else {
            _currentMarker = L.marker(latlng, { icon: this._getMarkerIcon(), draggable: true }).addTo(_map);
            _currentMarker.on('dragend', (ev) => this._updateCoordsDisplay(ev.target.getLatLng()));
        }
        this._updateCoordsDisplay(latlng);
    },

    _updateCoordsDisplay(latlng) {
        const el = document.getElementById('map-coords-display');
        if (!el) return;
        const lat = latlng.lat ?? latlng[0];
        const lng = latlng.lng ?? latlng[1];
        el.textContent = `Lat: ${parseFloat(lat).toFixed(6)}, Lon: ${parseFloat(lng).toFixed(6)}`;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
