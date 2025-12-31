import { apiFetch } from './api-client.js';

let rowsData = [];
let chartInstance = null;
let choicesPersonale, choicesCommessa;

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    initFilters();
    initListeners();
    await loadOptions();
    loadDashboard(); // Primo caricamento
});

function initFilters() {
    const today = new Date();
    // Default: Primo giorno del mese corrente -> Oggi
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('dateStart').valueAsDate = firstDay;
    document.getElementById('dateEnd').valueAsDate = today;
    
    choicesPersonale = new Choices('#filterPersonale', { removeItemButton: true, placeholderValue: 'Tutti i dipendenti' });
    choicesCommessa = new Choices('#filterCommessa', { removeItemButton: true, placeholderValue: 'Tutte le commesse' });
}

function initListeners() {
    document.getElementById('btnRefresh').addEventListener('click', loadDashboard);
    document.getElementById('globalSearch').addEventListener('input', (e) => filterLocalData(e.target.value));
    
    document.getElementById('selectAll').addEventListener('change', (e) => {
        document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
        updateSelectionUI();
    });
    
    document.getElementById('btnContabilizza').addEventListener('click', contabilizzaSelezionati);
}

// CARICAMENTO DROPDOWN
async function loadOptions() {
    try {
        const [pRes, cRes] = await Promise.all([
            apiFetch('/api/personale'),
            apiFetch('/api/commesse')
        ]);
        
        const pData = await pRes.json();
        const cData = await cRes.json();
        
        choicesPersonale.setChoices(pData.data.map(p => ({ value: p.id_personale, label: p.nome_cognome })), 'value', 'label', true);
        choicesCommessa.setChoices(cData.data.map(c => ({ value: c.id_commessa, label: `${c.impianto} (${c.codice_commessa || ''})` })), 'value', 'label', true);
    } catch(e) { console.error("Err loading options", e); }
}

// CORE FETCH
async function loadDashboard() {
    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;
    const pers = document.getElementById('filterPersonale').value;
    const comm = document.getElementById('filterCommessa').value;
    const stato = document.getElementById('filterStato').value;
    
    const params = new URLSearchParams({ start, end });
    if(pers) params.append('id_personale', pers);
    if(comm) params.append('id_commessa', comm);
    if(stato) params.append('stato', stato);
    
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="8">Caricamento...</td></tr>';
    
    try {
        const res = await apiFetch(`/api/dashboard/stats?${params}`);
        const data = await res.json();
        
        rowsData = data.rows; // Salvo dati raw per ricerca locale
        
        updateKPI(data.kpi);
        renderChart(data.charts);
        renderTable(rowsData);
        
    } catch(e) {
        console.error(e);
        alert("Errore caricamento dashboard");
    }
}

function updateKPI(kpi) {
    document.getElementById('kpiTotal').textContent = kpi.total_ore;
    document.getElementById('kpiPending').textContent = kpi.da_contabilizzare;
    document.getElementById('kpiDone').textContent = kpi.contabilizzate;
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">Nessun dato trovato.</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        const commessa = row.commesse ? row.commesse.impianto : 'N/D';
        const componente = row.componenti ? row.componenti.nome_componente : '';
        const personale = row.personale ? row.personale.nome_cognome : 'Ex Dipendente';
        const dateStr = new Date(row.data_lavoro).toLocaleDateString('it-IT');
        const statusLabel = row.stato === 1 ? 'Contabilizzato' : 'Aperto';
        const statusClass = `status-${row.stato}`;

        // Checkbox disabilitata se già contabilizzato (opzionale, o permetti revert)
        const chkDisabled = row.stato === 1 ? 'disabled' : '';

        tr.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" value="${row.id_registrazione}" ${chkDisabled}></td>
            <td>${dateStr}</td>
            <td><strong>${personale}</strong></td>
            <td>${commessa}</td>
            <td>${componente}</td>
            <td style="font-weight:bold;">${row.ore}</td>
            <td style="font-size:0.85em; color:#666;">${row.note || ''}</td>
            <td><span class="badge-status ${statusClass}">${statusLabel}</span></td>
        `;
        
        tr.querySelector('.row-checkbox').addEventListener('change', updateSelectionUI);
        tbody.appendChild(tr);
    });
    updateSelectionUI();
}

function updateSelectionUI() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    const panel = document.getElementById('selectionActions');
    
    if(selected.length > 0) {
        panel.style.display = 'flex';
        document.getElementById('selectedCount').textContent = `${selected.length} righe`;
    } else {
        panel.style.display = 'none';
    }
}

// AZIONE DI MASSA
async function contabilizzaSelezionati() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if(!ids.length) return;
    if(!confirm(`Vuoi contabilizzare (bloccare) ${ids.length} registrazioni?`)) return;
    
    try {
        await apiFetch('/api/dashboard/contabilizza', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
        
        // Ricarica tutto
        loadDashboard();
        document.getElementById('selectAll').checked = false;
        
    } catch(e) { alert("Errore durante l'aggiornamento"); }
}

// RICERCA LOCALE VELOCE
function filterLocalData(term) {
    const lowerTerm = term.toLowerCase();
    const filtered = rowsData.filter(r => {
        return (r.note || '').toLowerCase().includes(lowerTerm) ||
               (r.commesse?.impianto || '').toLowerCase().includes(lowerTerm) ||
               (r.personale?.nome_cognome || '').toLowerCase().includes(lowerTerm) ||
               (r.componenti?.nome_componente || '').toLowerCase().includes(lowerTerm);
    });
    renderTable(filtered);
}

// CHART.JS RENDERING
function renderChart(chartData) {
    const ctx = document.getElementById('commessaChart').getContext('2d');
    
    // Prepara dati
    const labels = Object.keys(chartData.by_commessa);
    const dataValues = Object.values(chartData.by_commessa);
    
    if (chartInstance) chartInstance.destroy(); // Pulisci precedente
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#3498db', '#e74c3c', '#9b59b6', '#2ecc71', '#f1c40f', '#34495e'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}