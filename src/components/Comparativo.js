import React from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

function fmt(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000)    return Math.round(n).toLocaleString("es-AR");
  return Math.round(n).toLocaleString("es-AR");
}

function safe(v) { return (v == null) ? 0 : Number(v) || 0; }

// Los datos (por_mes y totales) ya vienen filtrados por applyFilters.
export default function Comparativo({ data }) {
  if (!data) return <div className="loading">Cargando comparativo…</div>;

  const { por_mes = [], por_mes_chart, totales } = data;
  // por_mes_chart: año completo para el gráfico (cuando hay filtro de permisionario)
  // por_mes: filtrado por meses seleccionados, para los totales de las barras
  const chartMes = por_mes_chart || por_mes;

  const chartData = {
    labels: chartMes.map(r => r.mes),
    datasets: [
      {
        label: "Año anterior",
        data: chartMes.map(r => Math.round(safe(r.merc_ant) / 1000)),
        borderColor: "#B5D4F4", backgroundColor: "transparent",
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: "#B5D4F4", tension: 0.3,
      },
      {
        label: "Año actual",
        data: chartMes.map(r => Math.round(safe(r.merc_act) / 1000)),
        borderColor: "#1A5FA8", backgroundColor: "rgba(26,95,168,0.06)",
        fill: true, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: "#1A5FA8", tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 10 }, color: "#666", boxWidth: 16, padding: 10 } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}k tn` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#aaa" } },
      y: { grid: { color: "#f0f0f0" }, ticks: { font: { size: 10 }, color: "#aaa", callback: v => `${v}k` }, border: { display: false } },
    },
  };

  const maxMerc = Math.max(safe(totales?.mercaderias?.anterior), safe(totales?.mercaderias?.actual), 1);
  const maxTeus = Math.max(safe(totales?.teus?.anterior),        safe(totales?.teus?.actual),        1);
  const maxBq   = Math.max(safe(totales?.buques?.anterior),      safe(totales?.buques?.actual),      1);

  function CmpBars({ ant, act, max, sufijo, varPct }) {
    return (
      <div className="cmp-bar-wrap">
        <div className="cmp-bar-line">
          <span className="cmp-year">Ant.</span>
          <div className="cmp-track"><div className="cmp-fill" style={{ width: `${Math.round(safe(ant) / max * 100)}%`, background: "#B5D4F4" }} /></div>
          <span className="cmp-val">{fmt(ant)}{sufijo}</span>
        </div>
        <div className="cmp-bar-line">
          <span className="cmp-year">Act.</span>
          <div className="cmp-track"><div className="cmp-fill" style={{ width: `${Math.round(safe(act) / max * 100)}%`, background: "#1A5FA8" }} /></div>
          <span className="cmp-val">{fmt(act)}{sufijo}</span>
        </div>
        <div className={`cmp-var ${safe(varPct) >= 0 ? "up" : "down"}`}>
          {safe(varPct) >= 0 ? "▲" : "▼"} {Math.abs(safe(varPct)).toFixed(1)}%
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sec">Año anterior vs año actual</div>
      <div className="chart-box">
        <div className="chart-title">Toneladas mensuales comparadas</div>
        {por_mes.length > 0
          ? <Line data={chartData} options={chartOptions} height={180} />
          : <div className="loading">Sin datos para el período seleccionado.</div>}
      </div>

      <div className="divider" />
      <div className="cmp-row">
        <div className="cmp-label">Mercaderías totales</div>
        <CmpBars ant={totales?.mercaderias?.anterior} act={totales?.mercaderias?.actual} max={maxMerc} sufijo=" tn" varPct={totales?.mercaderias?.var_pct} />
      </div>

      <div className="divider" />
      <div className="cmp-row">
        <div className="cmp-label">TEUs</div>
        <CmpBars ant={totales?.teus?.anterior} act={totales?.teus?.actual} max={maxTeus} sufijo="" varPct={totales?.teus?.var_pct} />
      </div>

      <div className="divider" />
      <div className="cmp-row">
        <div className="cmp-label">Buques totales</div>
        <CmpBars ant={totales?.buques?.anterior} act={totales?.buques?.actual} max={maxBq} sufijo="" varPct={totales?.buques?.var_pct} />
      </div>
    </div>
  );
}
