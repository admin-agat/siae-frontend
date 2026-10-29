// Tabla estándar para TODAS las páginas de listado del SIAE.
// Ubicación: src/components/common/TablaEstandar.jsx
// (junto a ModalShell, AccionesFila, EncabezadoPagina y EstadoBadge)
//
// Qué resuelve sola (la página ya no lo escribe):
//   - Buscador (texto en MAYÚSCULAS mientras se escribe)
//   - Pestañas ACTIVOS / INACTIVOS / TODOS
//   - Encabezado color primario (#3B5BDB) con títulos en MAYÚSCULAS
//   - Filas de "Cargando..." y "Sin registros"
//   - Filas alternadas gris/blanco + resaltado azul claro al hacer clic
//   - Paginación de 10 en 10 (configurable)
//
// La página solo dice QUÉ columnas hay y QUÉ dato va en cada una. Ejemplo:
//
//   <TablaEstandar
//       datos={terceros}
//       cargando={loading}
//       nombreRegistros="terceros"
//       placeholderBusqueda="Buscar por nombre, RUC, zona o país..."
//       textosBusqueda={(t) => [t.name, t.identification, t.zone, paisDe(t)]}
//       columnas={[
//           { titulo: 'Nombre', render: (t) => t.name, className: 'font-medium' },
//           { titulo: 'Tipo',   render: (t) => t.type },
//           { titulo: 'Estado', render: (t) => <EstadoBadge activo={t.status} /> },
//           { titulo: 'Acciones', render: (t) => <AccionesFila ... /> },
//       ]}
//   />
//
// Las clases de Tailwind están escritas COMPLETAS (no armadas con variables), porque
// en Tailwind v4 las clases construidas dinámicamente no se generan y fallan en silencio.
import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

// Pestañas de estado. "valor" es lo que se compara contra el campo de estado del registro.
const PESTANAS = [
    { clave: 'ACTIVOS', etiqueta: 'ACTIVOS' },
    { clave: 'INACTIVOS', etiqueta: 'INACTIVOS' },
    { clave: 'TODOS', etiqueta: 'TODOS' },
];

export default function TablaEstandar({
    columnas,                         // [{ titulo, render: (fila) => contenido, className? }]
    datos = [],                       // registros a mostrar (array)
    cargando = false,                 // true mientras se piden los datos al backend
    nombreRegistros = 'registros',    // para "Mostrando 1–10 de 420 terceros"
    placeholderBusqueda = 'Buscar...',
    textosBusqueda = null,            // (fila) => [textos donde buscar]. Si es null, no hay buscador
    mostrarPestanas = true,           // pestañas ACTIVOS / INACTIVOS / TODOS
    campoEstado = 'status',           // nombre de la columna booleana de estado
    porPagina = 10,
    getId = (fila) => fila.id,        // cómo identificar cada fila (key + resaltado)
}) {
    const [busqueda, setBusqueda] = useState('');
    const [pestana, setPestana] = useState('ACTIVOS');
    const [paginaActual, setPaginaActual] = useState(1);
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Si cambia la búsqueda o la pestaña, se vuelve a la página 1
    // (en el mismo evento, no en un useEffect, para evitar un render extra)
    const cambiarBusqueda = (valor) => { setBusqueda(valor); setPaginaActual(1); };
    const cambiarPestana = (clave) => { setPestana(clave); setPaginaActual(1); };

    // Defensivo: si llega algo que no es array, se trata como lista vacía
    const lista = Array.isArray(datos) ? datos : [];

    // 1) Filtro por pestaña de estado
    const porEstado = !mostrarPestanas || pestana === 'TODOS'
        ? lista
        : lista.filter((fila) => (pestana === 'ACTIVOS' ? Boolean(fila[campoEstado]) : !fila[campoEstado]));

    // 2) Filtro por texto: busca en todos los textos que la página indicó.
    //    Se compara en minúsculas para que "rusia" encuentre "RUSIA".
    const texto = busqueda.trim().toLowerCase();
    const filtrados = !textosBusqueda || texto === ''
        ? porEstado
        : porEstado.filter((fila) =>
            textosBusqueda(fila).some((valor) => String(valor ?? '').toLowerCase().includes(texto))
        );

    // 3) Paginación
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
    const inicio = (paginaActual - 1) * porPagina;
    const filasPagina = filtrados.slice(inicio, inicio + porPagina);

    return (
        <>
            {/* Barra de filtros: buscador a la izquierda, pestañas a la derecha */}
            {(textosBusqueda || mostrarPestanas) && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    {textosBusqueda ? (
                        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 w-full max-w-md">
                            <Search size={18} className="text-gray-400" />
                            {/* Se guarda en MAYÚSCULAS mientras se escribe (estándar de buscadores) */}
                            <input
                                type="text"
                                placeholder={placeholderBusqueda}
                                className="outline-none w-full text-sm"
                                value={busqueda}
                                onChange={(e) => cambiarBusqueda(e.target.value.toUpperCase())}
                            />
                        </div>
                    ) : <div />}

                    {mostrarPestanas && (
                        <div className="flex gap-1 bg-white border rounded-lg p-1">
                            {PESTANAS.map((p) => (
                                <button
                                    key={p.clave}
                                    type="button"
                                    onClick={() => cambiarPestana(p.clave)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                                        pestana === p.clave
                                            ? 'bg-primario text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {p.etiqueta}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    {/* Encabezado color primario; "uppercase" pone los títulos en MAYÚSCULAS */}
                    <thead className="bg-primario text-white">
                        <tr>
                            {columnas.map((col) => (
                                <th key={col.titulo} className="text-left px-4 py-3 uppercase">
                                    {col.titulo}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan={columnas.length} className="text-center py-8 text-gray-400">
                                    Cargando {nombreRegistros}...
                                </td>
                            </tr>
                        ) : filasPagina.length === 0 ? (
                            <tr>
                                <td colSpan={columnas.length} className="text-center py-8 text-gray-400">
                                    No hay {nombreRegistros} para mostrar
                                </td>
                            </tr>
                        ) : (
                            filasPagina.map((fila, i) => {
                                const id = getId(fila);
                                return (
                                    <tr
                                        key={id}
                                        onClick={() => setFilaSeleccionada(id)}
                                        className={`cursor-pointer transition ${
                                            filaSeleccionada === id
                                                ? 'bg-primario-claro'
                                                : (i % 2 === 0 ? 'bg-gray-50' : 'bg-white')
                                        }`}
                                    >
                                        {columnas.map((col) => (
                                            <td key={col.titulo} className={`px-4 py-3 ${col.className || ''}`}>
                                                {/* Si el dato viene vacío, se muestra "—" */}
                                                {col.render(fila) ?? '—'}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Paginación (solo si hay registros) */}
                {!cargando && filtrados.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + porPagina, filtrados.length)} de {filtrados.length} {nombreRegistros}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
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
                                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                                disabled={paginaActual === totalPaginas}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

































