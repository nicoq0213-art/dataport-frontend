import React, { useState } from "react";
import { loginAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import { LOGO_SRC } from "../constants";

export default function Login() {
  const { login }  = useAuth();
  const [user, setUser]         = useState("");
  const [pass, setPass]         = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user || !pass) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loginAPI(user.trim(), pass);
      login(data.access_token, data.role, data.nombre, data.must_change_password);
    } catch (err) {
      setError(err.message || "No se pudo conectar con el servidor. Intentá nuevamente más tarde.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src={LOGO_SRC} alt="Puerto de Dock Sud" className="login-logo" />
        <div className="login-title">Data Port</div>
        <div className="login-sub">Puerto de Dock Sud</div>
        <div style={{ fontSize: 10, color: "#b0b8c4", letterSpacing: "0.05em", margin: "4px 0 16px" }}>
          Un producto de NexBoards Analytics
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            placeholder="Usuario"
            value={user}
            onChange={e => setUser(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            disabled={loading}
          />
          <div style={{ position: "relative" }}>
            <input
              className="login-input"
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              style={{ paddingRight: 44 }}
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              tabIndex={-1}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 16, lineHeight: 1, padding: 4,
              }}
              aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
            >
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button
            className="login-btn"
            type="submit"
            disabled={loading || !user || !pass}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <div style={{ fontSize: 11, color: "#b0b8c4", marginTop: 16, textAlign: "center" }}>
          ¿Olvidó su contraseña? Comunicate con el soporte de NexBoards.
        </div>
      </div>
    </div>
  );
}
