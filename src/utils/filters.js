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

// Rubro de carga que opera cada permisionario. Dato fijo del negocio (no está en
// el Excel: cada empresa opera siempre el mismo tipo de carga, no cambia mes a
// mes). Las claves de rubro usan las mismas etiquetas que FORMA_KEY, para poder
// traducir directo a formaKeys sin una segunda tabla de mapeo.
const EMPRESA_RUBRO = {
  "AGRECON S.A":                                    "Granel sólido",
  "ANTIVARI S.A.":                                  "Granel líquido",
  "BLINKI S.A.":                                    "Granel sólido",
  "DESTILERIA ARGENTINA DE PETROLEO S.A. (DAPSA)":  "Granel líquido",
  "COOPERATIVA DE TRABAJO DECOSUR LTDA.":           "Granel líquido",
  "EXOLGAN S.A.":                                   "Contenerizado",
  "LOGINTER S.A.":                                  "Carga gral.",
  "MARYMAR S.A.":                                   "Granel sólido",
  "MERANOL S.A.":                                   "Granel líquido",
  "ORVOL S.A.":                                     "Granel líquido",
  "PETRORIO S.A.":                                  "Granel líquido",
  "RAIZEN ARGENTINA S.A.":                          "Granel líquido",
  "SUYING S.A.":                                    "Granel sólido",
  "ODFJELL TERMINALS TAGSA S.A.":                   "Granel líquido",
  "Y.P.F. S.A.":                                    "Granel líquido",
};

// Normaliza nombres de empresa para el cruce con EMPRESA_RUBRO: tolera el punto
// final que a veces falta/sobra entre el Excel y esta lista (ej. "AGRECON S.A").
function _normEmpresa(s) {
  return (s || "").trim().replace(/\.$/, "");
}
function _rubroDe(empresa) {
  const norm = _normEmpresa(empresa);
  return EMPRESA_RUBRO[norm] ?? EMPRESA_RUBRO[`${norm}.`];
}

function _opCompleta(opKeys)      { return opKeys.length === ALL_OPS.length; }
function _formaCompleta(formaKeys) { return formaKeys.length === ALL_FORMAS.length; }

// ¿El permisionario filtrado (si hay) es compatible con el tipo de carga
// filtrado (si hay)? true si no hay uno de los dos, o si el rubro real del
// permisionario (vía EMPRESA_RUBRO) está entre los tipos de carga filtrados.
// Regla compartida por applyFilters y buildInformeData — un solo lugar decide
// esto, así los dos motores quedan de acuerdo siempre.
function _permCompatibleConCarga(permisionario, formaKeys) {
  if (!permisionario || _formaCompleta(formaKeys)) return true;
  const rubro = _rubroDe(permisionario);
  return !!(rubro && formaKeys.includes(FORMA_KEY[rubro]));
}

// TEUs: todos los contenedores del puerto son del rubro Contenerizado (hoy,
// únicamente Exolgan S.A.), así que el total del puerto sigue siendo válido si
// el permisionario filtrado es de ese rubro, o si el tipo de carga filtrado lo
// incluye. No hay desglose de TEUs por operación → si hay filtro de Operación,
// sin dato.
function _teusAplica(permisionario, opKeys, formaKeys) {
  const rubro = permisionario ? _rubroDe(permisionario) : null;
  return _opCompleta(opKeys)
    && (!permisionario || rubro === "Contenerizado")
    && (_formaCompleta(formaKeys) || formaKeys.includes("contenerizado"));
}

// Buques: no se pueden atribuir a una empresa, un tipo de carga ni una
// operación puntual (ambigüedad real del origen de datos) → solo con período.
function _buquesAplica(permisionario, opKeys, formaKeys) {
  return _opCompleta(opKeys) && !permisionario && _formaCompleta(formaKeys);
}

function safe(v) { return (v == null) ? 0 : Number(v) || 0; }
function varPct(a, b) { return a > 0 ? ((b - a) / a * 100) : 0; }

// ── Construcción de evolucion_mensual filtrada ────────────────────────────────

function buildEvo(datos, meses, opKeys, formaKeys, permisionario) {
  // 1. Permisionario: usa datos por empresa, respetando el filtro de operación
  // y de tipo de carga. Si el permisionario filtrado no opera el rubro también
  // filtrado (ej. una arenera con Tipo de carga=Contenerizado), no tiene nada
  // real que aportar: todo en 0, no el total sin filtrar de esa empresa.
  if (permisionario) {
    const compatible = _permCompatibleConCarga(permisionario, formaKeys);
    const src = filtrarMeses(datos.permisionarios?.por_mes || [], meses);
    return src.map(m => {
      if (!compatible) return { mes: m.mes, toneladas: 0, importacion: 0, exportacion: 0, removido: 0 };
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

// ── por_producto filtrado desde evolucion_productos ───────────────────────────

const PROD_COLS = [
  { producto: "Aridos",                       key: "aridos"              },
  { producto: "Crudo, combustibles y derivados", key: "crudo_derivados"  },
  { producto: "Gases",                        key: "gases"               },
  { producto: "Carga contenerizada",          key: "carga_contenerizada" },
  { producto: "Productos minerales",          key: "productos_minerales" },
  { producto: "Siderurgico / carga general",  key: "siderurgico"         },
];

// Mapeo forma (tipo de carga) → claves de producto en S2
const FORMA_TO_PROD = {
  granel_liquido:  ["crudo_derivados", "gases"],
  granel_solido:   ["aridos", "productos_minerales"],
  contenerizado:   ["carga_contenerizada"],
  carga_general:   ["siderurgico"],
};

function buildPorProducto(evoProdsSrc, meses, formaKeys, scaleFactor, fallback) {
  if (!evoProdsSrc || !evoProdsSrc.length) return fallback;
  const src = filtrarMeses(evoProdsSrc, meses);
  if (!src.length) return fallback;
  // Filtro por tipo de carga: solo productos que pertenecen a las formas activas
  const activeProdKeys = formaKeys.length < ALL_FORMAS.length
    ? formaKeys.flatMap(fk => FORMA_TO_PROD[fk] || [])
    : PROD_COLS.map(p => p.key);
  const result = PROD_COLS
    .filter(({ key }) => activeProdKeys.includes(key))
    .map(({ producto, key }) => ({
      producto,
      toneladas: Math.round(src.reduce((s, r) => s + safe(r[key]), 0) * scaleFactor),
    }))
    .filter(p => p.toneladas > 0)
    .sort((a, b) => b.toneladas - a.toneladas);
  return result.length > 0 ? result : fallback;
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

  // por_producto: conectado a todos los filtros.
  // Tipo de carga: filtra productos visibles via FORMA_TO_PROD (mapeo exacto).
  // Operación / Permisionario: escala proporcional via filteredEvo (forma excluida del
  // factor para evitar doble conteo, ya que forma se maneja via product key filter).
  const evoProds = datos.cargas?.evolucion_productos || [];
  const totalProdBruto = filtrarMeses(evoProds, meses)
    .reduce((s, r) => s + PROD_COLS.reduce((ss, { key }) => ss + safe(r[key]), 0), 0);
  const evoForScale = formaKeys.length === ALL_FORMAS.length
    ? filteredEvo
    : buildEvo(datos, meses, opKeys, ALL_FORMAS, permisionario);
  const totalForScale = evoForScale.reduce((s, r) => s + safe(r.toneladas), 0);
  const scaleFactor = totalProdBruto > 0 ? totalForScale / totalProdBruto : 1;
  const newPorProducto = buildPorProducto(
    evoProds,
    meses,
    formaKeys,
    scaleFactor,
    datos.cargas?.por_producto,
  );

  const newCargas = {
    ...datos.cargas,
    evolucion_mensual: filteredEvo,
    por_forma:         newPorForma,
    por_producto:      newPorProducto,
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

  // TEUs y buques: reglas de negocio válidas para los 4 filtros (permisionario,
  // tipo de carga, operación, período), compartidas con buildInformeData (ver
  // _teusAplica/_buquesAplica arriba) para que los dos motores nunca diverjan.
  const teusAplica   = _teusAplica(permisionario, opKeys, formaKeys);
  const buquesAplica = _buquesAplica(permisionario, opKeys, formaKeys);

  function _teusBuquesPatch(row) {
    return {
      teus_ant:   teusAplica ? row.teus_ant : 0,
      teus_act:   teusAplica ? row.teus_act : 0,
      buques_ant: buquesAplica ? row.buques_ant : null,
      buques_act: buquesAplica ? row.buques_act : null,
    };
  }

  // Reemplaza merc_ant/merc_act respetando el filtro de operación activo.
  function patchMercAct(srcList) {
    if (!hasNonMesesFilter) return srcList;
    if (permisionario) {
      // Igual que en buildEvo: si el permisionario filtrado no opera el rubro
      // también filtrado, no tiene nada real que aportar acá tampoco.
      if (!_permCompatibleConCarga(permisionario, formaKeys)) {
        return srcList.map(r => ({ ...r, merc_ant: 0, merc_act: 0, ..._teusBuquesPatch(r) }));
      }
      const empData = _getEmpData();
      if (empData?.por_mes?.length) {
        const byMes = new Map(empData.por_mes.map(m => [m.mes, {
          ant: _opSum(m, "anterior"),
          act: _opSum(m, "actual"),
        }]));
        return srcList.map(r => {
          const e = byMes.get(r.mes);
          const base = e ? { merc_ant: e.ant, merc_act: e.act } : { merc_ant: 0, merc_act: 0 };
          return { ...r, ...base, ..._teusBuquesPatch(r) };
        });
      }
      // Fallback: lee desde por_mes.empresas (sin apertura por operación)
      const permMes = datos.permisionarios?.por_mes || [];
      const byMes = new Map(permMes.map(m => [
        m.mes,
        safe((m.empresas || []).find(e => e.empresa?.trim() === permisionario?.trim())?.toneladas),
      ]));
      return srcList.map(r => ({ ...r, merc_act: byMes.get(r.mes) ?? 0, ..._teusBuquesPatch(r) }));
    }
    const evoByMes = new Map(filteredEvo.map(e => [e.mes, safe(e.toneladas)]));
    return srcList.map(r => ({ ...r, merc_act: evoByMes.get(r.mes) ?? r.merc_act, ..._teusBuquesPatch(r) }));
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
  //
  // Lógica reescrita desde cero. Tres dimensiones independientes que actúan juntas:
  //   meses        → qué filas de por_mes incluir
  //   operaciones  → qué campo sumar (importacion / exportacion / removido)
  //   permisionario → qué empresa mostrar
  //
  // Fuente de verdad: datos.permisionarios.por_mes (contiene imp/exp/rem por empresa por mes)

  // Toneladas de una empresa según las operaciones activas.
  function _empOp(emp) {
    if (!emp) return 0;
    // Si están todas las ops activas, usa el total precalculado del backend (evita drift de float).
    if (opKeys.length === ALL_OPS.length) return safe(emp.toneladas);
    return opKeys.reduce((s, op) => s + safe(emp[op]), 0);
  }

  const permMesBase = datos.permisionarios?.por_mes || [];

  // 1. Filtro de meses
  const mesesToShow = meses.length > 0
    ? permMesBase.filter(m => meses.includes(m.mes))
    : permMesBase;

  // 2. Para cada mes: filtro de empresa + operación
  const permMesFiltrado = mesesToShow.map(mesEntry => {
    let emps = mesEntry.empresas || [];

    // Filtro de permisionario (y compatibilidad con Tipo de carga, si está
    // filtrado — hoy la página Permisionarios oculta ese filtro en la UI, pero
    // el dato subyacente queda correcto igual si algo lo llega a habilitar).
    if (permisionario) {
      emps = _permCompatibleConCarga(permisionario, formaKeys)
        ? emps.filter(e => e.empresa?.trim() === permisionario.trim())
        : [];
    }

    // Filtro de operación (recalcula toneladas por empresa)
    emps = emps
      .map(e => ({ ...e, toneladas: _empOp(e) }))
      .filter(e => e.toneladas > 0)
      .sort((a, b) => b.toneladas - a.toneladas);

    const total = emps.reduce((s, e) => s + e.toneladas, 0);

    return {
      mes:        mesEntry.mes,
      total,
      operadores: emps.length,
      empresas:   emps,
    };
  });

  // 3. Ranking anual: acumula desde por_mes ya filtrado
  //    (así meses + operación + permisionario son consistentes con la vista mensual)
  const rankingAcc = {};
  permMesFiltrado.forEach(m => {
    m.empresas.forEach(e => {
      rankingAcc[e.empresa] = (rankingAcc[e.empresa] || 0) + e.toneladas;
    });
  });
  const rankAnualFiltrado = Object.entries(rankingAcc)
    .map(([empresa, toneladas]) => ({ empresa, toneladas }))
    .sort((a, b) => b.toneladas - a.toneladas);

  // 4. Total puerto: suma del ranking ya filtrado
  const totalPuerto = rankAnualFiltrado.reduce((s, e) => s + safe(e.toneladas), 0)
    || (!permisionario && !opKeys.length ? safe(datos.permisionarios?.total_puerto) : 0);

  const newPermisionarios = {
    ...datos.permisionarios,
    total_puerto:     totalPuerto,
    total_operadores: permisionario ? (rankAnualFiltrado.length > 0 ? 1 : 0) : rankAnualFiltrado.length,
    ranking_anual:    rankAnualFiltrado,
    por_mes:          permMesFiltrado,
  };

  // contenedores/navegación: reusan cmpTc/cmpTa/cmpBc/cmpBa (ya filtrados arriba
  // vía teusAplica/buquesAplica) en vez del agregado anual crudo que traía
  // datos.resumen — antes esas 4 tarjetas de Resumen nunca cambiaban con ningún
  // filtro. La cantidad de contenedores y el TRN no tienen ningún desglose
  // (ni mensual, ni por empresa/carga/operación) expuesto por el backend, así
  // que a partir de acá (con al menos un filtro activo) quedan sin dato — el
  // único caso donde son válidos es sin filtros, que ya salió antes por el
  // `if (!hasAny) return datos;` del principio.
  const newResumenFinal = {
    ...newResumen,
    contenedores: {
      total_contenedores: null,
      teus:                teusAplica ? cmpTc : null,
      var_pct_teus:        teusAplica && cmpTa > 0 ? varPct(cmpTa, cmpTc) : null,
    },
    navegacion: {
      total_buques: buquesAplica ? cmpBc : null,
      total_trn:    null,
      var_pct_bq:   buquesAplica && cmpBa > 0 ? varPct(cmpBa, cmpBc) : null,
    },
  };

  return {
    ...datos,
    resumen:        newResumenFinal,
    cargas:         newCargas,
    comparativo:    newComparativo,
    permisionarios: newPermisionarios,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Motor central del módulo Informe (Anual / Mensual)
// ════════════════════════════════════════════════════════════════════════════
//
// A diferencia de applyFilters() (que arma la vista propia de cada módulo:
// Resumen, Cargas, Comparativo, Permisionarios — sin tocar), esta función es el
// ÚNICO lugar que decide, para cualquier combinación de filtros, qué dato mostrar
// y de qué fuente más granular sacarlo. generarAnual/generarMensual (Informe.js)
// no deciden nada: solo leen los campos ya resueltos acá y arman las frases.
//
// Fuentes granulares disponibles en el sistema, de más a menos detalladas:
//   - permisionarios.por_mes     → empresa × operación × mes        (toneladas, real)
//   - cargas.evolucion_formas    → tipo de carga × operación × mes  (toneladas, todo el puerto)
//   - cargas.evolucion_mensual   → operación × mes                  (toneladas, todo el puerto)
//   - comparativo.por_mes        → mes                              (toneladas, TEUs, buques — actual + año anterior, todo el puerto)
//   - resumen.contenedores/navegacion → un único agregado anual, sin mes ni ninguna otra dimensión
//
// La única forma de cruzar "permisionario" con "tipo de carga" es EMPRESA_RUBRO
// (arriba), porque el Excel no registra esa relación en ningún lado.
//
// Excepciones reales (documentadas, no atajos): no existe en el sistema, a
// ningún nivel de detalle, el dato de "buques por empresa" (ambigüedad real del
// origen — un buque puede generar varias filas sin ser un nuevo ingreso), ni la
// "cantidad de contenedores"/TRN por mes (solo hay un agregado anual único), ni
// el tipo de producto específico (Aridos vs. Minerales, etc.) por empresa (solo
// se conoce el rubro completo, vía EMPRESA_RUBRO).

function _getEmpresaData(datos, permisionario) {
  const empresasDict = datos.permisionarios?.empresas;
  if (!empresasDict || !permisionario) return undefined;
  const key = Object.keys(empresasDict).find(k => k.trim() === permisionario.trim());
  return key ? empresasDict[key] : undefined;
}

export function buildInformeData(datos, filtros = {}) {
  if (!datos) return null;

  const meses         = filtros.meses         || [];
  const operaciones   = filtros.operaciones   || [];
  const cargasFiltro  = filtros.cargas        || [];
  const permisionario = filtros.permisionario || "";

  const opKeys    = operaciones.length  > 0 ? operaciones.map(o => OPER_KEY[o]).filter(Boolean)  : ALL_OPS;
  const formaKeys = cargasFiltro.length > 0 ? cargasFiltro.map(c => FORMA_KEY[c]).filter(Boolean) : ALL_FORMAS;
  const opCompleta    = opKeys.length === ALL_OPS.length;
  const formaCompleta = formaKeys.length === ALL_FORMAS.length;

  // Compatibilidad permisionario↔tipo de carga: regla compartida con
  // applyFilters (ver _permCompatibleConCarga arriba) — si no coinciden, no hay
  // nada real que mostrar en ninguna métrica (ni toneladas, ni TEUs, ni ranking).
  const permCompatibleConCarga = _permCompatibleConCarga(permisionario, formaKeys);

  const sinFiltros = opCompleta && formaCompleta && !permisionario && meses.length === 0;

  // ── 1. Toneladas: fuente única de verdad para todo el módulo ───────────────
  // buildEvo ya aplica la compatibilidad permisionario↔carga internamente.
  const evoCompatible = buildEvo(datos, meses, opKeys, formaKeys, permisionario);

  // "Anterior" granular: solo existe en dos casos (ver excepciones documentadas
  // arriba de por qué no hay más). En cualquier otra combinación, no hay dato
  // real de año anterior a este nivel de detalle → queda en null, no se inventa.
  const anteriorPorMes = new Map();
  if (permisionario && permCompatibleConCarga) {
    const empData = _getEmpresaData(datos, permisionario);
    (empData?.por_mes || []).forEach(m => {
      anteriorPorMes.set(m.mes, opKeys.reduce((s, op) => s + safe(m[`${op}_anterior`]), 0));
    });
  } else if (opCompleta && formaCompleta && !permisionario) {
    (datos.comparativo?.por_mes || []).forEach(r => anteriorPorMes.set(r.mes, safe(r.merc_ant)));
  }

  const toneladasPorMes = evoCompatible.map(r => ({
    mes:         r.mes,
    total:       safe(r.toneladas),
    importacion: safe(r.importacion),
    exportacion: safe(r.exportacion),
    removido:    safe(r.removido),
    anterior:    anteriorPorMes.has(r.mes) ? anteriorPorMes.get(r.mes) : null,
  }));

  const toneladas = {
    total:       toneladasPorMes.reduce((s, r) => s + r.total, 0),
    importacion: toneladasPorMes.reduce((s, r) => s + r.importacion, 0),
    exportacion: toneladasPorMes.reduce((s, r) => s + r.exportacion, 0),
    removido:    toneladasPorMes.reduce((s, r) => s + r.removido, 0),
    anterior:    null,
    var_pct:     null,
    por_mes:     toneladasPorMes,
  };
  if (toneladasPorMes.some(r => r.anterior != null)) {
    const ant = toneladasPorMes.reduce((s, r) => s + safe(r.anterior), 0);
    toneladas.anterior = ant;
    toneladas.var_pct  = ant > 0 ? varPct(ant, toneladas.total) : null;
  }

  // ── 2. TEUs y buques ─────────────────────────────────────────────────────
  // Mismas reglas compartidas con applyFilters (_teusAplica/_buquesAplica arriba).
  const teusAplica   = _teusAplica(permisionario, opKeys, formaKeys);
  const buquesAplica = _buquesAplica(permisionario, opKeys, formaKeys);

  const cmpPorMes = filtrarMeses(datos.comparativo?.por_mes || [], meses);

  function _serieAplicada(campoAct, campoAnt, aplica) {
    const por_mes = cmpPorMes.map(r => ({
      mes:      r.mes,
      actual:   aplica ? safe(r[campoAct]) : 0,
      anterior: aplica ? safe(r[campoAnt]) : 0,
    }));
    const actual   = por_mes.reduce((s, r) => s + r.actual, 0);
    const anterior = por_mes.reduce((s, r) => s + r.anterior, 0);
    return {
      aplica,
      actual:   aplica ? actual : null,
      anterior: aplica ? anterior : null,
      var_pct:  aplica && anterior > 0 ? varPct(anterior, actual) : null,
      por_mes,
    };
  }

  const teus   = _serieAplicada("teus_act",   "teus_ant",   teusAplica);
  const buques = _serieAplicada("buques_act", "buques_ant", buquesAplica);

  // ── 3. Cantidad de contenedores y TRN ───────────────────────────────────
  // Únicos agregados anuales sin ninguna dimensión mensual expuesta por el
  // backend → dato real solo en la vista completamente sin filtros.
  const contenedoresTotal = { aplica: sinFiltros, valor: sinFiltros ? (datos.resumen?.contenedores?.total_contenedores ?? null) : null };
  const trn                = { aplica: sinFiltros, valor: sinFiltros ? (datos.resumen?.navegacion?.total_trn ?? null) : null };

  // ── 4. Tipos de carga ────────────────────────────────────────────────────
  // Sin permisionario: hay dos fuentes posibles.
  //  - Sin filtro de Operación: evolucion_productos (S2) da el desglose más
  //    rico (6 categorías de producto), correctamente filtrado por carga+mes.
  //  - Con filtro de Operación: evolucion_productos no tiene esa dimensión (no
  //    se puede saber qué parte de "Aridos" es importación vs. removido), así
  //    que se reconstruye desde evolucion_formas (S3: forma×operación×mes),
  //    que sí la tiene — 4 categorías más generales, pero reales.
  // Con permisionario: no hay desglose de producto ni de forma por empresa en
  // ningún lado (solo el rubro completo, vía EMPRESA_RUBRO) → sin dato.
  let tiposDeCarga = { aplica: false, nivel: null, items: [] };
  if (!permisionario) {
    if (opCompleta) {
      const evoProds = datos.cargas?.evolucion_productos || [];
      const totalProdBruto = filtrarMeses(evoProds, meses)
        .reduce((s, r) => s + PROD_COLS.reduce((ss, { key }) => ss + safe(r[key]), 0), 0);
      const scaleFactor = totalProdBruto > 0 ? toneladas.total / totalProdBruto : 1;
      const porProducto = buildPorProducto(evoProds, meses, formaKeys, scaleFactor, null) || [];
      tiposDeCarga = {
        aplica: porProducto.length > 0,
        nivel:  "producto",
        items:  porProducto.map(p => ({ nombre: p.producto, toneladas: p.toneladas })),
      };
    } else {
      const evoFormasMes = filtrarMeses(datos.cargas?.evolucion_formas || [], meses);
      const porForma = buildPorForma(evoFormasMes, formaKeys, opKeys, null) || { importacion: [], exportacion: [], removido: [] };
      const acc = {};
      ["importacion", "exportacion", "removido"].forEach(op => {
        if (!opKeys.includes(op)) return;
        (porForma[op] || []).forEach(f => { acc[f.forma] = (acc[f.forma] || 0) + f.toneladas; });
      });
      const items = Object.entries(acc)
        .map(([nombre, ton]) => ({ nombre, toneladas: ton }))
        .filter(i => i.toneladas > 0)
        .sort((a, b) => b.toneladas - a.toneladas);
      tiposDeCarga = { aplica: items.length > 0, nivel: "forma", items };
    }
  }

  // ── 5. Ranking de empresas ───────────────────────────────────────────────
  // Real a nivel permisionario × operación × mes (PERMISIONARIOS). El tipo de
  // carga no está en esa hoja → se cruza vía EMPRESA_RUBRO, igual que arriba.
  function _empresaOp(emp) {
    if (!emp) return 0;
    if (opCompleta) return safe(emp.toneladas);
    return opKeys.reduce((s, op) => s + safe(emp[op]), 0);
  }

  const permMesBase = filtrarMeses(datos.permisionarios?.por_mes || [], meses);
  const permMesFiltrado = permMesBase.map(mesEntry => {
    let emps = mesEntry.empresas || [];
    if (permisionario) {
      // Si el permisionario filtrado no opera el rubro también filtrado, no
      // tiene nada real que aportar al ranking (mismo criterio que toneladas/TEUs).
      emps = permCompatibleConCarga
        ? emps.filter(e => e.empresa?.trim() === permisionario.trim())
        : [];
    } else if (!formaCompleta) {
      emps = emps.filter(e => {
        const r = _rubroDe(e.empresa);
        return r && formaKeys.includes(FORMA_KEY[r]);
      });
    }
    return emps.map(e => ({ ...e, toneladas: _empresaOp(e) })).filter(e => e.toneladas > 0);
  });

  const rankingAcc = {};
  permMesFiltrado.forEach(emps => emps.forEach(e => {
    rankingAcc[e.empresa] = (rankingAcc[e.empresa] || 0) + e.toneladas;
  }));
  const ranking = Object.entries(rankingAcc)
    .map(([empresa, toneladas]) => ({ empresa, toneladas }))
    .sort((a, b) => b.toneladas - a.toneladas);

  const empresas = { ranking, total_operadores: ranking.length };

  return {
    filtros: { meses, operaciones, cargas: cargasFiltro, permisionario },
    toneladas,
    teus,
    buques,
    contenedoresTotal,
    trn,
    tiposDeCarga,
    empresas,
  };
}
