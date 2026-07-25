// js/nuova-commessa.js — Logica pagina creazione commessa standalone
import { apiFetch } from './api-client.js';
import { IsAdmin, CurrentUser } from './core-init.js';

const App = {
    state: {
        tipo: 'COMPLETA',       // tipo corrente
        locked: false,          // tipo non modificabile
        returnTo: 'commesse',   // pagina di ritorno (commesse|manutenzioni)
        preCommessaId: null,    // pre-select commessa in manutenzioni (N/A qui)
        voValid: null,          // null=non verificato, true=ok, 'warn'=cross-type, false=blocked
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

        // Se non admin e tipo non locked come manutenzione → redirect
        if (!IsAdmin) {
            const ruolo = CurrentUser?.ruoli?.[0]?.nome_ruolo || CurrentUser?.ruolo || '';
            const isImpiegato = ruolo.toLowerCase().trim() === 'impiegato';
            if (!isImpiegato) {
                window.location.replace('index.html');
                return;
            }
            // Impiegato può solo creare manutenzioni
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
        this._applyTipo(this.state.tipo, false); // false = non animate on first load
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

        // Save button color
        this.dom.saveBtn.classList.toggle('manutenzione', tipo === 'MANUTENZIONE');

        // Sezioni solo-completa
        const onlyCompleta = document.querySelectorAll('.only-completa');
        const onlyManutenzione = document.querySelectorAll('.only-manutenzione');

        onlyCompleta.forEach(el => el.style.display = tipo === 'COMPLETA' ? '' : 'none');
        onlyManutenzione.forEach(el => el.style.display = tipo === 'MANUTENZIONE' ? '' : 'none');

        // Se manutenzione, impianto placeholder cambia
        const impiantoInput = document.getElementById('nomeImpianto');
        if (tipo === 'MANUTENZIONE') {
            impiantoInput.placeholder = 'Es. Ricambi pompa / Assistenza valvole';
        } else {
            impiantoInput.placeholder = 'Es. Magazzino Automatico';
        }

        // Locked state
        if (this.state.locked) {
            this.dom.btnCompleta.classList.add('locked');
            this.dom.btnManutenzione.classList.add('locked');
            this.dom.lockedNote.style.display = 'block';
        }
    },

    async _loadInitData() {
        try {
            const res = await apiFetch('/api/commesse/init-data');
            const data = await res.json();

            // Clienti
            if (data.clienti) {
                const clienteSelect = document.getElementById('clienteSelect');
                clienteSelect.innerHTML = '<option value="">Seleziona cliente...</option>' +
                    data.clienti.sort((a,b) => a.ragione_sociale.localeCompare(b.ragione_sociale))
                    .map(c => `<option value="${c.id_cliente}">${c.ragione_sociale}</option>`).join('');
                this.state.choicesCliente = new Choices(clienteSelect, {
                    searchEnabled: true, itemSelectText: '',
                    placeholderValue: 'Cerca cliente...', shouldSort: false
                });
            }

            // Macro categorie
            if (data.macros) {
                const macroSelect = document.getElementById('macroSelect');
                macroSelect.innerHTML = data.macros
                    .map(m => `<option value="${m.id_macro_categoria}">${m.nome}</option>`).join('');
                this.state.choicesMacro = new Choices(macroSelect, {
                    searchEnabled: true, itemSelectText: '',
                    removeItemButton: true, placeholderValue: 'Seleziona...'
                });
            }

            // Modelli (solo per COMPLETA)
            if (data.modelli) {
                const modelloSelect = document.getElementById('modelloSelect');
                modelloSelect.innerHTML = '<option value="">Nessun modello</option>' +
                    data.modelli.map(m => `<option value="${m.id_modello}">${m.nome_modello}</option>`).join('');
                this.state.choicesModello = new Choices(modelloSelect, {
                    searchEnabled: true, itemSelectText: '', placeholderValue: 'Cerca modello...'
                });
            }

            // Ubicazioni (solo per COMPLETA)
            if (data.ubicazioni) {
                const ubicazioneSelect = document.getElementById('ubicazioneSelect');
                ubicazioneSelect.innerHTML = '<option value="">Seleziona...</option>' +
                    data.ubicazioni.map(u => `<option value="${u.id_ubicazione}">${u.nome_ubicazione}</option>`).join('');
                this.state.choicesUbicazione = new Choices(ubicazioneSelect, {
                    searchEnabled: false, itemSelectText: ''
                });
            }
        } catch (e) {
            console.error('Errore caricamento init-data:', e);
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
        this.dom.saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Salvataggio...`;

        try {
            const formData = new FormData(this.dom.form);

            // Macro: Choices serializza su hidden, ma con multiple select dobbiamo gestirlo
            const macroSelect = document.getElementById('macroSelect');
            const macroValues = Array.from(macroSelect.selectedOptions).map(o => parseInt(o.value));
            formData.delete('ids_macro_categorie_attive');
            formData.append('ids_macro_categorie_attive', JSON.stringify(macroValues));

            // Nome cliente (per titolo task manutenzione)
            const clienteSelect = document.getElementById('clienteSelect');
            const nomeCliente = clienteSelect.options[clienteSelect.selectedIndex]?.text || '';
            formData.append('nome_cliente', nomeCliente);

            const res = await fetch(`${window._API_BASE_URL || ''}/api/commesse/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` },
                body: formData
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Errore durante il salvataggio');
            }

            // Successo → redirect
            if (this.state.tipo === 'MANUTENZIONE') {
                window.location.href = `manutenzioni.html?new=${result.id_commessa}`;
            } else {
                window.location.href = 'commesse.html';
            }

        } catch (e) {
            console.error('Errore submit:', e);
            alert(`Errore: ${e.message}`);
            this.dom.saveBtn.disabled = false;
            this.dom.saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> SALVA`;
        }
    },

    _goBack() {
        if (this.state.returnTo === 'manutenzioni') {
            window.location.href = 'manutenzioni.html';
        } else {
            window.location.href = 'commesse.html';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
