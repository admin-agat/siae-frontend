import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { inicioDe } from "../../routes/menu";
import CampoClave from "../../components/common/CampoClave";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // Si se llega aquí porque la sesión venció (axios.js redirige con ?expirada=1), se avisa.
    // 05/11/2026: ?inactividad=1 = la cerró el aviso de inactividad (Layout → AvisoInactividad)
    const [error, setError] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has("inactividad")) return "Tu sesión se cerró por inactividad (60 minutos sin usar el sistema). Vuelve a iniciar sesión.";
        return params.has("expirada") ? "Tu sesión expiró. Vuelve a iniciar sesión." : "";
    });
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await api.post("/login", { email, password });
            login(res.data.user, res.data.token);
            // 30/10/2026: primera pantalla que tiene permitida. 09/11/2026: antes, cambiar la contraseña si le toca
            navigate(res.data.user.cambiar_clave ? "/cambiar-clave" : inicioDe(res.data.user));
        } catch (err) {
            // 429 = demasiados intentos (el backend permite 5 por minuto)
            // 29/10/2026: un usuario desactivado ve el motivo (lo manda el backend)
            const mensaje = err.response?.data?.errors?.email?.[0] || "";
            setError(err.response?.status === 429
                ? "Demasiados intentos. Espera un minuto e inténtalo de nuevo."
                : mensaje.includes("desactivado") ? mensaje : "Credenciales incorrectas. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-primario">
            <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">

                {/* 05/11/2026: se quitó el selector de idioma (no hacía nada todavía) */}

                {/* Ícono */}
                <div className="flex justify-center mb-4">
                    {/* 06/11/2026: ícono del sistema (hojas verdes) */}
                    <img src="/icono-192.png" alt="AGAT · SIAE" className="w-20 h-20" />
                </div>

                {/* Título */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">AGAT · SIAE</h1>
                    <p className="text-gray-500 text-sm mt-1">Sistema Integral AGAT-ECUAGREEN</p>
                </div>

                {/* Formulario */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="login-usuario" className="text-sm font-medium text-gray-600">Usuario</label>
                        <input id="login-usuario" type="text" value={email} autoComplete="username" autoFocus
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Tu correo o usuario"
                            className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primario text-gray-800"
                        />
                    </div>

                    <div>
                        <label htmlFor="login-clave" className="text-sm font-medium text-gray-600">Contraseña</label>
                        {/* 09/11/2026: con ojo para ver lo que se escribe */}
                        <CampoClave
                            id="login-clave"
                            value={password}
                            autoComplete="current-password"
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Tu contraseña"
                            className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primario text-gray-800"
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl text-white font-semibold text-base bg-primario hover:bg-primario-hover transition disabled:opacity-50"
                    >
                        {loading ? "Ingresando..." : "Ingresar al sistema"}
                    </button>
                </form>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    Sistema de gestión integral · AGAT-ECUAGREEN S.A.<br />
                    Versión 1.0 — Junio 2026
                </p>

            </div>
        </div>
    );
}