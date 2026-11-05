// DispatchPendingPage.jsx — 05/11/2026: bandeja "Por despachar" del bodeguero.
// Lista las compras de fruta que registró Comercial (cupo + marca + bodega de retiro) y sin liquidar,
// con lo que falta entregar según la receta de la marca:
//   PENDIENTE (no retiró nada) · PARCIAL (faltan materiales) · COMPLETO · SIN RECETA (la marca no tiene receta)
// "Despachar" abre Despacho de materiales con bodega, productor y cupo ya elegidos.
// El backend filtra las bodegas de cada usuario (BODEGUERO: la suya; las compras sin bodega fija las ven todos).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, RefreshCw } from 'lucide-react';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import { getPorDespachar } from '../../api/materialDispatch';

const ESTADOS = {
    PENDIENTE: { texto: 'PENDIENTE', clase: 'bg-amber-100 text-amber-800' },
    PARCIAL: { texto: 'PARCIAL', clase: 'bg-blue-100 text-blue-700' },
    COMPLETO: { texto: 'COMPLETO', clase: 'bg-green-100 text-green-700' },
    SIN_RECETA: { texto: 'SIN RECETA', clase: 'bg-gray-200 text-gray-700' },
};

// Filtros de arriba: "Por despachar" = lo que aún tiene algo que entregar
const FILTROS = [
    { clave: 'POR_DESPACHAR', etiqueta: 'POR DESPACHAR', pasa: (f) => f.estado === 'PENDIENTE' || f.estado === 'PARCIAL' },
    { clave: 'COMPLETOS', etiqueta: 'COMPLETOS', pasa: (f) => f.estado === 'COMPLETO' },
    { clave: 'TODOS', etiqueta: 'TODOS', pasa: () => true },
];

const fechaVer = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');
const cajas = (n) => Number(n || 0).toLocaleString('es-EC');

function Resumen({ titulo, valor, detalle, clase }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{titulo}</p>
            <p className={`text-2xl font-bold ${clase}`}>{valor}</p>
            <p className="text-xs text-gray-500">{detalle}</p>
        </div>
    );
}

export default function DispatchPendingPage() {
    const navigate = useNavigate();
    const [filas, setFilas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [filtro, setFiltro] = useState('POR_DESPACHAR');

    const pedir = () =>
        getPorDespachar()
            .then((datos) => setFilas(Array.isArray(datos) ? datos : []))
            .catch(() => setError('No se pudo cargar la bandeja. Intenta de nuevo con "Actualizar".'))
            .finally(() => setCargando(false));

    const cargar = () => {
        setCargando(true);
        setError('');
        pedir();
    };

    useEffect(() => {
        pedir();
    }, []);

    const despachar = (f) =>
        navigate('/despacho-materiales', {
            state: {
                warehouse_id: f.warehouse_id,
                third_party_id: f.third_party_id,
                producer_quota_id: f.producer_quota_id,
                brand_code: f.brand_code,
            },
        });

    const porDespachar = filas.filter(FILTROS[0].pasa);
    const pendientes = filas.filter((f) => f.estado === 'PENDIENTE');
    const parciales = filas.filter((f) => f.estado === 'PARCIAL');
    const completos = filas.filter((f) => f.estado === 'COMPLETO');
    const visibles = filas.filter(FILTROS.find((x) => x.clave === filtro).pasa);

    return (
        <div className="p-6 space-y-6">
            <EncabezadoPagina
                titulo="Por despachar"
                subtitulo="Compras de fruta de Comercial y los materiales que falta entregar a cada productor"
            >
                <button
                    type="button"
                    onClick={cargar}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover transition"
                >
                    <RefreshCw size={16} /> Actualizar
                </button>
            </EncabezadoPagina>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Resumen titulo="POR DESPACHAR" valor={porDespachar.length} detalle={`${cajas(porDespachar.reduce((s, f) => s + f.cajas, 0))} cajas`} clase="text-gray-800" />
                <Resumen titulo="SIN RETIRAR NADA" valor={pendientes.length} detalle="Pendientes" clase="text-amber-700" />
                <Resumen titulo="RETIRO A MEDIAS" valor={parciales.length} detalle="Faltan materiales" clase="text-blue-700" />
                <Resumen titulo="COMPLETOS" valor={completos.length} detalle="Sin liquidar todavía" clase="text-green-700" />
            </div>

            {error && <p className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</p>}

            <div className="flex justify-end">
                <div className="flex gap-1 bg-white border rounded-lg p-1">
                    {FILTROS.map((f) => (
                        <button
                            key={f.clave}
                            type="button"
                            onClick={() => setFiltro(f.clave)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                                filtro === f.clave ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {f.etiqueta}
                        </button>
                    ))}
                </div>
            </div>

            <TablaEstandar
                datos={visibles}
                cargando={cargando}
                nombreRegistros="compras"
                mostrarPestanas={false}
                placeholderBusqueda="Buscar por productor, finca, marca o bodega..."
                textosBusqueda={(f) => [f.producer_name, ...(f.farms || []), f.brand_name, f.warehouse_name, `SEMANA ${f.week}`]}
                getId={(f) => `${f.producer_quota_id}|${f.brand_code}|${f.warehouse_id ?? ''}`}
                porPagina={15}
                columnas={[
                    { titulo: 'Semana', render: (f) => `${f.week} / ${f.year}`, className: 'whitespace-nowrap' },
                    {
                        titulo: 'Productor',
                        render: (f) => (
                            <div>
                                <p className="font-medium">{f.producer_name}</p>
                                {f.farms?.length > 0 && <p className="text-xs text-gray-500">{f.farms.join(', ')}</p>}
                            </div>
                        ),
                    },
                    { titulo: 'Marca', render: (f) => f.brand_name },
                    { titulo: 'Cajas', render: (f) => cajas(f.cajas), className: 'text-right font-semibold' },
                    { titulo: 'Bodega de retiro', render: (f) => f.warehouse_name || <span className="text-gray-400">CUALQUIERA</span> },
                    {
                        titulo: 'Estado',
                        render: (f) => {
                            const e = ESTADOS[f.estado] || ESTADOS.PENDIENTE;
                            return (
                                <div className="space-y-1">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${e.clase}`}>{e.texto}</span>
                                    {f.estado === 'PARCIAL' && (
                                        <p className="text-xs text-gray-500">{f.avance} % · faltan {f.materiales_faltan} de {f.materiales_total} materiales</p>
                                    )}
                                </div>
                            );
                        },
                    },
                    {
                        titulo: 'Último retiro',
                        render: (f) => (f.retiros ? `${fechaVer(f.ultimo_retiro)} (${f.retiros})` : '—'),
                        className: 'whitespace-nowrap',
                    },
                    {
                        titulo: 'Acciones',
                        render: (f) =>
                            f.estado === 'PENDIENTE' || f.estado === 'PARCIAL' ? (
                                <button
                                    type="button"
                                    onClick={() => despachar(f)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover transition"
                                >
                                    <Truck size={14} /> Despachar
                                </button>
                            ) : f.estado === 'SIN_RECETA' ? (
                                <span className="text-xs text-gray-500">La marca no tiene receta</span>
                            ) : null,
                    },
                ]}
            />
        </div>
    );
}
