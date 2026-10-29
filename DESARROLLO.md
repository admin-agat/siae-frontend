# SIAE — Sistema Integral AGAT-ECUAGREEN

Registro de desarrollo: qué está hecho, qué se corrigió y qué falta.
Cubre los dos repositorios: **siae-frontend** (este) y **siae-backend**.

> **Cómo mantener este archivo:** cada vez que se termine un cambio, agregar una línea en
> [Historial de cambios](#7-historial-de-cambios) y mover la tarea de [Pendientes](#8-pendientes)
> a la sección del módulo que corresponda.

Última actualización: **29/10/2026** (Cierre de embarque, roles EXPORTACIONES/COMERCIAL, Usuarios, bodega de retiro)

---

## Índice
1. [Tecnología y cómo ejecutar](#1-tecnología-y-cómo-ejecutar)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Módulos y estado](#3-módulos-y-estado)
4. [Flujo de negocio: pedido semanal](#4-flujo-de-negocio-pedido-semanal)
5. [Seguridad aplicada](#5-seguridad-aplicada)
6. [Estándares del proyecto](#6-estándares-del-proyecto)
7. [Historial de cambios](#7-historial-de-cambios)
8. [Pendientes](#8-pendientes)
9. [Checklist para producción](#9-checklist-para-producción)

---

## 1. Tecnología y cómo ejecutar

| Parte | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 + React Router + Axios + lucide-react | `C:\Users\AGAT-ECU-ADM\siae-frontend` |
| Backend | Laravel 12 + Sanctum (tokens Bearer) + PHP 8.2 | `C:\Users\AGAT-ECU-ADM\siae-backend` |
| Base de datos | PostgreSQL (base `SIAE`) | local, puerto 5432 |

**Ejecutar en local**
```bash
# Backend
cd siae-backend
php artisan migrate        # aplica migraciones pendientes
php artisan serve          # http://127.0.0.1:8000

# Frontend
cd siae-frontend
npm install
npm run dev                # http://localhost:5173
```

**Variables de entorno**
- Frontend: copiar `.env.example` como `.env` (`VITE_API_URL`).
- Backend: `.env` (no está en git). Variables de seguridad nuevas: `SANCTUM_EXPIRATION`, `CORS_ALLOWED_ORIGINS` (ver `.env.example`).

**Rendimiento local:** OPcache está activado en `C:\php\php.ini` (28/10/2026). Cada petición bajó de ~200 ms a ~30 ms.
Respaldo del archivo original: `C:\php\php.ini.respaldo-2026-10-28`.

---

## 2. Roles y permisos

| Rol | Usuarios (28/10/2026) | Qué puede hacer |
|---|---|---|
| **ADMIN** | 1 | Todo. Único que administra CONFIGURACIÓN (terceros, fincas, clientes, destinos, contratos de clientes, marcas). |
| **COORDINADOR_INVENTARIO** | 1 | Inventario completo + confirmar/cancelar transferencias + editar/anular movimientos + anular despachos. Exportaciones. |
| **JEFE_BODEGA** | 2 | Inventario (sin ajustes libres) + Exportaciones. No edita movimientos ya registrados. |
| **BODEGUERO** | 5 | Solo su bodega: Stock, Nuevo movimiento (compra, transferencia, devolución), Despacho de materiales, Historial. |
| **EXPORTACIONES** | 0 (nuevo 29/10) | Pedido semanal, Distribución en barcos, Cierre de embarque, Navieras, Bookings. No ve Inventario ni Comercial. |
| **COMERCIAL** | 0 (nuevo 29/10) | Compra de fruta (bloques, compras, precios, bodega de retiro). Lee pedido y barcos por la API, sin editarlos. |

Los usuarios se crean en **CONFIGURACIÓN → Usuarios** (solo ADMIN). Desactivar un usuario le cierra la sesión al instante.

**Dónde se controla**
- Frontend (solo visual): `RutaSoloAdmin`, `RutaNoBodeguero`, `RutaSoloCoordinador` en [AppRouter.jsx](src/routes/AppRouter.jsx) y el menú en [Sidebar.jsx](src/components/Sidebar.jsx).
- Backend (la protección real): middleware `admin` y `rol:` en `routes/api.php`, más reglas por bodega dentro de los controladores.

| Grupo de rutas API | Lectura | Escritura |
|---|---|---|
| Terceros | todos | ADMIN |
| Fincas | ADMIN | ADMIN |
| Marcas | todos (Despacho las necesita) | ADMIN |
| Clientes, Destinos, Contratos de clientes | todos menos BODEGUERO | ADMIN |
| Pedido semanal, Distribución en barcos, Cierre de embarque, Navieras, Barcos, Bookings | todos menos BODEGUERO | ADMIN, JEFE_BODEGA, COORDINADOR_INVENTARIO, EXPORTACIONES |
| Compra de fruta | todos menos BODEGUERO | ADMIN, COMERCIAL |
| Puertos, Tarifas | todos menos BODEGUERO | ADMIN |
| Usuarios | ADMIN | ADMIN |
| Movimientos, Stock, Despacho, Órdenes de compra | solo roles de INVENTARIO (+ BODEGUERO) | según la fila de cada uno |
| Bodegas, Insumos, Categorías, Motivos, Recetas | todos | todos menos BODEGUERO |
| Movimientos: crear / transferir | todos (BODEGUERO solo en su bodega) | — |
| Movimientos: editar / anular | — | ADMIN, COORDINADOR_INVENTARIO |
| Transferencias: confirmar / cancelar | ADMIN, COORDINADOR_INVENTARIO | ADMIN, COORDINADOR_INVENTARIO |
| Órdenes de compra: crear / cancelar | todos | todos menos BODEGUERO |
| Despacho de materiales: cupos de Comercial del productor | todos | — |

> En el **menú**: ADMIN ve todo; EXPORTACIONES solo su sección; COMERCIAL solo Compra de fruta; JEFE_BODEGA y COORDINADOR solo INVENTARIO. Al iniciar sesión cada rol entra a su pantalla (`src/routes/roles.js`). El 29/10/2026 se crearon los roles EXPORTACIONES y COMERCIAL (reemplaza la decisión del 28/10).

---

## 3. Módulos y estado

Leyenda: ✅ terminado · 🟡 parcial · ⏳ pendiente

### CONFIGURACIÓN (solo ADMIN)
| Pantalla | Estado | Notas |
|---|---|---|
| Terceros (maestro) | ✅ | Un solo formulario para productores, comercializadoras, proveedores y clientes. Baja lógica. |
| Fincas | ✅ | Ligadas a un productor. |
| Clientes | ✅ | Ficha del cliente del exterior (GT, RVI…). **Marcas del cliente** (varias). Columna "Contrato vigente". |
| Destinos | ✅ | |
| Contratos de clientes | ✅ | Precio por caja + vigencia + incoterm. No se permiten dos contratos activos que se crucen. |
| Marcas | ✅ | Movida desde Exportaciones el 28/10/2026. |
| **Usuarios** | ✅ | Nuevo 29/10/2026. Crear, editar (contraseña opcional), desactivar/reactivar; BODEGUERO con su bodega. |

### EXPORTACIONES
| Pantalla | Estado | Notas |
|---|---|---|
| **Pedido semanal** | ✅ | Nuevo 28/10/2026. Ver [sección 4](#4-flujo-de-negocio-pedido-semanal). |
| Navieras | ✅ | |
| Bookings | 🟡 | Funciona; pendiente migrar a componentes comunes. |
| Puertos | ✅ | Tipo **SALIDA** (Guayaquil, Puerto Bolívar) / **DESTINO**. |
| **Distribución en barcos** | ✅ | Nuevo 28/10/2026 (Fase 2). Barcos de la semana + hoja líneas × barcos. |
| **Cierre de embarque** | ✅ | Nuevo 29/10/2026. Por barco: ventana de carga, zarpe y bookings con lo REALMENTE embarcado + DAE, B/L, AUCP, orden, consignee/notify, pesos, ingreso (tarja del puerto). Imprime la "Asignación de carga". |
| SKU / Recetas, Marca BL, Invoice | ⏳ | En el menú como "Próximamente". |

### INVENTARIO
| Pantalla | Estado | Notas |
|---|---|---|
| Bodegas | ✅ | Cada bodega tiene un responsable (bodeguero). |
| Insumos por categoría | ✅ | Historial de precios de costo. |
| Motivos de movimiento | ✅ | Motivos permitidos por rol. |
| Stock general | ✅ | Existencia + en tránsito por bodega. |
| Nuevo movimiento | ✅ | Ingreso por OC (recepción parcial), egreso, devolución, transferencia. |
| Despacho de materiales | ✅ | Receta (BOM) por marca y cajas; guía de remisión. Desde el 28/10/2026 se despacha contra el **cupo de Comercial** (marca y cajas fijas). |
| Historial de despachos | ✅ | Reimprimir guía, anular. |
| Transferencias pendientes | ✅ | Confirmar (con ajuste por pérdida/daño) o cancelar. |
| Órdenes de compra | ✅ | Código OC-AAAA-NNNN, IVA 15/5/0, retenciones, cancelar/cerrar con motivo. |

### COMERCIAL y LIQUIDACIÓN
| Pantalla | Estado | Notas |
|---|---|---|
| **Compra de fruta** | ✅ | Nuevo 28/10/2026 (Fase 3). Productor/comercializadora + cliente + marca + cajas + precio oficial + precio real. Desde 29/10: CONTRATO/SPOT, forma de pago (100 % u 80/20), **bodega de retiro** y se permite comprar de más (aviso ámbar). |
| Comercializadoras | ⏳ | |
| **Tarjas** | ✅ | Nuevo 29/10/2026. Por camión: embarcadas, caídas, rechazadas; barco, placa, N° tarja. Solo ADMIN. |
| **Anticipos y préstamos** | ✅ | Nuevo 29/10/2026. Monto, descontado y saldo; se descuentan en la liquidación. Solo ADMIN. |
| **Liquidar** | ✅ | Nuevo 29/10/2026. Cupo (productor + semana): fruta − materiales − anticipos; código LIQ-00000001; imprimible; anular sin pagos. Solo ADMIN. |
| **Pagos e historial** | ✅ | Nuevo 29/10/2026. Registrar 1er pago (100 % / 80 %) y 2do pago (20 %) con fecha y comprobante; bandeja de pendientes. Solo ADMIN. |
| Dashboard | ⏳ | Página vacía. |

---

## 4. Flujo de negocio: pedido semanal

```
Correo de Rusia ──► 1. PEDIDO SEMANAL ──► 2. DISTRIBUCIÓN EN BARCOS ──► 3. COMPRA DE FRUTA ──► Despacho de materiales
                     (Exportaciones) ✅      (Logística, el plan) ✅         (Comercial) ✅           (en la bodega de retiro) ✅
                                                    │
                                                    └──► CIERRE DE EMBARQUE (lo real por booking: DAE, B/L, ingreso del puerto) ✅
                                                                                                        │
                    5. PAGOS 80/20 o 100 % ◄── 4. LIQUIDACIÓN ◄── TARJAS (puerto) ◄── Devolución de material sobrante
                         ✅                        ✅                  ✅                    (ligada al cupo) ✅
```

**Liquidación — reglas acordadas con el usuario (29/10/2026)**
- Ejemplo: a PEPE PÉREZ se le entregan materiales para 400 cajas y hace 300 → devuelve a bodega el material de 100. De las 300 que llegan a puerto: 245 embarcadas + 5 caídas (**se pagan**) + 50 rechazadas por calidad (**no se pagan**) → se pagan **250**.
- Se paga sobre las **tarjas** (por camión), al **precio real** de cada compra.
- Se descuentan: **materiales** retirados menos lo devuelto (solo categorías marcadas "se cobra al productor": cartón, plásticos, material chico, químicos; **contenedores no**) y **anticipos/préstamos**.
- Forma de pago por compra: **CONTRATO → 100 %**, **SPOT → 80/20** (80 % al embarcar, 20 % después); se puede cambiar (hay SPOT al 100 %).
- Los descuentos salen del primer pago. Si no alcanzan, del segundo. Si superan la fruta, no se liquida (se descuenta menos anticipo).
- Liquidar deja el cupo **LIQUIDADO**: no más despachos, devoluciones, tarjas ni cambios de la compra.
- Anular una liquidación solo sin pagos registrados: el cupo vuelve a abrirse y los anticipos recuperan su saldo.

**Reglas acordadas con el usuario (28/10/2026)**
- Un pedido por semana/año. Las correcciones de Rusia **se editan**, no se duplican.
- Se escribe primero el **total de cajas de la semana** (ej. 150 000) y el pedido solo se guarda cuando las líneas suman exactamente ese total.
- Cada línea: cliente, cajas, incoterm (FOB/CFR/CIF), modalidad (bajo cubierta / contenedor / granel), contenedores × cajas, puerto de salida, CONTRATO o SPOT, N° de pedido, notas.
- **CONTRATO:** el precio sale del contrato vigente del cliente al lunes de esa semana (mismo incoterm o contrato sin incoterm) y **queda congelado** en la línea.
- **SPOT:** el precio se escribe a mano por línea y puede quedar pendiente. El historial de precios SPOT son las líneas de pedido.
- Un cliente compra por CONTRATO y por SPOT al mismo tiempo (por eso el tipo va en la línea, no en el cliente).
- Un cliente tiene **varias marcas** y una marca puede ser de **varios clientes** (DOÑA ELENA es de GT y de RVI). Rusia no escribe la marca: la elige Comercial al comprar la fruta.
- Una línea del pedido se puede repartir en **varios barcos** (Fase 2) y entre **varios productores** (Fase 3).
- El contrato MAGAP del productor es **solo referencia**, no bloquea.
- Logística distribuye en barcos y **Comercial compra contra el total de la semana** (por cliente), no por barco.
- Cada compra lleva **dos precios**: el **oficial** (ministerio, ej. 7,50) y el **real** pagado al productor (ej. 7,10). La diferencia se ve por caja y en total.
- Productores **y comercializadoras** venden fruta y retiran materiales.
- Cada compra es una línea del **cupo semanal** del productor. El Despacho de materiales entrega contra ese cupo: la marca y las cajas ya no se escriben a mano. Un productor **sin** cupo de Comercial se sigue despachando como antes (cupo manual).

**Fases**
| Fase | Contenido | Estado |
|---|---|---|
| 1 | Marcas por cliente, puertos de salida, pantalla Pedido semanal | ✅ 28/10/2026 |
| 2 | Modelo `ShipmentLine` arreglado; Logística arma los barcos de la semana y reparte cada línea (contenedores completos, sin pasarse); pendiente por embarcar | ✅ 28/10/2026 |
| 3 | Comercial compra el total de la semana: productor + cliente + marca + cajas + precio oficial/real; el Despacho **lee** el cupo | ✅ 28/10/2026 |
| 4 | Liquidación: tarjas, devolución ligada al cupo, anticipos, liquidar, pagos 80/20 o 100 % | ✅ 29/10/2026 |

---

## 5. Seguridad aplicada

Aplicado el 28/10/2026 (backend y frontend). Probado con pruebas automáticas en una transacción revertida (no dejaron datos).

**Acceso**
- Permisos por rol en **todas** las rutas de la API (middleware `rol:` nuevo → `app/Http/Middleware/PermitirRoles.php`). Antes, Exportaciones, contratos y precios estaban abiertos a cualquier usuario con sesión.
- Un BODEGUERO ya no puede abrir movimientos ni despachos de otra bodega cambiando el número en la URL.
- Editar o anular movimientos ya registrados: solo ADMIN y COORDINADOR_INVENTARIO.

**Sesión**
- Límite de **5 intentos de login por minuto** (frena que adivinen contraseñas). La pantalla de login lo explica.
- Límite general de 120 peticiones por minuto por usuario.
- La sesión (token) **vence a las 12 horas** (`SANCTUM_EXPIRATION`). Antes no vencía nunca.
- Cerrar sesión **borra el token en el servidor** (antes solo en el navegador; había 21 tokens vivos).
- Tokens vencidos se borran solos cada día (`sanctum:prune-expired`, requiere `php artisan schedule:run` en producción).
- Si la sesión vence, el frontend vuelve al login con el aviso "Tu sesión expiró" (interceptor 401 en [axios.js](src/api/axios.js)).
- `localStorage` dañado ya no deja la aplicación en blanco ([AuthContext.jsx](src/context/AuthContext.jsx)).

**API**
- CORS configurable (`config/cors.php`, variable `CORS_ALLOWED_ORIGINS`): en producción aceptar solo el dominio del frontend.
- Cabeceras de seguridad en todas las respuestas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` (`app/Http/Middleware/CabecerasSeguridad.php`).
- Se quitaron rutas rotas: `DELETE` de insumos/categorías (no existía el método) y `GET /warehouses/{id}/stock` (método inexistente).

**Integridad del inventario**
- **Bloqueo por bodega** al sacar stock (egreso, transferencia, despacho): dos personas ya no pueden sacar a la vez el mismo material y dejar el stock negativo (`InventoryMovement::bloquearBodega`, `pg_advisory_xact_lock`).
- Confirmar una transferencia: no se puede recibir **más** de lo enviado ni insumos que no se enviaron; tampoco confirmarla dos veces.
- Editar un ingreso de OC ya no **duplica** lo recibido; anularlo lo descuenta de la OC.
- Una OC **CANCELADA o CERRADA** ya no recibe mercadería ni "revive".
- Anular un ingreso/devolución se bloquea si el stock quedaría negativo.
- Las transferencias y los despachos no se editan/anulan como movimiento suelto (tienen su propio flujo).

**Repositorio**
- `.env` del frontend agregado a `.gitignore` + plantilla `.env.example`. Ya estaba subido a git: se quitó del índice con `git rm --cached .env` el 29/10/2026 (solo contenía la URL del backend, no claves).
- El `.env` del backend nunca estuvo en git ✅.

---

## 6. Estándares del proyecto

**Colores** (definidos una sola vez en [index.css](src/index.css), `@theme`)
| Uso | Clase | Color |
|---|---|---|
| Primario (encabezados, botón Nuevo, tablas) | `bg-primario`, `hover:bg-primario-hover`, `bg-primario-claro` | `#3B5BDB` |
| Botón **Guardar** (= verde del lápiz Editar) | `bg-guardar text-guardar-texto` | green-600 + ícono 💾 |
| Botón **Cancelar** (= rojo de Desactivar) | `bg-cancelar text-cancelar-texto` | red-600 + ícono ✕ |
| Activo / éxito | green-600 · Inactivo / error: red-600 · Pendiente: amber | |

**Componentes comunes** (`src/components/common/`) — usarlos en toda pantalla nueva:
`EncabezadoPagina`, `TablaEstandar` (buscador, pestañas ACTIVOS/INACTIVOS/TODOS, paginación), `EstadoBadge`, `AccionesFila` (Editar/Desactivar/Reactivar), `ModalShell`, `DialogoConfirmacion`, `ToastFlotante`. Mensajes de toast en [toastMessages.js](src/utils/toastMessages.js).

**Reglas**
- Nunca se borra físicamente: baja lógica con `PATCH .../deactivate` y `.../reactivate`.
- Textos de negocio en MAYÚSCULAS (se convierten al escribir).
- Clases de Tailwind escritas completas (en v4 las clases armadas con variables no se generan).
- Las relaciones de Laravel llegan en snake_case (`third_party`, no `thirdParty`).
- Toda validación del frontend se repite en el backend.
- Los cambios de base de datos van en migraciones.

---

## 7. Historial de cambios

### 29/10/2026 — Cierre de embarque, roles EXPORTACIONES/COMERCIAL, Usuarios y bodega de retiro
Según la hoja real de Logística "libro 2 wk 37" (Asignación de carga) y las decisiones del usuario.
- Migración `2026_10_29_000003_closing_roles_pickup_warehouse`: roles **EXPORTACIONES** y **COMERCIAL** en el CHECK de `users` + `users.status`; `shipments.loading_from/loading_to` (ventana de carga; `departure_date` es el zarpe); tabla **`shipment_bookings`** (una fila por booking: cliente, marca, CONTRATO/SPOT, BODEGA o CONTENEDOR, bodegas del barco, contenedores, booking, DAE, B/L, AUCP, orden, Forma A, consignee/notify con dirección, cupo, embarcado, ingreso, muestras, pesos por caja, estado DAE, estado); `producer_quota_lines.pickup_warehouse_id`.
- **Cierre de embarque** (EXPORTACIONES → *Cierre de embarque*, `ShipmentClosingController`, `GET/PUT /customer-orders/{id}/closing`): registra lo REAL. Se permite embarcar más o menos que el cupo y contenedores incompletos (aviso ámbar). Resumen por cliente CONTRATO/SPOT ("el contrato quedó corto en X; se completó con SPOT"). Tarja del puerto **por DAE** (una DAE cubre varios bookings): ingreso − embarcado = lo que no subió. Cruce con las tarjas registradas en Liquidación. Pesos y totales calculados (en el Excel el total de pesos solo sumaba la fila 4). Propone el último consignee/notify del cliente. No se repite un booking. Un barco con bookings no se puede quitar de la distribución. Imprime la "Asignación de carga" en horizontal ([ClosingPrint.jsx](src/components/ClosingPrint.jsx)). El listado de pedidos trae `shipped_boxes`.
- **Compra de fruta**: cada compra lleva la **bodega donde retira cartón y materiales** (obligatoria; se propone la última del vendedor; no se cambia si ya retiró, tiene tarjas o está liquidada). Se **permite comprar más de lo pedido** por cliente (aviso ámbar; antes se bloqueaba).
- **Despacho de materiales**: los cupos de Comercial salen por bodega de retiro; desde otra bodega no se pueden elegir (el backend responde "Este cupo se retira en otra bodega: BODEGA X"). Lo ya retirado se descuenta por bodega.
- **Cambios simultáneos** (`app/Http/Controllers/Concerns/ControlVersion.php`): Distribución, Compra de fruta y Cierre entregan una `version` y el PUT debe devolverla; si otro usuario guardó antes → **409** "OTRO USUARIO GUARDÓ CAMBIOS..." (las compras las cargan varios usuarios durante la semana). La fila del pedido se bloquea mientras se guarda.
- **Usuarios** (CONFIGURACIÓN, `UserController`, `/users`): crear, editar, desactivar (borra sus tokens), reactivar; un usuario desactivado no puede iniciar sesión (el login lo explica). BODEGUERO con su bodega.
- **Permisos**: escritura de Exportaciones `ADMIN, JEFE_BODEGA, COORDINADOR_INVENTARIO, EXPORTACIONES`; compras `ADMIN, COMERCIAL`; movimientos, stock, despacho y órdenes de compra solo para los roles de inventario (antes abiertos a cualquier usuario con sesión). Frontend: `RutaRoles` en AppRouter, menú por rol y pantalla de inicio por rol ([roles.js](src/routes/roles.js)).
- La API responde **401 en JSON** sin sesión aunque falte la cabecera Accept (antes daba 500 por la ruta "login" inexistente).
- Pruebas: **46 automáticas** en transacción revertida (roles, usuarios, versión 409, bodega de retiro, sobre-pedido, despacho por bodega, cierre con los 10 bookings reales de la WK37 = 153.593 cajas) + recorrido en Chrome de las pantallas por rol (sin errores de consola) y del PDF de impresión; los datos temporales se borraron.

### 29/10/2026 — Compra por barco + marca (según la hoja real "wk 37")
- Migración `2026_10_29_000002_create_purchase_blocks`: `shipments.voyage` (N° de viaje; el barco queda solo con su nombre), tabla `purchase_blocks` (barco + marca + cliente + modalidad + puerto + **meta**), en cada compra `purchase_block_id`, `producer_id` (productor real si se compró a un comercial), `farm_name`, `mag_code`, `executive`, `cut_date`, `delivery_port_id`, `transport_deduction`, `notes`; `tally_sheets.container_number`; `settlements.transport_amount` y `settlement_lines.transport_deduction`. Se quitó el UNIQUE (cupo, marca, cliente): un vendedor puede tener varias compras de la misma marca.
- **Compra de fruta** rehecha por bloques: cada bloque muestra meta / comprado / falta (la meta es referencia, como en la hoja); la compra se hace al **comercial o directo al productor**; el transporte de contenedor es lo que negocia Comercial al comprar.
- Distribución en barcos: campo **Viaje** por barco (sale en la impresión). Un barco con compras no se puede quitar.
- Tarjas: columna **Contenedor**; al elegir la compra se propone el barco de su bloque.
- Liquidación: descuenta el **transporte negociado** de las compras que llegaron a puerto (`Neto = fruta − materiales − transporte − anticipos`).
- Pruebas: 13 nuevas (bloques, viaje, contenedor, transporte) + las 34 de liquidación adaptadas, todas OK en transacción revertida.

### 29/10/2026 — Liquidación al productor (Fase 4)
Menú **LIQUIDACIÓN** (solo ADMIN): *Tarjas*, *Anticipos y préstamos*, *Liquidar*, *Pagos e historial*.
- Migración `2026_10_29_000001_create_settlement_tables`: `producer_quota_lines.negotiation_type` (CONTRATO/SPOT) y `payment_scheme` ('100'/'80_20'); tablas `tally_sheets`, `producer_advances`, `settlements` (una activa por cupo, índice único parcial), `settlement_lines`, `settlement_materials`, `settlement_advances`, `settlement_payments`. La categoría CONTENEDORES deja de cobrarse al productor.
- Backend: `TallySheetController` (`GET/PUT /customer-orders/{id}/tallies`), `ProducerAdvanceController` (`/producer-advances`), `SettlementController` (`/settlements`: quotas, preview, store, show, pay, unpay, annul). Todo bajo middleware `admin`.
- Devolución de productor: nuevo `producer_quota_id` en el movimiento DEVOLUCIÓN (obligatorio si tiene semanas sin liquidar con material retirado; no más de lo retirado; no a un cupo liquidado). Endpoint `GET /inventory-movements/returnable-quotas/{tercero}`. Una devolución ligada se anula (no se edita).
- Compra de fruta: columnas Tipo (CONTRATO/SPOT) y Pago (100 % / 80-20); CONTRATO se propone si el productor tiene contrato MAGAP vigente. Una compra con tarjas no se quita ni cambia de productor/marca/cliente.
- Frontend: `TalliesPage`, `TallySheetPage`, `ProducerAdvancesPage` + `ProducerAdvanceModal`, `SettlementsPage`, `SettlementFormPage`, `SettlementDetailPage` (imprimible), `SettlementHistoryPage`; selector "Semana a la que devuelve" en Nuevo movimiento → DEVOLUCIÓN.
- Probado con 34 pruebas automáticas en transacción revertida (ejemplo de 300 cajas: neto 1.497,00 = 1.775 fruta − 178 materiales − 100 anticipo; pagos 1.142 + 355).

### 29/10/2026 — Librerías con fallas de seguridad actualizadas
- Backend (`composer audit`: 30 avisos en 8 paquetes → **0**): Laravel 12.62 → **12.70.2** (había uno *crítico*: saltarse la autenticación por token), Guzzle 7.16, Symfony 7.4.22, league/commonmark 2.10, flysystem 3.36. Mismas versiones mayores; las 80 pruebas siguen OK.
- Frontend (lo que se descarga al navegador → **0**): axios 1.21, react-router-dom 7.18.5 (había redirección abierta).
- Pendiente: herramientas de compilación (postcss, nanoid, browserslist…, solo se usan al construir): detener `npm run dev` y ejecutar `npm audit fix` (Windows bloquea los archivos mientras corre).

### 29/10/2026 — Velocidad al cambiar de menú + prueba de Inventario
- **Precarga de pantallas**: las rutas de cada pantalla pasaron a [paginas.js](src/routes/paginas.js); `Layout` las descarga en segundo plano (una por una, desde 1,5 s después de entrar). Cambiar de menú ya no espera la descarga. La carga inicial sigue en ~300 KB.
- **Vite `server.warmup`** ([vite.config.js](vite.config.js)): en `npm run dev` las pantallas quedan compiladas al arrancar (antes se compilaban al abrirlas por primera vez).
- **Backend `CACHE_STORE=file`** (antes `database`): el límite de peticiones (throttle) hacía 6 consultas por petición, una con `SELECT … FOR UPDATE` que ponía en fila las peticiones simultáneas. Ahora cada petición hace solo sus consultas propias. Medido: todas las API < 70 ms.
- **Corrección Órdenes de compra**: un INGRESO contra una OC solo acepta insumos de la OC y **no más de lo pendiente** (antes una OC COMPLETA seguía recibiendo). Al editar un ingreso, lo que ese ingreso ya había recibido vuelve a contar como pendiente.
- **Prueba de Inventario (33/33 OK, transacción revertida)**: OC → ingreso parcial/total y estados; no recibir de más ni insumos ajenos; OC cerrada no recibe; egreso sin stock bloqueado; merma; stock general; transferencia (no recibir más de lo enviado, ni otro insumo, ni dos veces; solo coordinador/admin confirma); permisos del BODEGUERO (otra bodega, motivos de ajuste, ver movimientos ajenos, crear OC); JEFE_BODEGA no anula; no anular ingreso si el stock quedaría negativo; despacho por receta (cálculo, stock), devolución ligada al cupo y anulación del despacho.

### 29/10/2026
- **Comercializadoras → CONFIGURACIÓN** (ruta `/comercializadoras`, solo ADMIN): es la misma pantalla de Terceros filtrada al tipo COMERCIALIZADORA (`TercerosPage` acepta `tipoFijo`); "Nueva comercializadora" ya viene con ese tipo. Se quitó "Comercializadoras — Próximamente" de COMERCIAL.
- **Dashboard gerencial (DEMOSTRACIÓN, datos de ejemplo)** en [DashboardPage.jsx](src/pages/dashboard/DashboardPage.jsx): indicadores de la semana (pedido, % comprado, embarcado, ahorro precio real vs oficial, % rechazo), cajas por semana (pedido/comprado/embarcado), cajas por cliente, precio oficial vs real, top productores, barcos de la semana, calidad por productor, pagos pendientes 80/20 y materiales bajo el mínimo. Recharts; colores validados para daltonismo; cada gráfico tiene vista de tabla. Pendiente: conectar a datos reales.
- **Recetas**: el menú dice ahora *Marcas y recetas* (CONFIGURACIÓN); se quitó "SKU / Recetas — Próximamente" de EXPORTACIONES. Escribir recetas: solo ADMIN (antes también JEFE_BODEGA y COORDINADOR).
- **Puertos → CONFIGURACIÓN** (solo ADMIN; la URL `/exportaciones/puertos` no cambia). Pantalla rehecha con los componentes comunes: buscador, pestañas de estado, filtro SALIDA/DESTINO, columnas código/ciudad/país/tipo, botón **Tarifas** que abre debajo los conceptos del puerto, diálogos y avisos estándar. `PortModal` en 2 columnas con `DialogoConfirmacion`. Backend: crear/editar/desactivar puertos y tarifas solo ADMIN (la lectura sigue abierta al personal para pedidos y barcos).
- Barcos UNIREEFER cargados: COOL EXPLORER UNI1406, SNOW FLOWER UNI1404, WILD PEONY UNI1405, DITLEV UNI1402, BALTIC HOLLYHOCK UNI1403, CS CARE UNI1399, BALTIC SPIRIT UNI1397, COOL EAGLE UNI1398. Pendiente decidir si el N° de viaje (UNIxxxx) sale del nombre del barco y pasa al embarque.
- **Imprimir el pedido semanal**: nueva acción *Imprimir* (ícono de impresora gris) en la tabla de Pedido semanal y botón *Imprimir* en el modal Ver. Hoja horizontal con cabecera, líneas (precio y monto) y resumen por cliente; marca PEDIDO ANULADO si aplica. `AccionesFila` acepta ahora `onImprimir` (opcional) para reutilizarlo en otras tablas.
- **Imprimir la distribución semanal**: botón *Imprimir* en Distribución en barcos. Hoja horizontal con un bloque por barco (naviera, puertos, fechas, ETA, líneas, contenedores y cajas), resumen por cliente, lo pendiente por embarcar y firmas. Si hay cambios sin guardar sale marcada **BORRADOR** ([DistributionPrint.jsx](src/components/DistributionPrint.jsx)).
- **Carga por partes** (`React.lazy` en [AppRouter.jsx](src/routes/AppRouter.jsx) + `Suspense` en Layout): el JS inicial bajó de más de 500 KB a 304 KB; cada pantalla se descarga al abrirla.
- Fincas: el selector de productor ya no muestra productores inactivos (salvo el que la finca ya tenía).
- Limpieza: se borraron páginas y archivos sin uso (`CompradoresPage`, `inventario/ShipmentFormPage`, `inventario/ShippingLinesPage`, `SuppliesPage`, `SupplyCategoriesPage`, `App.jsx`, `App.css`, `src/assets/*`, `public/favicon.svg`, `public/icons.svg`, `src/api/shipments.js`, el `.code-workspace`) e íconos sin uso del menú.
- Git: `.env` sacado del repositorio (`git rm --cached`) y renombre de Fincas preparado. Quedan **en espera del commit**.

### 28/10/2026 — Fases 2 y 3 del flujo de pedidos
**Fase 2 · Distribución en barcos (Logística)** — menú EXPORTACIONES → *Distribución en barcos*
- Migración `2026_10_28_000003_link_shipments_to_customer_orders`: barcos ligados al pedido (`customer_order_id`, `vessel_id`, `destination_port_id`, `eta`) y cada reparto ligado a su línea (`customer_order_line_id`).
- `app/Models/ShipmenLine.php` (nombre mal escrito, copia de Shipment) reemplazado por `ShipmentLine.php` real.
- `ShipmentDistributionController` (`GET/PUT /customer-orders/{id}/distribution`): valida que el barco sea de la naviera, puertos SALIDA/DESTINO, ETA ≥ salida, contenedores completos y que no se embarque más de lo pedido. Quitar un barco = baja lógica.
- El pedido ya no permite quitar una línea embarcada, cambiarle el cliente o dejarla con menos cajas que las embarcadas.
- Pantallas `OrderDistributionsPage` (avance por semana) y `OrderDistributionPage` (barcos + hoja líneas × barcos, botón **+** para completar, aviso si el puerto no coincide).

**Fase 3 · Compra de fruta (Comercial)** — menú COMERCIAL → *Compra de fruta*
- Migración `2026_10_28_000004_add_purchase_fields_to_producer_quotas`: cupo ligado al pedido; cada línea con `customer_id`, `brand_id`, `official_price`, `real_price`. UNIQUE (cupo, marca) → (cupo, marca, cliente).
- `PurchaseAllocationController` (`GET/PUT /customer-orders/{id}/purchases`): solo productores/comercializadoras activos, marca del cliente, no comprar más de lo pedido por cliente; no se quita ni cambia una compra con materiales ya retirados o cupo liquidado.
- Pantallas `PurchasesPage` y `PurchaseAllocationPage` (resumen por cliente, precio oficial vs real, diferencia, referencia MAGAP asignado/contratado).
- **Despacho de materiales**: nuevo `GET /material-dispatch/quotas/{tercero}`; si el productor tiene cupo de Comercial se elige el cupo y la marca/cajas quedan fijas; el despacho ya no reescribe las cajas del cupo. Sin cupo de Comercial sigue el flujo manual.
- Corrección: `getThirdParties()` no enviaba filtros, y el formulario de Clientes mostraba todos los terceros en vez de solo los tipo CLIENTE.

### 28/10/2026
**Seguridad y buenas prácticas** — todo lo de la [sección 5](#5-seguridad-aplicada). Además, cancelar una OC que ya recibió algo ahora la deja **CERRADA** (el frontend ya lo esperaba; el backend siempre ponía CANCELADA).

**Pedido semanal (Fase 1)**
- Migración `2026_10_28_000001_add_customer_brands_and_port_type`: tabla `customer_brand`, columnas `code`, `city`, `port_type` en `ports` (el modelo usaba `code/city` sin que existieran), puertos GUAYAQUIL (GYE) y PUERTO BOLÍVAR (PBO).
- Migración `2026_10_28_000002_add_expected_boxes_to_customer_orders`: total de cajas de la semana.
- Backend: `CustomerOrder`, `CustomerOrderLine`, `CustomerOrderController` (rutas `/customer-orders`).
- Frontend: `CustomerOrdersPage`, `CustomerOrderFormPage` (líneas, precio de contrato automático, cuadre contra el total, resumen por cliente).
- Clientes: selector de marcas. Puertos: tipo SALIDA/DESTINO.
- Botón **Ver** (ojo azul) en Pedido semanal: modal de solo lectura `CustomerOrderViewModal` con líneas, precios guardados, montos y resumen por cliente. `AccionesFila` acepta ahora `onVer` (opcional) para reutilizarlo en otras tablas.

**Interfaz**
- Paleta unificada (`primario`) en las 27 pantallas; botones Guardar verde / Cancelar rojo con íconos en todos los formularios.
- Terceros, Fincas, Clientes, Destinos y Contratos de clientes migrados a los componentes comunes.
- Nuevos `DialogoConfirmacion` y `ToastFlotante`.
- Marcas movida a CONFIGURACIÓN; se quitó el "Marcas — Próximamente" duplicado de COMERCIAL.
- Botón "Agregar línea" visible; corrección del layout (las tablas anchas ya no cortan la página).

**Correcciones**
- Clientes: un cliente compra por CONTRATO y SPOT a la vez (se quitó el tipo de negociación del cliente; error "third party id has already been taken").
- `Booking`: faltaba `client_id` y la relación `client()` (GET /bookings daba 500 con datos).
- `third_party` vs `thirdParty` en BookingModal y Nuevo movimiento.
- `cancelTransfer` usaba POST en vez de PATCH (405).
- `fincasPage.jsx` → `FincasPage.jsx` (fallaba en Linux/producción).
- Rendimiento: OPcache activado.

### Antes del 28/10/2026 (según git)
| Fecha | Cambio |
|---|---|
| 28/10 | Componentes comunes; Terceros/Fincas migrados; menú CONFIGURACIÓN; Terceros y Fincas sin DELETE |
| 20/10 | Despacho: una marca por retiro, recomendado vs real |
| 08/10 | Clientes (CHECK CONTRATO/SPOT, bloqueo de código), toasts, sidebar desplegable |
| 25/09 | Marcas (validación de código) + Clientes reescritos |
| 11/09 | Cancelación de OC con motivo, impresión compacta, acordeón en Stock |
| 05/09 | Lectura de terceros para todos los roles; sección Logística |
| 03–04/09 | Bodegueros, DEVOLUCIÓN, vista restringida del BODEGUERO, login con Enter |
| 02/09 | Ciclo completo OC → Ingreso con recepción parcial |
| 31/08 | Módulos de inventario y stock |
| 15–18/06 | Configuración inicial React + Laravel + Sanctum, login, despliegue en Render |

---

## 8. Pendientes

### Alta prioridad
- [ ] **Subir a producción** en el VPS (faltan los datos de acceso): ver [Checklist](#9-checklist-para-producción).
- [ ] Crear los usuarios reales de Exportaciones y Comercial en CONFIGURACIÓN → Usuarios.
- [ ] Confirmar qué significa el estado "21" de la DAE (el usuario lo va a preguntar).
- [ ] Pantalla **Bookings** antigua (tabla `bookings`, vacía): con el Cierre de embarque queda duplicada; decidir si se quita del menú.
- [ ] Liquidación de cupos **manuales** (despachos sin compra de Comercial): hoy no se liquidan porque no tienen precio real ni tarjas.
- [ ] Probar la Liquidación en el navegador con datos reales (el backend está probado; las pantallas compilan).
- [ ] Dashboard: reemplazar los datos de ejemplo por un endpoint `/dashboard` con datos reales.
- [ ] Notificaciones por WhatsApp a gerencia (ej. "operación de la semana lista"): por decidir la vía (Meta WhatsApp Cloud API, Twilio o enlace wa.me).
- [ ] Cargar los **contratos MAGAP** de los productores (tabla `contracts` vacía): hoy la referencia MAGAP muestra "SIN CONTRATO".
- [ ] Decidir si se elimina el **cupo manual** del despacho (productores sin compra de Comercial) cuando todo el flujo esté en uso.
- [ ] Antiguos `ShipmentController`/`ShipmentLineController` (basados en SKU) en el backend: sin uso; el SKU aún no existe (la pantalla `ShipmentFormPage` ya se borró).
- [ ] Confirmar si **GT** y **GRAND TRADE - JSC** son el mismo cliente (hoy son dos fichas distintas).

### Media
- [ ] Migrar a componentes comunes: Bookings, Navieras, Puertos, Bodegas, Motivos, Insumos, Órdenes de compra, Historial de despachos, ShippingLineModal.
- [ ] Errores de lint `react-hooks/set-state-in-effect` (patrón de carga en `useEffect` en casi todas las páginas).
- [ ] Desactivar marcas de prueba (PRUEBA DOS, MARCA DE PRUEBA).

### Limpieza (código sin uso)
- [ ] En `inventoryMovements.js`: `getInventoryMovements`, `updateInventoryMovement`, `deactivateInventoryMovement` sin uso (se dejan por si se usan en un historial de movimientos).
- [ ] Dependencia `recharts` (sin uso hasta que exista el Dashboard).

---

## 9. Checklist para producción

- [ ] Backend `.env`: `APP_ENV=production`, `APP_DEBUG=false` (con `true` se muestran rutas y consultas internas al público).
- [ ] `CORS_ALLOWED_ORIGINS` = dominio real del frontend.
- [ ] `SANCTUM_EXPIRATION` acorde a la jornada (720 = 12 h).
- [ ] Programador de tareas: `* * * * * php artisan schedule:run` (borra tokens vencidos).
- [ ] `php artisan config:cache` y `php artisan route:cache` al desplegar.
- [ ] HTTPS obligatorio en frontend y backend.
- [ ] OPcache activado en el servidor.
- [ ] Contraseñas de usuarios cambiadas y robustas; contraseña de PostgreSQL distinta a la de desarrollo.
- [ ] Respaldo diario de la base de datos.
- [x] `git rm --cached .env` en el frontend (hecho 29/10/2026; se aplica con el próximo commit).
