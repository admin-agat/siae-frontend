// InventoryStockPage.jsx
// Vista general de stock: todas las bodegas con sus insumos y existencias actuales.
import { useState, useEffect } from 'react';
import { Search, Warehouse } from 'lucide-react';
import { getGeneralStock } from '../../api/inventoryStock';

export default function InventoryStockPage() {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');

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

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Stock General</h1>
                    <p className="text-gray-500 text-sm">Existencias actuales por bodega</p>
                </div>
                <button
                    onClick={cargarStock}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
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
                <div className="space-y-6">
                    {Object.entries(porBodega).map(([bodega, filas]) => (
                        <div key={bodega} className="bg-white rounded-xl shadow overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b">
                                <Warehouse size={16} className="text-[#0F6E56]" />
                                <h2 className="font-semibold text-gray-800">{bodega}</h2>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-[#0F6E56] text-white">
                                    <tr>
                                        <th className="text-left px-4 py-3">Insumo</th>
                                        <th className="text-right px-4 py-3">Existencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filas.map((f, i) => (
                                        <tr key={f.supply_id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="px-4 py-3 font-medium">{f.supply_name}</td>
                                            <td className="px-4 py-3 text-right">
                                                {Number(f.existencia).toLocaleString('es-EC')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}