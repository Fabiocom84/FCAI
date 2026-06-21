// js/distribuzione-ore.js

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const App = {
    data: {
        commesse: [],
        selectedCommessa: null,
        ordini: [],          // OP della commessa
        oreLavorate: [],     // ore_lavorate della commessa
        oreProposte: {},     // id_op -> ore proposte dall'AI
        oreFinali: {},       // id_op -> ore inserite dall'utente
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
        console.log("🚀 DISTRIBUZIONE ORE INIT");
        if (!IsAdmin) {
            window.location.replace('index.html');
            return;
        }

        this.bindEvents();
        await this.loadCommesse();
    },

    bindEvents: function() {
        // Selettore commessa
        document.getElementById('commessaSelect').addEventListener('change', (e) => {
            document.getElementById('btnCarica').disabled = !e.target.value;
        });

        // Bottone carica
        document.getElementById('btnCarica').addEventListener('click', () => this.loadCommessaData());

        // Bottone elabora (placeholder)
        document.getElementById('btnElabora').addEventListener('click', () => this.elaboraDistribuzione());

        // Bottone chiudi selezionati
        document.getElementById('btnChiudiSelezionati').addEventListener('click', () => this.chiudiSelezionati());

        // Select all checkbox
        document.getElementById('checkAll').addEventListener('change', (e) => {
            document.querySelectorAll('.op-check').forEach(cb => {
                // Solo OP aperti
                if (!cb.disabled) cb.checked = e.target.checked;
            });
            this.updateChiudiButton();
        });
    },

    // === CARICAMENTO COMMESSE ===
    loadCommesse: async function() {
        try {
            const res = await apiFetch('/api/commesse/view?limit=200&status=In Lavorazione');
            const json = await res.json();
            this.data.commesse = json.data || [];

            const select = document.getElementById('commessaSelect');
            select.innerHTML = '<option value="">— Seleziona una commessa —</option>';

            // Ordina per label
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

    // === CARICAMENTO DATI COMMESSA ===
    loadCommessaData: async function() {
        const idCommessa = document.getElementById('commessaSelect').value;
        if (!idCommessa) return;

        const btn = document.getElementById('btnCarica');
        btn.disabled = true; btn.textContent = '⏳ Caricamento...';

        try {
            // Caricamento parallelo: OP + Ore lavorate
            const [ordiniRes, oreRes] = await Promise.all([
                apiFetch(`/api/produzione/ordini?status=tutti&id_commessa=${idCommessa}`),
                apiFetch(`/api/distribuzione/ore-commessa/${idCommessa}`)
            ]);

            this.data.ordini = await ordiniRes.json();
            
            // Ore lavorate: potrebbe fallire se l'endpoint non esiste ancora
            try {
                const oreJson = await oreRes.json();
                this.data.oreLavorate = oreJson.data || oreJson || [];
            } catch {
                this.data.oreLavorate = [];
            }

            this.data.selectedCommessa = parseInt(idCommessa);
            this.data.oreProposte = {};
            this.data.oreFinali = {};

            // Render
            this.renderSummary();
            this.renderTable();

            // Mostra pannelli
            document.getElementById('summaryPanel').style.display = 'block';
            document.getElementById('actionsBar').style.display = 'flex';
            document.getElementById('tableContainer').style.display = 'block';
            document.getElementById('btnElabora').disabled = false;

        } catch (e) {
            console.error("Errore caricamento dati commessa:", e);
            alert("Errore nel caricamento: " + e.message);
        } finally {
            btn.disabled = false; btn.textContent = '📊 Carica';
        }
    },

    // === RENDER RIEPILOGO ===
    renderSummary: function() {
        const ordini = this.data.ordini;
        const aperti = ordini.filter(o => !o.data_invio);
        const chiusi = ordini.filter(o => o.data_invio);

        document.getElementById('sumOpTotali').textContent = ordini.length;
        document.getElementById('sumOpAperti').textContent = aperti.length;
        document.getElementById('sumOpChiusi').textContent = chiusi.length;

        // Ore lavorate totali
        const oreTotali = this.data.oreLavorate.reduce((sum, o) => sum + (o.ore || 0), 0);
        document.getElementById('sumOreLavorate').textContent = oreTotali.toFixed(1) + 'h';

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
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#999;">Nessun OP trovato per questa commessa</td></tr>';
            return;
        }

        // Ordina: aperti prima, poi per data
        const sorted = [...this.data.ordini].sort((a, b) => {
            // Aperti prima
            if (!a.data_invio && b.data_invio) return -1;
            if (a.data_invio && !b.data_invio) return 1;
            // Poi per data ricezione
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

            if (isClosed) tr.classList.add('row-closed');

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

            // Event: checkbox change
            tr.querySelector('.op-check')?.addEventListener('change', () => this.updateChiudiButton());

            // Event: ore finali input change
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
        document.getElementById('checkAll').checked = false;
    },

    // === AGGIORNA TOTALI ===
    updateTotali: function() {
        // Totale Ore AI
        let totAI = 0;
        let hasAI = false;
        Object.values(this.data.oreProposte).forEach(v => {
            if (v != null) { totAI += v; hasAI = true; }
        });
        document.getElementById('totalOreAI').textContent = hasAI ? totAI.toFixed(1) + 'h' : '—';

        // Totale Ore Finali (da input + OP già chiusi)
        let totFinali = 0;
        let hasFinali = false;

        // Ore dagli input
        document.querySelectorAll('.ore-input').forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) { totFinali += val; hasFinali = true; }
        });

        // Ore da OP chiusi
        this.data.ordini.forEach(op => {
            if (op.data_invio && op.tempo_impiegato) {
                totFinali += op.tempo_impiegato / 60;
                hasFinali = true;
            }
        });

        document.getElementById('totalOreFinali').textContent = hasFinali ? totFinali.toFixed(1) + 'h' : '—';
    },

    // === AGGIORNA BOTTONE CHIUDI ===
    updateChiudiButton: function() {
        const checked = document.querySelectorAll('.op-check:checked:not(:disabled)');
        const btn = document.getElementById('btnChiudiSelezionati');
        btn.disabled = checked.length === 0;
        btn.textContent = checked.length > 0
            ? `✅ Chiudi Selezionati (${checked.length})`
            : '✅ Chiudi Selezionati';
    },

    // === ELABORA DISTRIBUZIONE (PLACEHOLDER) ===
    elaboraDistribuzione: async function() {
        const btn = document.getElementById('btnElabora');
        btn.disabled = true; btn.textContent = '⏳ Elaborazione...';

        try {
            // TODO: Fase 2 — Chiamata API per matching keywords + storico
            // Per ora simula un breve delay
            await new Promise(r => setTimeout(r, 800));

            alert('🚧 Funzionalità in sviluppo.\n\nL\'algoritmo di distribuzione verrà implementato nella Fase 2.\nPer ora puoi inserire le ore manualmente nella colonna "Ore Finali".');

        } catch (e) {
            console.error("Errore elaborazione:", e);
            alert("Errore: " + e.message);
        } finally {
            btn.disabled = false; btn.textContent = '🤖 Elabora Distribuzione';
        }
    },

    // === CHIUDI SELEZIONATI ===
    chiudiSelezionati: async function() {
        const checked = document.querySelectorAll('.op-check:checked:not(:disabled)');
        if (checked.length === 0) return;

        // Raccogli dati
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
                daChiudere.push({
                    id_op: idOp,
                    ore: ore,
                    qta: op?.qta_richiesta || 0,
                    numero_op: op?.numero_op || ''
                });
            }
        });

        if (errori.length > 0) {
            alert('⚠️ Errori:\n\n' + errori.join('\n'));
            return;
        }

        const conferma = confirm(
            `Stai per chiudere ${daChiudere.length} OP:\n\n` +
            daChiudere.map(d => `  ${d.numero_op}: ${d.ore}h`).join('\n') +
            `\n\nProcedere?`
        );
        if (!conferma) return;

        const btn = document.getElementById('btnChiudiSelezionati');
        btn.disabled = true; btn.textContent = '⏳ Chiusura in corso...';

        let successi = 0;
        let fallimenti = 0;

        for (const item of daChiudere) {
            try {
                const minuti = Math.round(item.ore * 60);
                await apiFetch(`/api/produzione/op/${item.id_op}/chiudi`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        tempo_impiegato: minuti,
                        qta_prodotta: item.qta
                    })
                });
                successi++;
            } catch (e) {
                console.error(`Errore chiusura OP ${item.numero_op}:`, e);
                fallimenti++;
            }
        }

        alert(`✅ ${successi} OP chiusi con successo${fallimenti > 0 ? `\n❌ ${fallimenti} errori` : ''}`);

        // Ricarica dati
        await this.loadCommessaData();

        btn.disabled = false; btn.textContent = '✅ Chiudi Selezionati';
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });
