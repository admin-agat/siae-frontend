// Encabezado estándar para TODAS las páginas de listado del SIAE.
// Ubicación: src/components/common/EncabezadoPagina.jsx  (junto a ModalShell y AccionesFila)
//
// Estándar acordado (27/10/2026):
//   - Título grande SIN ícono + subtítulo gris debajo (como Terceros)
//   - Botón "+ Nuevo X" a la derecha en color PRIMARIO (bg-primario = #3B5BDB, el mismo
//     del botón Guardar de ModalShell y del Sidebar): primario = crear/guardar
//
// Uso en cualquier página:
//   <EncabezadoPagina
//       titulo="Terceros"
//       subtitulo="Productores, comercializadoras y clientes"
//       textoBoton="Nuevo tercero"
//       onNuevo={handleNuevo}
//   />
//
// Si una página no debe permitir crear (ej. Clientes, que se crean desde el maestro),
// simplemente no se pasa onNuevo y el botón no aparece.
// Las clases de Tailwind están escritas COMPLETAS (no armadas con variables), porque
// en Tailwind v4 las clases construidas dinámicamente no se generan y fallan en silencio.
import { Plus } from 'lucide-react';

export default function EncabezadoPagina({ titulo, subtitulo, textoBoton, onNuevo, children }) {
    return (
        <div className="flex justify-between items-center mb-6">
            {/* Lado izquierdo: título y subtítulo */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">{titulo}</h1>
                {subtitulo && <p className="text-gray-500 text-sm">{subtitulo}</p>}
            </div>

            {/* Lado derecho: botones extra opcionales (children) + botón Nuevo */}
            <div className="flex items-center gap-2">
                {/* children: por si alguna página necesita un botón adicional
                    (ej. Exportar, Imprimir) al lado del Nuevo */}
                {children}

                {onNuevo && (
                    <button
                        type="button"
                        onClick={onNuevo}
                        className="flex items-center gap-2 bg-primario hover:bg-primario-hover text-white px-4 py-2 rounded-lg shadow-sm transition"
                    >
                        <Plus size={18} />
                        {textoBoton || 'Nuevo'}
                    </button>
                )}
            </div>
        </div>
    );
}
