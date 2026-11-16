# Revisión de rendimiento y escalabilidad del SIAE — 16/11/2026

Autor: agente `siae-architect`. Este informe es solo de lectura: no se cambió código ni datos.
Mediciones en local (base `SIAE`, PostgreSQL 15, PHP 8.2 CLI), dentro de una transacción revertida, con caché en memoria y sin crear tokens. También se revisaron las cabeceras HTTP públicas de producción.
No toca reglas de negocio: semana de compra, liquidación, contratos, flete y órdenes de compra quedan iguales.

---

## Resumen ejecutivo (para Peter)

1. **Hoy el sistema responde rápido.** Todas las pantallas medidas tardan entre 5 y 70 ms en el servidor. Con decenas de usuarios no hay urgencia.
2. **El arreglo más barato y de más efecto está en el servidor web (nginx).** Hoy los archivos JavaScript salen **sin comprimir y sin caché larga**: cada persona baja 1,4 MB en vez de unos 380 KB. Son unas 10 líneas de configuración y las corre Peter con sudo.
3. **Lo primero que se va a poner lento** es el contador de "Por despachar" del menú de bodega. Hace 4 consultas por cada compra enviada y no liquidada, y se pide cada 2 minutos y en cada cambio de pantalla. También la **liquidación**, que lista todos los cupos de la historia sin filtro de semana.
4. **Guardar la Compra de fruta** hace unas 4 consultas por cada compra de la semana. Con unas 100 compras por semana son unas 500 consultas, cerca de 1 segundo. Se puede bajar a unas 30.
5. Varias pantallas **descargan la historia completa** cuando solo necesitan lo reciente: terceros con contratos (143 KB con 420 terceros), la "última bodega" de cada vendedor, los despachos y las liquidaciones. Con datos ×10, ahí es donde se nota.
6. **La base de datos es pequeña y lo va a seguir siendo**, salvo la bitácora (`audit_logs`), que crece más rápido que todo lo demás. Conviene limitar su búsqueda y planear un archivo por año.
7. **Recomendación:** hacer ya los 6 "rápidos de alto impacto" (unos 2 días de trabajo más la configuración de nginx) y dejar el resto para cuando haya más historia.

---

## 1. Mediciones en local

Datos locales mínimos: 420 terceros, 1 bloque de compra, 32 líneas de inventario y 87 registros de bitácora. **Las consultas N+1 no se notan con estos datos**: por eso, abajo de la tabla está la estimación con el volumen de producción.

| Endpoint | Consultas | Tiempo SQL | Tiempo total (3.ª vez) | JSON |
|---|---|---|---|---|
| `GET /me` | 0 | 0 ms | 4 ms | 0,8 KB |
| `GET /notifications/count` | 1 | 0,7 ms | 5 ms | — |
| `GET /material-dispatch/pending/count` | **11** (con 1 grupo) | 7 ms | 15 ms | — |
| `GET /customer-orders` | 1 | 3 ms | 9 ms | 0,6 KB |
| `GET /customer-orders/{id}/purchases` | 28 | 23 ms | 43 ms | 8 KB |
| `GET /customer-orders/{id}/distribution` | 13 | 25 ms | 54 ms | 8 KB |
| `GET /customer-orders/{id}/closing` | 15 | 19 ms | 43 ms | 2 KB |
| `GET /customer-orders/{id}/tallies` | 12 | 10 ms | 23 ms | 0,6 KB |
| `GET /boards/operations` (tablero) | 40 | 48 ms | 67 ms | 3 KB |
| `GET /settlements/quotas` | 4 | 4 ms | 13 ms | 0,2 KB |
| `GET /settlements/preview/{cupo}` | 11 | 13 ms | 25 ms | 1 KB |
| `GET /inventory/stock` | 2 | 5 ms | 11 ms | 4 KB |
| `GET /inventory-movements` | 8 | 7 ms | 22 ms | 9 KB |
| `GET /third-parties?status=1` | 4 | 8 ms | **58 ms** | **144 KB** |
| `GET /producer-contracts` | 3 | 5 ms | 26 ms | 79 KB |
| `GET /supplies` | 2 | 2 ms | 33 ms | 40 KB |
| `GET /audit-logs` | 4 | 2 ms | 16 ms | 17 KB |
| `GET /voyage-profit` | 14 | 10 ms | 18 ms | 1 KB |

**Lo que no entra en la medición y sí pasa en producción, en cada petición:**
- buscar el token;
- buscar el usuario;
- `UPDATE personal_access_tokens SET last_used_at`: Sanctum escribe una vez por petición;
- el límite de peticiones (throttle) en caché `file`.

Son unas 3 consultas más por petición, una de ellas de escritura. Con decenas de usuarios no pesa.

**Cómo se ve con el volumen de producción** (~100 compras por semana, ~1.700 en total y creciendo):

| Operación | Consultas estimadas hoy | Dentro de 1 año | Por qué |
|---|---|---|---|
| Guardar Compra de fruta (PUT) | ~450–550 | igual por semana | 2 consultas por cada compra existente, 1–2 por cada compra recibida y 1 por cada puerto |
| Contador "Por despachar" | 4 × grupos pendientes (≈100–400) | crece si la liquidación se atrasa | 4 consultas por cupo × marca × bodega, sin límite de semanas |
| `GET purchases`: última bodega | lee **todas** las compras de la historia | ~5.000 filas/año | arma la lista en PHP en vez de en SQL |
| `GET settlements/quotas` sin filtro | todos los cupos con sus compras | ~5.000 compras/año → varios MB | la pantalla no manda semana ni año |

---

## 2. Rápidos de alto impacto (hacer ya)

| # | Grav. | Dónde | Problema | Impacto estimado | Esf. | Propuesta |
|---|---|---|---|---|---|---|
| R1 | 🔴 | nginx de producción (`/assets/*`) | Los JS y CSS salen **sin gzip** (`index-*.js` = 292 KB sin comprimir) y **sin `Cache-Control`**. El JSON del API tampoco se comprime (nginx comprime por defecto solo `text/html`). | Primera carga: 1,4 MB → ~380 KB. Cada visita revalida los archivos. Terceros (144 KB) → ~15 KB. | S | En el `server` de SIAE: `gzip on; gzip_comp_level 5; gzip_min_length 1024; gzip_types application/javascript text/css application/json image/svg+xml;` y `location /assets/ { expires 1y; add_header Cache-Control "public, max-age=31536000, immutable"; }`. index.html sigue con `no-cache`, como ya está. Lo corre Peter con sudo, con respaldo del `.conf` como el del 15/11. |
| R2 | 🔴 | `MaterialDispatchController.php:104-191` (`pendingCount` → `filasPorDespachar`) y `src/components/Sidebar.jsx:96-102` | Para contar, arma la bandeja completa. Por cada grupo cupo × marca × bodega hace `yaDespachado` más 3 consultas de `retiros` (`max(created_at)`, `count`, `max(date)`). Lo pide cada 2 minutos y **en cada cambio de pantalla** (depende de `location.pathname`). | Hoy son 11 consultas con 1 grupo; con 100 grupos, ~400 consultas por clic de cada bodeguero. Es lo primero que se va a sentir lento. | S–M | (a) Juntar los retiros en **una** consulta agrupada por `producer_quota_id, brand_id, warehouse_id` (`MAX(created_at)`, `COUNT(*)`, `MAX(date)`) y `yaDespachado` en otra, ambas con `whereIn` de los cupos. Quedan ~6 consultas fijas. (b) En `Sidebar.jsx`, sacar `location.pathname` de las dependencias y pausar cuando la pestaña está oculta. (c) Opcional: guardar la cuenta 60 s en caché por usuario. |
| R3 | 🔴 | `PurchaseAllocationController.php:276-286` (bucle de `update`) | Por cada compra existente: `yaRetiro()` (1 consulta) y `tallies()->exists()` (1 consulta). `cargar()` ya resuelve lo mismo en 2 consultas para toda la semana. | Guardar una semana de 100 compras: ~200 consultas menos. | S | Usar lo mismo que en `cargar()`: un `pluck` de `tally_sheets` por las líneas y un `distinct` de `inventory_movements` por los cupos, antes del bucle. |
| R4 | 🟡 | `PurchaseAllocationController.php:170,183` (`Port::find` dentro del bucle) y `:357` (`ProducerQuota::firstOrNew` por compra) | Una consulta por bloque y por compra con puerto, y otra por compra para buscar el cupo. | ~200 consultas más en cada guardado. | S | Cargar antes `Port::whereIn(...)->pluck('port_type','id')` y los cupos del vendedor y la semana con un solo `whereIn`, en un arreglo por `"tp|año|semana"`. Solo se crea el cupo si falta. **No cambia la regla de semana de compra.** |
| R5 | 🟡 | `PurchaseAllocationController.php:886-893` (`$ultimaBodega`) | Trae **todas** las compras de la historia con bodega, las ordena y hace `unique()` en PHP. Se ejecuta en cada GET y después de cada guardado, envío o división. | Hoy son ~1.700 filas; con 3 años, ~15.000 filas por carga (~50–150 ms y memoria). | S | Una sola consulta: `SELECT DISTINCT ON (q.third_party_id) q.third_party_id, l.pickup_warehouse_id … ORDER BY q.third_party_id, l.id DESC`, o, mejor aún, limitada a los vendedores activos o a los últimos 6 meses. |
| R6 | 🟡 | `SettlementController.php:49-62` y `src/pages/liquidacion/SettlementsPage.jsx:30` | `GET /settlements/quotas` sin semana ni año: todos los cupos de la historia con sus compras y 3 sumas de tarjas cada uno. | Crece sin límite: ~5.000 compras al año en el JSON. | S | Que la pantalla mande `year` y un rango de semanas (por defecto, las últimas 8 más todo lo que no está LIQUIDADO). En el backend, si no llega filtro, aplicar ese mismo por defecto. |

---

## 3. Resto de hallazgos

### Backend: consultas y tamaño de respuestas

| # | Grav. | Dónde | Problema | Impacto | Esf. | Propuesta |
|---|---|---|---|---|---|---|
| B1 | 🟡 | `ThirdPartyController.php:34-50` (`index`) | Devuelve todos los terceros con `customer.brands` y `contracts` completos. Lo usan Compra de fruta, Despacho, Movimientos, OC, Anticipos y Fincas, y casi todas solo necesitan `id, name, type`. | 144 KB con 420 terceros; crece con cada productor. Se pide en cada apertura de esas pantallas. | S | Agregar `?campos=lista` (o `/third-parties/options`) que devuelva `id, name, type, status` sin relaciones, y usarlo en los selectores. La pantalla Terceros sigue con la versión completa. |
| B2 | 🟡 | `ProducerAdvanceController.php:30` y `ProducerAdvance::descontado()` | N+1: una consulta por anticipo para calcular el saldo. | Con 500 anticipos son 500 consultas. | S | Un `withSum` o una subconsulta agrupada de `settlement_advances` unida a `settlements.status = true`. |
| B3 | 🟡 | `MaterialDispatchController.php:459` (`index`) y `SettlementController.php:90` (`index`) | Historial de despachos y de liquidaciones sin límite ni paginación (`get()`). | Crece cada semana; hoy no se nota. | S | Filtro por año por defecto, o `limit(1000)` como en Movimientos, más búsqueda en el servidor. |
| B4 | 🟡 | `AuditLogController.php:39,42,50` (Bitácora) | (a) `changes::text ILIKE '%…%'` recorre toda la tabla. (b) `paginate` hace `COUNT(*)` completo en cada página. (c) La lista de tablas hace un `DISTINCT` sobre toda la bitácora en cada petición. | Con ~1 millón de filas (unos 4–5 años), 0,3–2 s por página. | S–M | (a) Exigir un rango de fechas cuando hay texto libre (por defecto, 30 días). (b) `simplePaginate` o un conteo aproximado. (c) Sacar la lista de tablas de los modelos con `Auditable`, o guardarla 1 h en caché. Más adelante: índice `pg_trgm` GIN sobre `changes::text` si se usa mucho. |
| B5 | 🟢 | `InventoryMovementController.php:353,357,400` (`whereDate`) | `whereDate` envuelve la columna en `date(...)` y PostgreSQL no puede usar el índice `(warehouse_id, type, date)` para el rango. | Bajo hoy; con 100.000 movimientos, ~50–100 ms. | S | `where('date', '>=', $desde)` y `where('date', '<', $hasta + 1 día)`. Agregar el índice `inventory_movements (date DESC, id DESC)` para la lista sin bodega (`orderByDesc('date')->limit(1000)`). |
| B6 | 🟢 | `PurchaseAllocationController.php:794` (`Schema::getColumnListing` en `version()`) | Una consulta al catálogo en cada GET y PUT para armar la huella. | ~2–5 ms por llamada. | S | Constante con las columnas, o caché estática por proceso. |
| B7 | 🟢 | `PurchaseAllocationController.php:958-965` (`farms` y `contracts` en `cargar()`) | Manda todas las fincas activas y todos los contratos activos en cada carga. | Con ~1.000 fincas, ~100 KB (unos 10 KB con gzip). | M | Bien por ahora con gzip (R1). Más adelante, solo las fincas de los vendedores de la semana y búsqueda en el servidor al agregar otro. |
| B8 | 🟢 | `CostoPromedio::historial()` (`app/Services/CostoPromedio.php:29`) | Recalcula el promedio recorriendo **toda** la historia del insumo en cada kárdex y en cada movimiento que lo toca. | Con ~3.000 líneas por insumo al año, unos 10–30 ms dentro de 5 años. | M | Por ahora está bien: así se asegura el promedio correcto si se anula algo viejo. Más adelante: guardar el promedio por movimiento (columna `avg_cost_after` en la línea) y recalcular solo desde la fecha tocada. **Cambio de diseño: pasa antes por Peter.** |
| B9 | 🟢 | `TableroOperaciones` (`app/Services/Tableros/TableroOperaciones.php`) | 40 consultas agregadas, sin N+1, acotadas al rango de semanas. | 67 ms en local; <130 ms en producción según DESARROLLO. | S | Bien. Si hay muchos usuarios de GERENCIA, guardar 60 s en caché por combinación de filtros. |
| B10 | 🟢 | Sanctum (`last_used_at`) | Un `UPDATE` del token en cada petición, también en los sondeos de campanita y contador. | Mucha escritura chica: crece la tabla de tokens y el autovacuum trabaja más. Con decenas de usuarios no importa. | — | Nada por ahora; `sanctum:prune-expired` ya corre a diario. Con ×10 usuarios, revisar que el autovacuum alcance (ver §5). |
| B11 | 🟢 | Colas y correo | No hay correos ni trabajos pesados: las notificaciones son inserciones directas (`Notificaciones::envioBodega`). | Ninguno. | — | No hace falta un worker de colas. Si un día se mandan correos o PDF, usar `QUEUE_CONNECTION=database` con un worker de systemd. |
| B12 | 🟢 | Índices | Las llaves foráneas y los filtros principales tienen índice desde las migraciones `2026_11_02_000006` y `2026_11_10_000002`. Faltan solo los de B5 y, opcionalmente, `user_notifications (producer_quota_line_id)` para `envioQuitado`. | Bajo. | S | Una migración chica con esos 2 índices, junto con B5. |

### Frontend

| # | Grav. | Dónde | Problema | Impacto | Esf. | Propuesta |
|---|---|---|---|---|---|---|
| F1 | 🟡 | `src/routes/paginas.js:62-73` y `src/components/Layout.jsx:70` (`precargarPaginas`) | Precarga **las 60 pantallas** para cualquier usuario, incluido el Tablero (368 KB, recharts), aunque el usuario no tenga permiso para abrirlas. | Un bodeguero baja 1,4 MB que no usa (380 KB con gzip). | S | Precargar solo las rutas de `menuDe(user)` y dejar `DashboardPage` para el final, o solo si tiene la pantalla `dashboard`. |
| F2 | 🟡 | `src/pages/comercial/PurchaseAllocationPage.jsx` (1.629 líneas, 42 `useState`, 0 `useMemo`/`memo`) | Cada tecla vuelve a dibujar todos los bloques y filas y recalcula `fincasDe` (filtra todas las fincas por fila), `vendedores.find` y `avanceContratos` (contratos × compras). | Con 100–150 compras por semana: 20–60 ms por tecla en un PC de oficina. Se siente como "teclado pegajoso". | M | (1) `useMemo` para mapas: `vendedoresPorId`, `fincasPorDueño` (Map) y `avanceContratos`. (2) Sacar la fila de compra a un componente con `React.memo` y callbacks estables (`useCallback` con `bKey`/`cKey`). Medir antes con React Profiler sobre una semana real. |
| F3 | 🟢 | `CustomerOrderFormPage.jsx` (697 líneas) | Sin memo, pero son 5–15 líneas por pedido. | Ninguno visible. | — | No hace falta. |
| F4 | 🟢 | Listas largas | `TablaEstandar` ya pagina en el cliente (10 por página), así que el DOM se mantiene chico. `SelectBuscable` solo dibuja las opciones cuando está abierto. | Bien. El costo está en el JSON que se baja (ver B1 y B3), no en el DOM. | — | No hace falta virtualizar. |
| F5 | 🟢 | Sondeos (`Campanita.jsx` 60 s, `Sidebar.jsx` 120 s, `AvisoVersion.jsx` 5 min, latido de `/me` por actividad) | La campanita y el contador siguen sondeando con la pestaña oculta. | ~1–2 peticiones por minuto por usuario de bodega. Con ×10 usuarios sigue siendo poco, **si R2 está hecho**. | S | Pausar si `document.visibilityState !== 'visible'`, como ya hace `AvisoVersion`. |
| F6 | 🟢 | Bundle | `index` 292 KB (92 KB gzip): React, router, axios y layout. `createLucideIcon` 68 KB compartido. 100 archivos JS, 1,41 MB en total (377 KB gzip). Compila en 1,8 s. | Bien con R1. | — | Nada. Si algún día hace falta, `manualChunks` para separar `react-dom`. |

### Servidor (VPS Hostinger, Ubuntu 24.04, nginx + php-fpm 8.3 + PostgreSQL 16, compartido con CHAUNE)

Todo esto pide sudo y lo corre Peter. **No tocar la configuración de CHAUNE.**

| # | Grav. | Tema | Propuesta |
|---|---|---|---|
| S1 | 🔴 | gzip y caché de `/assets` | Ver R1. Brotli es opcional: en Ubuntu necesita el módulo `libnginx-mod-http-brotli-filter`; gzip alcanza. |
| S2 | 🟡 | OPcache (php-fpm) | Confirmar en `/etc/php/8.3/fpm/php.ini`: `opcache.enable=1`, `opcache.memory_consumption=192`, `opcache.max_accelerated_files=20000`, `opcache.interned_strings_buffer=16`. Dejar `validate_timestamps=1` con `revalidate_freq=60`: así un `git pull` se ve sin reiniciar php-fpm, que pediría sudo. JIT no hace falta. |
| S3 | 🟢 | Laravel al subir | Ya se usa `php artisan optimize` (config, rutas y eventos). Agregar `composer install --no-dev --optimize-autoloader`. |
| S4 | 🟡 | php-fpm pool | `pm = dynamic`, `pm.max_children` según la RAM. Unos 40–60 MB por proceso: con 4 GB compartidos, **10–12**; `pm.start_servers=3`, `pm.max_spare_servers=5`, `pm.max_requests=500`. Activar `pm.status_path` y `slowlog` (`request_slowlog_timeout = 3s`) para ver qué se pone lento. |
| S5 | 🟡 | PostgreSQL 16 (VPS de 4 GB compartido; con 8 GB se duplica lo marcado con *) | `shared_buffers = 512MB`*, `effective_cache_size = 2GB`*, `work_mem = 16MB`, `maintenance_work_mem = 128MB`, `random_page_cost = 1.1` (SSD), `effective_io_concurrency = 200`, `max_connections = 50`, `checkpoint_completion_target = 0.9`, `wal_compression = on`, `log_min_duration_statement = 500ms` (registra las consultas lentas), `shared_preload_libraries = 'pg_stat_statements'` + `CREATE EXTENSION pg_stat_statements` (top de consultas reales). El autovacuum por defecto alcanza. |
| S6 | 🟡 | Respaldos | El respaldo diario a las 02:00 con 30 días está bien. Falta: (1) **la copia fuera del servidor (B2)**, ya pendiente; (2) **probar restaurar** una vez al mes en una base de prueba; (3) cuando la base pase de ~1 GB, `pg_dump -Fc` (comprimido y restaurable por tabla). |
| S7 | 🟢 | cron | `schedule:run` cada minuto ya está. Si se hace B4, agregar ahí la tarea de archivo anual de la bitácora. |
| S8 | 🟢 | Monitoreo | Pendiente en DESARROLLO ("monitor de caída"). Un sondeo externo gratis a `/up` cada 5 min alcanza. |

### Base de datos

- **Tamaño local:** 15 MB, 73 tablas. Las más grandes son índices sobre tablas casi vacías.
- **Crecimiento esperado en producción** (a confirmar en el servidor con `pg_total_relation_size`):

| Tabla | Por año (estimado) | En 10 años | Comentario |
|---|---|---|---|
| `producer_quota_lines` | ~5.000 filas | ~50.000 | Pequeña. |
| `tally_sheets`, `settlement_lines` | ~5.000 | ~50.000 | Pequeñas. |
| `inventory_movement_lines` | ~15.000 | ~150.000 | Pequeña. |
| **`audit_logs`** | **150.000–250.000 filas (~200–300 MB con índices)** | **2–2,5 millones (2–3 GB)** | Cada compra creada guarda todas sus columnas en JSON. Los avisos de la campanita también se auditan. Es lo único que va a pesar. |
| `personal_access_tokens` | muchas actualizaciones, pocas filas | — | Se limpia a diario. |

- **Bitácora:** la búsqueda es el problema, no el tamaño (ver B4). Plan cuando pase de ~1 millón de filas: una tabla `audit_logs_<año>` de archivo, o partición por rango de `created_at`. Lo pasado se sigue pudiendo consultar en modo de solo lectura. **Es un cambio grande: diseño aparte y aprobación de Peter.**
- **Índices:** bien cubiertos (ver B12). Antes de agregar más, activar `pg_stat_statements` (S5) en producción y mirar las consultas reales.

---

## 4. Escalabilidad: qué se rompe primero

**Si los usuarios se multiplican ×10 (cientos):**
1. Primero, el contador "Por despachar" (R2): una carga N+1 multiplicada por el número de bodegueros y de clics.
2. Después, los procesos de php-fpm (S4): con 10–12 procesos y respuestas de 50 ms se atienden unas 200 peticiones por segundo, sobra. Solo se llenaría si un endpoint lento los ocupa.
3. Throttle y caché en `file`: siguen bien en un solo servidor. Redis solo haría falta con más de un servidor o con miles de usuarios.
4. Guardados simultáneos de Compra de fruta: ya están protegidos con `lockForUpdate` y huella (409). Si cada guardado dura ~1 s (R3/R4), dos usuarios en la misma semana se esperan. Con R3 y R4 baja a ~0,2 s.

**Si los datos se multiplican ×10 (años de historia):**
1. Las listas sin filtro de fecha: `settlements/quotas` (R6), historial de despachos y de liquidaciones (B3), "última bodega" (R5) y terceros con contratos (B1).
2. La búsqueda en la bitácora (B4).
3. El kárdex y el costo promedio de insumos con mucha historia (B8): recién en varios años.
4. El Tablero y las hojas por semana (pedido, distribución, compra y cierre) **no se afectan**: ya filtran por semana.

**Qué hacer ya y qué después:**

| Cuándo | Qué |
|---|---|
| **Ya** (≈2 días más nginx) | R1 (nginx), R2, R3, R4, R5, R6, F1 |
| **En 1–3 meses** | B1, B2, B3, B4 (a, b, c), B5 + B12 (una migración de índices), F2, F5, S2, S4, S5, S6 |
| **Cuando haya ~1 millón de filas en la bitácora o 2+ años de historia** | Archivo o partición de `audit_logs`, B7, B8, caché del tablero (B9) |

---

## 5. Cómo verificar después de cada arreglo

- **Backend:** el mismo método de esta revisión. En `tinker`, `DB::listen` para contar consultas y `Sanctum::actingAs` con `cache.default=array`, todo dentro de `DB::beginTransaction()` / `rollBack()`. Probar con una copia de producción **en `siae_test`** para ver el N+1 real, y borrar la copia al terminar.
- **Producción, tras R1:** `curl -sI -H "Accept-Encoding: gzip" https://siae.datalytica.cloud/assets/<archivo>.js` debe mostrar `Content-Encoding: gzip` y `Cache-Control: public, max-age=31536000, immutable`.
- **Producción, tras S5:** `SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;`.

---

## 6. Preguntas abiertas para Peter

1. **RAM del VPS** (4 GB u 8 GB) y cuánta usa CHAUNE. Con eso se ajustan S4 y S5.
2. **¿Por cuánto tiempo se debe poder consultar la bitácora en línea?** ¿2 años y luego archivo, o todo siempre? (B4 y la partición).
3. **Liquidación:** ¿la pantalla de cupos por liquidar puede mostrar por defecto las últimas 8 semanas más todo lo que no esté LIQUIDADO (R6)? Lo más viejo y ya liquidado quedaría en el Historial.
4. **Historial de despachos y de liquidaciones** (B3): ¿por defecto, el año actual?
5. ¿Autorizas que Peter corra la configuración de nginx de R1 (con respaldo del `.conf`, fuera de horario)?

---

## 7. Lo que se hizo para esta revisión (sin cambios en el sistema)

- Lectura de los controladores, servicios, middleware, rutas y migraciones del backend, y de las páginas, el router y los componentes comunes del frontend.
- Conteo de filas e índices en la base local `SIAE`, solo con lecturas. Las mediciones de endpoints se hicieron en una transacción revertida. Se comprobó después que la bitácora, los tokens y la caché quedaron iguales (87 / 40 / 4).
- Compilación del frontend en un `git worktree` temporal de HEAD, con junction a `node_modules`. Se borró al terminar y `PortsMasterDetailPage.jsx` no se tocó.
- Cabeceras HTTP públicas de producción revisadas con `curl`: solo GET, sin sesión.
