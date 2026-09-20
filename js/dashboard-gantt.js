// js/dashboard-gantt.js
//
// Il diagramma di Gantt delle fasi di produzione, estratto da `dashboard.js`
// il 20/09/2026 (task 4.6, primo taglio).
//
// PERCHE' QUESTO TAGLIO E' IL PIU' PULITO DEI TRE FATTI FINORA
// `renderGanttChart` erano 182 righe con **zero** accessi a `this.state`,
// **zero** chiamate API e **zero** letture da `this.dom`: riceve i dati come
// argomento e disegna geometria. Misurato con `strumenti/struttura_moduli.py`.
//
// L'estrazione di `exportToXlsx` aveva bisogno di quattro campi di stato come
// parametri; quella del popup dei filtri dell'oggetto di stato **per
// riferimento**, perche' lo scrive. Questa non ha bisogno di niente: la firma
// e' la stessa di prima.
//
// L'UNICA DIPENDENZA DA `this` SE N'E' ANDATA INSIEME AL METODO
// Era `this._getWeekStart(today)`. Quell'aiutante e' puro (nessuno stato,
// nessun DOM) e il suo unico chiamante in tutto il repository era questo
// metodo — verificato con grep su tutto il frontend, incluse le letture
// indirette via `window.Dashboard`. Quindi entra qui come `inizioSettimana` e
// **non e' esportato**: `Dashboard` passa da 37 metodi a 35.
//
// DOVE PUO' ROMPERSI IN SILENZIO, e va detto perche' un collaudo distratto non
// lo vedrebbe. `inizioSettimana` serve a UNA cosa sola: posizionare la linea
// verticale di «oggi». Un errore proprio la' non produce alcun errore di
// console e non svuota il grafico — lascia un Gantt perfetto a cui manca un
// filetto verticale. Il collaudo su staging deve guardare quella linea, non
// accontentarsi che il diagramma compaia.
//
// A CHE COSA RESTA LEGATO QUESTO MODULO
// Non a `Dashboard`, ma all'HTML: cerca `#ca-gantt-container` da se' con
// `document.getElementById`, come faceva prima. E' una dipendenza dalla vista
// «Analisi Commessa», non dall'oggetto che la governa, ed e' il motivo per cui
// qui non serve passare nessun contenitore.

/**
 * Disegna il Gantt delle fasi nel contenitore `#ca-gantt-container`.
 *
 * @param {object} ganttData  come arriva dall'API: `gantt_attuale`,
 *                            `gantt_ombra`, `timeline`, `settimana_zero`,
 *                            `num_commesse_ombra`.
 */
export function disegnaGantt(ganttData) {
    const container = document.getElementById('ca-gantt-container');
    if (!container) return;
    container.innerHTML = '';

    const attuale = ganttData.gantt_attuale || [];
    const ombra = ganttData.gantt_ombra || [];
    const timeline = ganttData.timeline || [];
    const settimanaZero = ganttData.settimana_zero;

    if (!attuale.length || !timeline.length || !settimanaZero) {
        container.innerHTML = '<div class="gantt-empty">📅 Nessun dato Gantt disponibile. Le ore registrate verranno mostrate qui raggruppate per fase di produzione.</div>';
        return;
    }

    // Collect all unique phases (from both attuale and ombra)
    const phasesMap = new Map();
    attuale.forEach(f => phasesMap.set(f.fase_id, f.fase_nome));
    ombra.forEach(f => { if (!phasesMap.has(f.fase_id)) phasesMap.set(f.fase_id, f.fase_nome); });
    const phases = Array.from(phasesMap.entries()).sort((a, b) => a[0] - b[0]);

    const numWeeks = timeline.length;
    const labelColWidth = 140; // px
    const weekMinWidth = 35; // px per week cell

    // Build CSS Grid: 1 label column + N week columns
    const chart = document.createElement('div');
    chart.className = 'gantt-chart';
    chart.style.gridTemplateColumns = `${labelColWidth}px repeat(${numWeeks}, minmax(${weekMinWidth}px, 1fr))`;
    chart.style.gridTemplateRows = `auto repeat(${phases.length}, auto)`;

    // --- HEADER ROW ---
    // Corner cell (empty label)
    const corner = document.createElement('div');
    corner.className = 'gantt-header-label';
    corner.textContent = 'Fase';
    corner.style.gridColumn = '1';
    chart.appendChild(corner);

    // Week headers - show month label at start of each month
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    let lastMonth = -1;
    timeline.forEach((weekStr, i) => {
        const d = new Date(weekStr);
        const month = d.getMonth();
        const headerCell = document.createElement('div');
        headerCell.className = 'gantt-header-label';
        headerCell.style.gridColumn = `${i + 2}`;
        if (month !== lastMonth) {
            headerCell.textContent = monthNames[month] + ' ' + String(d.getFullYear()).slice(2);
            lastMonth = month;
        } else {
            // Show week number or day
            headerCell.textContent = d.getDate();
            headerCell.style.color = 'var(--col-cccccc)';
            headerCell.style.fontSize = '0.6rem';
        }
        chart.appendChild(headerCell);
    });

    // --- PHASE ROWS ---
    const phaseColors = ['gantt-phase-0', 'gantt-phase-1', 'gantt-phase-2', 'gantt-phase-3', 'gantt-phase-4'];

    phases.forEach(([phaseId, phaseName], rowIdx) => {
        const gridRow = rowIdx + 2; // +2 because row 1 is header

        // Phase Label
        const label = document.createElement('div');
        label.className = 'gantt-phase-label';
        label.textContent = phaseName;
        label.style.gridRow = gridRow;
        label.style.gridColumn = '1';
        chart.appendChild(label);

        // Timeline cell (spans all week columns)
        const timelineCell = document.createElement('div');
        timelineCell.className = 'gantt-row-timeline';
        timelineCell.style.gridRow = gridRow;
        timelineCell.style.gridColumn = `2 / ${numWeeks + 2}`;

        // Week grid cells (background)
        for (let w = 0; w < numWeeks; w++) {
            const cell = document.createElement('div');
            cell.className = 'gantt-week-cell';
            timelineCell.appendChild(cell);
        }

        // --- SHADOW BAR (if exists for this phase) ---
        const shadowPhase = ombra.find(o => o.fase_id === phaseId);
        if (shadowPhase) {
            const shadowStart = shadowPhase.offset_settimane || 0;
            const shadowDuration = shadowPhase.durata_settimane || 1;
            const shadowLeftPct = (shadowStart / numWeeks) * 100;
            const shadowWidthPct = (shadowDuration / numWeeks) * 100;

            const shadowBar = document.createElement('div');
            shadowBar.className = 'gantt-bar-shadow';
            shadowBar.style.left = shadowLeftPct + '%';
            shadowBar.style.width = Math.min(shadowWidthPct, 100 - shadowLeftPct) + '%';
            shadowBar.title = `Previsione: ${phaseName} – Sett. ${shadowStart + 1} → ${shadowStart + shadowDuration} (~${shadowPhase.ore_mediane || 0}h)`;
            timelineCell.appendChild(shadowBar);
        }

        // --- ACTUAL BAR ---
        const actualPhase = attuale.find(a => a.fase_id === phaseId);
        if (actualPhase) {
            const dettaglio = actualPhase.dettaglio_settimane || [];
            if (dettaglio.length > 0) {
                const firstWeek = dettaglio[0].settimana;
                const lastWeek = dettaglio[dettaglio.length - 1].settimana;
                const startIdx = timeline.indexOf(firstWeek);
                const endIdx = timeline.indexOf(lastWeek);

                if (startIdx >= 0 && endIdx >= 0) {
                    const barStartPct = (startIdx / numWeeks) * 100;
                    const barWidthPct = ((endIdx - startIdx + 1) / numWeeks) * 100;

                    const actualBar = document.createElement('div');
                    actualBar.className = `gantt-bar-actual ${phaseColors[rowIdx % phaseColors.length]}`;
                    actualBar.style.left = barStartPct + '%';
                    actualBar.style.width = Math.max(barWidthPct, (1 / numWeeks) * 100) + '%';

                    // Label inside bar
                    const barLabel = document.createElement('span');
                    barLabel.className = 'gantt-bar-label';
                    barLabel.textContent = actualPhase.ore_totali + 'h';
                    actualBar.appendChild(barLabel);

                    // Tooltip
                    const tooltip = document.createElement('div');
                    tooltip.className = 'gantt-tooltip';
                    const weeksSummary = dettaglio.slice(0, 5).map(d => {
                        const dt = new Date(d.settimana);
                        return `${dt.getDate()}/${dt.getMonth() + 1}: ${d.ore}h`;
                    }).join(' | ');
                    tooltip.textContent = `${phaseName}: ${actualPhase.ore_totali}h — ${weeksSummary}${dettaglio.length > 5 ? ' ...' : ''}`;
                    actualBar.appendChild(tooltip);

                    timelineCell.appendChild(actualBar);
                }
            }
        }

        chart.appendChild(timelineCell);
    });

    // --- TODAY LINE (positioned after DOM insertion via RAF) ---
    const today = new Date();
    const todayStr = inizioSettimana(today);
    const todayIdx = timeline.indexOf(todayStr);

    container.appendChild(chart);

    // Position today line after layout (needs measured widths)
    if (todayIdx >= 0) {
        requestAnimationFrame(() => {
            const chartRect = chart.getBoundingClientRect();
            // First week cell to measure timeline area
            const firstCell = chart.querySelector('.gantt-row-timeline');
            if (firstCell) {
                const cellRect = firstCell.getBoundingClientRect();
                const timelineStartX = cellRect.left - chartRect.left;
                const timelineW = cellRect.width;
                const lineX = timelineStartX + ((todayIdx + 0.5) / numWeeks) * timelineW;

                const todayLine = document.createElement('div');
                todayLine.className = 'gantt-today-line';
                todayLine.style.left = lineX + 'px';
                chart.appendChild(todayLine);
            }
        });
    }

    // Ombra info badge
    const numOmbra = ganttData.num_commesse_ombra || 0;
    if (numOmbra > 0) {
        const badge = document.createElement('div');
        badge.className = 'gantt-ombra-info';
        badge.textContent = `📊 Previsione basata su ${numOmbra} commesse simili chiuse`;
        container.appendChild(badge);
    }
}

/**
 * Inizio della settimana ISO (lunedi') di una data, in formato `YYYY-MM-DD`.
 *
 * Privata: il suo unico chiamante e' `disegnaGantt`, ed e' entrata qui con lui.
 * Era `_getWeekStart` in `dashboard.js`.
 */
function inizioSettimana(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}
