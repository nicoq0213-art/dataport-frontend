import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MESES_ORDEN = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_CORTO = {
  Enero: "Ene", Febrero: "Feb", Marzo: "Mar", Abril: "Abr", Mayo: "May", Junio: "Jun",
  Julio: "Jul", Agosto: "Ago", Septiembre: "Sep", Octubre: "Oct", Noviembre: "Nov", Diciembre: "Dic",
};

function safe(v) { return (v == null) ? 0 : Number(v) || 0; }

function fmtMoney(n) {
  if (!n && n !== 0) return "$0";
  const abs = Math.abs(n);
  const signo = n < 0 ? "-" : "";
  if (abs >= 1000000000) return `${signo}$${(abs / 1000000000).toFixed(2)}MM`;
  if (abs >= 1000000)    return `${signo}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000)       return `${signo}$${(abs / 1000).toFixed(0)}k`;
  return `${signo}$${Math.round(abs).toLocaleString("es-AR")}`;
}

function fmtMoneyFull(n) {
  return `$${Math.round(safe(n)).toLocaleString("es-AR")}`;
}

// data: lista cruda de {anio, mes, cuenta, facturado, recaudado} — una fila
// por combinación, tal como llega del backend (hoja "Recaudado y facturado").
// Este módulo no pasa por applyFilters: tiene sus propios filtros (Mes, Cuenta),
// independientes de los filtros globales de toneladas.
export default function RecaudadoFacturado({ data }) {
  const rows = useMemo(() => data || [], [data]);

  const periodos = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = `${r.anio}-${r.mes}`;
      if (!map.has(key)) map.set(key, { key, anio: r.anio, mes: r.mes });
    });
    return Array.from(map.values()).sort((a, b) => (
      a.anio !== b.anio ? a.anio - b.anio : MESES_ORDEN.indexOf(a.mes) - MESES_ORDEN.indexOf(b.mes)
    ));
  }, [rows]);

  const cuentas = useMemo(() => {
    const set = new Set();
    rows.forEach(r => set.add(r.cuenta));
    return Array.from(set);
  }, [rows]);

  const [periodoKey, setPeriodoKey] = useState("");
  const [cuenta, setCuenta]         = useState("");

  if (!rows.length) return <div className="loading">Cargando datos de recaudación…</div>;

  const periodoActual = periodos.find(p => p.key === periodoKey) || periodos[periodos.length - 1];
  const anioSel = periodoActual?.anio;
  const mesSel  = periodoActual?.mes;
  const multiAnio = new Set(periodos.map(p => p.anio)).size > 1;

  const filasMes = rows.filter(r => r.anio === anioSel && r.mes === mesSel);
  const filasMesCuenta = cuenta ? filasMes.filter(r => r.cuenta === cuenta) : filasMes;

  const facturadoMes = filasMesCuenta.reduce((s, r) => s + safe(r.facturado), 0);
  const recaudadoMes = filasMesCuenta.reduce((s, r) => s + safe(r.recaudado), 0);
  const pctCobrado   = facturadoMes > 0 ? (recaudadoMes / facturadoMes) * 100 : 0;

  const acumuladoAnio = rows
    .filter(r => r.anio === anioSel && (!cuenta || r.cuenta === cuenta))
    .reduce((s, r) => s + safe(r.recaudado), 0);

  const mesesDelAnio = periodos.filter(p => p.anio === anioSel).map(p => p.mes);
  const porMesAnio = mesesDelAnio.map(mes => {
    const filas = rows.filter(r => r.anio === anioSel && r.mes === mes && (!cuenta || r.cuenta === cuenta));
    return {
      mes,
      facturado: filas.reduce((s, r) => s + safe(r.facturado), 0),
      recaudado: filas.reduce((s, r) => s + safe(r.recaudado), 0),
    };
  });

  const chartData = {
    labels: porMesAnio.map(r => MESES_CORTO[r.mes] || r.mes),
    datasets: [
      {
        label: "Facturado",
        data: porMesAnio.map(r => Math.round(r.facturado / 1000000)),
        backgroundColor: "#85B7EB",
        borderRadius: 2,
      },
      {
        label: "Recaudado",
        data: porMesAnio.map(r => Math.round(r.recaudado / 1000000)),
        backgroundColor: "#1A5FA8",
        borderRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 10 }, color: "#666", boxWidth: 10, padding: 8 } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y * 1000000)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#aaa" } },
      y: { grid: { color: "#f0f0f0" }, ticks: { font: { size: 10 }, color: "#aaa", callback: v => `${v}M` }, border: { display: false } },
    },
  };

  return (
    <div>
      <div className="filtros-panel" style={{ marginTop: 0, marginBottom: 14 }}>
        <div className="filtros-group">
          <div className="filtros-label">Mes</div>
          <div className="filtros-pills">
            {periodos.map(p => (
              <button key={p.key}
                className={`filtros-pill ${p.key === periodoActual?.key ? "active" : ""}`}
                onClick={() => setPeriodoKey(p.key)}>
                {(MESES_CORTO[p.mes] || p.mes)}{multiAnio ? ` ${String(p.anio).slice(-2)}` : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="filtros-group">
          <div className="filtros-label">Cuenta</div>
          <select className="filtros-select" value={cuenta} onChange={e => setCuenta(e.target.value)}>
            <option value="">Todas</option>
            {cuentas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Facturado del mes</div>
          <div className="kpi-value">{fmtMoney(facturadoMes)}</div>
          <div className="kpi-unit">{mesSel} {anioSel}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Recaudado del mes</div>
          <div className="kpi-value">{fmtMoney(recaudadoMes)}</div>
          <div className="kpi-unit">{mesSel} {anioSel}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">% cobrado</div>
          <div className="kpi-value" style={{ color: pctCobrado >= 100 ? "#1a7a4a" : "#111" }}>
            {pctCobrado.toFixed(1)}%
          </div>
          <div className="kpi-unit">Recaudado / Facturado</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Acumulado del año</div>
          <div className="kpi-value">{fmtMoney(acumuladoAnio)}</div>
          <div className="kpi-unit">Recaudado {anioSel}</div>
        </div>
      </div>

      <div className="divider" />
      <div className="chart-box">
        <div className="chart-title">Facturado vs Recaudado por mes — {anioSel}</div>
        {porMesAnio.length > 0
          ? <Bar data={chartData} options={chartOptions} height={180} />
          : <div className="loading">Sin datos para el año seleccionado.</div>}
      </div>

      <div className="divider" />
      <div className="sec">Desglose por cuenta — {mesSel} {anioSel}</div>
      {filasMesCuenta.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table className="arb-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Facturado</th>
                <th>Recaudado</th>
              </tr>
            </thead>
            <tbody>
              {filasMesCuenta.map((r, i) => (
                <tr key={i}>
                  <td>{r.cuenta}</td>
                  <td>{fmtMoneyFull(r.facturado)}</td>
                  <td>{fmtMoneyFull(r.recaudado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="loading">Sin datos para la cuenta seleccionada.</div>
      )}
    </div>
  );
}
