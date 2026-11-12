import axios from "axios";

// En local usa Laravel local, en producción usa Render automáticamente
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api",
  headers: { Accept: "application/json" },
});

// Agrega el token automáticamente en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 28/10/2026: respuestas de error comunes a todo el sistema.
//  - 401: la sesión venció (el token dura 12 h, ver config/sanctum.php del backend) o fue
//    cerrada. Antes la pantalla quedaba "colgada" mostrando errores; ahora se limpia la
//    sesión y se vuelve al login. No aplica al propio /login (credenciales malas = 422).
//  - 429: demasiadas peticiones o intentos de login (throttle del backend).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const esLogin = error.config?.url?.includes("/login");

    if (status === 401 && !esLogin) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.dispatchEvent(new Event("siae:soltar-aviso")); // 11/11/2026: sesión vencida: sin el aviso de "¿salir del sitio?"
        window.location.assign("/login?expirada=1");
      }
    }

    // 09/11/2026: debe cambiar la contraseña (primer ingreso o venció a los 3 meses): se marca en el
    // usuario guardado y se va a "Cambia tu contraseña" (el backend no deja usar nada más)
    if (status === 403 && error.response?.data?.codigo === "CAMBIAR_CLAVE") {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user) localStorage.setItem("user", JSON.stringify({ ...user, cambiar_clave: error.response.data.motivo }));
      } catch {
        // usuario guardado dañado: la pantalla igual lo pide al backend (/me)
      }
      if (window.location.pathname !== "/cambiar-clave") {
        window.dispatchEvent(new Event("siae:soltar-aviso")); // 11/11/2026: debe cambiar la clave: sin el aviso de "¿salir del sitio?"
        window.location.assign("/cambiar-clave");
      }
    }

    if (status === 429 && error.response?.data) {
      error.response.data.message = "DEMASIADOS INTENTOS. ESPERA UN MINUTO E INTÉNTALO DE NUEVO.";
    }

    return Promise.reject(error);
  }
);

export default api;
