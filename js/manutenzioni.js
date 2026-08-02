// js/manutenzioni.js — Logica pagina gestione manutenzioni
import { apiFetch } from './api-client.js';
import { IsAdmin, CurrentUser } from './core-init.js';
import { supabase } from './supabase-client.js';

const App = {
    state: {
        list: [],
        selectedId: null,
        detail: null,
        searchTimeout: null,
        includeCompleted: false,
        searchTerm: '',
        editChoicesCliente: null,
    },

    dom: {},

    async init() {
        // Verifica accesso: solo Admin o Impiegato
        const ruolo = CurrentUser?.ruoli?.[0]?.nome_ruolo || CurrentUser?.ruolo || '';
        const isImpiegato = ruolo.toLowerCase().trim() === 'impiegato';
        if (!IsAdmin && !isImpiegato) {
            window.location.replace('index.html');
            return;
        }

        this._bindDom();
        this._bindEvents();

        // Admin-only elements
        if (IsAdmin) {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
        }

        await this._loadList();

        // Gestione parametri URL in ingresso
        const params = new URLSearchParams(window.location.search);
        const newId      = params.get('new');       // da nuova-commessa (creazione)
        const selectedId = params.get('selected');  // da nuova-commessa (ritorno da modifica)
        const autoId = newId || selectedId;
        if (autoId) setTimeout(() => this._selectCard(parseInt(autoId)), 500);
    },

    _bindDom() {
        this.dom = {
            list:               document.getElementById('manutenzioniList'),
            listLoader:         document.getElementById('listLoader'),
            countBadge:         document.getElementById('countBadge'),
            searchInput:        document.getElementById('searchInput'),
            showCompletedToggle:document.getElementById('showCompletedToggle'),
            addBtn:             document.getElementById('addBtn'),
            detailPlaceholder:  document.getElementById('detailPlaceholder'),
            detailContent:      document.getElementById('detailContent'),
            detCodice:          document.getElementById('detCodice'),
            detStatus:          document.getElementById('detStatus'),
            detCliente:         document.getElementById('detCliente'),
            detImpianto:        document.getElementById('detImpianto'),
            detVO:              document.getElementById('detVO'),
            detData:            document.getElementById('detData'),
            detOfficina:        document.getElementById('detOfficina'),
            detNote:            document.getElementById('detNote'),
            btnModifica:        document.getElementById('btnModifica'),
            btnElimina:         document.getElementById('btnElimina'),
            btnCompleta:        document.getElementById('btnCompleta'),
            btnInserisciOp:     document.getElementById('btnInserisciOp'),
            oreTotal:           document.getElementById('oreTotal'),
            oreAperte:          document.getElementById('oreAperte'),
            oreContat:          document.getElementById('oreContat'),
            oreTableBody:       document.getElementById('oreTableBody'),
            opTableBody:        document.getElementById('opTableBody'),
            taskDetail:         document.getElementById('taskDetail'),
            // Completa modal
            completaModalOverlay:   document.getElementById('completaModalOverlay'),
            completaModal:          document.getElementById('completaModal'),
            completaTitolo:         document.getElementById('completaTitolo'),
            completaOpTot:          document.getElementById('completaOpTot'),
            completaOpChiusi:       document.getElementById('completaOpChiusi'),
            completaOreTot:         document.getElementById('completaOreTot'),
            completaOreContat:      document.getElementById('completaOreContat'),
            completaOreDaContat:    document.getElementById('completaOreDaContat'),
            completaAnnulla:        document.getElementById('completaAnnulla'),
            completaConferma:       document.getElementById('completaConferma'),
            // Layout
            layout:     document.getElementById('appLayout'),
        };
    },

    _bindEvents() {
        // Ricerca con debounce
        this.dom.searchInput.addEventListener('input', () => {
            clearTimeout(this.state.searchTimeout);
            this.state.searchTimeout = setTimeout(() => {
                this.state.searchTerm = this.dom.searchInput.value.trim();
                this._loadList();
            }, 400);
        });

        // Toggle completate
        this.dom.showCompletedToggle.addEventListener('change', () => {
            this.state.includeCompleted = this.dom.showCompletedToggle.checked;
            this._loadList();
        });

        // + Nuova
        this.dom.addBtn.addEventListener('click', () => {
            const url = IsAdmin
                ? 'nuova-commessa.html?tipo=manutenzione&from=manutenzioni'
                : 'nuova-commessa.html?tipo=manutenzione&locked=true&from=manutenzioni';
            window.location.href = url;
        });

        // Modifica → redirige a nuova-commessa in modalità edit
        this.dom.btnModifica.addEventListener('click', () => {
            const id = this.state.selectedId;
            if (!id) return;
            window.location.href = `nuova-commessa.html?id=${id}&tipo=MANUTENZIONE&mode=edit&from=manutenzioni`;
        });

        // Elimina (admin only)
        this.dom.btnElimina.addEventListener('click', () => this._handleDelete());

        // Completa
        this.dom.btnCompleta.addEventListener('click', () => this._openCompletaModal());

        // Completa modal
        this.dom.completaAnnulla.addEventListener('click', () => this._closeCompletaModal());
        this.dom.completaModalOverlay.addEventListener('click', () => this._closeCompletaModal());
        this.dom.completaConferma.addEventListener('click', () => this._confirmCompleta());



    },

    // ── CARICA LISTA via RPC Supabase (ottimizzata con aggregazioni OdP + ore) ──
    async _loadList() {
        this.dom.listLoader.style.display = '';
        try {
            // ── Supabase RPC diretta: get_manutenzioni_list ──
            // Ritorna dati piatti compatibili con _renderList (ragione_sociale, nome_status,
            // count_op, count_op_aperti, total_ore, ore_da_validare già aggregati server-side)
            const { data, error } = await supabase.rpc('get_manutenzioni_list', {
                p_include_completed: this.state.includeCompleted,
                p_search_term: this.state.searchTerm || null
            });

            if (error) throw error;

            this.state.list = data || [];
            this._renderList();

        } catch (e) {
            console.error('Errore Supabase RPC get_manutenzioni_list:', e);
            // ── Fallback: backend API ──
            try {
                const params = new URLSearchParams({
                    include_completed: this.state.includeCompleted ? 'true' : 'false',
                });
                if (this.state.searchTerm) params.set('search', this.state.searchTerm);

                const res = await apiFetch(`/api/manutenzioni/?${params}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!Array.isArray(data)) throw new Error('Risposta non valida');

                this.state.list = data;
                this._renderList();
            } catch (fallbackErr) {
                console.error('Errore fallback _loadList:', fallbackErr);
                this.dom.list.innerHTML = `
                    <div class="man-no-results">
                        <div class="man-no-results-icon">❌</div>
                        <p>Errore di caricamento</p>
                        <small style="color:#999;">${fallbackErr.message}</small>
                    </div>`;
            }
        } finally {
            this.dom.listLoader.style.display = 'none';
        }
    },

    _renderList() {
        this.dom.countBadge.textContent = this.state.list.length;

        if (this.state.list.length === 0) {
            this.dom.list.innerHTML = '<div class="man-no-results"><div class="man-no-results-icon">🔧</div><p>Nessuna manutenzione trovata</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        this.state.list.forEach(m => {
            const card = document.createElement('div');
            const isDone = m.nome_status?.toLowerCase().includes('complet') || m.nome_status?.toLowerCase().includes('chiuso');
            card.className = `man-card${isDone ? ' completed' : ''}${m.id_commessa === this.state.selectedId ? ' active' : ''}`;
            card.dataset.id = m.id_commessa;

            const oreDaVal = parseFloat(m.ore_da_validare || 0);
            const totalOre = parseFloat(m.total_ore || 0);
            const openOp = parseInt(m.count_op_aperti || 0);
            const totOp = parseInt(m.count_op || 0);

            const data = m.data_commessa ? new Date(m.data_commessa).toLocaleDateString('it-IT') : '—';

            card.innerHTML = `
                <div class="man-card-top">
                    <span class="man-card-vo">${m.vo || 'N/D'}</span>
                    <span class="man-card-status-pill ${isDone ? 'done' : ''}">${m.nome_status || 'In Lavorazione'}</span>
                </div>
                <div class="man-card-cliente">${m.ragione_sociale || '—'}</div>
                <div class="man-card-impianto">${m.impianto || '—'}</div>
                <div class="man-card-meta">
                    <span class="man-card-meta-item">📅 ${data}</span>
                    ${totOp > 0 ? `<span class="man-card-meta-item${openOp > 0 ? ' warn' : ''}">⚙️ ${totOp} OdP${openOp > 0 ? ` (${openOp} ✗)` : ' ✓'}</span>` : ''}
                    ${totalOre > 0 ? `<span class="man-card-meta-item${oreDaVal > 0 ? ' warn' : ''}">🕐 ${totalOre}h${oreDaVal > 0 ? ` (${oreDaVal}h aperte)` : ''}</span>` : ''}
                </div>
            `;

            card.addEventListener('click', () => this._selectCard(m.id_commessa));
            fragment.appendChild(card);
        });

        this.dom.list.innerHTML = '';
        this.dom.list.appendChild(fragment);
    },

    async _selectCard(id) {
        this.state.selectedId = id;

        // Aggiorna active state nelle card
        document.querySelectorAll('.man-card').forEach(c => {
            c.classList.toggle('active', parseInt(c.dataset.id) === id);
        });

        // Mobile: mostra dettaglio (gestito dal CSS tramite detail-open)
        this.dom.layout.classList.add('detail-open');

        // Mostra content, nasconde placeholder
        this.dom.detailPlaceholder.style.display = 'none';
        this.dom.detailContent.style.display = 'flex';

        // Carica dettaglio
        try {
            const res = await apiFetch(`/api/manutenzioni/${id}`);
            const data = await res.json();
            this.state.detail = data;
            this._renderDetail(data);
        } catch (e) {
            console.error('Errore dettaglio manutenzione:', e);
        }

        // ── OdP direttamente da Supabase (bypass bug backend id_registro → id) ──
        // Caricamento asincrono indipendente: non blocca il render del dettaglio
        this._loadOrdiniSupabase(id);
    },

    // ── Carica OdP via RPC Supabase (SECURITY DEFINER → bypassa RLS) ──
    async _loadOrdiniSupabase(commessa_id) {
        try {
            const { data: op, error } = await supabase
                .rpc('get_odp_for_commessa', { p_id_commessa: commessa_id });

            if (error) {
                console.warn('RPC OdP error:', error.message);
                // Prova fallback query diretta (se RLS lo permette)
                const { data: op2, error: err2 } = await supabase
                    .from('registro_produzione')
                    .select('id, numero_op, codice_articolo, descrizione, qta_richiesta, data_ricezione, data_invio')
                    .eq('id_commessa', commessa_id)
                    .order('data_ricezione', { ascending: false });
                if (!err2 && op2?.length > 0) this._renderOrdini(op2);
                return;
            }
            this._renderOrdini(op || []);
        } catch (e) {
            console.warn('Supabase OdP query fallita:', e.message);
        }
    },

    _renderDetail(data) {
        const c = data.commessa;
        const riepilogo = data.riepilogo;
        const isDone = c.status_commessa?.nome_status?.toLowerCase().includes('complet') ||
                       c.status_commessa?.nome_status?.toLowerCase().includes('chiuso');

        // Header
        this.dom.detCodice.textContent = c.codice_commessa || '—';
        this.dom.detStatus.textContent = c.status_commessa?.nome_status || 'In Lavorazione';
        this.dom.detStatus.className = `man-detail-status${isDone ? ' done' : ''}`;

        // Info
        this.dom.detCliente.textContent = c.clienti?.ragione_sociale || '—';
        this.dom.detImpianto.textContent = c.impianto || '—';
        this.dom.detVO.textContent = c.vo || '—';
        this.dom.detData.textContent = c.data_commessa ? new Date(c.data_commessa).toLocaleDateString('it-IT') : '—';
        this.dom.detOfficina.textContent = c.visibile_officina ? '✅ Sì' : '❌ No';
        this.dom.detNote.textContent = c.note || '—';

        // Pulsante Completa (solo se In Lavorazione)
        this.dom.btnCompleta.style.display = !isDone ? '' : 'none';

        // Ore summary
        this.dom.oreTotal.textContent = `${riepilogo.total_ore}h totali`;
        this.dom.oreAperte.textContent = `${riepilogo.ore_da_validare}h da validare`;
        this.dom.oreContat.textContent = `${riepilogo.ore_contabilizzate}h contabilizzate 🔒`;

        // Ore table
        const ore = data.ore || [];
        if (ore.length === 0) {
            this.dom.oreTableBody.innerHTML = '<tr class="man-table-empty"><td colspan="6">Nessuna ora registrata</td></tr>';
        } else {
            this.dom.oreTableBody.innerHTML = ore.map(o => {
                const locked = o.stato === 1;
                const data_str = o.data_lavoro ? new Date(o.data_lavoro).toLocaleDateString('it-IT') : '—';
                return `
                    <tr>
                        <td>${data_str}</td>
                        <td>${o.personale?.nome_cognome || '—'}</td>
                        <td><strong>${o.ore}h</strong></td>
                        <td>${o.macro_categorie?.nome || o.componenti?.nome_componente || '—'}</td>
                        <td>${o.note || '—'}</td>
                        <td>${locked ? '<span class="man-ore-locked-icon" title="Contabilizzato">🔒</span>' : ''}</td>
                    </tr>`;
            }).join('');
        }

        // OdP table (placeholder — verrà aggiornato da _loadOrdiniSupabase)
        this._renderOrdini(data.ordini_produzione || []);

        // Link inserisci OdP
        this.dom.btnInserisciOp.href = `inserimento-ordini.html?commessaId=${c.id_commessa}`;

        // Task
        if (data.task) {
            const t = data.task;
            const isDoneTask = t.stato?.toLowerCase() === 'completato';
            // La descrizione della task coincide con la nota della commessa
            const noteDesc = c.note || t.descrizione || '';
            this.dom.taskDetail.innerHTML = `
                <div class="man-task-title">${t.titolo || '—'}</div>
                ${noteDesc ? `<div class="man-task-desc">${noteDesc}</div>` : ''}
                <div class="man-task-meta">
                    <span class="man-task-chip ${isDoneTask ? 'done' : 'todo'}">${t.stato || 'Da Fare'}</span>
                    <span class="man-task-chip">${t.priorita || 'Media'}</span>
                    ${t.personale_assegnatario?.nome_cognome ? `<span class="man-task-chip">👤 ${t.personale_assegnatario.nome_cognome}</span>` : ''}
                </div>
            `;
        } else {
            this.dom.taskDetail.innerHTML = '<div class="man-task-placeholder">Nessuna task associata</div>';
        }
    },

    // ── Renderizza tabella Ordini di Produzione (richiamato anche da _loadOrdiniSupabase) ──
    _renderOrdini(op) {
        if (!this.dom.opTableBody) return;
        if (op.length === 0) {
            this.dom.opTableBody.innerHTML = '<tr class="man-table-empty"><td colspan="5">Nessun ordine di produzione</td></tr>';
        } else {
            this.dom.opTableBody.innerHTML = op.map(o => {
                const aperto = !o.data_invio;
                return `
                    <tr>
                        <td><strong>${o.numero_op || '—'}</strong></td>
                        <td>${o.codice_articolo || '—'}</td>
                        <td>${o.descrizione || '—'}</td>
                        <td>${o.qta_richiesta || '—'}</td>
                        <td class="${aperto ? 'man-op-aperto' : 'man-op-chiuso'}">${aperto ? '⚙️ Aperto' : '✓ Inviato'}</td>
                    </tr>`;
            }).join('');
        }
    },

    // ── FUNZIONI EDIT MODALE rimosse: edit avviene su nuova-commessa.html ──
    // _openEditModal, _closeEditModal, _submitEdit → obsolete dopo la migrazione


    // ── ELIMINA ──
    async _handleDelete() {
        if (!IsAdmin || !this.state.selectedId) return;
        if (!confirm('Eliminare definitivamente questa manutenzione?')) return;

        try {
            const res = await apiFetch(`/api/commesse/${this.state.selectedId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Errore eliminazione');
            this.state.selectedId = null;
            this.state.detail = null;
            this.dom.detailContent.style.display = 'none';
            this.dom.detailPlaceholder.style.display = '';
            await this._loadList();
        } catch(e) {
            alert(`Errore: ${e.message}`);
        }
    },

    // ── COMPLETA MODAL ──
    async _openCompletaModal() {
        if (!this.state.selectedId) return;
        try {
            const res = await apiFetch(`/api/manutenzioni/${this.state.selectedId}/summary`);
            const summary = await res.json();

            if (summary.open_op > 0) {
                alert(`Impossibile completare: ci sono ancora ${summary.open_op} ordini di produzione aperti.`);
                return;
            }

            const c = this.state.detail?.commessa;
            this.dom.completaTitolo.textContent = `${c?.codice_commessa || ''} — ${c?.clienti?.ragione_sociale || ''} — ${c?.impianto || ''}`;
            this.dom.completaOpTot.textContent = summary.total_op || '0';
            this.dom.completaOpChiusi.textContent = summary.closed_op || '0';
            this.dom.completaOreTot.textContent = `${summary.total_ore || 0}h`;
            this.dom.completaOreContat.textContent = `${summary.ore_contabilizzate || 0}h`;
            this.dom.completaOreDaContat.textContent = `${summary.ore_da_validare || 0}h`;

            this.dom.completaModalOverlay.style.display = '';
            this.dom.completaModal.style.display = '';
        } catch(e) {
            alert(`Errore: ${e.message}`);
        }
    },

    _closeCompletaModal() {
        this.dom.completaModalOverlay.style.display = 'none';
        this.dom.completaModal.style.display = 'none';
    },

    async _confirmCompleta() {
        if (!this.state.selectedId) return;
        this.dom.completaConferma.disabled = true;
        this.dom.completaConferma.textContent = 'Elaborazione...';

        try {
            const res = await apiFetch(`/api/manutenzioni/${this.state.selectedId}/complete`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Errore completamento');

            this._closeCompletaModal();
            await this._loadList();
            await this._selectCard(this.state.selectedId);
            // Piccolo feedback
            alert(`✅ Manutenzione completata!\n${result.ore_contabilizzate} registrazioni ore contabilizzate.\nTotale ore: ${result.total_ore}h`);
        } catch(e) {
            alert(`Errore: ${e.message}`);
        } finally {
            this.dom.completaConferma.disabled = false;
            this.dom.completaConferma.textContent = '✓ Conferma Completamento';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
