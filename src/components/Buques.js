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
  const [traficoFil, setTraficoFil] = useState([]);  // [] = todos
  const [arbFil, setArbFil]         = useState([]);  // [] = todos

  if (!data) return <div className="loading">Cargando buques…</div>;

  const { trafico, arboladura } = data;

  function toggleT(key) {
    setTraficoFil(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  }
  function toggleA(tipo) {
    setArbFil(p => p.includes(tipo) ? p.filter(t => t !== tipo) : [...p, tipo]);
  }
  function limpiar() { setTraficoFil([]); setArbFil([]); }

  const activos = traficoFil.length + arbFil.length;

  const traficoVisible = TRAFICO_TIPOS.filter(
    t => traficoFil.length === 0 || traficoFil.includes(t.key)
  );
  const arbVisible = (arboladura || []).filter(
    a => arbFil.length === 0 || arbFil.includes(a.tipo)
  );

  const totalBuquesFil = arbVisible.reduce((s, a) => s + (a.cantidad || 0), 0);
  const totalTrnFil    = arbVisible.reduce((s, a) => s + (Number(a.trn) || 0), 0);

  const donaTrn = {
    labels: arbVisible.map(a => a.tipo),
    datasets: [{ data: arbVisible.map(a => a.trn), backgroundColor: COLORS, borderWidth: 2, borderColor: "#fff" }],
  };
  const donaCant = {
    labels: arbVisible.map(a => a.tipo),
    datasets: [{ data: arbVisible.map(a => a.cantidad), backgroundColor: COLORS, borderWidth: 2, borderColor: "#fff" }],
  };

  return (
    <div>
      {/* ── Filtros locales ────────────────────────────────── */}
      <div className="filtros-wrap">
        <button className="filtros-toggle" onClick={() => setOpen(!open)}>
          <span>▼ Filtros</span>
          {activos > 0 && <span className="filtros-badge">{activos}</span>}
        </button>
        {open && (
          <div className="filtros-panel">
            <div className="filtros-group">
              <div className="filtros-label">Tipo de tráfico</div>
              <div className="filtros-pills">
                {TRAFICO_TIPOS.map(t => (
                  <button key={t.key}
                    className={`filtros-pill ${traficoFil.includes(t.key) ? "active" : ""}`}
                    onClick={() => toggleT(t.key)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="filtros-group">
              <div className="filtros-label">Tipo de arboladura</div>
              <div className="filtros-pills">
                {(arboladura || []).map(a => (
                  <button key={a.tipo}
                    className={`filtros-pill ${arbFil.includes(a.tipo) ? "active" : ""}`}
                    onClick={() => toggleA(a.tipo)}>{a.tipo}</button>
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
            <div className="kpi-value">{fmt(trafico?.[t.key]?.buques)}</div>
            <div className="kpi-unit">buques · {fmt(trafico?.[t.key]?.trn)} TRN</div>
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
            {arbVisible.map((a, i) => (
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
        {arbVisible.length > 0
          ? <Doughnut data={donaTrn} options={donaOptions} height={220} />
          : <div className="loading">Sin datos para los filtros seleccionados.</div>}
      </div>

      {/* ── Gráfico Cantidad ──────────────────────────────── */}
      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Distribución cantidad de buques por tipo</div>
        {arbVisible.length > 0
          ? <Doughnut data={donaCant} options={donaOptions} height={220} />
          : <div className="loading">Sin datos para los filtros seleccionados.</div>}
      </div>
    </div>
  );
}
