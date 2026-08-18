import React, { useState, useEffect } from "react";
import "./App.css";
import { fetchDashboard } from "./api";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { applyFilters } from "./utils/filters";
import { LOGO_SRC } from "./constants";
import Login from "./components/Login";
import LoadingScreen from "./components/LoadingScreen";
import Resumen from "./components/Resumen";
import Buques from "./components/Buques";
import Cargas from "./components/Cargas";
import Comparativo from "./components/Comparativo";
import Permisionarios from "./components/Permisionarios";
import Informe from "./components/Informe";
import Infraestructura from "./components/Infraestructura";
import Admin from "./components/Admin";
import Filtros from "./components/Filtros";

const MODULOS = [
  { id: "resumen",        label: "Resumen ejecutivo", icon: "⊞" },
  { id: "buques",         label: "Buques",             icon: "⛵" },
  { id: "cargas",         label: "Cargas",             icon: "📦" },
  { id: "comparativo",    label: "Comparativo",        icon: "📊" },
  { id: "permisionarios", label: "Permisionarios",     icon: "🏭" },
  { id: "informe",          label: "Informe",          icon: "📄" },
  { id: "infraestructura", label: "Infraestructura",  icon: "🏗️" },
];

const FILTROS_INIT = { meses: [], operaciones: [], cargas: [], permisionario: "" };

function AppContent() {
  const { auth, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pagina, setPagina]     = useState("resumen");
  const [rawData, setRawData]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [filtros, setFiltros]   = useState(FILTROS_INIT);

  function cargarDatos() {
    setLoading(true);
    setError(null);
    fetchDashboard()
      .then(d => { setRawData(d); setLoading(false); })
      .catch(err => {
        setLoading(false);
        if (err.status === 401) { logout(); return; }
        setError(
          err.name === "AbortError"
            ? "El servidor tardó demasiado. Intentá nuevamente más tarde."
            : "No se pudo cargar la información. Intentá nuevamente más tarde."
        );
      });
  }

  useEffect(() => {
    if (!auth) return;
    setPagina("resumen");
    cargarDatos();
  }, [auth]);

  if (!auth) return <Login />;

  function navegar(id) { setPagina(id); setMenuOpen(false); }

  // Aplicar filtros sobre los datos crudos → fuente única de verdad
  const datos = applyFilters(rawData, filtros);

  const periodo = (() => {
    const meses = rawData?.resumen?.evolucion_mensual;
    if (!meses?.length) return "—";
    const primero = meses[0]?.mes;
    const ultimo  = meses[meses.length - 1]?.mes;
    const año = new Date().getFullYear();
    return primero === ultimo ? `${primero} ${año}` : `${primero}–${ultimo} ${año}`;
  })();

  const mesesDisponibles  = rawData?.resumen?.evolucion_mensual?.map(r => r.mes) || [];
  const permisDisponibles = rawData?.permisionarios?.ranking_anual?.map(p => p.empresa) || [];
  const enModulo          = pagina !== "config";

  // Módulos sin filtros aplicables: se oculta el panel completo
  const SIN_FILTROS    = ["buques", "infraestructura"];
  const mostrarFiltros = enModulo && !SIN_FILTROS.includes(pagina);
  // Permisionarios no usa "Tipo de carga"
  const ocultarCargas  = pagina === "permisionarios";

  const hayFiltros = mostrarFiltros && !!(
    filtros.permisionario ||
    filtros.meses.length > 0 ||
    filtros.operaciones.length > 0 ||
    (!ocultarCargas && filtros.cargas.length > 0)
  );

  return (
    <div className="shell">
      <div className="topbar" style={{ display: loading ? 'none' : 'flex' }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">☰</button>
          <img src={LOGO_SRC} alt="Consorcio de Gestión del Puerto de Dock Sud"
            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span className="logo-app">Data Port</span>
            <span className="logo-sub">Puerto de Dock Sud</span>
          </div>
        </div>
        <span className="period-badge">{periodo}</span>
      </div>

      <div className="layout">
        <div className={`overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />

        <div className={`sidebar ${menuOpen ? "open" : ""}`}>
          <div style={{ padding: "16px 16px 12px", borderBottom: "0.5px solid #e0e0e0", display: "flex", alignItems: "center", gap: 10 }}>
            <img src={LOGO_SRC} alt="Logo"
              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1A5FA8" }}>Data Port</div>
              <div style={{ fontSize: 10, color: "#888" }}>{auth.nombre || auth.role}</div>
            </div>
          </div>
          <div style={{ paddingTop: 8, flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="nav-section">Módulos</div>
            {MODULOS.map(m => (
              <div key={m.id} className={`nav-item ${pagina === m.id ? "active" : ""}`} onClick={() => navegar(m.id)}>
                <span>{m.icon}</span>{m.label}
              </div>
            ))}
            <div className="nav-divider" />
            <div className="nav-section">Sistema</div>
            {auth.role === "admin" && (
              <div className={`nav-item ${pagina === "config" ? "active" : ""}`} onClick={() => navegar("config")}>
                <span>⚙</span> Configuración
              </div>
            )}
            <div className="nav-item" onClick={logout}>
              <span>↩</span> Cerrar sesión
            </div>
          </div>
        </div>

        <div className="content">
          {loading && <LoadingScreen />}
          {error && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: 16,
            }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1A5FA8" }}>
                No se pudo cargar la información
              </div>
              <div style={{ fontSize: 13, color: "#666", maxWidth: 280 }}>{error}</div>
              <button onClick={cargarDatos} style={{
                marginTop: 8, padding: "10px 24px", borderRadius: 8, border: "none",
                background: "#1A5FA8", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && datos && enModulo && (
            <>
              {mostrarFiltros && (
                <Filtros
                  meses={mesesDisponibles}
                  permisionarios={permisDisponibles}
                  onChange={setFiltros}
                  ocultarCargas={ocultarCargas}
                />
              )}

              {hayFiltros && (
                <div style={{
                  background: "#EBF4FB", borderRadius: 8, padding: "8px 12px",
                  marginBottom: 12, fontSize: 11, color: "#1A5FA8",
                  borderLeft: "3px solid #2B7EC1",
                  display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
                }}>
                  <span style={{ fontWeight: 600 }}>Vista filtrada:</span>
                  {filtros.permisionario && <span><strong>{filtros.permisionario}</strong></span>}
                  {filtros.meses.length > 0 && <span>{filtros.meses.join(" · ")}</span>}
                  {filtros.operaciones.length > 0 && <span>{filtros.operaciones.join(" · ")}</span>}
                  {!ocultarCargas && filtros.cargas.length > 0 && <span>{filtros.cargas.join(" · ")}</span>}
                </div>
              )}

              {pagina === "resumen"        && <Resumen        data={datos.resumen}        filtros={filtros} />}
              {pagina === "buques"         && <Buques         data={datos.buques}         filtros={filtros} />}
              {pagina === "cargas"         && <Cargas         data={datos.cargas}         filtros={filtros} />}
              {pagina === "comparativo"    && <Comparativo    data={datos.comparativo}    filtros={filtros} />}
              {pagina === "permisionarios" && <Permisionarios data={datos.permisionarios} filtros={filtros} />}
              {pagina === "informe"          && <Informe        data={rawData}  filtros={filtros} />}
              {pagina === "infraestructura" && <Infraestructura />}
            </>
          )}

          {pagina === "config" && auth.role === "admin" && <Admin />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
