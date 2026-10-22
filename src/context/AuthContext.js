import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token             = localStorage.getItem("dp_token");
    const role              = localStorage.getItem("dp_role");
    const nombre            = localStorage.getItem("dp_nombre");
    const mustChangePassword = localStorage.getItem("dp_must_change") === "true";
    return token ? { token, role, nombre, mustChangePassword } : null;
  });

  function login(token, role, nombre, mustChangePassword) {
    localStorage.setItem("dp_token",      token);
    localStorage.setItem("dp_role",       role);
    localStorage.setItem("dp_nombre",     nombre);
    localStorage.setItem("dp_must_change", String(mustChangePassword ?? false));
    setAuth({ token, role, nombre, mustChangePassword: mustChangePassword ?? false });
  }

  function logout() {
    localStorage.removeItem("dp_token");
    localStorage.removeItem("dp_role");
    localStorage.removeItem("dp_nombre");
    localStorage.removeItem("dp_must_change");
    setAuth(null);
  }

  function clearMustChange() {
    localStorage.setItem("dp_must_change", "false");
    setAuth(prev => prev ? { ...prev, mustChangePassword: false } : null);
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout, clearMustChange }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
