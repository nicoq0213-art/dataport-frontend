import React from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const NOMBRES = {
  "Aridos": "Áridos",
  "Siderurgico / carga general": "Siderúrgico / carga general",
  "Granel liquido": "Granel líquido",
  "Granel solido": "Granel sólido",
};
function corregir(n) { return NOMBRES[n] || n; }

function fmt(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(0) + "k";
  return Math.round(n).toLocaleString("es-AR");
}

// Los datos ya vienen filtrados. Este componente solo renderiza.
// filtros se usa únicamente para saber qué datasets mostrar en el chart (visual).
export default function Cargas({ data, filtros = {} }) {
  if (!data) return <div className="loading">Cargando datos de cargas…</div>;

  const { por_producto, evolucion_mensual, por_forma } = data;
  const operFiltro = filtros.operaciones || [];
  const permFiltro = filtros.permisionario || "";

  const evolucion = evolucion_mensual || [];

  // Mostrar solo los datasets de las operaciones seleccionadas (visual)
  const DATASETS = [
    { label: "Importación", key: "importacion", color: "#1A5FA8" },
    { label: "Exportación", key: "exportacion", color: "#85B7EB" },
    { label: "Removido",    key: "removido",    color: "#cce0f5" },
  ].filter(d => operFiltro.length === 0 || operFiltro.includes(d.label));

  const chartData = {
    labels: evolucion.map(r => r.mes),
    datasets: DATASETS.map(d => ({
      label: d.label,
      data: evolucion.map(r => Math.round((Number(r[d.key]) || 0) / 1000)),
      backgroundColor: d.color,
      borderRadius: 2,
      stack: "s",
    })),
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 10 }, color: "#666", boxWidth: 10, padding: 8 } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}k tn` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#aaa" }, stacked: true },
      y: { grid: { color: "#f0f0f0" }, ticks: { font: { size: 10 }, color: "#aaa", callback: v => `${v}k` }, border: { display: false }, stacked: true },
    },
  };

  const maxProd = Math.max(...(por_producto?.map(p => p.toneladas) || [1]));

  // Secciones de por_forma a mostrar: las que tienen datos y corresponden a ops visibles
  const FORMA_LABEL = { importacion: "importación", exportacion: "exportación", removido: "removido" };
  const formasSections = Object.keys(por_forma || {}).filter(k => {
    if (operFiltro.length > 0) {
      const opMap = { importacion: "Importación", exportacion: "Exportación", removido: "Removido" };
      if (!operFiltro.includes(opMap[k])) return false;
    }
    return (por_forma[k]?.length > 0);
  });

  return (
    <div>
      {!permFiltro && (
        <>
          <div className="sec">Por tipo de producto</div>
          {(por_producto || []).map((p, i) => (
            <div className="bar-row" key={i}>
              <div className="bar-meta">
                <span>{corregir(p.producto)}</span>
                <span>{fmt(p.toneladas)} tn</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{
                  width: `${Math.round(p.toneladas / maxProd * 100)}%`,
                  background: p.toneladas / maxProd > 0.3 ? "#1A5FA8" : "#B5D4F4",
                }} />
              </div>
            </div>
          ))}
        </>
      )}

      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Imp / Exp / Removido por mes</div>
        {evolucion.length > 0 && DATASETS.length > 0
          ? <Bar data={chartData} options={chartOptions} height={180} />
          : <div className="loading">Sin datos para los filtros seleccionados.</div>}
      </div>

      {!permFiltro && formasSections.map(secKey => (
        <React.Fragment key={secKey}>
          <div className="divider" />
          <div className="sec">Por forma de presentación — {FORMA_LABEL[secKey]}</div>
          <div className="kpi-grid">
            {(por_forma[secKey] || []).map((f, i) => (
              <div className="kpi-card" key={i}>
                <div className="kpi-label">{corregir(f.forma)}</div>
                <div className="kpi-value">{fmt(f.toneladas)}</div>
                <div className="kpi-unit">toneladas</div>
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
