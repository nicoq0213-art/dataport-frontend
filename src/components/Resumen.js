import React from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function fmt(n, tipo) {
  if (n == null) return "—";
  if (!n && n !== 0) return "0";
  if (tipo === "entero") return Math.round(n).toLocaleString("es-AR");
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(0) + "k";
  return Math.round(n).toLocaleString("es-AR");
}

function Var({ val }) {
  if (val == null) return null;
  const pos = val >= 0;
  return (
    <div className={`kpi-var ${pos ? "up" : "down"}`}>
      {pos ? "▲" : "▼"} {Math.abs(val).toFixed(1)}% vs año ant.
    </div>
  );
}

// Los datos que llegan ya están filtrados por applyFilters.
// Este componente solo renderiza.
export default function Resumen({ data }) {
  if (!data) return <div className="loading">Cargando resumen...</div>;

  const { mercaderias, contenedores, navegacion, evolucion_mensual } = data;

  const evolucion = evolucion_mensual || [];

  const chartData = {
    labels: evolucion.map(r => r.mes),
    datasets: [{
      data: evolucion.map(r => Math.round((Number(r.toneladas) || 0) / 1000)),
      backgroundColor: "#1A5FA8",
      borderRadius: 4,
      borderSkipped: false,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}k tn` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#aaa" } },
      y: { grid: { color: "#f0f0f0" }, ticks: { font: { size: 10 }, color: "#aaa", callback: v => `${v}k` }, border: { display: false } },
    },
  };

  // Solo mostrar cards de op con valor no nulo
  const opsCards = [
    { key: "importacion", label: "Importación" },
    { key: "exportacion", label: "Exportación" },
    { key: "removido",    label: "Removido"    },
  ].filter(op => mercaderias?.[op.key] != null);

  return (
    <div>
      <div className="sec">Mercaderías</div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total</div>
          <div className="kpi-value">{fmt(mercaderias?.total)}</div>
          <div className="kpi-unit">toneladas</div>
          <Var val={mercaderias?.var_pct} />
        </div>
        {opsCards.map(op => (
          <div className="kpi-card" key={op.key}>
            <div className="kpi-label">{op.label}</div>
            <div className="kpi-value">{fmt(mercaderias?.[op.key])}</div>
            <div className="kpi-unit">toneladas</div>
          </div>
        ))}
      </div>

      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Toneladas por mes</div>
        {evolucion.length > 0
          ? <Bar data={chartData} options={chartOptions} height={160} />
          : <div className="loading">Sin datos para el período seleccionado.</div>}
      </div>

      <div className="divider" />
      <div className="sec">Contenedores</div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total contenedores</div>
          <div className="kpi-value">{fmt(contenedores?.total_contenedores, "entero")}</div>
          <div className="kpi-unit">unidades</div>
          <Var val={contenedores?.var_pct_teus} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">TEUs</div>
          <div className="kpi-value">{fmt(contenedores?.teus, "entero")}</div>
          <div className="kpi-unit">unidades</div>
        </div>
      </div>

      <div className="divider" />
      <div className="sec">Navegación</div>
      <div className="pill-row">
        <div className="pill">
          <div className="pill-num" style={{ color: "#1A5FA8" }}>
            {Math.round(navegacion?.total_buques || 0).toLocaleString("es-AR")}
          </div>
          <div className="pill-lbl">Total buques</div>
        </div>
        <div className="pill">
          <div className="pill-num">{fmt(navegacion?.total_trn)}</div>
          <div className="pill-lbl">TRN total</div>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card kpi-full">
          <div className="kpi-label">Variación buques vs año anterior</div>
          <Var val={navegacion?.var_pct_bq} />
        </div>
      </div>
    </div>
  );
}
