import { createContext, useContext, useState } from "react";
const AuthContext = createContext();
export function AuthProvider({ children }) {
  // Al iniciar, intenta restaurar el usuario guardado (antes solo se guardaba el token,
  // lo que hacía que el role se perdiera al recargar la página)
  const [user, setUser] = useState(() => {
    const usuarioGuardado = localStorage.getItem("user");
    return usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  });
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem("token", tokenData);
    localStorage.setItem("user", JSON.stringify(userData)); // Persistimos el usuario completo (incluye role)
  };
  const logout = () => { 
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };
  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext); 
}