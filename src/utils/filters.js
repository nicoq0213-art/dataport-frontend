/**
 * Motor de filtros centralizado.
 * Toma los datos crudos del backend y retorna una copia con todos los módulos
 * recalculados según los filtros activos.
 *
 * Dimensiones soportadas por fuente de datos:
 *   meses       → cualquier módulo con datos mensuales
 *   operaciones → cargas.evolucion_formas / cargas.evolucion_mensual
 *   cargas      → cargas.evolucion_formas  (S3: forma×operación×mes)
 *   permisionario → permisionarios.por_mes (empresa×mes)
 */

const FORMA_KEY = {
  "Granel líquido": "granel_liquido",
  "Granel sólido":  "granel_solido",
  "Contenerizado":  "contenerizado",
  "Carga gral.":    "carga_general",
};

const OPER_KEY = {
  "Importación": "importacion",
  "Exportación": "exportacion",
  "Removido":    "removido",
};

const ALL_OPS   = ["importacion", "exportacion", "removido"];
const ALL_FORMAS = ["granel_liquido", "granel_solido", "contenerizado", "carga_general"];

function safe(v) { return (v == null) ? 0 : Number(v) || 0; }
function varPct(a, b) { return a > 0 ? ((b - a) / a * 100) : 0; }

// ── Construcción de evolucion_mensual filtrada ────────────────────────────────

function buildEvo(datos, meses, opKeys, formaKeys, permisionario) {
  // 1. Permisionario: usa datos por empresa, respetando el filtro de operación
  if (permisionario) {
    const src = filtrarMeses(datos.permisionarios?.por_mes || [], meses);
    return src.map(m => {
      const emp = (m.empresas || []).find(e => e.empresa?.trim() === permisionario?.trim());
      if (!emp) return { mes: m.mes, toneladas: 0, importacion: 0, exportacion: 0, removido: 0 };
      const imp = opKeys.includes("importacion") ? safe(emp.importacion) : 0;
      const exp = opKeys.includes("exportacion") ? safe(emp.exportacion) : 0;
      const rem = opKeys.includes("removido")    ? safe(emp.removido)    : 0;
      return { mes: m.mes, toneladas: imp + exp + rem, importacion: imp, exportacion: exp, removido: rem };
    });
  }

  // 2. Con tipo de carga: usa evolucion_formas (S3 mensual)
  const evoFormas = datos.cargas?.evolucion_formas || [];
  if (formaKeys !== ALL_FORMAS && evoFormas.length > 0) {
    const src = filtrarMeses(evoFormas, meses);
    return src.map(r => {
      let imp = 0, exp = 0, rem = 0;
      if (opKeys.includes("importacion") && r.importacion)
        imp = formaKeys.reduce((s, fk) => s + safe(r.importacion[fk]), 0);
      if (opKeys.includes("exportacion") && r.exportacion)
        exp = formaKeys.filter(fk => fk !== "carga_general")
                       .reduce((s, fk) => s + safe(r.exportacion[fk]), 0);
      if (opKeys.includes("removido") && r.removido)
        rem = formaKeys.filter(fk => fk === "granel_liquido" || fk === "granel_solido")
                       .reduce((s, fk) => s + safe(r.removido[fk]), 0);
      return { mes: r.mes, toneladas: imp + exp + rem, importacion: imp, exportacion: exp, removido: rem };
    });
  }

  // 3. Solo operaciones / meses: usa evolucion_mensual de cargas (S1)
  const evoCMes = datos.cargas?.evolucion_mensual || [];
  const src = filtrarMeses(evoCMes, meses);
  return src.map(r => {
    const imp = opKeys.includes("importacion") ? safe(r.importacion) : 0;
    const exp = opKeys.includes("exportacion") ? safe(r.exportacion) : 0;
    const rem = opKeys.includes("removido")    ? safe(r.removido)    : 0;
    return { mes: r.mes, toneladas: imp + exp + rem, importacion: imp, exportacion: exp, removido: rem };
  });
}

function filtrarMeses(arr, meses) {
  return meses.length > 0 ? arr.filter(r => meses.includes(r.mes)) : arr;
}

// ── por_forma filtrado desde evolucion_formas ─────────────────────────────────

function buildPorForma(evoFormasSrc, formaKeys, opKeys, fallback) {
  if (!evoFormasSrc.length) return fallback;

  function agg(opKey, formaKey) {
    return evoFormasSrc.reduce((s, r) => s + safe(r[opKey]?.[formaKey]), 0);
  }

  const IMP_COLS = [
    ["Granel liquido",             "granel_liquido"],
    ["Granel solido",              "granel_solido"],
    ["Contenerizado",              "contenerizado"],
    ["Carga gral. no contenerizada","carga_general"],
  ];
  const EXP_COLS = [
    ["Granel liquido", "granel_liquido"],
    ["Granel solido",  "granel_solido"],
    ["Contenerizado",  "contenerizado"],
  ];
  const REM_COLS = [
    ["Granel liquido", "granel_liquido"],
    ["Granel solido",  "granel_solido"],
  ];

  function buildSection(cols, opKey) {
    if (!opKeys.includes(opKey)) return [];
    return cols
      .filter(([, fk]) => formaKeys.includes(fk))
      .map(([forma, fk]) => ({ forma, toneladas: agg(opKey, fk) }))
      .filter(f => f.toneladas > 0);
  }

  return {
    importacion: buildSection(IMP_COLS, "importacion"),
    exportacion: buildSection(EXP_COLS, "exportacion"),
    removido:    buildSection(REM_COLS, "removido"),
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

export function applyFilters(datos, filtros) {
  if (!datos) return datos;

  const {
    meses        = [],
    operaciones  = [],
    cargas: cargasFiltro = [],
    permisionario = "",
  } = filtros;

  const hasAny = !!(permisionario || meses.length || operaciones.length || cargasFiltro.length);
  if (!hasAny) return datos;

  // Resolver claves activas
  const opKeys    = operaciones.length  > 0 ? operaciones.map(o  => OPER_KEY[o]).filter(Boolean)  : ALL_OPS;
  const formaKeys = cargasFiltro.length > 0 ? cargasFiltro.map(c => FORMA_KEY[c]).filter(Boolean) : ALL_FORMAS;

  // ── evolucion_mensual filtrada (fuente única de verdad para toneladas) ──────
  const filteredEvo = buildEvo(datos, meses, opKeys, formaKeys, permisionario);

  const totalImp  = filteredEvo.reduce((s, r) => s + (r.importacion != null ? safe(r.importacion) : 0), 0);
  const totalExp  = filteredEvo.reduce((s, r) => s + (r.exportacion != null ? safe(r.exportacion) : 0), 0);
  const totalRem  = filteredEvo.reduce((s, r) => s + (r.removido    != null ? safe(r.removido)    : 0), 0);
  const totalMerc = filteredEvo.reduce((s, r) => s + safe(r.toneladas), 0);

  // ── Resumen ──────────────────────────────────────────────────────────────────
  const newResumen = {
    ...datos.resumen,
    mercaderias: {
      total:       totalMerc,
      importacion: totalImp || null,
      exportacion: totalExp || null,
      removido:    totalRem || null,
      var_pct:     null,
    },
    evolucion_mensual: filteredEvo,
  };

  // ── Cargas ───────────────────────────────────────────────────────────────────
  const evoFormas = datos.cargas?.evolucion_formas || [];
  const evoFormasMesFiltrado = filtrarMeses(evoFormas, meses);

  const newPorForma = buildPorForma(
    evoFormasMesFiltrado,
    formaKeys,
    opKeys,
    datos.cargas?.por_forma,
  );

  const newCargas = {
    ...datos.cargas,
    evolucion_mensual: filteredEvo,
    por_forma: newPorForma,
  };

  // ── Comparativo ──────────────────────────────────────────────────────────────
  const cmpAll = datos.comparativo?.por_mes || [];         // año completo (para el gráfico)
  const cmpSrc = filtrarMeses(cmpAll, meses);              // filtrado por meses (para totales)

  const hasNonMesesFilter = !!(permisionario || operaciones.length > 0 || cargasFiltro.length > 0);

  // Lookup normalizado: busca la clave de empresas haciendo trim() en ambos lados.
  function _getEmpData() {
    const empresasDict = datos.permisionarios?.empresas;
    if (!empresasDict || !permisionario) return undefined;
    const key = Object.keys(empresasDict).find(k => k.trim() === permisionario.trim());
    return key ? empresasDict[key] : undefined;
  }

  // Suma los campos _anterior/_actual de empData.por_mes según las ops activas.
  // El backend expone: importacion_anterior, exportacion_anterior, removido_anterior (ídem _actual).
  function _opSum(mesObj, suffix) {
    return opKeys.reduce((s, op) => s + safe(mesObj[`${op}_${suffix}`]), 0);
  }

  // Reemplaza merc_ant/merc_act respetando el filtro de operación activo.
  function patchMercAct(srcList) {
    if (!hasNonMesesFilter) return srcList;
    if (permisionario) {
      const empData = _getEmpData();
      if (empData?.por_mes?.length) {
        const byMes = new Map(empData.por_mes.map(m => [m.mes, {
          ant: _opSum(m, "anterior"),
          act: _opSum(m, "actual"),
        }]));
        return srcList.map(r => {
          const e = byMes.get(r.mes);
          return e ? { ...r, merc_ant: e.ant, merc_act: e.act } : { ...r, merc_ant: 0, merc_act: 0 };
        });
      }
      // Fallback: lee desde por_mes.empresas (sin apertura por operación)
      const permMes = datos.permisionarios?.por_mes || [];
      const byMes = new Map(permMes.map(m => [
        m.mes,
        safe((m.empresas || []).find(e => e.empresa?.trim() === permisionario?.trim())?.toneladas),
      ]));
      return srcList.map(r => ({ ...r, merc_act: byMes.get(r.mes) ?? 0 }));
    }
    const evoByMes = new Map(filteredEvo.map(e => [e.mes, safe(e.toneladas)]));
    return srcList.map(r => ({ ...r, merc_act: evoByMes.get(r.mes) ?? r.merc_act }));
  }

  const cmpSrcFinal = patchMercAct(cmpSrc); // para totales (meses filtrados)

  // Gráfico de línea: año completo para permisionario, con filtro de operación aplicado.
  const cmpChartData = (() => {
    if (permisionario) {
      const empData = _getEmpData();
      if (empData?.por_mes?.length) {
        return empData.por_mes.map(m => ({
          mes:        m.mes,
          merc_ant:   _opSum(m, "anterior"),
          merc_act:   _opSum(m, "actual"),
          teus_ant:   0, teus_act:   0,
          buques_ant: 0, buques_act: 0,
        }));
      }
      return patchMercAct(cmpAll); // fallback: año completo
    }
    return cmpSrcFinal;
  })();

  const cmpMa = cmpSrcFinal.reduce((s, r) => s + safe(r.merc_ant),   0);
  const cmpMc = cmpSrcFinal.reduce((s, r) => s + safe(r.merc_act),   0);
  const cmpTa = cmpSrcFinal.reduce((s, r) => s + safe(r.teus_ant),   0);
  const cmpTc = cmpSrcFinal.reduce((s, r) => s + safe(r.teus_act),   0);
  const cmpBa = cmpSrcFinal.reduce((s, r) => s + safe(r.buques_ant), 0);
  const cmpBc = cmpSrcFinal.reduce((s, r) => s + safe(r.buques_act), 0);

  const newComparativo = {
    por_mes:       cmpSrcFinal,   // para barras de totales (respeta meses filter)
    por_mes_chart: cmpChartData,  // para gráfico de línea (año completo si permisionario)
    totales: {
      mercaderias: { anterior: cmpMa, actual: cmpMc, var_pct: varPct(cmpMa, cmpMc) },
      teus:        { anterior: cmpTa, actual: cmpTc, var_pct: varPct(cmpTa, cmpTc) },
      buques:      { anterior: cmpBa, actual: cmpBc, var_pct: varPct(cmpBa, cmpBc) },
    },
  };

  // ── Permisionarios ───────────────────────────────────────────────────────────
  const permMesSrc = filtrarMeses(datos.permisionarios?.por_mes || [], meses);
  const rankAnualFiltrado = permisionario
    ? (datos.permisionarios?.ranking_anual || []).filter(e => e.empresa?.trim() === permisionario?.trim())
    : datos.permisionarios?.ranking_anual;

  // totalMerc ya refleja el filtro de operación aplicado en buildEvo
  const totalPuerto = permisionario ? totalMerc : datos.permisionarios?.total_puerto;

  const newPermisionarios = {
    ...datos.permisionarios,
    total_puerto:     totalPuerto,
    total_operadores: permisionario ? (rankAnualFiltrado.length > 0 ? 1 : 0) : datos.permisionarios?.total_operadores,
    ranking_anual:    rankAnualFiltrado,
    por_mes:          permMesSrc,
  };

  return {
    ...datos,
    resumen:        newResumen,
    cargas:         newCargas,
    comparativo:    newComparativo,
    permisionarios: newPermisionarios,
  };
}
