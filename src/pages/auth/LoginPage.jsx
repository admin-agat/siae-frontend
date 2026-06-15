import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await api.post("/login", { email, password });
            login(res.data.user, res.data.token);
            navigate("/dashboard");
        } catch (err) {
            setError("Credenciales incorrectas. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0F6E56" }}>
            <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">

                {/* Ícono */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0F6E56" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3C7 3 3 7.5 3 12c0 4 2.5 7.5 6 9 .5-2 1-4 3-6-2 1-4 1-5 0 1-3 4-5 7-5s6 2 7 5c-1 1-3 1-5 0 2 2 2.5 4 3 6 3.5-1.5 6-5 6-9 0-4.5-4-9-9-9z" />
                        </svg>
                    </div>
                </div>

                {/* Título */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">AGAT · SIAE</h1>
                    <p className="text-gray-500 text-sm mt-1">Sistema Integral AGAT-ECUAGREEN</p>
                </div>

                {/* Formulario */}
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Correo electrónico</label>
                        <input type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@agat-ecuagreen.com"
                            className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] text-gray-800"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-600">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] text-gray-800"
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-3 rounded-xl text-white font-semibold text-base hover:opacity-90 transition disabled:opacity-50"
                        style={{ backgroundColor: "#0F6E56" }}
                    >
                        {loading ? "Ingresando..." : "Ingresar al sistema"}
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    Sistema de gestión integral · AGAT-ECUAGREEN S.A.<br />
                    Versión 1.0 — Junio 2026
                </p>

            </div>
        </div>
    );
}