import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { inicioDe } from "../../routes/menu";
import CampoClave from "../../components/common/CampoClave";

// 09/11/2026 — LOPDP: cambio de contraseña.
// Obligatorio al primer ingreso (o cuando el ADMIN le puso una nueva) y cada 3 meses: mientras tanto
// es la única pantalla que se ve (el backend responde 403 CAMBIAR_CLAVE a todo lo demás).
// También se abre desde "Cambiar contraseña" en la barra azul, y ahí se puede volver.
const AVISOS = {
    PRIMER_INGRESO: "Por seguridad, cambia la contraseña que te dio el administrador antes de usar el sistema. Solo tú la sabrás.",
    VENCIDA: "Tu contraseña cumplió 3 meses. Por seguridad, cámbiala para seguir usando el sistema.",
};

const inputClass = "w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primario text-gray-800";

export default function CambiarClavePage() {
    const { user, actualizarUsuario, logout } = useAuth();
    const navigate = useNavigate();
    const obligatorio = user?.cambiar_clave;

    const [actual, setActual] = useState("");
    const [nueva, setNueva] = useState("");
    const [repetir, setRepetir] = useState("");
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);

    // Requisitos a la vista mientras escribe (el backend valida lo mismo)
    const reglas = [
        { texto: "Al menos 8 caracteres", ok: nueva.length >= 8 },
        { texto: "Letras y números", ok: /\p{L}/u.test(nueva) && /\p{N}/u.test(nueva) },
        { texto: "Distinta de la actual", ok: nueva !== "" && nueva !== actual },
        { texto: "La repetición coincide", ok: repetir !== "" && nueva === repetir },
    ];

    const guardar = async (e) => {
        e.preventDefault();
        setError("");
        if (!reglas.every((r) => r.ok)) {
            setError("La contraseña nueva no cumple todos los requisitos.");
            return;
        }
        setGuardando(true);
        try {
            const res = await api.put("/me/password", { actual, nueva, nueva_confirmation: repetir });
            actualizarUsuario(res.data);
            navigate(inicioDe(res.data), { replace: true, state: { claveCambiada: true } });
        } catch (err) {
            const errores = err.response?.data?.errors;
            setError(errores ? Object.values(errores).flat()[0] : err.response?.data?.message || "No se pudo cambiar la contraseña.");
        } finally {
            setGuardando(false);
        }
    };

    const salir = () => {
        logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-primario px-4 py-8">
            <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-md">
                <div className="flex justify-center mb-4">
                    <img src="/icono-192.png" alt="AGAT · SIAE" className="w-16 h-16" />
                </div>
                <div className="text-center mb-5">
                    <h1 className="text-2xl font-bold text-gray-800">Cambia tu contraseña</h1>
                    <p className="text-gray-500 text-sm mt-1">{user?.name}</p>
                </div>

                {obligatorio && (
                    <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-4">
                        {AVISOS[obligatorio] || AVISOS.PRIMER_INGRESO}
                    </p>
                )}

                <form onSubmit={guardar} className="space-y-4">
                    {/* Usuario oculto: el navegador lo usa para guardar la contraseña nueva en el lugar correcto */}
                    <input type="text" name="username" value={user?.email || ""} autoComplete="username" readOnly hidden />
                    <div>
                        <label htmlFor="clave-actual" className="text-sm font-medium text-gray-600">Contraseña actual</label>
                        {/* 09/11/2026: cada campo con su ojo (antes una casilla "Mostrar contraseñas") */}
                        <CampoClave id="clave-actual" value={actual} autoComplete="current-password" autoFocus
                            onChange={(e) => setActual(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="clave-nueva" className="text-sm font-medium text-gray-600">Contraseña nueva</label>
                        <CampoClave id="clave-nueva" value={nueva} autoComplete="new-password"
                            onChange={(e) => setNueva(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="clave-repetir" className="text-sm font-medium text-gray-600">Repite la contraseña nueva</label>
                        <CampoClave id="clave-repetir" value={repetir} autoComplete="new-password"
                            onChange={(e) => setRepetir(e.target.value)} className={inputClass} />
                    </div>

                    <ul className="text-sm space-y-1">
                        {reglas.map((r) => (
                            <li key={r.texto} className={r.ok ? "text-green-700" : "text-gray-400"}>
                                {r.ok ? "✓" : "○"} {r.texto}
                            </li>
                        ))}
                    </ul>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <button type="submit" disabled={guardando}
                        className="w-full py-3 rounded-xl text-white font-semibold text-base bg-primario hover:bg-primario-hover transition disabled:opacity-50">
                        {guardando ? "Guardando..." : "Cambiar contraseña"}
                    </button>
                    {obligatorio ? (
                        <button type="button" onClick={salir} className="w-full text-sm text-gray-500 hover:text-gray-800">
                            Cerrar sesión
                        </button>
                    ) : (
                        <button type="button" onClick={() => navigate(-1)} className="w-full text-sm text-gray-500 hover:text-gray-800">
                            Volver
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
