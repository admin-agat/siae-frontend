// Campanita de notificaciones en la barra de arriba (12/11/2026, diseño aprobado por Peter).
// Ubicación: src/components/common/Campanita.jsx
//
// Primer aviso: ENVIO_BODEGA (Comercial envió a retirar una compra). Lo ven el bodeguero de esa bodega y los
// coordinadores de inventario. Cuenta los no leídos cada minuto; al abrir se ven los últimos 30.
// Clic en un aviso: queda leído y abre Despacho de materiales con bodega, vendedor, cupo y marca ya elegidos
// (lo mismo que "Despachar" en Por despachar).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { getNotificaciones, getNotificacionesCuenta, marcarLeida, marcarTodasLeidas } from '../../api/notifications';
import { useIrA } from './AvisoSalida';

const CADA_MS = 60000;

const hace = (iso) => {
    if (!iso) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function Campanita() {
    const navigate = useNavigate();
    const irA = useIrA();
    const [cuenta, setCuenta] = useState(0);
    const [abierta, setAbierta] = useState(false);
    const [avisos, setAvisos] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(false);
    const caja = useRef(null);
    const boton = useRef(null);

    const contar = () => getNotificacionesCuenta().then((d) => setCuenta(Number(d?.count) || 0)).catch(() => {});

    useEffect(() => {
        contar();
        const t = setInterval(contar, CADA_MS);
        return () => clearInterval(t);
    }, []);

    // Se cierra al hacer clic fuera o con Escape
    useEffect(() => {
        if (!abierta) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierta(false); };
        const tecla = (e) => { if (e.key === 'Escape') { setAbierta(false); boton.current?.focus(); } };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierta]);

    const abrir = () => {
        if (abierta) { setAbierta(false); return; }
        setAbierta(true);
        setCargando(true);
        setError(false);
        getNotificaciones().then((d) => setAvisos(Array.isArray(d) ? d : [])).catch(() => { setAvisos([]); setError(true); })
            .finally(() => setCargando(false));
        contar();
    };

    const elegir = (a) => {
        if (!a.read_at) {
            marcarLeida(a.id).then(contar).catch(() => {});
            setAvisos((lista) => lista.map((x) => (x.id === a.id ? { ...x, read_at: new Date().toISOString() } : x)));
        }
        setAbierta(false);
        if (a.link) irA(() => navigate(a.link, { state: a.data || null }));
    };

    const leerTodas = () => {
        marcarTodasLeidas().then(contar).catch(() => {});
        setAvisos((lista) => lista.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
        setCuenta(0);
    };

    return (
        <div ref={caja} className="relative shrink-0">
            <button
                ref={boton}
                type="button"
                onClick={abrir}
                title={cuenta ? `${cuenta} avisos sin leer` : 'Notificaciones'}
                aria-label={cuenta ? `Notificaciones: ${cuenta} sin leer` : 'Notificaciones'}
                aria-expanded={abierta}
                className="relative flex items-center text-white border border-white/50 rounded-lg px-2.5 py-1.5 hover:bg-white hover:text-primario transition"
            >
                <Bell size={15} />
                {cuenta > 0 && (
                    <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-red-600 text-white rounded-full px-1.5 min-w-[18px] h-[18px] leading-[18px] text-center">
                        {cuenta > 99 ? '99+' : cuenta}
                    </span>
                )}
            </button>

            {abierta && (
                <div role="dialog" aria-label="Notificaciones" className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] bg-white rounded-xl shadow-lg border border-gray-200 z-50 text-gray-800">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                        <p className="text-sm font-semibold">Notificaciones</p>
                        {avisos.some((a) => !a.read_at) && (
                            <button type="button" onClick={leerTodas} className="flex items-center gap-1 text-xs font-semibold text-primario hover:underline">
                                <CheckCheck size={14} /> Marcar todas como leídas
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-auto scroll-ancho">
                        {cargando && <p className="px-4 py-6 text-sm text-gray-500 text-center">Cargando...</p>}
                        {!cargando && error && <p className="px-4 py-6 text-sm text-red-600 text-center">NO SE PUDIERON CARGAR LAS NOTIFICACIONES. INTENTA DE NUEVO.</p>}
                        {!cargando && !error && avisos.length === 0 && <p className="px-4 py-6 text-sm text-gray-500 text-center">No tienes notificaciones.</p>}
                        {!cargando && avisos.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => elegir(a)}
                                className={`w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${a.read_at ? '' : 'bg-primario-claro'}`}
                            >
                                <p className={`text-xs ${a.read_at ? 'font-medium text-gray-600' : 'font-bold text-primario'}`}>
                                    {!a.read_at && <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1.5 align-middle" aria-hidden="true" />}
                                    {a.title}
                                </p>
                                <p className="text-xs text-gray-700 mt-0.5">{a.body}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    {a.created_by ? `Envió: ${a.created_by} · ` : ''}{hace(a.created_at)}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
