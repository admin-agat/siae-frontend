// PurchaseOrdersPage.jsx
// Listado de Órdenes de Compra (OC). Cada fila muestra el código generado,
// proveedor, bodega destino, fecha/semana y estado (PENDIENTE hasta que se
// reciba vía InventoryMovementFormPage). Desde aquí se navega a crear una
// nueva OC o a ver el detalle de una existente.
import { useState, useEffect, useMemo } from 'react';
import { Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPurchaseOrders } from '../../api/purchaseOrders';

const PAGE_SIZE = 10;

const ESTADO_ESTILOS = {
    PENDIENTE: 'bg-amber-100 text-amber-800',
    RECIBIDA: 'bg-green-100 text-green-800',
    CANCELADA: 'bg-red-100 text-red-800',
};

export default function PurchaseOrdersPage() {
    const navigate = useNavigate();

    const [ordenes, setOrdenes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('TODOS');
    const [pagina, setPagina] = useState(1);

    useEffect(() => {
        cargarOrdenes();
    }, []);

    const cargarOrdenes = async () => {
        setCargando(true);
        setError('');
        try {
            const res = await getPurchaseOrders();
            setOrdenes(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR ÓRDENES DE COMPRA:', err);
            setError('NO SE PUDIERON CARGAR LAS ÓRDENES DE COMPRA');
        } finally {
            setCargando(false);
        }
    };

    const ordenesFiltradas = useMemo(() => {
        return ordenes.filter((o) => {
            const coincideEstado = filtroEstado === 'TODOS' || o.status === filtroEstado;
            const texto = busqueda.trim().toUpperCase();
            const coincideTexto =
                !texto ||
                o.code?.toUpperCase().includes(texto) ||
                o.third_party?.name?.toUpperCase().includes(texto) ||
                o.warehouse?.name?.toUpperCase().includes(texto);
            return coincideEstado && coincideTexto;
        });
    }, [ordenes, busqueda, filtroEstado]);

    const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / PAGE_SIZE));
    const ordenesPagina = ordenesFiltradas.slice(
        (pagina - 1) * PAGE_SIZE,
        pagina * PAGE_SIZE
    );

    useEffect(() => {
        setPagina(1);
    }, [busqueda, filtroEstado]);

    const formatearFecha = (fechaISO) => {
        if (!fechaISO) return '—';
        const [anio, mes, dia] = fechaISO.split('-');
        return `${dia}/${mes}/${anio}`;
    };

    return (
        <div className="max-w-full mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Órdenes de Compra</h1>
                    <p className="text-gray-500 text-sm">
                        Pedidos a proveedores, pendientes o ya recibidos en bodega
                    </p>
                </div>
                <button
                    onClick={() => navigate('/ordenes-compra/nueva')}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45]"
                >
                    <Plus size={16} />
                    Nueva Orden de Compra
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-4 items-center">
                <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                    placeholder="BUSCAR POR CÓDIGO, PROVEEDOR O BODEGA..."
                    className="flex-1 min-w-[240px] bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none uppercase"
                />
                <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                >
                    <option value="TODOS">Todos los estados</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="RECIBIDA">Recibida</option>
                    <option value="CANCELADA">Cancelada</option>
                </select>
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#0F6E56] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Código</th>
                            <th className="text-left px-4 py-3">Proveedor</th>
                            <th className="text-left px-4 py-3">Bodega destino</th>
                            <th className="text-left px-4 py-3">Fecha</th>
                            <th className="text-center px-4 py-3 w-20">Semana</th>
                            <th className="text-center px-4 py-3 w-32">Estado</th>
                            <th className="text-center px-4 py-3 w-16"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan={7} className="text-center px-4 py-8 text-gray-400">
                                    Cargando órdenes de compra...
                                </td>
                            </tr>
                        ) : ordenesPagina.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center px-4 py-8 text-gray-400">
                                    No hay órdenes de compra que coincidan con el filtro
                                </td>
                            </tr>
                        ) : (
                            ordenesPagina.map((orden, index) => (
                                <tr
                                    key={orden.id}
                                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                                >
                                    <td className="px-4 py-3 font-semibold text-gray-800">{orden.code}</td>
                                    <td className="px-4 py-3">{orden.third_party?.name || '—'}</td>
                                    <td className="px-4 py-3">{orden.warehouse?.name || '—'}</td>
                                    <td className="px-4 py-3">{formatearFecha(orden.date)}</td>
                                    <td className="px-4 py-3 text-center">{orden.week ?? '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                ESTADO_ESTILOS[orden.status] || 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {orden.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => navigate(`/ordenes-compra/${orden.id}`)}
                                            className="text-gray-500 hover:text-[#0F6E56]"
                                            title="Ver detalle"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {totalPaginas > 1 && (
                    <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50 text-sm">
                        <span className="text-gray-500">
                            Página {pagina} de {totalPaginas} — {ordenesFiltradas.length} orden(es)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                                disabled={pagina === 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                                disabled={pagina === totalPaginas}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}