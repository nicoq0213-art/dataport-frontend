import React, { useState } from "react";
import { cambiarPasswordPropio } from "../api";
import { useAuth } from "../context/AuthContext";

function EyeBtn({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      style={{
        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
        background: "none", border: "none", cursor: "pointer", fontSize: 16,
        lineHeight: 1, padding: 4,
      }}
      aria-label={show ? "Ocultar contraseña" : "Ver contraseña"}
    >
      {show ? "🙈" : "👁"}
    </button>
  );
}

export default function CambiarPassword({ forced, onBack, onSuccess }) {
  const { clearMustChange } = useAuth();
  const [form, setForm]       = useState({ current: "", nueva: "", repetir: "" });
  const [show, setShow]       = useState({ current: false, nueva: false, repetir: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [ok, setOk]           = useState(false);

  function toggle(field) { setShow(s => ({ ...s, [field]: !s[field] })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (form.nueva !== form.repetir) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await cambiarPasswordPropio(form.current, form.nueva, form.repetir);
      clearMustChange();
      setOk(true);
      setTimeout(() => { onSuccess?.(); }, 1500);
    } catch (err) {
      setError(err.message || "Error al cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 400, gap: 0 }}>

        {forced && (
          <div style={{
            background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10,
            padding: "12px 14px", fontSize: 13, color: "#664d03", marginBottom: 16,
          }}>
            Tenés una contraseña provisoria. Elegí una nueva para continuar.
          </div>
        )}

        {!forced && (
          <button
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 500, color: "#1A5FA8", padding: "4px 0",
              marginBottom: 8,
            }}
            onClick={onBack}
          >
            ← Volver
          </button>
        )}

        <div className="login-title" style={{ fontSize: 18, marginBottom: 4 }}>
          Cambiar contraseña
        </div>

        {ok ? (
          <div style={{
            background: "#e6fff6", color: "#00875a", borderRadius: 8,
            padding: "12px 14px", fontSize: 14, fontWeight: 600,
            textAlign: "center", marginTop: 12,
          }}>
            ✅ Contraseña actualizada. Redirigiendo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form" style={{ marginTop: 12 }}>

            <label style={{ fontSize: 12, fontWeight: 500, color: "#888", marginTop: 6 }}>
              Contraseña actual
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="login-input"
                type={show.current ? "text" : "password"}
                placeholder="••••••••"
                style={{ paddingRight: 44 }}
                value={form.current}
                onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                required
              />
              <EyeBtn show={show.current} onToggle={() => toggle("current")} />
            </div>

            <label style={{ fontSize: 12, fontWeight: 500, color: "#888", marginTop: 6 }}>
              Nueva contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="login-input"
                type={show.nueva ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                style={{ paddingRight: 44 }}
                value={form.nueva}
                onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))}
                required
              />
              <EyeBtn show={show.nueva} onToggle={() => toggle("nueva")} />
            </div>

            <label style={{ fontSize: 12, fontWeight: 500, color: "#888", marginTop: 6 }}>
              Repetir nueva contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="login-input"
                type={show.repetir ? "text" : "password"}
                placeholder="••••••••"
                style={{ paddingRight: 44 }}
                value={form.repetir}
                onChange={e => setForm(f => ({ ...f, repetir: e.target.value }))}
                required
              />
              <EyeBtn show={show.repetir} onToggle={() => toggle("repetir")} />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button
              className="login-btn"
              type="submit"
              disabled={loading || !form.current || !form.nueva || !form.repetir}
              style={{ opacity: loading ? 0.7 : 1, marginTop: 16 }}
            >
              {loading ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
