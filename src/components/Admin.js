import React, { useState, useEffect } from "react";
import { uploadExcel, getUsuarios, crearUsuario, eliminarUsuario } from "../api";

export default function Admin() {
  const [tab, setTab]           = useState("excel");
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [newUser, setNewUser]   = useState({ username: "", password: "", nombre: "" });
  const [showPass, setShowPass] = useState(false);
  const [userMsg, setUserMsg]   = useState(null);

  useEffect(() => {
    if (tab === "usuarios") loadUsuarios();
  }, [tab]);

  async function loadUsuarios() {
    try { setUsuarios(await getUsuarios()); } catch {}
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      await uploadExcel(file);
      setUploadMsg({ ok: true, text: "Archivo subido correctamente. Los datos se actualizarán en la próxima consulta." });
      setFile(null);
    } catch (err) {
      setUploadMsg({ ok: false, text: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    setUserMsg(null);
    try {
      await crearUsuario(newUser.username, newUser.password, newUser.nombre);
      setNewUser({ username: "", password: "", nombre: "" });
      setUserMsg({ ok: true, text: "Usuario creado correctamente." });
      loadUsuarios();
    } catch (err) {
      setUserMsg({ ok: false, text: err.message });
    }
  }

  async function handleEliminar(id) {
    try { await eliminarUsuario(id); loadUsuarios(); } catch {}
  }

  return (
    <div>
      <div className="sec">Configuración</div>
      <div className="toggle-wrap" style={{ marginBottom: 16 }}>
        <button className={`toggle-btn ${tab === "excel" ? "active" : ""}`} onClick={() => setTab("excel")}>Excel</button>
        <button className={`toggle-btn ${tab === "usuarios" ? "active" : ""}`} onClick={() => setTab("usuarios")}>Usuarios</button>
      </div>

      {tab === "excel" && (
        <div>
          <div className="admin-title">Reemplazar informe.xlsx</div>
          <div className="admin-desc">El archivo reemplaza todos los datos activos. El cambio es inmediato para los usuarios.</div>
          <form onSubmit={handleUpload} className="admin-form">
            <label className="admin-file-label">
              <input
                type="file"
                accept=".xlsx"
                style={{ display: "none" }}
                onChange={e => { setFile(e.target.files[0]); setUploadMsg(null); }}
              />
              {file ? <span className="admin-filename">📄 {file.name}</span> : <span>Seleccionar archivo .xlsx</span>}
            </label>
            <button className="admin-btn" type="submit" disabled={!file || uploading}>
              {uploading ? "Subiendo…" : "Subir archivo"}
            </button>
          </form>
          {uploadMsg && <div className={`admin-msg ${uploadMsg.ok ? "ok" : "err"}`}>{uploadMsg.text}</div>}
        </div>
      )}

      {tab === "usuarios" && (
        <div>
          <div className="admin-title">Usuarios de lectura</div>
          {usuarios.length === 0
            ? <div className="loading" style={{ textAlign: "left", paddingLeft: 0 }}>Sin usuarios registrados.</div>
            : usuarios.map(u => (
              <div className="admin-user-row" key={u.id}>
                <div>
                  <div className="admin-user-name">{u.nombre || u.username}</div>
                  <div className="admin-user-sub">@{u.username}</div>
                </div>
                <button className="admin-del" onClick={() => handleEliminar(u.id)} title="Eliminar">✕</button>
              </div>
            ))
          }

          <div className="divider" style={{ margin: "16px 0" }} />
          <div className="admin-title">Nuevo usuario</div>
          <form onSubmit={handleCrear} className="admin-form">
            <input className="login-input" placeholder="Nombre completo" value={newUser.nombre}
              onChange={e => setNewUser({ ...newUser, nombre: e.target.value })} />
            <input className="login-input" placeholder="Nombre de usuario" value={newUser.username}
              autoCapitalize="none"
              onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
            <div style={{ position: "relative" }}>
              <input
                className="login-input"
                type={showPass ? "text" : "password"}
                placeholder="Contraseña (mín. 8 caracteres)"
                style={{ paddingRight: 44 }}
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
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
            <button className="admin-btn" type="submit" disabled={!newUser.username || !newUser.password}>
              Crear usuario
            </button>
          </form>
          {userMsg && <div className={`admin-msg ${userMsg.ok ? "ok" : "err"}`}>{userMsg.text}</div>}
        </div>
      )}
    </div>
  );
}
