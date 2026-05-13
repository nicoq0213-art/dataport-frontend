import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ["#1A5FA8","#378ADD","#85B7EB","#B5D4F4","#2E75B6","#1a5fa8","#4da8e0","#cce0f5","#042C53"];

function fmt(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000)    return Math.round(n).toLocaleString("es-AR");
  return Math.round(n).toLocaleString("es-AR");
}

export default function Buques({ data }) {
  if (!data) return <div className="loading">Cargando buques…</div>;

  const { trafico, arboladura } = data;

  const traficoVisible = [
    { label: "Ultramar", key: "ultramar" },
    { label: "Cabotaje", key: "cabotaje" },
    { label: "CMI",      key: "cmi"      },
  ];

  const donaData = {
    labels: arboladura?.map(a => a.tipo) || [],
    datasets: [{
      data: arboladura?.map(a => a.trn) || [],
      backgroundColor: COLORS,
      borderWidth: 2,
      borderColor: "#fff",
    }],
  };

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

  return (
    <div>
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

      <div className="divider" />
      <div className="sec">Detalle por arboladura</div>
      <div style={{ overflowX: "auto" }}>
      <table className="arb-table">
        <thead>
          <tr><th>Tipo de buque</th><th>Cantidad</th><th>TRN</th></tr>
        </thead>
        <tbody>
          {arboladura?.map((a, i) => (
            <tr key={i}>
              <td>{a.tipo}</td>
              <td>{fmt(a.cantidad)}</td>
              <td>{fmt(a.trn)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td>Total</td>
            <td>{fmt(trafico?.total?.buques)}</td>
            <td>{fmt(trafico?.total?.trn)}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Distribución TRN por tipo de buque</div>
        <Doughnut data={donaData} options={donaOptions} height={220} />
      </div>
    </div>
  );
}
