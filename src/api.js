const BASE_URL = process.env.REACT_APP_API_URL || "https://dataport-backend-production.up.railway.app";

function getToken() {
  return localStorage.getItem("dp_token");
}

async function _get(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const token = getToken();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    clearTimeout(timer);
    if (res.status === 401) { const e = new Error("401"); e.status = 401; throw e; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Error ${res.status}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function _post(endpoint, body, contentType = "application/json") {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body: contentType === "application/json" ? JSON.stringify(body) : body,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.detail || `Error ${res.status}`);
  }
  return res.json();
}

// Auth
export async function loginAPI(username, password) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const form = new URLSearchParams({ username, password });
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Credenciales incorrectas");
    }
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("El servidor tardó demasiado. Intentá nuevamente.");
    throw e;
  }
}

// Admin: Excel
export async function uploadExcel(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Error al subir archivo");
  }
  return res.json();
}

// Admin: Usuarios
export function getUsuarios()                              { return _get("/usuarios"); }
export function crearUsuario(username, password, nombre)   { return _post("/usuarios", { username, password, nombre }); }
export async function eliminarUsuario(id) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/usuarios/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al eliminar");
  return res.json();
}

// Dashboard
export function fetchDashboard()      { return _get("/dashboard"); }
export function fetchResumen()        { return _get("/resumen"); }
export function fetchBuques()         { return _get("/buques"); }
export function fetchCargas()         { return _get("/cargas"); }
export function fetchComparativo()    { return _get("/comparativo"); }
export function fetchPermisionarios() { return _get("/permisionarios"); }
