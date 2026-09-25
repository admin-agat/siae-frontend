// InventoryStockPage.jsx
// Vista general de stock: todas las bodegas con sus insumos y existencias actuales.
// Cada bodega es un acordeón: clic en el encabezado para expandir/colapsar.
// NUEVO: columna "En Tránsito" muestra cantidades que vienen en camino por
// transferencias todavía PENDIENTE de confirmación (no cuentan como stock
// disponible hasta que el Coordinador las confirme).
import { useState, useEffect } from 'react';
import { Search, Warehouse, ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { getGeneralStock } from '../../api/inventoryStock';

export default function InventoryStockPage() {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    // Guarda qué bodegas están expandidas: { "BODEGA SAN JUAN": true, ... }
    // Empieza vacío (todo colapsado) para que la vista general sea compacta.
    const [bodegasAbiertas, setBodegasAbiertas] = useState({});

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
                    className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition"
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

                        return (
                            <div key={bodega} className="bg-white rounded-xl shadow overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleBodega(bodega)}
                                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b hover:bg-gray-100 transition text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Warehouse size={16} className="text-[#3B5BDB]" />
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

                                {abierta && (
                                    <table className="w-full text-sm">
                                        <thead className="bg-[#3B5BDB] text-white">
                                            <tr>
                                                <th className="text-left px-4 py-3">Insumo</th>
                                                <th className="text-right px-4 py-3">Existencia</th>
                                                <th className="text-right px-4 py-3">En Tránsito</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filas.map((f, i) => {
                                                const enTransito = Number(f.en_transito) || 0;

                                                return (
                                                    <tr key={f.supply_id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                        <td className="px-4 py-3 font-medium">{f.supply_name}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {Number(f.existencia).toLocaleString('es-EC')}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
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
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}