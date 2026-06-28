// js/distribuzione-ore.js — v3: apiFetch per letture (backend bypassa RLS), Supabase RLS blocca anon key

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const App = {
    data: {
        commesse: [],
        selectedCommessa: null,
        ordini: [],          // OP della commessa
        oreLavorate: [],     // ore_lavorate della commessa
        storicoArticoli: {}, // id_articolo -> [{numero_op, ore, commessa}]
        oreProposte: {},     // id_op -> ore proposte dall'AI
        oreFinali: {},       // id_op -> ore inserite dall'utente
        showClosed: false,
    },

    // === HELPERS ===
    buildCommessaLabel: function(c) {
        if (!c) return 'N/D';
        const parts = [
            c.clienti?.ragione_sociale,
            c.impianto,
            c.vo,
            c.riferimento_tecnico
        ].filter(p => p && p.trim() !== '');
        return parts.join(' | ') || 'N/D';
    },

    formatOre: function(minuti) {
        if (!minuti || minuti <= 0) return '0h';
        return (minuti / 60).toFixed(1) + 'h';
    },

    // === INIT ===
    init: async function() {
        console.log("🚀 DISTRIBUZIONE ORE INIT v3");
        if (!IsAdmin) {
            window.location.replace('index.html');
            return;
        }
        this.bindEvents();
        await this.loadCommesse();
    },

    bindEvents: function() {
        document.getElementById('commessaSelect').addEventListener('change', (e) => {
            document.getElementById('btnCarica').disabled = !e.target.value;
        });
        document.getElementById('btnCarica').addEventListener('click', () => this.loadCommessaData());
        document.getElementById('btnElabora').addEventListener('click', () => this.elaboraDistribuzione());
        document.getElementById('btnChiudiSelezionati').addEventListener('click', () => this.chiudiSelezionati());

        document.getElementById('toggleChiusi').addEventListener('change', (e) => {
            this.data.showClosed = e.target.checked;
            this.renderTable();
        });

        document.getElementById('checkAll').addEventListener('change', (e) => {
            document.querySelectorAll('.op-check:not(:disabled)').forEach(cb => {
                if (cb.closest('tr').style.display !== 'none') {
                    cb.checked = e.target.checked;
                }
            });
            this.updateChiudiButton();
        });
    },

    // === CARICAMENTO COMMESSE (via backend) ===
    loadCommesse: async function() {
        try {
            const res = await apiFetch('/api/commesse/view?limit=200&status=In Lavorazione');
            const json = await res.json();
            this.data.commesse = json.data || [];

            const select = document.getElementById('commessaSelect');
            select.innerHTML = '<option value="">— Seleziona una commessa —</option>';

            const sorted = this.data.commesse
                .map(c => ({ ...c, label: this.buildCommessaLabel(c) }))
                .sort((a, b) => a.label.localeCompare(b.label));

            sorted.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id_commessa;
                opt.textContent = c.label;
                select.appendChild(opt);
            });

            console.log(`📋 ${this.data.commesse.length} commesse caricate`);
        } catch (e) {
            console.error("Errore caricamento commesse:", e);
        }
    },

    // === CARICAMENTO DATI COMMESSA (3 chiamate parallele via backend) ===
    loadCommessaData: async function() {
        const idCommessa = parseInt(document.getElementById('commessaSelect').value);
        if (!idCommessa) return;

        const btn = document.getElementById('btnCarica');
        btn.disabled = true; btn.textContent = '⏳ Caricamento...';

        try {
            // 2 chiamate parallele: OP + Ore lavorate
            const [ordiniRes, oreRes] = await Promise.all([
                apiFetch(`/api/produzione/ordini?status=tutti&id_commessa=${idCommessa}`),
                apiFetch(`/api/distribuzione/ore-commessa/${idCommessa}`)
            ]);

            this.data.ordini = await ordiniRes.json();

            try {
                const oreJson = await oreRes.json();
                this.data.oreLavorate = oreJson.data || [];
            } catch {
                this.data.oreLavorate = [];
            }

            this.data.selectedCommessa = idCommessa;
            this.data.oreProposte = {};
            this.data.oreFinali = {};

            console.log(`📦 ${this.data.ordini.length} OP, ${this.data.oreLavorate.length} registrazioni ore`);

            // Render
            this.renderSummary();
            this.renderTable();

            // Mostra pannelli
            document.getElementById('summaryPanel').style.display = 'block';
            document.getElementById('actionsBar').style.display = 'flex';
            document.getElementById('tableContainer').style.display = 'block';
            document.getElementById('btnElabora').disabled = false;

            // Reset toggle
            document.getElementById('toggleChiusi').checked = false;
            this.data.showClosed = false;

            // Carica storico articoli in background
            this.loadStoricoArticoli();

        } catch (e) {
            console.error("Errore caricamento dati commessa:", e);
            alert("Errore nel caricamento: " + (e.message || e));
        } finally {
            btn.disabled = false; btn.textContent = '📊 Carica';
        }
    },

    // === CARICAMENTO STORICO ARTICOLI (via backend) ===
    loadStoricoArticoli: async function() {
        const idArticoli = [...new Set(
            this.data.ordini.filter(o => o.id_articolo).map(o => o.id_articolo)
        )];

        if (idArticoli.length === 0) {
            this.data.storicoArticoli = {};
            this.fillStoricoColumn();
            return;
        }

        try {
            const res = await apiFetch('/api/distribuzione/storico-articoli', {
                method: 'POST',
                body: JSON.stringify({ id_articoli: idArticoli })
            });
            const storico = await res.json();

            // Escludi OP della commessa corrente
            const currentOps = new Set(this.data.ordini.map(o => o.numero_op));
            for (const artId of Object.keys(storico)) {
                storico[artId] = storico[artId].filter(s => !currentOps.has(s.numero_op));
            }

            this.data.storicoArticoli = storico;
            console.log(`📜 Storico: ${Object.keys(storico).length} articoli con registrazioni`);
            this.fillStoricoColumn();
        } catch (e) {
            console.warn("Storico articoli non disponibile:", e);
            this.data.storicoArticoli = {};
            this.fillStoricoColumn();
        }
    },

    // === RIEMPIE LA COLONNA STORICO ===
    fillStoricoColumn: function() {
        document.querySelectorAll('[data-storico-art]').forEach(cell => {
            const artId = cell.dataset.storicoArt;
            if (!artId) {
                cell.innerHTML = '<span class="storico-empty">—</span>';
                return;
            }

            const entries = this.data.storicoArticoli[artId] || [];

            if (entries.length === 0) {
                cell.innerHTML = '<span class="storico-empty">Nessuno storico</span>';
            } else {
                const display = entries.slice(0, 5);
                cell.innerHTML = `<ul class="storico-list">
                    ${display.map(s => `<li>
                        <span class="storico-label" title="OP: ${s.numero_op}">${s.commessa || s.numero_op}</span>
                        <span class="storico-ore">${s.ore}h</span>
                    </li>`).join('')}
                    ${entries.length > 5 ? `<li style="color:#888; font-size:0.9em;">+${entries.length - 5} altri</li>` : ''}
                </ul>`;
            }
        });
    },

    // === RENDER RIEPILOGO ===
    renderSummary: function() {
        const ordini = this.data.ordini;
        const aperti = ordini.filter(o => !o.data_invio);
        const chiusi = ordini.filter(o => o.data_invio);

        document.getElementById('sumOpTotali').textContent = ordini.length;
        document.getElementById('sumOpAperti').textContent = aperti.length;
        document.getElementById('sumOpChiusi').textContent = chiusi.length;

        // Ore lavorate totali (da tabella ore_lavorate)
        const oreTotali = this.data.oreLavorate.reduce((sum, o) => sum + (o.ore || 0), 0);
        document.getElementById('sumOreLavorate').textContent = oreTotali.toFixed(1) + 'h';

        // Ore contabilizzate (tempo_impiegato degli OP chiusi)
        const oreContabilizzate = chiusi.reduce((sum, o) => sum + ((o.tempo_impiegato || 0) / 60), 0);
        document.getElementById('sumOreContabilizzate').textContent = oreContabilizzate.toFixed(1) + 'h';

        // Ore da distribuire
        const oreDaDistribuire = Math.max(0, oreTotali - oreContabilizzate);
        document.getElementById('sumOreDaDistribuire').textContent = oreDaDistribuire.toFixed(1) + 'h';

        // Ore per mese
        const orePerMese = {};
        const mesiNomi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

        this.data.oreLavorate.forEach(o => {
            if (o.data_registrazione) {
                const d = new Date(o.data_registrazione);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = `${mesiNomi[d.getMonth()]} ${d.getFullYear()}`;
                if (!orePerMese[key]) orePerMese[key] = { label, ore: 0 };
                orePerMese[key].ore += (o.ore || 0);
            }
        });

        const grid = document.getElementById('oreMesiGrid');
        const sortedMesi = Object.keys(orePerMese).sort();

        if (sortedMesi.length === 0) {
            grid.innerHTML = '<span style="color:#999; font-style:italic;">Nessun dato ore per questa commessa</span>';
        } else {
            grid.innerHTML = sortedMesi.map(k => {
                const m = orePerMese[k];
                return `<div class="ore-mese-badge">
                    <span class="mese-label">${m.label}</span>
                    <span class="mese-value">${m.ore.toFixed(1)}h</span>
                </div>`;
            }).join('');
        }
    },

    // === RENDER TABELLA OP ===
    renderTable: function() {
        const tbody = document.getElementById('opTableBody');
        tbody.innerHTML = '';

        if (this.data.ordini.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#999;">Nessun OP trovato per questa commessa</td></tr>';
            return;
        }

        const sorted = [...this.data.ordini].sort((a, b) => {
            if (!a.data_invio && b.data_invio) return -1;
            if (a.data_invio && !b.data_invio) return 1;
            return (a.data_ricezione || '').localeCompare(b.data_ricezione || '');
        });

        sorted.forEach(op => {
            const tr = document.createElement('tr');
            const isClosed = !!op.data_invio;
            const codice = op.anagrafica_articoli?.codice_articolo || '—';
            const desc = op.anagrafica_articoli?.descrizione || op.descrizione || '—';
            const fase = op.fasi_produzione?.nome_fase || '';
            const proposta = this.data.oreProposte[op.id];
            const finali = this.data.oreFinali[op.id];

            if (isClosed) {
                tr.classList.add('row-closed');
                if (!this.data.showClosed) tr.style.display = 'none';
            }

            tr.innerHTML = `
                <td class="col-check">
                    <input type="checkbox" class="op-check" data-id="${op.id}" ${isClosed ? 'disabled' : ''}>
                </td>
                <td class="col-op">
                    <div class="op-info">
                        <div>
                            <span class="op-numero">${op.numero_op || '—'}</span>
                            ${isClosed ? '<span class="op-badge-closed">CHIUSO</span>' : ''}
                        </div>
                        <div class="op-descrizione">${desc}</div>
                        <div class="op-meta">
                            <span>📦 ${codice}</span>
                            ${fase ? `<span>🔧 ${fase}</span>` : ''}
                            <span>📐 Qtà: ${op.qta_richiesta || '—'}</span>
                            ${isClosed && op.tempo_impiegato ? `<span>⏱️ ${this.formatOre(op.tempo_impiegato)}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td class="col-storico" data-storico-art="${op.id_articolo || ''}">
                    <span style="color:#ddd; font-size:0.8em;">⏳</span>
                </td>
                <td class="col-ore-ai">
                    <div class="ore-cell ${proposta == null ? 'empty' : ''}">
                        ${proposta != null ? proposta.toFixed(1) + 'h' : '—'}
                    </div>
                </td>
                <td class="col-dettaglio">
                    <div class="dettaglio-placeholder" id="dettaglio-${op.id}">
                        <span style="color:#ccc; font-style:italic;">In attesa di elaborazione</span>
                    </div>
                </td>
                <td class="col-ore-finali">
                    ${isClosed 
                        ? `<div class="ore-cell">${this.formatOre(op.tempo_impiegato)}</div>`
                        : `<input type="number" class="ore-input" data-id="${op.id}" step="0.1" min="0"
                            placeholder="—" value="${finali != null ? finali : ''}">`
                    }
                </td>
            `;
            tbody.appendChild(tr);

            tr.querySelector('.op-check')?.addEventListener('change', () => this.updateChiudiButton());

            const input = tr.querySelector('.ore-input');
            if (input) {
                input.addEventListener('input', () => {
                    const val = parseFloat(input.value);
                    this.data.oreFinali[op.id] = isNaN(val) ? null : val;
                    this.updateTotali();
                });
            }
        });

        this.updateTotali();
        this.fillStoricoColumn();
        document.getElementById('checkAll').checked = false;
    },

    // === AGGIORNA TOTALI ===
    updateTotali: function() {
        let totAI = 0, hasAI = false;
        Object.values(this.data.oreProposte).forEach(v => {
            if (v != null) { totAI += v; hasAI = true; }
        });
        document.getElementById('totalOreAI').textContent = hasAI ? totAI.toFixed(1) + 'h' : '—';

        let totFinali = 0, hasFinali = false;
        document.querySelectorAll('.ore-input').forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) { totFinali += val; hasFinali = true; }
        });
        this.data.ordini.forEach(op => {
            if (op.data_invio && op.tempo_impiegato) {
                totFinali += op.tempo_impiegato / 60;
                hasFinali = true;
            }
        });
        document.getElementById('totalOreFinali').textContent = hasFinali ? totFinali.toFixed(1) + 'h' : '—';
    },

    updateChiudiButton: function() {
        const checked = document.querySelectorAll('.op-check:checked:not(:disabled)');
        const btn = document.getElementById('btnChiudiSelezionati');
        btn.disabled = checked.length === 0;
        btn.textContent = checked.length > 0
            ? `✅ Chiudi Selezionati (${checked.length})`
            : '✅ Chiudi Selezionati';
    },

    // === ELABORA (PLACEHOLDER) ===
    elaboraDistribuzione: async function() {
        const btn = document.getElementById('btnElabora');
        btn.disabled = true; btn.textContent = '⏳ Elaborazione...';
        try {
            await new Promise(r => setTimeout(r, 800));
            alert('🚧 Funzionalità in sviluppo.\n\nL\'algoritmo di distribuzione verrà implementato nella Fase 2.\nPer ora puoi inserire le ore manualmente nella colonna "Ore Finali".');
        } finally {
            btn.disabled = false; btn.textContent = '🤖 Elabora Distribuzione';
        }
    },

    // === CHIUDI SELEZIONATI ===
    chiudiSelezionati: async function() {
        const checked = document.querySelectorAll('.op-check:checked:not(:disabled)');
        if (checked.length === 0) return;

        const daChiudere = [];
        let errori = [];
        checked.forEach(cb => {
            const idOp = parseInt(cb.dataset.id);
            const input = document.querySelector(`.ore-input[data-id="${idOp}"]`);
            const ore = input ? parseFloat(input.value) : NaN;
            const op = this.data.ordini.find(o => o.id === idOp);

            if (isNaN(ore) || ore < 0) {
                errori.push(`OP ${op?.numero_op || idOp}: ore non valide`);
            } else {
                daChiudere.push({ id_op: idOp, ore, qta: op?.qta_richiesta || 0, numero_op: op?.numero_op || '' });
            }
        });

        if (errori.length > 0) { alert('⚠️ Errori:\n\n' + errori.join('\n')); return; }

        if (!confirm(`Stai per chiudere ${daChiudere.length} OP:\n\n` +
            daChiudere.map(d => `  ${d.numero_op}: ${d.ore}h`).join('\n') + `\n\nProcedere?`)) return;

        const btn = document.getElementById('btnChiudiSelezionati');
        btn.disabled = true; btn.textContent = '⏳ Chiusura in corso...';

        let successi = 0, fallimenti = 0;
        for (const item of daChiudere) {
            try {
                await apiFetch(`/api/produzione/op/${item.id_op}/chiudi`, {
                    method: 'PUT',
                    body: JSON.stringify({ tempo_impiegato: Math.round(item.ore * 60), qta_prodotta: item.qta })
                });
                successi++;
            } catch (e) {
                console.error(`Errore chiusura OP ${item.numero_op}:`, e);
                fallimenti++;
            }
        }

        alert(`✅ ${successi} OP chiusi con successo${fallimenti > 0 ? `\n❌ ${fallimenti} errori` : ''}`);
        await this.loadCommessaData();
        btn.disabled = false; btn.textContent = '✅ Chiudi Selezionati';
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });
