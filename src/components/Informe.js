import React, { useState } from "react";
import { buildInformeData } from "../utils/filters";

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

function topNombres(lista, top = 3) {
  if (!lista || lista.length === 0) return null;
  const primeros = lista.slice(0, top);
  if (primeros.length === 1) return primeros[0].nombre;
  const last = primeros[primeros.length - 1];
  const rest = primeros.slice(0, -1).map(p => p.nombre).join(", ");
  return `${rest} y ${last.nombre}`;
}

// ── Generador de texto ANUAL ───────────────────────────────────────────────
// Todas las decisiones de "¿este dato es válido con este filtro?" ya se
// resolvieron en buildInformeData() (filters.js). Acá solo se arman frases a
// partir de valores ya filtrados: si un campo no aplica, llega en null/0 y el
// párrafo correspondiente se omite solo. No hay ningún "si hay filtro X, hago Y".
function generarAnual(informe, filtros = {}) {
  if (!informe) return [];
  const { toneladas, teus, buques, contenedoresTotal, trn, tiposDeCarga, empresas } = informe;

  // Estas dos son las únicas lecturas de "filtros" en todo el generador, y
  // ambas son elección de palabras sobre un dato ya resuelto (el nombre de la
  // empresa filtrada, si el texto debe aclarar "del rubro filtrado"), no una
  // decisión de qué dato mostrar.
  const permFiltro  = filtros.permisionario || "";
  const hayCargaFiltro = (filtros.cargas || []).length > 0;
  const sujeto = permFiltro || "el puerto";

  const parrafos = [];

  // 1. Mercaderías totales
  if (toneladas.total > 0) {
    let p = permFiltro
      ? `Durante el período analizado, ${sujeto} movilizó un total de ${fmtTn(toneladas.total)}`
      : `Durante el período analizado, el puerto movilizó un total de ${fmtTn(toneladas.total)}`;

    if (toneladas.var_pct != null) {
      p += `, registrando ${varFrase(toneladas.var_pct)}`;
    }
    p += ".";

    const partes = [];
    if (toneladas.importacion > 0) partes.push(`importación: ${fmtTn(toneladas.importacion)}`);
    if (toneladas.exportacion > 0) partes.push(`exportación: ${fmtTn(toneladas.exportacion)}`);
    if (toneladas.removido    > 0) partes.push(`removido: ${fmtTn(toneladas.removido)}`);
    if (partes.length > 1) p += ` El desglose fue: ${partes.join(", ")}.`;

    parrafos.push(p);
  }

  // 2. Contenedores y TEUs
  if (safe(teus.actual) > 0) {
    let p = contenedoresTotal.aplica && contenedoresTotal.valor != null
      ? `En materia de contenedores, se registraron ${fmtNum(contenedoresTotal.valor)} unidades, equivalentes a ${fmtNum(teus.actual)} TEUs`
      : `En materia de contenedores, se registraron ${fmtNum(teus.actual)} TEUs`;
    if (safe(teus.anterior) > 0) {
      p += `, representando ${varFrase(teus.var_pct)} en términos de TEUs`;
    }
    p += ".";
    parrafos.push(p);
  }

  // 3. Buques
  if (safe(buques.actual) > 0) {
    let p = `En cuanto a la actividad de navegación, se registraron ${fmtNum(buques.actual)} buques durante el período`;
    if (trn.aplica && trn.valor != null) {
      p += `, con un total de ${fmtNum(trn.valor)} TRN`;
    }
    if (safe(buques.anterior) > 0) {
      p += `. El movimiento de buques refleja ${varFrase(buques.var_pct)}`;
    }
    p += ".";
    parrafos.push(p);
  }

  // 4. Comparativo vs año anterior
  if (toneladas.anterior != null && toneladas.anterior > 0 && toneladas.total > 0) {
    const ant = toneladas.anterior, act = toneladas.total;
    const diff = act - ant;
    const diffStr = diff >= 0
      ? `superior en ${fmtTn(Math.abs(diff))} al año anterior`
      : `inferior en ${fmtTn(Math.abs(diff))} al año anterior`;
    parrafos.push(
      `En comparación con el año anterior, el volumen total movilizado fue ${diffStr}, ` +
      `pasando de ${fmtTn(ant)} a ${fmtTn(act)}.`
    );
  }

  // 5. Tipos de carga
  if (tiposDeCarga.aplica) {
    const nombres = topNombres(tiposDeCarga.items, 3);
    if (nombres) {
      parrafos.push(
        `Los principales tipos de carga movilizados durante el período fueron: ${nombres}, ` +
        `concentrando la mayor parte del volumen operado en el puerto.`
      );
    }
  }

  // 6. Empresas / operadores
  if (empresas.ranking.length > 0) {
    if (permFiltro) {
      parrafos.push(
        `Los datos corresponden exclusivamente a las operaciones de ${permFiltro} en el período seleccionado.`
      );
    } else {
      const topEmp = topEmpresas(empresas.ranking, 3);
      const rubroTxt = hayCargaFiltro ? " del rubro filtrado" : "";
      let p = `En relación a los operadores portuarios${rubroTxt}, participaron ${fmtNum(empresas.total_operadores)} empresas en el movimiento de cargas`;
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
// Mismo principio: toneladas.por_mes / teus.por_mes / buques.por_mes ya vienen
// resueltos por buildInformeData() para el mes y la combinación de filtros
// activa. Ningún "if" de acá pregunta qué filtro está prendido.
function generarMensual(informe) {
  if (!informe) return [];
  const { toneladas, teus, buques } = informe;

  const teusPorMes   = new Map(teus.por_mes.map(r => [r.mes, r]));
  const buquesPorMes = new Map(buques.por_mes.map(r => [r.mes, r]));

  return toneladas.por_mes.map(m => {
    const varMerc = m.anterior != null && m.anterior > 0
      ? ((m.total - m.anterior) / m.anterior * 100) : null;

    const t = teusPorMes.get(m.mes)   || { actual: 0, anterior: 0 };
    const b = buquesPorMes.get(m.mes) || { actual: null, anterior: null };
    const varTeus = safe(t.anterior) > 0 ? ((safe(t.actual) - safe(t.anterior)) / safe(t.anterior) * 100) : null;
    const varBq   = safe(b.anterior) > 0 ? ((safe(b.actual) - safe(b.anterior)) / safe(b.anterior) * 100) : null;

    let texto = `En ${m.mes}, se movilizaron ${fmtTn(m.total)}`;
    if (varMerc !== null) {
      texto += varMerc !== 0
        ? `, evidenciando ${varFraseMes(varMerc)}`
        : `, sin variación significativa respecto al mismo mes del año anterior`;
    }
    texto += ". ";

    const partes = [];
    if (m.importacion > 0) partes.push(`importación: ${fmtTn(m.importacion)}`);
    if (m.exportacion > 0) partes.push(`exportación: ${fmtTn(m.exportacion)}`);
    if (m.removido    > 0) partes.push(`removido: ${fmtTn(m.removido)}`);
    if (partes.length > 1) texto += `Desglose por operación: ${partes.join(", ")}. `;

    if (safe(t.actual) > 0) {
      texto += `Se movilizaron ${fmtNum(t.actual)} TEUs`;
      if (varTeus !== null && Math.abs(varTeus) >= 0.1) texto += `, con ${varFraseMes(varTeus)}`;
      texto += `. `;
    }

    if (safe(b.actual) > 0) {
      texto += `El número de buques fue de ${fmtNum(b.actual)}`;
      if (varBq !== null && Math.abs(varBq) >= 0.1) texto += `, representando ${varFraseMes(varBq)}`;
      texto += `.`;
    }

    return { mes: m.mes, texto: texto.trim() };
  });
}

// ── Componente principal ───────────────────────────────────────────────────
// data: payload crudo del backend (sin pasar por applyFilters — buildInformeData
// arma su propia vista filtrada desde las fuentes más granulares).
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

  const informe = buildInformeData(data, filtros);
  const parrafosAnual    = generarAnual(informe, filtros);
  const registrosMensual = generarMensual(informe);

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
