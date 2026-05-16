import React, { useState } from "react";

const OPERACIONES = ["Importación", "Exportación", "Removido"];
const CARGAS      = ["Granel líquido", "Granel sólido", "Contenerizado", "Carga gral."];

const FILTROS_INIT = {
  meses: [], operaciones: [], cargas: [], permisionario: "",
};

export default function Filtros({ meses = [], permisionarios = [], onChange, ocultarCargas = false }) {
  const [open, setOpen]     = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_INIT);

  function toggle(key, val) {
    const curr = filtros[key];
    const next = curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val];
    apply({ ...filtros, [key]: next });
  }

  function setPerm(val) {
    apply({ ...filtros, permisionario: val });
  }

  function apply(next) {
    setFiltros(next);
    onChange(next);
  }

  function limpiar() {
    apply(FILTROS_INIT);
  }

  const activos =
    filtros.meses.length +
    filtros.operaciones.length +
    (ocultarCargas ? 0 : filtros.cargas.length) +
    (filtros.permisionario ? 1 : 0);

  return (
    <div className="filtros-wrap">
      <button className="filtros-toggle" onClick={() => setOpen(!open)}>
        <span>▼ Filtros</span>
        {activos > 0 && <span className="filtros-badge">{activos}</span>}
      </button>

      {open && (
        <div className="filtros-panel">
          {meses.length > 0 && (
            <div className="filtros-group">
              <div className="filtros-label">Período</div>
              <div className="filtros-pills">
                {meses.map(m => (
                  <button key={m}
                    className={`filtros-pill ${filtros.meses.includes(m) ? "active" : ""}`}
                    onClick={() => toggle("meses", m)}>{m}</button>
                ))}
              </div>
            </div>
          )}

          <div className="filtros-group">
            <div className="filtros-label">Operación</div>
            <div className="filtros-pills">
              {OPERACIONES.map(o => (
                <button key={o}
                  className={`filtros-pill ${filtros.operaciones.includes(o) ? "active" : ""}`}
                  onClick={() => toggle("operaciones", o)}>{o}</button>
              ))}
            </div>
          </div>

          {!ocultarCargas && (
            <div className="filtros-group">
              <div className="filtros-label">Tipo de carga</div>
              <div className="filtros-pills">
                {CARGAS.map(c => (
                  <button key={c}
                    className={`filtros-pill ${filtros.cargas.includes(c) ? "active" : ""}`}
                    onClick={() => toggle("cargas", c)}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {permisionarios.length > 0 && (
            <div className="filtros-group">
              <div className="filtros-label">Permisionario</div>
              <select className="filtros-select" value={filtros.permisionario} onChange={e => setPerm(e.target.value)}>
                <option value="">Todos</option>
                {permisionarios.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {activos > 0 && (
            <button className="filtros-clear" onClick={limpiar}>Limpiar filtros</button>
          )}
        </div>
      )}
    </div>
  );
}
