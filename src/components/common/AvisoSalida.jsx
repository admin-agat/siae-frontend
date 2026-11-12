// Aviso de "¿Seguro que deseas salir?" cuando una pantalla tiene cambios sin guardar.
// Ubicación: src/components/common/AvisoSalida.jsx
//
// 11/11/2026 (pedido de Peter): antes solo preguntaba el botón Volver/Cancelar de cada pantalla; si se hacía clic
// en otra opción del menú, se recargaba o se usaba "atrás" del navegador, lo escrito se perdía sin aviso.
// El sistema usa BrowserRouter (sin useBlocker), así que se cubre así:
//   - Menú lateral, cambiar contraseña y cerrar sesión: pasan por irA() → si hay cambios, el diálogo estándar.
//   - Recargar o cerrar la pestaña: 'beforeunload' (el navegador muestra su propio aviso; su texto no se cambia).
//   - "Atrás" del navegador: se agrega una entrada repetida al historial mientras hay cambios; al volver se
//     queda en la pantalla y pregunta. "Salir sin guardar" vuelve de verdad a la página anterior.
//
// Uso en una pantalla:   useAvisoSalida(hayCambios);          (hayCambios = booleano de esa pantalla)
// Uso para navegar:      const irA = useIrA();  irA(() => navigate('/ruta'));
// Las navegaciones propias de la pantalla (ej. después de guardar) usan navigate() directo y no preguntan.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import DialogoConfirmacion from './DialogoConfirmacion';

const Contexto = createContext(null);

export function ProveedorAvisoSalida({ children }) {
    const cambios = useRef(false);   // la pantalla activa tiene cambios sin guardar
    const historialExtra = useRef(false); // ya se agregó la entrada repetida al historial
    const [pendiente, setPendiente] = useState(null); // acción a ejecutar si confirma "Salir sin guardar"

    // La entrada repetida se agrega una sola vez por pantalla (no en cada cambio), para no llenar el historial
    const marcar = useCallback((hay) => {
        cambios.current = hay;
        if (hay && !historialExtra.current) {
            window.history.pushState(window.history.state, '', window.location.href);
            historialExtra.current = true;
        }
    }, []);

    const soltar = useCallback(() => {
        cambios.current = false;
        historialExtra.current = false;
    }, []);

    const irA = useCallback((accion) => {
        if (!cambios.current) { accion(); return; }
        setPendiente(() => accion);
    }, []);

    useEffect(() => {
        const alRecargar = (e) => {
            if (!cambios.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        // "Atrás": el navegador ya volvió a la entrada repetida (misma dirección); se vuelve a poner y se pregunta
        const alVolver = () => {
            if (!cambios.current) return;
            window.history.pushState(window.history.state, '', window.location.href);
            setPendiente(() => () => window.history.go(-2));
        };
        window.addEventListener('beforeunload', alRecargar);
        window.addEventListener('popstate', alVolver);
        // 11/11/2026: src/api/axios.js lo dispara antes de mandar al login (sesión vencida) o a cambiar la clave
        const alSoltar = () => { cambios.current = false; };
        window.addEventListener('siae:soltar-aviso', alSoltar);
        return () => {
            window.removeEventListener('beforeunload', alRecargar);
            window.removeEventListener('popstate', alVolver);
            window.removeEventListener('siae:soltar-aviso', alSoltar);
        };
    }, []);

    // valor estable: si cambiara en cada dibujo, las pantallas volverían a registrarse y se repetiría la entrada del historial
    const valor = useMemo(() => ({ marcar, soltar, irA }), [marcar, soltar, irA]);

    const salir = () => {
        const accion = pendiente;
        cambios.current = false;
        historialExtra.current = false;
        setPendiente(null);
        accion();
    };

    return (
        <Contexto.Provider value={valor}>
            {children}
            {pendiente && (
                <DialogoConfirmacion
                    titulo="¿Seguro que deseas salir?"
                    textoAceptar="Salir sin guardar"
                    textoCancelar="Seguir editando"
                    onCancelar={() => setPendiente(null)}
                    onAceptar={salir}
                >
                    Tienes cambios sin guardar que se perderán.
                </DialogoConfirmacion>
            )}
        </Contexto.Provider>
    );
}

/** La pantalla avisa si tiene cambios sin guardar; al salir de ella el aviso se apaga solo. */
export function useAvisoSalida(hayCambios) {
    const ctx = useContext(Contexto);
    useEffect(() => {
        ctx?.marcar(Boolean(hayCambios));
    }, [ctx, hayCambios]);
    useEffect(() => () => ctx?.soltar(), [ctx]);
}

/** Navegar preguntando antes si la pantalla activa tiene cambios sin guardar. */
export function useIrA() {
    const ctx = useContext(Contexto);
    return ctx ? ctx.irA : (accion) => accion();
}

/** Apaga el aviso sin preguntar (cierre de sesión por inactividad: la sesión ya terminó). */
export function useSoltarAviso() {
    const ctx = useContext(Contexto);
    return ctx ? ctx.soltar : () => {};
}
