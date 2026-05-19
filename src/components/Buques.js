import React, { useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ["#1A5FA8","#378ADD","#85B7EB","#B5D4F4","#2E75B6","#1a5fa8","#4da8e0","#cce0f5","#042C53"];

const TRAFICO_TIPOS = [
  { label: "Ultramar", key: "ultramar" },
  { label: "Cabotaje", key: "cabotaje" },
  { label: "CMI",      key: "cmi"      },
];

function fmt(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000)    return Math.round(n).toLocaleString("es-AR");
  return Math.round(n).toLocaleString("es-AR");
}

const donaOptions = {
  responsive: true,
  cutout: "62%",
  plugins: {
    legend: { position: "bottom", labels: { font: { size: 10 }, color: "#666", boxWidth: 10, padding: 8 } },
    tooltip: {
      callbacks: {
        label: ctx => {
          const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
          return ` ${ctx.label}: ${(ctx.parsed / tot * 100).toFixed(1)}%`;
        },
      },
    },
  },
};

export default function Buques({ data }) {
  const [open, setOpen]             = useState(false);
  const [mesFil, setMesFil]         = useState([]);
  const [traficoFil, setTraficoFil] = useState([]);
  const [arbFil, setArbFil]         = useState([]);

  if (!data) return <div className="loading">Cargando buques…</div>;

  const { trafico, arboladura, evolucion_arboladura: evoArb = [] } = data;
  const hasEvo = evoArb.length > 0;

  const allMeses = hasEvo ? evoArb.map(m => m.mes) : [];
  const allTipos = hasEvo
    ? [...new Set(evoArb.flatMap(m => m.arboladura.map(a => a.tipo)))]
    : (arboladura || []).map(a => a.tipo);

  function tog(setter) {
    return val => setter(p => p.includes(val) ? p.filter(v => v !== val) : [...p, val]);
  }
  function limpiar() { setMesFil([]); setTraficoFil([]); setArbFil([]); }

  const activos = mesFil.length + traficoFil.length + arbFil.length;

  // ── Computar datos filtrados ──────────────────────────────────────────────
  let traficoVisible, arbTableData;

  if (hasEvo) {
    // 1. Filtrar por mes
    const mesesData = mesFil.length > 0
      ? evoArb.filter(m => mesFil.includes(m.mes))
      : evoArb;

    // 2. Agregar por tipo a través de los meses seleccionados
    const arbByTipo = {};
    mesesData.forEach(m => {
      m.arboladura.forEach(a => {
        if (!arbByTipo[a.tipo]) {
          arbByTipo[a.tipo] = {
            ultramar: { cantidad: 0, trn: 0 },
            cmi:      { cantidad: 0, trn: 0 },
            cabotaje: { cantidad: 0, trn: 0 },
          };
        }
        ["ultramar", "cmi", "cabotaje"].forEach(t => {
          arbByTipo[a.tipo][t].cantidad += a[t]?.cantidad || 0;
          arbByTipo[a.tipo][t].trn      += a[t]?.trn      || 0;
        });
      });
    });

    // 3. Filtrar tipos
    const tiposToShow = Object.keys(arbByTipo).filter(
      tipo => arbFil.length === 0 || arbFil.includes(tipo)
    );

    // 4. Qué trafico keys sumar
    const traficoKeys = traficoFil.length > 0 ? traficoFil : ["ultramar", "cmi", "cabotaje"];

    // 5. KPI cards: valores reales cruzando trafico + tipos filtrados
    const traficoComputed = {};
    TRAFICO_TIPOS.forEach(({ key }) => {
      traficoComputed[key] = {
        buques: tiposToShow.reduce((s, t) => s + (arbByTipo[t]?.[key]?.cantidad || 0), 0),
        trn:    tiposToShow.reduce((s, t) => s + (arbByTipo[t]?.[key]?.trn      || 0), 0),
      };
    });
    traficoVisible = TRAFICO_TIPOS
      .filter(t => traficoFil.length === 0 || traficoFil.includes(t.key))
      .map(t => ({ ...t, data: traficoComputed[t.key] }));

    // 6. Tabla y gráficos: tipo filtrado + trafico agregado
    arbTableData = tiposToShow
      .map(tipo => ({
        tipo,
        cantidad: traficoKeys.reduce((s, t) => s + (arbByTipo[tipo]?.[t]?.cantidad || 0), 0),
        trn:      traficoKeys.reduce((s, t) => s + (arbByTipo[tipo]?.[t]?.trn      || 0), 0),
      }))
      .filter(a => a.cantidad > 0 || a.trn > 0)
      .sort((a, b) => b.trn - a.trn);

  } else {
    // Fallback: usar datos agregados del DATA sheet
    traficoVisible = TRAFICO_TIPOS
      .filter(t => traficoFil.length === 0 || traficoFil.includes(t.key))
      .map(t => ({ ...t, data: trafico?.[t.key] }));

    arbTableData = (arboladura || [])
      .filter(a => arbFil.length === 0 || arbFil.includes(a.tipo))
      .map(a => ({ tipo: a.tipo, cantidad: a.cantidad, trn: Number(a.trn) }));
  }

  const totalBuquesFil = arbTableData.reduce((s, a) => s + (a.cantidad || 0), 0);
  const totalTrnFil    = arbTableData.reduce((s, a) => s + (a.trn      || 0), 0);

  const donaTrn = {
    labels: arbTableData.map(a => a.tipo),
    datasets: [{ data: arbTableData.map(a => a.trn), backgroundColor: COLORS, borderWidth: 2, borderColor: "#fff" }],
  };
  const donaCant = {
    labels: arbTableData.map(a => a.tipo),
    datasets: [{ data: arbTableData.map(a => a.cantidad), backgroundColor: COLORS, borderWidth: 2, borderColor: "#fff" }],
  };

  return (
    <div>
      {/* ── Filtros ────────────────────────────────────────── */}
      <div className="filtros-wrap">
        <button className="filtros-toggle" onClick={() => setOpen(!open)}>
          <span>▼ Filtros</span>
          {activos > 0 && <span className="filtros-badge">{activos}</span>}
        </button>
        {open && (
          <div className="filtros-panel">
            {allMeses.length > 0 && (
              <div className="filtros-group">
                <div className="filtros-label">Período</div>
                <div className="filtros-pills">
                  {allMeses.map(m => (
                    <button key={m}
                      className={`filtros-pill ${mesFil.includes(m) ? "active" : ""}`}
                      onClick={() => tog(setMesFil)(m)}>{m}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="filtros-group">
              <div className="filtros-label">Tipo de tráfico</div>
              <div className="filtros-pills">
                {TRAFICO_TIPOS.map(t => (
                  <button key={t.key}
                    className={`filtros-pill ${traficoFil.includes(t.key) ? "active" : ""}`}
                    onClick={() => tog(setTraficoFil)(t.key)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="filtros-group">
              <div className="filtros-label">Tipo de arboladura</div>
              <div className="filtros-pills">
                {allTipos.map(tipo => (
                  <button key={tipo}
                    className={`filtros-pill ${arbFil.includes(tipo) ? "active" : ""}`}
                    onClick={() => tog(setArbFil)(tipo)}>{tipo}</button>
                ))}
              </div>
            </div>
            {activos > 0 && (
              <button className="filtros-clear" onClick={limpiar}>Limpiar filtros</button>
            )}
          </div>
        )}
      </div>

      {/* ── Por tipo de tráfico ────────────────────────────── */}
      <div className="sec">Por tipo de tráfico</div>
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        {traficoVisible.map(t => (
          <div key={t.key} className="kpi-card">
            <div className="kpi-label">{t.label}</div>
            <div className="kpi-value">{fmt(t.data?.buques)}</div>
            <div className="kpi-unit">buques · {fmt(t.data?.trn)} TRN</div>
          </div>
        ))}
      </div>

      {/* ── Detalle por arboladura ─────────────────────────── */}
      <div className="divider" />
      <div className="sec">Detalle por arboladura</div>
      <div style={{ overflowX: "auto" }}>
        <table className="arb-table">
          <thead>
            <tr><th>Tipo de buque</th><th>Cantidad</th><th>TRN</th></tr>
          </thead>
          <tbody>
            {arbTableData.map((a, i) => (
              <tr key={i}>
                <td>{a.tipo}</td>
                <td>{fmt(a.cantidad)}</td>
                <td>{fmt(a.trn)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              <td>{fmt(totalBuquesFil)}</td>
              <td>{fmt(totalTrnFil)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Gráfico TRN ───────────────────────────────────── */}
      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Distribución TRN por tipo de buque</div>
        {arbTableData.length > 0
          ? <Doughnut data={donaTrn} options={donaOptions} height={220} />
          : <div className="loading">Sin datos para los filtros seleccionados.</div>}
      </div>

      {/* ── Gráfico Cantidad ──────────────────────────────── */}
      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Distribución cantidad de buques por tipo</div>
        {arbTableData.length > 0
          ? <Doughnut data={donaCant} options={donaOptions} height={220} />
          : <div className="loading">Sin datos para los filtros seleccionados.</div>}
      </div>
    </div>
  );
}
