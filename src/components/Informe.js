import React, { useState } from "react";

// ── Utilidades de formato ──────────────────────────────────────────────────
function fmtTn(n) {
  if (!n && n !== 0) return "0 toneladas";
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)} millones de toneladas`;
  if (n >= 1000)    return `${Math.round(n).toLocaleString("es-AR")} toneladas`;
  return `${Math.round(n).toLocaleString("es-AR")} toneladas`;
}

function fmtNum(n) {
  if (!n && n !== 0) return "0";
  return Math.round(n).toLocaleString("es-AR");
}

function safe(v) { return (v == null) ? 0 : Number(v) || 0; }

function pctStr(v) {
  const n = safe(v);
  return `${Math.abs(n).toFixed(1)}%`;
}

function varFrase(pct) {
  const n = safe(pct);
  if (Math.abs(n) < 0.1) return "sin variación significativa respecto al año anterior";
  return n >= 0
    ? `un incremento del ${pctStr(n)} respecto al año anterior`
    : `una caída del ${pctStr(n)} respecto al año anterior`;
}

function varFraseMes(pct) {
  const n = safe(pct);
  if (Math.abs(n) < 0.1) return "sin variación significativa respecto al mismo mes del año anterior";
  return n >= 0
    ? `un aumento del ${pctStr(n)} interanual`
    : `una disminución del ${pctStr(n)} interanual`;
}

function topEmpresas(lista, top = 3) {
  if (!lista || lista.length === 0) return null;
  const primeras = lista.slice(0, top);
  if (primeras.length === 1) return primeras[0].empresa;
  const last = primeras[primeras.length - 1];
  const rest = primeras.slice(0, -1).map(e => e.empresa).join(", ");
  return `${rest} y ${last.empresa}`;
}

function topProductos(lista, top = 3) {
  if (!lista || lista.length === 0) return null;
  const primeros = lista.slice(0, top);
  if (primeros.length === 1) return primeros[0].tipo || primeros[0].producto || primeros[0].carga;
  const last = primeros[primeros.length - 1];
  const rest = primeros.slice(0, -1).map(p => p.tipo || p.producto || p.carga).join(", ");
  return `${rest} y ${last.tipo || last.producto || last.carga}`;
}

// ── Generador de texto ANUAL ───────────────────────────────────────────────
// filtros: { meses, operaciones, cargas, permisionario } — para adaptar el texto al contexto activo
function generarAnual(data, filtros = {}) {
  if (!data) return [];
  const res    = data.resumen        || {};
  const cmp    = data.comparativo    || {};
  const perm   = data.permisionarios || {};
  const cargas = data.cargas         || {};

  const merc    = res.mercaderias  || {};
  const cont    = res.contenedores || {};
  const nav     = res.navegacion   || {};
  const totales = cmp.totales      || {};

  const permFiltro  = filtros.permisionario || "";
  const opFiltro    = filtros.operaciones   || [];
  const hayOpFiltro = opFiltro.length > 0;
  // Sujeto: empresa específica o "el puerto"
  const sujeto = permFiltro || "el puerto";
  const verb   = permFiltro ? "movilizó" : "movilizó el puerto";

  const parrafos = [];

  // 1. Mercaderías totales
  if (merc.total != null && merc.total > 0) {
    // Solo mencionar variación cuando está disponible (es null cuando hay filtros activos)
    let p = permFiltro
      ? `Durante el período analizado, ${sujeto} movilizó un total de ${fmtTn(merc.total)}`
      : `Durante el período analizado, el puerto movilizó un total de ${fmtTn(merc.total)}`;

    if (merc.var_pct != null) {
      p += `, registrando ${varFrase(merc.var_pct)}`;
    }
    p += ".";

    // Desglose por operación: solo mencionar las que tienen valor > 0
    const partes = [];
    if (safe(merc.importacion) > 0) partes.push(`importación: ${fmtTn(merc.importacion)}`);
    if (safe(merc.exportacion) > 0) partes.push(`exportación: ${fmtTn(merc.exportacion)}`);
    if (safe(merc.removido)    > 0) partes.push(`removido: ${fmtTn(merc.removido)}`);
    if (partes.length > 1) {
      p += ` El desglose fue: ${partes.join(", ")}.`;
    } else if (partes.length === 1 && hayOpFiltro) {
      // Filtro de una sola operación: ya está implícito en el total, no repetir
    }

    parrafos.push(p);
  }

  // 2. Contenedores y TEUs — solo si no hay filtro de op/permisionario que los haga no aplicables
  if (!hayOpFiltro && !permFiltro && cont.teus != null && safe(cont.teus) > 0) {
    let p = `En materia de contenedores, se registraron ${fmtNum(cont.total_contenedores || 0)} unidades, equivalentes a ${fmtNum(cont.teus)} TEUs`;
    if (cont.var_pct_teus != null) {
      p += `, representando ${varFrase(cont.var_pct_teus)} en términos de TEUs`;
    }
    p += ".";
    parrafos.push(p);
  }

  // 3. Buques — solo si no hay filtro de op/permisionario
  if (!hayOpFiltro && !permFiltro && nav.total_buques != null && safe(nav.total_buques) > 0) {
    let p = `En cuanto a la actividad de navegación, se registraron ${fmtNum(nav.total_buques)} buques durante el período`;
    if (nav.total_trn != null) {
      p += `, con un total de ${fmtNum(nav.total_trn)} TRN`;
    }
    if (nav.var_pct_bq != null) {
      p += `. El movimiento de buques refleja ${varFrase(nav.var_pct_bq)}`;
    }
    p += ".";
    parrafos.push(p);
  }

  // 4. Comparativo vs año anterior — solo cuando hay data anterior significativa y sin filtros de op/forma
  if (!hayOpFiltro && totales.mercaderias?.anterior != null && totales.mercaderias?.actual != null) {
    const ant = safe(totales.mercaderias.anterior);
    const act = safe(totales.mercaderias.actual);
    if (ant > 0 && act > 0) {
      const diff = act - ant;
      const diffStr = diff >= 0
        ? `superior en ${fmtTn(Math.abs(diff))} al año anterior`
        : `inferior en ${fmtTn(Math.abs(diff))} al año anterior`;
      parrafos.push(
        `En comparación con el año anterior, el volumen total movilizado fue ${diffStr}, ` +
        `pasando de ${fmtTn(ant)} a ${fmtTn(act)}.`
      );
    }
  }

  // 5. Productos — respeta el filtro de período (por_produto ya viene filtrado)
  if (!permFiltro) {
    const prods = topProductos(cargas.por_producto);
    if (prods) {
      parrafos.push(
        `Los principales tipos de carga movilizados durante el período fueron: ${prods}, ` +
        `concentrando la mayor parte del volumen operado en el puerto.`
      );
    }
  }

  // 6. Permisionarios / operadores
  if (perm.ranking_anual?.length > 0) {
    if (permFiltro) {
      // Filtro de empresa: destacar su posición
      parrafos.push(
        `Los datos corresponden exclusivamente a las operaciones de ${permFiltro} en el período seleccionado.`
      );
    } else {
      const topEmp = topEmpresas(perm.ranking_anual, 3);
      let p = `En relación a los operadores portuarios, participaron ${fmtNum(perm.total_operadores || perm.ranking_anual.length)} empresas en el movimiento de cargas`;
      if (topEmp) p += `, destacándose ${topEmp} como las principales en términos de volumen operado`;
      p += ".";
      parrafos.push(p);
    }
  }

  // 7. Cierre
  parrafos.push(
    `Los datos expuestos reflejan la actividad portuaria consolidada para el período seleccionado, ` +
    `sobre la base de la información disponible en el sistema.`
  );

  return parrafos;
}

// ── Generador de texto MENSUAL ─────────────────────────────────────────────
function generarMensual(data, filtros = {}) {
  if (!data) return [];
  const cmp    = data.comparativo  || {};
  const cargas = data.cargas       || {};

  const porMes  = cmp.por_mes              || [];
  const evolMes = cargas.evolucion_mensual || [];

  const hayOpFiltro   = (filtros.operaciones || []).length > 0;
  const hayFormFiltro = (filtros.cargas || []).length > 0;
  // Cuando hay filtro de op/forma, merc_ant no está filtrado → no comparar interanual
  const compararConAnterior = !hayOpFiltro && !hayFormFiltro;

  // Indexar evolución de cargas por mes
  const cargasPorMes = {};
  evolMes.forEach(r => { cargasPorMes[r.mes] = r; });

  return porMes.map(m => {
    const merAnt = safe(m.merc_ant);
    const merAct = safe(m.merc_act);
    // Recalcular variación (applyFilters modifica merc_act pero no merc_var)
    const varMerc = compararConAnterior && merAnt > 0
      ? ((merAct - merAnt) / merAnt * 100) : null;

    const teusAct = safe(m.teus_act);
    const teusAnt = safe(m.teus_ant);
    const varTeus = compararConAnterior && teusAnt > 0
      ? ((teusAct - teusAnt) / teusAnt * 100) : null;

    const bqAct = safe(m.buques_act);
    const bqAnt = safe(m.buques_ant);
    const varBq = compararConAnterior && bqAnt > 0
      ? ((bqAct - bqAnt) / bqAnt * 100) : null;

    const c = cargasPorMes[m.mes] || {};

    let texto = `En ${m.mes}, se movilizaron ${fmtTn(merAct)}`;
    if (varMerc !== null) {
      texto += varMerc !== 0
        ? `, evidenciando ${varFraseMes(varMerc)}`
        : `, sin variación significativa respecto al mismo mes del año anterior`;
    }
    texto += ". ";

    // Desglose imp/exp/rem: solo mostrar los que tienen valor > 0
    const partes = [];
    if (safe(c.importacion) > 0) partes.push(`importación: ${fmtTn(c.importacion)}`);
    if (safe(c.exportacion) > 0) partes.push(`exportación: ${fmtTn(c.exportacion)}`);
    if (safe(c.removido)    > 0) partes.push(`removido: ${fmtTn(c.removido)}`);
    if (partes.length > 1) texto += `Desglose por operación: ${partes.join(", ")}. `;

    // TEUs — solo si no hay filtro de op/forma (TEUs no filtrables por esas dimensiones)
    if (!hayOpFiltro && !hayFormFiltro && teusAct > 0) {
      texto += `Se movilizaron ${fmtNum(teusAct)} TEUs`;
      if (varTeus !== null && Math.abs(varTeus) >= 0.1) {
        texto += `, con ${varFraseMes(varTeus)}`;
      }
      texto += `. `;
    }

    // Buques — mismo criterio
    if (!hayOpFiltro && !hayFormFiltro && bqAct > 0) {
      texto += `El número de buques fue de ${fmtNum(bqAct)}`;
      if (varBq !== null && Math.abs(varBq) >= 0.1) {
        texto += `, representando ${varFraseMes(varBq)}`;
      }
      texto += `.`;
    }

    return { mes: m.mes, texto: texto.trim() };
  });
}

// ── Componente principal ───────────────────────────────────────────────────
export default function Informe({ data, filtros = {} }) {
  const [vista, setVista] = useState("anual");

  if (!data) return <div className="loading">Cargando informe…</div>;

  // Verificar si hay datos suficientes
  const tieneDatos = !!(
    data.resumen?.mercaderias?.total != null ||
    (data.comparativo?.por_mes || []).length > 0
  );

  if (!tieneDatos) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "#aaa", fontSize: 13 }}>
        Sin datos suficientes para generar el informe.
      </div>
    );
  }

  const parrafosAnual    = generarAnual(data, filtros);
  const registrosMensual = generarMensual(data, filtros);

  // Descripción del contexto activo
  const mesesFiltrados = filtros.meses         || [];
  const permFiltro     = filtros.permisionario  || "";
  const operFiltro     = (filtros.operaciones   || []).join(" · ");
  const cargaFiltro    = (filtros.cargas        || []).join(" · ");

  const contextoBadge = [
    permFiltro                    && `Permisionario: ${permFiltro}`,
    mesesFiltrados.length > 0     && `Meses: ${mesesFiltrados.join(", ")}`,
    operFiltro                    && `Operaciones: ${operFiltro}`,
    cargaFiltro                   && `Tipo de carga: ${cargaFiltro}`,
  ].filter(Boolean).join(" — ");

  return (
    <div>
      {/* Encabezado + toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span className="sec" style={{ marginBottom: 0 }}>Informe narrativo</span>
        <div className="toggle-wrap">
          <button className={`toggle-btn ${vista === "anual"   ? "active" : ""}`} onClick={() => setVista("anual")}>Anual</button>
          <button className={`toggle-btn ${vista === "mensual" ? "active" : ""}`} onClick={() => setVista("mensual")}>Por mes</button>
        </div>
      </div>

      {/* Badge de contexto */}
      {contextoBadge && (
        <div style={{
          background: "#EBF4FB", borderRadius: 8, padding: "7px 12px",
          marginBottom: 14, fontSize: 11, color: "#1A5FA8",
          borderLeft: "3px solid #2B7EC1",
        }}>
          <strong>Vista filtrada:</strong> {contextoBadge}
        </div>
      )}

      {/* Vista ANUAL */}
      {vista === "anual" && (
        <div>
          {parrafosAnual.length === 0
            ? <div className="loading">Sin datos para generar el informe anual.</div>
            : parrafosAnual.map((p, i) => (
                <p key={i} style={{
                  fontSize: 13, lineHeight: 1.75, textAlign: "justify",
                  color: "#333", marginBottom: 14,
                }}>
                  {p}
                </p>
              ))
          }
        </div>
      )}

      {/* Vista MENSUAL */}
      {vista === "mensual" && (
        <div>
          {registrosMensual.length === 0
            ? <div className="loading">Sin datos mensuales para el período seleccionado.</div>
            : registrosMensual.map((r, i) => (
                <div key={i} style={{
                  background: "#f5f7fa", borderRadius: 10,
                  padding: "14px 16px", marginBottom: 12,
                  borderLeft: "3px solid #1A5FA8",
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: "#1A5FA8",
                    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
                  }}>
                    {r.mes}
                  </div>
                  <p style={{
                    fontSize: 13, lineHeight: 1.7, textAlign: "justify",
                    color: "#333", margin: 0,
                  }}>
                    {r.texto}
                  </p>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
