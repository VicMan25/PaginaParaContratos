/* ==========================================
   CalcLaboral CO — Lógica de cálculo
   Normativa colombiana 2025
   ========================================== */

// ── Constantes legales 2026 ──────────────────
const SMMLV  = 1750000;   // Salario mínimo mensual legal vigente 2025
const AUX_TP = 200000;    // Auxilio de transporte 2025 (≤2 SMMLV)

// Porcentajes Seguridad Social (% sobre IBC)
const PCT = {
  // Salud
  salud_empleador:     8.5,
  salud_trabajador:    4.0,
  salud_contratista:  12.5, // asume total

  // Pensión
  pension_empleador:  12.0,
  pension_trabajador:  4.0,
  pension_contratista:16.0, // asume total

  // ARL (solo empleador / en servicios asume el contratista la cotización mínima)
  // Se lee del select según nivel de riesgo

  // Parafiscales (solo contratos laborales)
  caja:  4.0,
  icbf:  3.0, // exento si salario < 10 SMMLV
  sena:  2.0, // exento si salario < 10 SMMLV
};

// ── Estado ────────────────────────────────────
let selectedContract = null;

// ── Init ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  populateReference();

  document.getElementById('salario').addEventListener('input', updateSMMLVHint);
  updateSMMLVHint();
});

function updateSMMLVHint() {
  const sal = parseFloat(document.getElementById('salario').value) || 0;
  const hint = document.getElementById('smmlv-hint');
  if (sal > 0) {
    const factor = (sal / SMMLV).toFixed(2);
    hint.textContent = `≈ ${factor} SMMLV`;
  } else {
    hint.textContent = '';
  }
}

function populateReference() {
  const items = [
    ['SMMLV 2026',              fmt(SMMLV)],
    ['Aux. Transporte 2026',    fmt(AUX_TP)],
    ['Salud — Empleador',       '8,5%'],
    ['Salud — Trabajador',      '4,0%'],
    ['Pensión — Empleador',     '12,0%'],
    ['Pensión — Trabajador',    '4,0%'],
    ['ARL — Empleador',         '0,522% – 6,96%'],
    ['Caja Compensación',       '4,0%'],
    ['ICBF',                    '3,0%'],
    ['SENA',                    '2,0%'],
    ['Prima servicios',         '8,33%/mes'],
    ['Cesantías',               '8,33%/mes'],
    ['Int. cesantías',          '12%/año'],
    ['Vacaciones',              '4,17%/mes'],
  ];

  const ul = document.getElementById('reference-list');
  ul.innerHTML = items.map(([k, v]) =>
    `<li><span>${k}</span><strong>${v}</strong></li>`
  ).join('');
}

// ── Navegación entre paneles ──────────────────
function goToPanel(n) {
  // Validación panel 1
  if (n === 2) {
    const sal = parseFloat(document.getElementById('salario').value);
    if (!sal || sal <= 0) {
      alert('⚠ Por favor ingresa un salario válido.');
      return;
    }
  }
  // Validación panel 2
  if (n === 3 && !selectedContract) {
    alert('⚠ Selecciona un tipo de contrato.');
    return;
  }

  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${n}`).classList.add('active');

  // Steps
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    const idx = i / 2 + 1; // steps alternados con lines
    if (Number.isInteger(idx)) {
      const stepN = Math.round(idx);
      if (stepN < n) s.classList.add('done');
      else if (stepN === n) s.classList.add('active');
    }
  });
  // fix step indicator indexing (0,2,4 are steps; 1,3 are lines)
  const steps = document.querySelectorAll('.step');
  steps.forEach((s, i) => {
    s.classList.remove('active','done');
    const sn = i + 1;
    if (sn < n) s.classList.add('done');
    else if (sn === n) s.classList.add('active');
  });
}

function selectContract(el, type) {
  document.querySelectorAll('.contract-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedContract = type;

  const alert = document.getElementById('servicios-alert');
  alert.style.display = type === 'servicios' ? 'flex' : 'none';
}

// ── Cálculo principal ─────────────────────────
function calcular() {
  if (!selectedContract) { alert('⚠ Selecciona un tipo de contrato.'); return; }

  const nombre  = document.getElementById('nombre').value.trim() || 'Trabajador';
  const salario = parseFloat(document.getElementById('salario').value) || 0;
  const arlPct  = parseFloat(document.getElementById('arl-nivel').value);
  const dias    = parseInt(document.getElementById('dias').value) || 30;
  const meses   = parseFloat(document.getElementById('meses').value) || 12;
  const tipo    = selectedContract;

  if (salario <= 0) { alert('⚠ Salario inválido.'); return; }

  // ── Determinar si aplica auxilio de transporte ──
  // Aplica si salario ≤ 2 SMMLV y es contrato laboral
  const esLaboral   = tipo !== 'servicios';
  const esParcial   = tipo === 'parcial';
  const auxTp       = (esLaboral && salario <= 2 * SMMLV) ? AUX_TP : 0;

  // ── IBC (Ingreso Base de Cotización) ──
  // Para contratos laborales: salario (el aux transporte NO hace parte del IBC)
  // Para servicios: 40% del ingreso bruto (mínimo 1 SMMLV)
  let ibc;
  if (tipo === 'servicios') {
    ibc = Math.max(salario * 0.40, SMMLV);
  } else {
    ibc = salario; // El aux. de transporte no integra el IBC
  }

  // ── Exoneración parafiscales (Ley 1607/2012) ──
  // Empleadores con trabajadores >10 SMMLV o personas naturales con <2 trabajadores
  // Para efectos académicos: exoneración de ICBF y SENA si salario < 10 SMMLV
  const exonerado = salario < 10 * SMMLV;

  // ── Cálculos Seguridad Social ──
  let ssRows = [];

  if (tipo === 'servicios') {
    // CONTRATISTA: paga todo él mismo (40% IBC mínimo 1 SMMLV)
    const salud    = round(ibc * PCT.salud_contratista / 100);
    const pension  = round(ibc * PCT.pension_contratista / 100);
    const arlVal   = round(ibc * arlPct / 100);

    ssRows = [
      { concepto: 'Salud',    base: ibc, pct: `${PCT.salud_contratista}%`,   emp: salud,   trab: 0,     total: salud,   nota: 'Contratista asume 100%' },
      { concepto: 'Pensión',  base: ibc, pct: `${PCT.pension_contratista}%`, emp: pension, trab: 0,     total: pension, nota: 'Contratista asume 100%' },
      { concepto: 'ARL',      base: ibc, pct: `${arlPct}%`,                  emp: arlVal,  trab: 0,     total: arlVal,  nota: 'Sobre IBC (40% ing. bruto)' },
    ];

  } else {
    // CONTRATOS LABORALES
    const saludEmp  = round(ibc * PCT.salud_empleador  / 100);
    const saludTrab = round(ibc * PCT.salud_trabajador / 100);
    const pensEmp   = round(ibc * PCT.pension_empleador  / 100);
    const pensTrab  = round(ibc * PCT.pension_trabajador / 100);
    const arlVal    = round(ibc * arlPct / 100);
    const cajaVal   = round(ibc * PCT.caja / 100);
    const icbfVal   = exonerado ? 0 : round(ibc * PCT.icbf / 100);
    const senaVal   = exonerado ? 0 : round(ibc * PCT.sena / 100);

    ssRows = [
      {
        concepto: 'Salud',
        base: ibc, pct: `${PCT.salud_empleador}% + ${PCT.salud_trabajador}%`,
        emp: saludEmp, trab: saludTrab,
        total: saludEmp + saludTrab,
        nota: 'Art. 204 Ley 100/93'
      },
      {
        concepto: 'Pensión',
        base: ibc, pct: `${PCT.pension_empleador}% + ${PCT.pension_trabajador}%`,
        emp: pensEmp, trab: pensTrab,
        total: pensEmp + pensTrab,
        nota: 'Art. 20 Ley 100/93'
      },
      {
        concepto: 'ARL',
        base: ibc, pct: `${arlPct}%`,
        emp: arlVal, trab: 0,
        total: arlVal,
        nota: 'Dec. 1607/2002'
      },
      {
        concepto: 'Caja de Compensación',
        base: ibc, pct: `${PCT.caja}%`,
        emp: cajaVal, trab: 0,
        total: cajaVal,
        nota: ''
      },
      {
        concepto: 'ICBF',
        base: ibc, pct: `${PCT.icbf}%`,
        emp: icbfVal, trab: 0,
        total: icbfVal,
        nota: exonerado ? 'Exonerado (Ley 1607/12)' : ''
      },
      {
        concepto: 'SENA',
        base: ibc, pct: `${PCT.sena}%`,
        emp: senaVal, trab: 0,
        total: senaVal,
        nota: exonerado ? 'Exonerado (Ley 1607/12)' : ''
      },
    ];
  }

  // Totales SS
  const totalEmp  = ssRows.reduce((a, r) => a + r.emp,  0);
  const totalTrab = ssRows.reduce((a, r) => a + r.trab, 0);
  const totalSS   = ssRows.reduce((a, r) => a + r.total, 0);

  // ── Cálculos Prestaciones Sociales ──
  let prestRows = [];
  let totalPrest = 0;

  if (esLaboral) {
    // Base prestaciones = salario + aux transporte (prima, cesantías, intereses)
    // Vacaciones = solo salario
    const basePrest = salario + auxTp;

    // Prima de servicios (Art. 306 CST): salario+aux / 12 * días (proporcional)
    const prima = round(basePrest * dias / 360);

    // Cesantías (Art. 249 CST): (salario+aux) * días / 360
    const cesantias = round(basePrest * dias / 360);

    // Intereses sobre cesantías (Ley 52/75): cesantías * 12% / 360 * días
    const intCesantias = round(cesantias * 0.12 * dias / 360);

    // Vacaciones (Art. 186 CST): salario / 24 (15 días hábiles proporcional)
    // = salario * días / 720 (base anual)
    const vacaciones = round(salario * dias / 720);

    // Liquidación definitiva (suma de todos proporcional al período)
    // Para efectos de tabla se muestra la suma total

    prestRows = [
      {
        concepto: 'Auxilio de transporte',
        base: `Sal ≤ 2 SMMLV`,
        formula: 'Valor fijo',
        factor: auxTp > 0 ? 'Aplica' : 'No aplica',
        valor: auxTp,
        nota: auxTp === 0 ? 'Salario > 2 SMMLV' : 'Art. 7 Ley 15/59'
      },
      {
        concepto: 'Prima de servicios',
        base: fmt(basePrest),
        formula: '(Sal+Aux) × días / 360',
        factor: `${dias} días`,
        valor: prima,
        nota: 'Art. 306 CST'
      },
      {
        concepto: 'Cesantías',
        base: fmt(basePrest),
        formula: '(Sal+Aux) × días / 360',
        factor: `${dias} días`,
        valor: cesantias,
        nota: 'Art. 249 CST'
      },
      {
        concepto: 'Intereses s/ cesantías',
        base: fmt(cesantias),
        formula: 'Ces. × 12% × días / 360',
        factor: `${dias} días`,
        valor: intCesantias,
        nota: 'Ley 52/1975'
      },
      {
        concepto: 'Vacaciones',
        base: fmt(salario),
        formula: 'Sal × días / 720',
        factor: `${dias} días`,
        valor: vacaciones,
        nota: 'Art. 186 CST'
      },
    ];

    totalPrest = prestRows.reduce((a, r) => a + r.valor, 0);
  }

  // ── Costo total empleador ──
  const costoTotalEmp = salario + auxTp + totalEmp + (esLaboral ? totalPrest : 0);

  // ── Renderizar resultados ──
  renderResults({
    nombre, salario, ibc, auxTp, tipo, dias, meses,
    ssRows, totalEmp, totalTrab, totalSS,
    prestRows, totalPrest,
    costoTotalEmp, esLaboral, exonerado
  });

  goToPanel(3);
}

// ── Renderizado ───────────────────────────────
function renderResults(d) {
  const tipos = {
    indefinido: 'Término Indefinido',
    fijo:       'Término Fijo',
    obra:       'Obra o Labor',
    parcial:    'Medio Tiempo / Parcial',
    servicios:  'Prestación de Servicios',
  };

  // Subtitle
  document.getElementById('result-subtitle').textContent =
    `${d.nombre} · ${tipos[d.tipo]} · Período: ${d.dias} días`;

  // Summary cards
  const cards = [
    { label: 'Salario base',        value: fmt(d.salario),           highlight: false },
    { label: 'Aux. Transporte',     value: d.auxTp > 0 ? fmt(d.auxTp) : 'No aplica', highlight: false },
    { label: 'IBC cotización',      value: fmt(d.ibc),               highlight: false },
    { label: 'Total seg. social',   value: fmt(d.totalSS),           highlight: false },
    { label: 'Total prestaciones',  value: d.esLaboral ? fmt(d.totalPrest) : 'N/A', highlight: false },
    { label: 'Costo total empresa', value: fmt(d.costoTotalEmp),     highlight: true  },
  ];

  document.getElementById('summary-cards').innerHTML = cards.map((c, i) => `
    <div class="summary-card ${c.highlight ? 'highlight' : ''}" style="animation-delay:${i*0.06}s">
      <div class="s-label">${c.label}</div>
      <div class="s-value">${c.value}</div>
    </div>
  `).join('');

  // SS badge
  document.getElementById('badge-ss').textContent = fmt(d.totalSS);

  // SS rows
  const tbSS = document.getElementById('tbody-ss');
  tbSS.innerHTML = d.ssRows.map(r => `
    <tr>
      <td>
        <strong>${r.concepto}</strong>
        ${r.nota ? `<br><small class="na">${r.nota}</small>` : ''}
      </td>
      <td class="mono">${fmt(r.base)}</td>
      <td class="pct">${r.pct}</td>
      <td class="mono accent">${r.emp > 0 ? fmt(r.emp) : '<span class="na">—</span>'}</td>
      <td class="mono green">${r.trab > 0 ? fmt(r.trab) : '<span class="na">—</span>'}</td>
      <td class="mono"><strong>${fmt(r.total)}</strong></td>
    </tr>
  `).join('');

  // SS footer
  document.getElementById('tfoot-ss').innerHTML = `
    <tr>
      <td colspan="3">TOTALES</td>
      <td class="accent">${fmt(d.totalEmp)}</td>
      <td class="green">${fmt(d.totalTrab)}</td>
      <td>${fmt(d.totalSS)}</td>
    </tr>
  `;

  // Prestaciones
  const blockPrest = document.getElementById('block-prest');
  if (d.esLaboral) {
    blockPrest.style.display = 'block';
    document.getElementById('badge-prest').textContent = fmt(d.totalPrest);

    document.getElementById('tbody-prest').innerHTML = d.prestRows.map(r => `
      <tr>
        <td>
          <strong>${r.concepto}</strong>
          ${r.nota ? `<br><small class="na">${r.nota}</small>` : ''}
        </td>
        <td class="mono">${r.base}</td>
        <td class="na">${r.formula}</td>
        <td class="na">${r.factor}</td>
        <td class="mono accent"><strong>${r.valor > 0 ? fmt(r.valor) : '<span class="na">—</span>'}</strong></td>
      </tr>
    `).join('');

    document.getElementById('tfoot-prest').innerHTML = `
      <tr>
        <td colspan="4">TOTAL PRESTACIONES</td>
        <td>${fmt(d.totalPrest)}</td>
      </tr>
    `;
  } else {
    blockPrest.style.display = 'none';
  }

  // Nota legal
  let nota = '';
  if (d.tipo === 'servicios') {
    nota = `<strong>Contrato de Prestación de Servicios:</strong> El contratista independiente asume la totalidad de los aportes a salud (${PCT.salud_contratista}%) y pensión (${PCT.pension_contratista}%) calculados sobre el 40% del ingreso bruto (mínimo 1 SMMLV). <strong>No aplican</strong> prestaciones sociales (prima, cesantías, vacaciones) ni aportes parafiscales (ICBF, SENA, Caja). — Art. 2 Ley 797/2003, Dec. 1273/2018.`;
  } else if (d.exonerado) {
    nota = `<strong>Exoneración parafiscales:</strong> Al ser el salario menor a 10 SMMLV, el empleador está exonerado del aporte a ICBF (3%) y SENA (2%), según la Ley 1607 de 2012 y el Decreto 1828 de 2013. El tipo de contrato <em>${{indefinido:'Término Indefinido',fijo:'Término Fijo',obra:'Obra o Labor',parcial:'Medio Tiempo'}[d.tipo]}</em> conlleva todas las prestaciones sociales de ley. ${d.auxTp > 0 ? `El auxilio de transporte (${fmt(AUX_TP)}) aplica porque el salario no supera 2 SMMLV y se suma a la base de cesantías, intereses y prima.` : 'El salario supera 2 SMMLV, por tanto no hay auxilio de transporte.'}`;
  } else {
    nota = `El empleador <strong>no está exonerado</strong> del pago de ICBF y SENA (salario ≥ 10 SMMLV). Se aplican todos los aportes parafiscales. Contrato: <em>${{indefinido:'Término Indefinido',fijo:'Término Fijo',obra:'Obra o Labor',parcial:'Medio Tiempo'}[d.tipo]}</em>.`;
  }
  document.getElementById('legal-note').innerHTML = nota;
}

// ── Utilidades ────────────────────────────────
function fmt(n) {
  return '$ ' + Math.round(n).toLocaleString('es-CO');
}
function round(n) { return Math.round(n); }

function resetForm() {
  document.getElementById('nombre').value  = '';
  document.getElementById('salario').value = '';
  document.getElementById('dias').value    = '30';
  document.getElementById('meses').value   = '12';
  document.getElementById('arl-nivel').value = '0.522';
  document.querySelectorAll('.contract-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('servicios-alert').style.display = 'none';
  selectedContract = null;
  updateSMMLVHint();
  goToPanel(1);
}

function imprimirResultados() {
  window.print();
}