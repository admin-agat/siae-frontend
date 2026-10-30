import { createContext, useContext, useState } from "react";
import api from "../api/axios";
const AuthContext = createContext();

// Lee el usuario guardado. 28/10/2026: protegido con try/catch — si localStorage tenía
// un valor dañado, JSON.parse lanzaba un error y TODA la app quedaba en blanco.
const leerUsuarioGuardado = () => {
  try {
    const usuarioGuardado = localStorage.getItem("user");
    return usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

export function AuthProvider({ children }) {
  // Al iniciar, intenta restaurar el usuario guardado (antes solo se guardaba el token,
  // lo que hacía que el role se perdiera al recargar la página)
  const [user, setUser] = useState(leerUsuarioGuardado);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem("token", tokenData);
    localStorage.setItem("user", JSON.stringify(userData)); // Persistimos el usuario completo (incluye role)
  };
  // 30/10/2026: refresca los datos del usuario (pantallas que el ADMIN le dio o quitó) sin volver a entrar
  const actualizarUsuario = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };
  const logout = () => {
    // 28/10/2026: se avisa al backend para que BORRE el token. Antes solo se borraba en el
    // navegador y el token seguía siendo válido en el servidor (había 21 tokens vivos).
    // No se espera la respuesta: si falla (sin red, ya vencido) igual se cierra la sesión local.
    api.post("/logout").catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };
  return (
    <AuthContext.Provider value={{ user, token, login, logout, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
