// InventoryStockPage.jsx
// Vista general de stock: todas las bodegas con sus insumos y existencias actuales.
// Cada bodega es un acordeón: clic en el encabezado para expandir/colapsar.
// NUEVO: columna "En Tránsito" muestra cantidades que vienen en camino por
// transferencias todavía PENDIENTE de confirmación (no cuentan como stock
// disponible hasta que el Coordinador las confirme).
import { useState, useEffect } from 'react';
import { Search, Warehouse, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { getGeneralStock } from '../../api/inventoryStock';

// 19/11/2026 (Peter): filas por página en la tabla de cada bodega
const POR_PAGINA = 10;

export default function InventoryStockPage() {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    // Guarda qué bodegas están expandidas: { "BODEGA SAN JUAN": true, ... }
    // Empieza vacío (todo colapsado) para que la vista general sea compacta.
    const [bodegasAbiertas, setBodegasAbiertas] = useState({});
    // 18/11/2026 (Peter): fila elegida en verde, como en las demás listas (clave bodega|insumo)
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);
    // 19/11/2026 (Peter): página actual de cada bodega: { "BODEGA SAN JUAN": 2, ... }
    const [paginas, setPaginas] = useState({});

    useEffect(() => {
        cargarStock();
    }, []);

    const cargarStock = async () => {
        try {
            setLoading(true);
            const res = await getGeneralStock();
            setStock(res.data);
        } catch (error) {
            console.error('Error cargando el stock general:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleBodega = (bodega) => {
        setBodegasAbiertas((prev) => ({
            ...prev,
            [bodega]: !prev[bodega],
        }));
    };

    const stockFiltrado = stock.filter(row =>
        `${row.warehouse_name} ${row.supply_name}`.toLowerCase().includes(busqueda.toLowerCase())
    );

    // Agrupamos las filas planas que devuelve el backend por bodega,
    // para mostrar una tabla por cada una.
    const porBodega = stockFiltrado.reduce((acc, row) => {
        if (!acc[row.warehouse_name]) acc[row.warehouse_name] = [];
        acc[row.warehouse_name].push(row);
        return acc;
    }, {});

    // Mientras el usuario busca algo, conviene expandir automáticamente
    // las bodegas que sí tienen resultados, para no obligarlo a abrir
    // cada una manualmente después de filtrar.
    const estaAbierta = (bodega) => {
        if (busqueda.trim() !== '') return true;
        return Boolean(bodegasAbiertas[bodega]);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Stock General</h1>
                    <p className="text-gray-500 text-sm">Existencias actuales por bodega</p>
                </div>
                <button
                    onClick={cargarStock}
                    className="flex items-center gap-2 bg-primario text-white px-4 py-2 rounded-lg hover:bg-primario-hover transition"
                >
                    Actualizar
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-6 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por bodega o insumo..."
                    className="outline-none w-full text-sm uppercase placeholder:normal-case"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                />
            </div>

            {loading ? (
                <p className="text-center text-gray-400 py-10">Cargando existencias...</p>
            ) : Object.keys(porBodega).length === 0 ? (
                <p className="text-center text-gray-400 py-10">No hay existencias registradas todavía</p>
            ) : (
                <div className="space-y-4">
                    {Object.entries(porBodega).map(([bodega, filas]) => {
                        const abierta = estaAbierta(bodega);
                        // 19/11/2026 (Peter): paginación local de 10 por bodega (si el filtro deja menos páginas, se usa la última)
                        const totalPaginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
                        const paginaActual = Math.min(paginas[bodega] || 1, totalPaginas);
                        const inicio = (paginaActual - 1) * POR_PAGINA;
                        const filasPagina = filas.slice(inicio, inicio + POR_PAGINA);

                        return (
                            <div key={bodega} className="bg-white rounded-xl shadow overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleBodega(bodega)}
                                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b hover:bg-gray-100 transition text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Warehouse size={16} className="text-primario" />
                                        <h2 className="font-semibold text-gray-800">{bodega}</h2>
                                        <span className="text-xs text-gray-400">
                                            ({filas.length} {filas.length === 1 ? 'insumo' : 'insumos'})
                                        </span>
                                    </div>
                                    {abierta ? (
                                        <ChevronUp size={18} className="text-gray-500" />
                                    ) : (
                                        <ChevronDown size={18} className="text-gray-500" />
                                    )}
                                </button>

                                {/* 19/11/2026 (Peter): tabla con formato SAP (#, filas alternadas, paginación de 10 por bodega) */}
                                {abierta && (<>
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="bg-primario text-white">
                                            <tr>
                                                <th className="text-center px-2 py-2 text-xs w-10">#</th>
                                                <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Insumo</th>
                                                <th className="text-right px-3 py-2 uppercase text-xs whitespace-nowrap">Existencia</th>
                                                <th className="text-right px-3 py-2 uppercase text-xs whitespace-nowrap">En Tránsito</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filasPagina.map((f, i) => {
                                                const enTransito = Number(f.en_transito) || 0;

                                                return (
                                                    <tr key={f.supply_id} onClick={() => setFilaSeleccionada(`${bodega}|${f.supply_id}`)}
                                                        className={`cursor-pointer ${filaSeleccionada === `${bodega}|${f.supply_id}` ? 'fila-elegida bg-green-600 text-white' : (i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50')}`}>
                                                        <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{inicio + i + 1}</td>
                                                        <td className="px-3 py-1.5 border border-gray-200 font-medium">{f.supply_name}</td>
                                                        <td className="px-3 py-1.5 border border-gray-200 text-right">
                                                            {Number(f.existencia).toLocaleString('es-EC')}
                                                        </td>
                                                        <td className="px-3 py-1.5 border border-gray-200 text-right">
                                                            {enTransito > 0 ? (
                                                                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                                                    <Truck size={14} />
                                                                    {enTransito.toLocaleString('es-EC')}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                                        <span className="text-xs text-gray-500">
                                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, filas.length)} de {filas.length} insumos
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPaginas((prev) => ({ ...prev, [bodega]: Math.max(1, paginaActual - 1) }))}
                                                disabled={paginaActual === 1}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                                            >
                                                <ChevronLeft size={16} />
                                                Anterior
                                            </button>
                                            <span className="text-sm text-gray-600 px-2">
                                                Página {paginaActual} de {totalPaginas}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setPaginas((prev) => ({ ...prev, [bodega]: Math.min(totalPaginas, paginaActual + 1) }))}
                                                disabled={paginaActual === totalPaginas}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                                            >
                                                Siguiente
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </>)}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}