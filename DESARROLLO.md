# SIAE — Sistema Integral AGAT-ECUAGREEN

Registro de desarrollo: qué está hecho, qué se corrigió y qué falta.
Cubre los dos repositorios: **siae-frontend** (este) y **siae-backend**.

> **Cómo mantener este archivo:** cada vez que se termine un cambio, agregar una línea en
> [Historial de cambios](#7-historial-de-cambios) y mover la tarea de [Pendientes](#8-pendientes)
> a la sección del módulo que corresponda.

Última actualización: **30/10/2026** (listas con búsqueda; precio oficial MAG y nota de crédito; bitácora; instalación en producción; permisos por persona)

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
| **COMERCIAL** | 0 (nuevo 29/10) | Compra de fruta (bloques, compras, precios, bodega de retiro) y Precios oficiales MAG. Lee pedido y barcos por la API, sin editarlos. |
| **DEPARTAMENTO** | nuevo 05/11 | Un usuario por departamento (Compras, Sistemas, Logística…): llena sus órdenes de compra y ve solo las de su departamento. |
| **CONTABILIDAD** | nuevo 05/11 | Aprueba (única) las OC de todos los departamentos, genera el TXT de pagos de Banco Pichincha y maneja las cuentas bancarias de proveedores. |
| **LIQUIDACIONES** | nuevo 06/11 | Departamento de Liquidaciones: contratos y régimen de retención de productores, parámetros de la semana, tarjas, anticipos, liquidar, pagos y notas de crédito. |

Los usuarios se crean en **CONFIGURACIÓN → Usuarios** (solo ADMIN). Desactivar un usuario le cierra la sesión al instante.

**Dónde se controla**
- Frontend (solo visual): `RutaSoloAdmin`, `RutaNoBodeguero`, `RutaSoloCoordinador` en [AppRouter.jsx](src/routes/AppRouter.jsx) y el menú en [Sidebar.jsx](src/components/Sidebar.jsx).
- Backend (la protección real): middleware `admin` y `rol:` en `routes/api.php`, más reglas por bodega dentro de los controladores.

| Grupo de rutas API | Lectura | Escritura |
|---|---|---|
| Terceros | todos | ADMIN |
| Fincas | ADMIN | ADMIN |
| Marcas | todos (Despacho las necesita) | ADMIN |
| Destinos, Contratos de clientes | todos menos BODEGUERO | ADMIN |
| Pedido semanal, Distribución en barcos, Cierre de embarque, Navieras, Barcos, Bookings | todos menos BODEGUERO | ADMIN, JEFE_BODEGA, COORDINADOR_INVENTARIO, EXPORTACIONES |
| Compra de fruta | todos menos BODEGUERO | ADMIN, COMERCIAL |
| Puertos, Tarifas | todos menos BODEGUERO | ADMIN |
| Usuarios | ADMIN | ADMIN |
| Movimientos, Stock, Despacho, Órdenes de compra | solo roles de INVENTARIO (+ BODEGUERO) | según la fila de cada uno |
| Bodegas, Insumos, Categorías, Motivos, Recetas | todos | todos menos BODEGUERO |
| Movimientos: crear / transferir | todos (BODEGUERO solo en su bodega) | — |
| Movimientos: ver historial y kárdex | JEFE_BODEGA, COORDINADOR_INVENTARIO, ADMIN (todas) · BODEGUERO (solo su bodega) | — |
| Movimientos: editar / anular | — | ADMIN, COORDINADOR_INVENTARIO (pantalla "Movimientos y kárdex") |
| Transferencias: confirmar / cancelar | ADMIN, COORDINADOR_INVENTARIO (todas) · BODEGUERO de la bodega destino (pantalla "Recibir transferencias", solo confirmar) | ADMIN, COORDINADOR_INVENTARIO |
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
| Clientes | — | **Quitada 02/11/2026**: repetía Terceros. La ficha del cliente (país, contacto, dirección, **marcas**, activo) se edita en Terceros. |
| Destinos | ✅ | |
| Contratos de clientes | ✅ | Precio por caja + vigencia + incoterm. No se permiten dos contratos activos que se crucen. |
| Marcas | ✅ | Movida desde Exportaciones el 28/10/2026. |
| **Usuarios** | ✅ | Nuevo 29/10/2026. Crear, editar (contraseña opcional), desactivar/reactivar; BODEGUERO con su bodega. 30/10/2026: perfil, "asistente de" y excepciones por persona (pantallas EXTRA o QUITADAS). |
| **Perfiles y permisos** | ✅ | Nuevo 30/10/2026. Perfil = nombre + tipo base + pantallas. Los 6 perfiles iniciales reproducen los roles de antes; 02/11/2026 se agregó GERENCIA. Solo ADMIN. |
| **Bitácora** | ✅ | Nuevo 30/10/2026. Quién creó/editó/desactivó/borró qué, con fecha y hora, campo por campo; inicios y cierres de sesión. Filtros por usuario, módulo, acción, fechas y texto. Solo ADMIN, solo lectura. |

### EXPORTACIONES
| Pantalla | Estado | Notas |
|---|---|---|
| **Pedido semanal** | ✅ | Nuevo 28/10/2026. Ver [sección 4](#4-flujo-de-negocio-pedido-semanal). |
| Navieras | ✅ | |
| Bookings | — | **Quitada 05/11/2026**: tabla suelta que repetía Distribución en barcos (barco, viaje, ETA) + Cierre de embarque (N° de booking). La tabla `bookings` queda en la base (0 registros en producción). |
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
| Por despachar | ✅ | (05/11/2026) Bandeja del bodeguero. Desde el 10/11/2026 solo muestra las compras que Comercial **envió a bodega**; contador en el menú. |
| Despacho de materiales | ✅ | Receta (BOM) por marca y cajas; guía de remisión. Desde el 28/10/2026 se despacha contra el **cupo de Comercial** (marca y cajas fijas); desde el 10/11/2026, solo lo enviado a bodega. |
| Historial de despachos | ✅ | Reimprimir guía, anular. |
| Transferencias pendientes | ✅ | Confirmar (con ajuste por pérdida/daño) o cancelar. El faltante se registra como MERMA/DAÑO en la bodega destino. |
| Recibir transferencias | ✅ | (31/10/2026) El bodeguero de la bodega destino confirma lo que le llega; no cancela. |
| Movimientos y kárdex | ✅ | (31/10/2026) Historial con filtros (bodega, tipo, insumo, fechas, texto), activos/anulados, recibo; kárdex por insumo y bodega con saldo inicial y acumulado. El Coordinador corrige (fecha, motivo, tercero, guía, referencia, líneas) o anula; transferencias, despachos y devoluciones de cupo siguen en su propia pantalla. |
| Órdenes de compra | ✅ | Código OC-AAAA-NNNN, IVA 15/5/0, retenciones, cancelar/cerrar con motivo. "Ver todos los insumos"; al guardar, los insumos quedan vinculados al proveedor. |

### COMERCIAL y LIQUIDACIÓN
| Pantalla | Estado | Notas |
|---|---|---|
| **Compra de fruta** | ✅ | Nuevo 28/10/2026 (Fase 3). Productor/comercializadora + cliente + marca + cajas + precio oficial + precio real. Desde 29/10: CONTRATO/SPOT, forma de pago (100 % u 80/20), **bodega de retiro** y se permite comprar de más (aviso ámbar). Desde 30/10: propone el **precio oficial MAG** y muestra la **nota de crédito** por compra. |
| **Precios oficiales MAG** | ✅ | Nuevo 30/10/2026. Precio por caja por tipo de caja y vigencia (N° de acuerdo ministerial); no se permiten dos precios activos en las mismas fechas. ADMIN y COMERCIAL. |
| Comercializadoras | ⏳ | |
| **Tarjas** | ✅ | Nuevo 29/10/2026. Por camión: embarcadas, caídas, rechazadas; barco, placa, N° tarja. Solo ADMIN. |
| **Anticipos y préstamos** | ✅ | Nuevo 29/10/2026. Monto, descontado y saldo; se descuentan en la liquidación. Solo ADMIN. |
| **Liquidar** | ✅ | Nuevo 29/10/2026. Cupo (productor + semana): fruta − materiales − anticipos; código LIQ-00000001; imprimible; anular sin pagos. Solo ADMIN. |
| **Pagos e historial** | ✅ | Nuevo 29/10/2026. Registrar 1er pago (100 % / 80 %) y 2do pago (20 %) con fecha y comprobante; bandeja de pendientes. Solo ADMIN. |
| **Notas de crédito** | ✅ | Nuevo 30/10/2026. Bandeja POR RECIBIR / RECIBIDAS con el total que debe cada vendedor; el N° de factura y de NC se registra en el detalle de la liquidación. Solo ADMIN. |
| Dashboard | ⏳ | Demostración con datos de ejemplo. **Solo GERENCIA** (y ADMIN) desde 02/11/2026. |

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
- **09/11/2026 — Cambio de contraseña obligatorio (LOPDP):** al primer ingreso (o cuando el ADMIN le pone una nueva) y cada **3 meses**. El ADMIN queda fuera. Mientras tanto la API responde `403 CAMBIAR_CLAVE` a todo menos `/me`, `/me/password` y `/logout` (middleware `clave`). Ver historial 09/11/2026.

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
`EncabezadoPagina`, `TablaEstandar` (buscador, pestañas ACTIVOS/INACTIVOS/TODOS, paginación), `EstadoBadge`, `AccionesFila` (Editar/Desactivar/Reactivar), `ModalShell`, `DialogoConfirmacion`, `ToastFlotante`, `SelectBuscable`. Mensajes de toast en [toastMessages.js](src/utils/toastMessages.js).

**Reglas**
- Nunca se borra físicamente: baja lógica con `PATCH .../deactivate` y `.../reactivate`.
- Textos de negocio en MAYÚSCULAS (se convierten al escribir).
- Clases de Tailwind escritas completas (en v4 las clases armadas con variables no se generan).
- Las relaciones de Laravel llegan en snake_case (`third_party`, no `thirdParty`).
- Toda validación del frontend se repite en el backend.
- Los cambios de base de datos van en migraciones.
- **Bitácora**: todo modelo nuevo lleva `use \App\Models\Concerns\Auditable;`. Borrar o actualizar varios registros se hace uno por uno (`->get()->each->delete()`), nunca con `where(...)->delete()/update()`.
- **Pantalla nueva** (permisos por persona): agregar su clave en `siae-backend/config/pantallas.php`, la misma `pantalla` en [menu.js](src/routes/menu.js), la ruta con `P('clave', <Pagina />)` en AppRouter y proteger su API con `->middleware('pantalla:clave')`. No usar `rol:` para dar acceso a una pantalla (solo para acciones internas que dependen del tipo base).
- **No usar `<select>` nativo**: usar `SelectBuscable` (mismas props y `<option>`/`<optgroup>`), que permite escribir para buscar.
- **No usar `<input type="number">`**: usar `CampoNumero` (`decimales={0}` para cajas y cantidades por pieza, `2` para dinero; `max` opcional). El tipo number del navegador deja pasar letras y convierte lo inválido en vacío (se guardaba 0).
- **Montos en pantalla:** `dinero()` de `utils/formato.js` (formato es-EC, 1.234,56), no `toFixed(2)`. **Fechas en pantalla:** dd/mm/aaaa.
- **Fecha de hoy:** `hoyISO()` de `utils/fecha.js`, nunca `new Date().toISOString()` (es UTC: desde las 19:00 da mañana).
- **Botones de solo icono:** siempre con `title` y `aria-label`. **Cancelar / Cerrar:** `bg-cancelar` (gris); el rojo solo para desactivar o anular.
- **Textos:** español de Ecuador (tú): "Selecciona", "Elige", no "Seleccioná", "Elegí".

---

## 7. Historial de cambios

### 10/11/2026 — Modalidades de carga unificadas, bodega opcional y carga de la compra WK40 (solo en local y en la copia, sin subir)
- **Modalidades** (pedido de Exportaciones y Logística): son las mismas 4 en el pedido, la distribución, la compra (bloques) y el cierre (bookings).
  - GRANEL BAJO CUBIERTA, PALETIZADO BAJO CUBIERTA, CONTENEDOR AL GRANEL y CONTENEDOR PALETIZADO.
  - Los códigos son los del pedido (`CAJA_` = paletizado). En el backend están en `CustomerOrderLine::TIPOS_CARGA` y `esContenedor()`; en el frontend, en [utils/modalidades.js](src/utils/modalidades.js).
  - Migración `2026_11_10_000005_modalidades_carga_unificadas`: `purchase_blocks.cargo_mode` y `shipment_bookings.cargo_mode` pasan a varchar(25) con un CHECK nuevo. Lo existente pasa a la versión GRANEL (BAJO_CUBIERTA/BODEGA → GRANEL_BAJO_CUBIERTA, CONTENEDOR → GRANEL_CONTENEDOR). En la copia de producción eran 1 bloque y 11 bookings.
  - El cierre, la impresión del cierre y los gastos por viaje reconocen el contenedor por `_CONTENEDOR`.
- **Bodega de retiro opcional:**
  - El backend acepta compras sin bodega, para la carga histórica.
  - La pantalla la sigue exigiendo en las compras nuevas, y deja volver a guardar las que no la tienen.
- **Cliente AGAT-ECUAGREEN S.A.S** (la empresa se vende su propia fruta): lo crean ellos en Terceros como CLIENTE, con su RUC, país y marcas.
- **Precio MAG 2026:** $7,50 por la caja 22XU, Acuerdo Ministerial 107, vigente del 01/01 al 31/12/2026. Se registra una vez al año en Precios MAG; en producción no estaba registrado.
- **Carga de la compra WK40** desde `SEGUIMIENTO DE COMPRAS 2026 RESPALDO.xlsx`, hoja WEEK40_2026: 261 compras en 12 bloques, 149.384 cajas estimadas, igual que el Excel.
  - Pasa por el mismo `PUT /customer-orders/{id}/purchases` que la pantalla.
  - Script `carga_wk40.php`: exige `CARGA_BD` y con `CARGA_SIMULAR=1` revierte todo.
  - Reglas del usuario:
    - cajas = estimadas (las terminadas van en Tarjas);
    - precio del Excel = precio real;
    - bodega vacía;
    - BANDA = PACKED y SPOT;
    - GLOBAL VILLAGE va a RVI; PALM BANANAS y DOÑA ELENA, a GT.
  - STAR SPIRIT está en el pedido WK39 del sistema, así que sus 133 compras (84.937 cajas) van a la compra de la WK39 con el día de corte del Excel.
  - PALLETS SUR queda con la entrega vacía y una nota, pendiente de confirmar.
  - Se crearon 65 productores, 16 comercializadoras y 152 fincas con el nombre del Excel y sin RUC, para validar. Las decisiones están en `WK40_carga_decisiones.csv`.
  - **Hecho en la copia `siae_copia` (respaldo de producción del 10/11 15:08 UTC), no en producción.**
- Pruebas: envío 32/32 (nuevas: compra sin bodega), exportaciones 96 (solo las 4 viejas de `/bookings`), presentación 21, NC 36, liquidación 40, bitácora 22, proforma 8, bandeja 18, huella 12. Las pruebas pasaron a los códigos nuevos de modalidad. Build OK.

### 10/11/2026 — Compra de fruta: un color suave por barco (solo en local, sin subir)
- Pedido del usuario (revisión de interfaz del módulo comercial): que al llenar no se pierda entre bloques y en la fila de 19 columnas.
- Se probó también un color por grupo de columnas (vendedor, entrega, precio…); el usuario prefirió la tabla **sin colores, como estaba**, y se quitó.
- [PurchaseAllocationPage.jsx](src/pages/comercial/PurchaseAllocationPage.jsx):
  - **Cada barco con su color suave**: la cabecera y un borde izquierdo grueso del bloque. Los bloques del mismo barco comparten color. Son 6 tonos: turquesa, naranja, índigo, lima, cian y amarillo. A pedido del usuario no hay rojo, rosado ni fucsia. Se asignan por el orden de los barcos de la semana y, si hay más de 6, se repiten.
  - **"#" y "Se le compra a" quedan fijos a la izquierda** al desplazar la tabla. Toman el mismo fondo gris o blanco de la fila.
  - Vendedor y cajas vacíos llevan **borde ámbar**, como ya tenían finca y bodega.
  - Arriba de los bloques, una leyenda **"BARCOS DE LA SEMANA"** con el color de cada barco.
  - El estado de la meta sigue en la columna FALTA y en el texto al pasar el mouse sobre el bloque.
  - Solo cambia la apariencia: no toca lo que se guarda.
- Revisado en Chrome a 1600 px (capturas `colores-*.png`): el vendedor queda fijo a 37 px del borde al desplazar y no hay errores de consola. Lint sin avisos, build OK.

### 10/11/2026 — El Despacho ya no exige "Enviar a bodega" (pedido del usuario mientras se cuadra la operación)
- El usuario pidió que, por ahora, el envío a bodega **no sea requisito para despachar** (se está cuadrando exportaciones → comercial → tarjas → liquidaciones con lo histórico).
- `MaterialDispatchController`: los cupos (`/material-dispatch/quotas`) y las cajas a entregar vuelven a contar **todas** las compras; se quita el mensaje "Comercial todavía no envía esta compra a bodega".
- La bandeja **Por despachar** y el contador siguen mostrando solo lo enviado: las compras históricas que se carguen no se envían y no llenan la bandeja.
- Probado: envío 30/30 (ajustado: sin enviar sale en cupos y calcular da 200), por despachar 18/18, inventario 111/111; exportaciones solo las 4 fallas viejas de `/bookings`.

### 10/11/2026 — Compra de fruta: "Enviar a bodega" y contador de "Por despachar" (en producción desde 10/11/2026)
- **Producción** (10/11/2026 09:39, a pedido del usuario): respaldos `~/respaldos/siae_production_20261110_1439_antes_envio_bodega.sql`, `frontend_dist_20261110_1439_antes_envio_bodega.tgz` y `backend_env_20261110_1439_antes_envio_bodega` (hora del servidor, UTC). Migración en 38 ms; las 6 compras que había quedaron enviadas (0 sin enviar). Backend `c64ee65`, frontend `2ae35bd`. Sin archivos ilegibles para www-data; rutas nuevas 401 sin sesión.
- **Pedido del usuario:** cuando Comercial guarda la compra, debe enviarla a bodega para su despacho, y la bodega ve el listado de pendientes. Acordado: botón por línea y por bloque sin repetir, las compras existentes quedan enviadas, contador en el menú.
- **Compra de fruta** ([PurchaseAllocationPage.jsx](src/pages/comercial/PurchaseAllocationPage.jsx)):
  - Columna nueva **BODEGA**. En la compra guardada aparece el botón **Enviar a bodega**. Ya enviada muestra **✔ ENVIADA dd/mm hh:mm**, quién la envió y, si después cambió, **CAMBIÓ dd/mm hh:mm**.
  - **Quitar envío** (con confirmación): solo mientras la bodega no haya entregado materiales de esa marca en esa bodega.
  - En la cabecera del bloque, **Enviar bloque a bodega (N)**: envía las guardadas que faltan; las ya enviadas no se repiten (conservan su fecha) y las de cupo liquidado se saltan.
  - Se envía lo guardado: con cambios sin guardar pide "GUARDA LOS CAMBIOS ANTES DE ENVIAR A BODEGA".
- **Backend:**
  - Migración `2026_11_10_000004_envio_compras_a_bodega`: `producer_quota_lines.sent_to_warehouse_at`, `sent_to_warehouse_by` (usuario) y `changed_after_sent_at`. Las compras que ya existían quedan **enviadas** (con su `created_at`), así la bodega no deja de verlas.
  - `POST /customer-orders/{id}/purchases/send` `{ purchase_ids }` y `PATCH /customer-orders/{id}/purchases/{lineId}/unsend` (pantalla `compra_fruta`). Bloquean la semana (`lockForUpdate`): dos clics no envían dos veces. Cada envío queda en la bitácora.
  - Enviar **no cambia la "version"** de la semana: la huella de las compras ya no incluye `updated_at` ni las columnas del envío, así no choca con otro usuario que esté editando.
  - Al guardar, si una compra enviada cambia **cajas, marca, bodega de retiro o vendedor**, se marca `changed_after_sent_at` (las notas, precios, etc. no).
  - **Por despachar** (`GET /material-dispatch/pending`): solo las compras enviadas; columnas nuevas `enviado_at`, `enviado_por`, `cambio` (cambió después de enviar y no se ha retirado desde entonces) y `cambio_at`.
  - **Despacho de materiales:** los cupos (`/material-dispatch/quotas`) y las cajas a entregar cuentan solo lo enviado. Si la compra existe pero no se envió: "Comercial todavía no envía esta compra a bodega."
  - Contador `GET /material-dispatch/pending/count` (pendientes + parciales, con las bodegas de cada usuario; pantalla `despacho`).
- **Menú** ([Sidebar.jsx](src/components/Sidebar.jsx)): número rojo en el ícono de INVENTARIO y junto a "Por despachar". Se pide al abrir, al cambiar de página y cada 2 minutos, solo si la persona tiene esa pantalla. **Bandeja** ([DispatchPendingPage.jsx](src/pages/inventario/DispatchPendingPage.jsx)): columna ENVIADO (fecha, quién y aviso CAMBIÓ).
- **Probado:**
  - `prueba_envio_bodega.php` 30/30, en transacción revertida: sin enviar no sale en la bandeja, ni en cupos, y calcular da 422; enviar con fecha y quién; no repite; bitácora; version igual; contador +1; guardar sin cambios o con cambio de notas no marca CAMBIÓ y con cambio de cajas sí; un retiro posterior quita el CAMBIÓ; quitar envío con retiro da 422, sin retiro se permite; lista vacía 422; cupo liquidado no se envía; bodeguero 403 al enviar y 200 en el contador.
  - Chrome `ui_envio_bodega.mjs` 18/18: botón, aviso de guardar primero, ✔ ENVIADA y quién, bandeja del bodeguero con ENVIADO, contador en el ícono y en el ítem, quitar envío con confirmación, enviar bloque, sin errores de consola.
  - Regresión: por despachar 18/18, inventario 111/111, presentación 21/21, seguridad 80/80, permisos 50/50, huella 12/12.
  - Exportaciones: se ajustó la prueba del cupo, que ahora se envía antes de buscarlo en el Despacho. Quedan solo las 4 fallas conocidas de `/bookings`, que se quitó en la v1.1 (la prueba está vieja).
  - Build OK.
- **Al subir:** quien tenga abierta Compra de fruta en ese momento recibirá una vez el aviso de "otro usuario guardó" (cambió la forma de la huella) y debe recargar.

### 09/11/2026 — Revisión de seguridad, etapa 2 (base de datos) — sistema v1.1
- La barra azul pasa a mostrar **v1.1** (antes v1.0).
- **Cuentas bancarias cifradas:** `ThirdPartyBankAccount.account_number` con cast `encrypted` (APP_KEY). Migración `2026_11_10_000001_cifrar_cuentas_bancarias`: columna a `text` y cifra las existentes (no cifra dos veces; `down` descifra). Contabilidad, el resumen `****1234` de la OC y el TXT del Pichincha leen el número real desde el modelo. **Sin la APP_KEY del `.env` de producción las cuentas no se pueden leer**: el `.env` se respalda junto con la base.
- La bitácora enmascara con el valor descifrado (`getOriginal`/`getAttribute`), no con el texto cifrado.
- **Índices y controles** (`2026_11_10_000002_indices_y_controles`):
  - Índice en 51 llaves foráneas que no tenían (solo si no existe uno que empiece por esa columna).
  - Se quitan 2 índices repetidos: `third_parties_type_index` (lo cubre `type, status`) y `shipment_lines_shipment_id_index` (lo cubre el único `shipment_id, customer_order_line_id`).
  - CHECK con la misma lista que valida el código: `profiles.base_role` (`Profile::TIPOS_BASE`), `inventory_movements.transfer_status` (PENDIENTE/CONFIRMADA/CANCELADA), `negotiation_type` CONTRATO/SPOT en `customers`, `shipment_lines` y `settlement_lines`. `supplies.unit`, `material_recipes.unit`, `settlement_week_parameters.box_type` y `shipment_bookings.dae_status` quedan libres (se escriben a mano).
- **Bookings viejos fuera** (`2026_11_10_000003_quitar_bookings_viejos`): tabla `bookings` y `shipment_lines.booking_id` (si tienen datos, la migración se detiene sin borrar nada). Se quitan `BookingController`, el modelo `Booking`, las rutas `/bookings`, la pantalla `bookings` de los permisos de rutas y en el frontend `BookingsPage`, `BookingModal` y `api/bookings.js` (no estaban en el menú). Los bookings reales siguen en `shipment_bookings` (Cierre de embarque).
- **No se tocaron (pendiente de decidir):** `skus`, `sku_supplies` (módulo SKU/Recetas "por construir"), `invoices`, `invoice_lines`, `bills_of_lading` (¿facturación/Contífico?) y sus catálogos `box_weights`, `package_types`, `shipment_types`, `sticker_types`.
- **Probado:** cifrado 11/11 (cifra las existentes, ceros a la izquierda, dos veces no cifra doble, bitácora `****`, TXT con el número real, down/up); huella 12/12; las 3 migraciones se revierten y se vuelven a aplicar; seguridad 80/80, permisos 50/50, cambio de clave 33/33, inventario 111/111, OC/Contabilidad 44/44, liquidación 40/40, NC 36/36, presentación 21/21, por despachar 18/18, movimientos 33/33, sugerencias 28/28, costo promedio 23/23, bitácora 22/22.
- Nota de pruebas: corridas seguidas con el mismo usuario chocan con el límite de 120 peticiones/minuto (429); entre suites, `php artisan cache:clear`.

### 09/11/2026 — Revisión de seguridad, etapa 1
- **Bitácora sin números de cuenta completos:** `Auditable` registra `account_number` como `****1234` (crear, editar antes→después, borrar) con `AuditLog::enmascarar()`. Migración `2026_11_09_000002_enmascarar_cuentas_bitacora` enmascara lo que ya estaba guardado (sin vuelta atrás; el número completo sigue en `third_party_bank_accounts`).
- **Symfony 7.4.22 → 7.4.23** (http-foundation, http-kernel, routing y dependencias, solo parches): `composer audit` sin avisos.
- **Borrado el comando `db:reset-schemas`** (borraba esquemas sin preguntar; ya no se usaba, todo está en `public`).
- **Servidor (cron de peter, sin sudo):**
  - `schedule:run` cada minuto (borra a diario los tokens vencidos, `sanctum:prune-expired`).
  - Respaldo diario de la base a las 02:00 con `~/bin/respaldo_siae.sh` → `~/respaldos/siae_production_AAAAMMDD_HHMM_diario.sql.gz`, permiso 600, se guardan 30 días, registro en `~/respaldos/respaldo.log`. Falta la copia fuera del servidor (B2).
  - `.env` con permiso 640 y respaldos `.sql`/`.tgz` con 600.
  - `LOG_LEVEL=warning` (estaba en `debug`).
- **Incidente al subir (09/11/2026 ~20:40–20:44, unos 3 minutos):** en la sesión SSH del respaldo quedó `umask 077` y en esa misma sesión corrieron `git pull`, `composer install` y `php artisan optimize`. Los archivos nuevos (Symfony en `vendor/`, `bootstrap/cache/packages.php` y `services.php`, `AuditLog.php`, `Auditable.php`) quedaron sin lectura para `www-data` → la API respondía 500. Se arregló con `chmod go+r` (y `go+rx` en carpetas); sin pérdida de datos. **Regla:** usar `umask 077` solo en un subshell `( umask 077; pg_dump … )`, nunca en la sesión donde se sube código; después de subir, revisar `find . -user peter ! -perm -o=r ! -name .env`.
- **Probado:** enmascarado y migración (12/13; la que "falla" es solo el orden de las llaves del JSON), seguridad 80/80, permisos 50/50, cambio de clave 33/33, inventario 111/111, liquidación 40/40, OC 44/44, bitácora 22/22, cierre 8/8.

### 09/11/2026 — Control de cambios simultáneos: detecta guardados en el mismo segundo (backend)
- **Hallazgo de la revisión de seguridad:** la "versión" de Distribución en barcos, Compra de fruta y Cierre de embarque era `COUNT + MAX(updated_at)`. `updated_at` va en segundos, así que dos guardados en el mismo segundo daban la misma versión y el segundo no recibía el 409 ("otro usuario guardó cambios…"). Riesgo bajo en la práctica, pero real.
- **Cambio:** `huella()` ([ControlVersion.php](../siae-backend/app/Http/Controllers/Concerns/ControlVersion.php)) ahora es el md5 del **contenido** de las filas (`string_agg(t::text ORDER BY t.id)`), sin depender de la hora. Compra de fruta usa la misma `huella()` (antes tenía su propio COUNT/MAX por el join; ahora pasa `select('l.*')`). Sin cambios en el frontend ni en la base.
- **Probado:** el cierre (proforma/turno) detecta la versión vieja sin pausa (8/8); huella de las 3 hojas: igual sin cambios, distinta con un cambio en el mismo segundo, vuelve a ser igual al restaurar el dato, ~2 ms por cálculo (12/12).

### 09/11/2026 — Aviso de versión nueva, botón Actualizar y reloj con segundos
- **Pedido:** no tener que recargar con F5 / Ctrl+F5 para ver lo que se sube.
- **Aviso de versión nueva** ([AvisoVersion.jsx](src/components/common/AvisoVersion.jsx)):
  - Cada 5 minutos, y al volver a la pestaña, baja `index.html` sin caché y compara el nombre del JS principal (`/assets/index-XXXX.js`, cambia en cada build) con el cargado.
  - Si cambió, aparece una franja amarilla bajo la barra azul: "Hay una versión nueva del sistema… **Actualizar**".
  - No recarga sola, para no perder un formulario a medias. En desarrollo (`npm run dev`) no revisa.
- **Botón Actualizar** (flechas circulares) en la barra azul: recarga la página. Primero estuvo junto a la llave; el mismo 09/11/2026 se movió **al lado de "v1.0"** (en celular, al lado de "SIAE") para dejarlo con la versión y lejos de Cerrar sesión.
- **Barra:** lo fijo ahora es un contenedor con la barra y la franja. El reloj muestra los segundos y se actualiza cada segundo (solo el reloj, no la página).
- **Pendiente con sudo:** que nginx sirva `index.html` con `Cache-Control: no-cache` (en `location /`: `add_header Cache-Control "no-cache";`), para que una recarga normal siempre traiga lo último.
- **Probado en Chrome (build real con `vite preview` y dev), computadora y celular:**
  - Segundos, botón, aviso que no recarga solo, franja fija al bajar, Actualizar carga lo nuevo: todo OK.
  - La simulación de subida (solo el JS principal renombrado) mezcla versiones y rompe Usuarios; en una subida real se regeneran todos los archivos.

### 09/11/2026 — Ojo para ver la contraseña (en producción desde 09/11/2026)
- **Pedido:** un botón para ver la contraseña que se está escribiendo.
- Componente común [CampoClave.jsx](src/components/common/CampoClave.jsx): campo de contraseña con un ojo a la derecha. Arranca oculta; el ojo la muestra u oculta (`aria-label` "Mostrar/Ocultar contraseña") y no envía el formulario.
- Se usa en Usuarios (nuevo y editar), en el inicio de sesión y en "Cambia tu contraseña". En esta última, cada campo tiene su ojo (antes había una casilla "Mostrar contraseñas").
- **Probado en Chrome, computadora y celular, 17/17.**

### 09/11/2026 — Cambio de contraseña obligatorio (LOPDP)
- **Pedido:** que cada usuario cambie la contraseña al entrar por primera vez, para que el ADMIN no conozca la contraseña definitiva de nadie. Decidido con el usuario:
  - También los usuarios que ya existen (todas sus contraseñas las puso el ADMIN).
  - Vence cada **3 meses**.
  - El ADMIN queda fuera.
- **Base de datos** (migración `2026_11_09_000001_cambio_clave_obligatorio`):
  - `users.must_change_password` y `users.password_changed_at`.
  - Al migrar, todos los usuarios que no son ADMIN quedan marcados.
- **Cuándo debe cambiarla** (`User::motivoCambioClave()`):
  - `PRIMER_INGRESO`: usuario nuevo, o el ADMIN le escribió una contraseña en Usuarios.
  - `VENCIDA`: pasaron 3 meses desde que la cambió él mismo (`MESES_VIGENCIA_CLAVE`).
- **Backend:**
  - El middleware `clave` (`app/Http/Middleware/ClaveVigente.php`) bloquea el resto de la API con `403 CAMBIAR_CLAVE`, así que no se salta llamando a la API directo.
  - `PUT /me/password` pide la actual, la nueva y su repetición. La nueva debe tener mínimo 8 caracteres, con letras y números, y ser distinta de la actual.
  - Al cambiarla se cierran sus otras sesiones (ej. el celular) y queda `CAMBIO_CLAVE` en la bitácora, sin la contraseña.
  - Límite propio `cambio_clave`: 10 intentos por minuto por usuario. Un `throttle:10,1` suelto compartía el contador con el `throttle:120,1` general y bloqueaba al primer intento.
  - `/login` y `/me` traen `cambiar_clave`.
- **Frontend:**
  - Pantalla [CambiarClavePage.jsx](src/pages/auth/CambiarClavePage.jsx) en `/cambiar-clave`, sin menú, con los requisitos a la vista.
  - Mientras deba cambiarla, `RutaPrivada` y el interceptor 403 de [axios.js](src/api/axios.js) lo llevan ahí.
  - Botón con una **llave** en la barra azul para cambiarla cuando quiera ([Layout.jsx](src/components/Layout.jsx)).
  - En Usuarios aparece "FALTA CAMBIAR CONTRASEÑA" o "CONTRASEÑA VENCIDA".
- **Probado:**
  - Backend 33/33 (transacción revertida).
  - Permisos 50/50 y seguridad 80/80: se ajustaron para marcar como "ya cambiada" a los usuarios de prueba.
  - Liquidación 40/40.
  - Chrome, computadora y celular, 19/19.

### 06/11/2026 — Barra azul fija arriba (en producción desde 06/11/2026)
- **Pedido:** que la barra azul de arriba (semana, fecha, hora, usuario y Cerrar sesión) se quede fija al bajar en la página.
- [Layout.jsx](src/components/Layout.jsx): el `header` lleva `sticky top-0 z-20`. Así queda debajo del menú desplegado (z-30/40) y de los modales (z-50 en adelante).
- **Probado en Chrome, computadora y celular, 13/13:** la barra sigue arriba al bajar; el menú y los modales quedan encima; sin scroll lateral; sin errores.

### 06/11/2026 — Ícono del sistema: hojas verdes (en producción desde 06/11/2026)
- También dentro del sistema:
  - En la barra de arriba, junto al nombre, en un círculo blanco para que se vea sobre el azul ([Layout.jsx](src/components/Layout.jsx)).
  - En el inicio de sesión, en lugar del círculo azul ([LoginPage.jsx](src/pages/auth/LoginPage.jsx)).
  - En el encabezado del menú completo ([Sidebar.jsx](src/components/Sidebar.jsx)).
- Se revisó con capturas en computadora y celular: sin scroll lateral y sin errores.
- **Pedido:** usar como ícono del sistema la imagen de dos hojas verdes que mandó el usuario.
- Se le quitó el fondo gris claro (quedó transparente) y se dejó cuadrada, en 5 tamaños: `public/icono-32.png` y `icono-64.png` (pestaña del navegador), `icono-180.png` (acceso directo en iPhone) e `icono-192.png` / `icono-512.png` (Android, en `public/site.webmanifest`).
- [index.html](index.html) ya no usa `platanos.png`. El archivo sigue en `public/` por si se quiere volver atrás.

### 06/11/2026 — Liquidación como el Excel, parte 1: datos base (en producción desde 06/11/2026)
- **Producción** (06/11/2026 13:23, a pedido del usuario en horario y sin modo mantenimiento):
  - Respaldo `~/respaldos/siae_production_20261106_1823_antes_liquidacion_parte1.sql` y `frontend_dist_20261106_1823_antes_liquidacion_parte1.tgz` (hora del servidor, UTC).
  - Migración en 0,05 s. Quedaron 24 asociaciones o cooperativas en NO RETENER, los 5 tramos de retención y el perfil LIQUIDACIONES. Las rutas nuevas responden 401 sin sesión.
  - Falta crear el usuario de Liquidaciones y cargar los contratos (a mano, o desde el Excel si el usuario lo valida).
- **Pedido:** el usuario mandó el Excel de Liquidaciones (WK41–43, "AUTOMATICO") y pidió que la liquidación se haga **tal como ese Excel**.
- **Decisiones del 06/11, que reemplazan las del 29/10:**
  - Sí hay **retención IR único banano**.
  - Solo se pagan las cajas **embarcadas**; las caídas ya no.
  - El **anticipo 80 %** se paga antes de liquidar.
  - El **mínimo oficial** es uno solo por semana.
  - Los descuentos de evaluadores, estibas y comisión los ingresa el **equipo de validación**.
  - Las liquidaciones las hace el **Departamento de Liquidaciones**.
- **Plan en 4 partes:**
  1. Datos base (esta entrega).
  2. Validación de descuentos y anticipo 80 %.
  3. Liquidación nueva: LQ por contrato y spot, más el documento LG.
  4. Pagos (TXT Pichincha) y reportes (retenciones, cuadre).
- **Parámetros de la semana** (LIQUIDACIÓN → Parámetros de la semana; equivale a la hoja PARAMETROS):
  - Datos: mínimo oficial por caja, tipo de caja, tasa BPA y reconocimiento por caja en Pto. Bolívar.
  - La semana nueva propone los valores de la última.
  - Tabla `settlement_week_parameters`, con una sola fila por año y semana.
- **Tabla de retención** (pestaña de la misma pantalla; equivale a la hoja CALCULADORA BANANERA):
  - Tramos ≤1.000 1 %, ≤5.000 1,25 %, ≤20.000 1,5 %, ≤50.000 1,75 % y más de 50.000 2 %. Se pueden editar si cambia la ley.
  - Validación: los tramos van seguidos y solo el último queda "en adelante".
  - Incluye un simulador.
  - Regla en [RetencionBanano.php](../siae-backend/app/Services/RetencionBanano.php):
    - Tasa efectiva por las cajas de cada liquidación, redondeada a 2 decimales; retención = total × tasa.
    - BPA paga la tasa fija de la semana; NO_RETENER paga 0.
- **Contratos y retención** (LIQUIDACIÓN → Contratos y retención; equivale a la hoja Base Productores):
  - Por productor o comercializadora: régimen (`third_parties.retention_regime`: NORMAL, BPA o NO_RETENER) y nombre corto para la referencia de pago.
  - La migración dejó las asociaciones y cooperativas en NO RETENER, detectadas por el nombre.
  - Contratos en la tabla `contracts` (MAGAP), que estaba vacía y sin pantalla. Cada contrato tiene:
    - N° (1, 2…), cupo semanal, precio y condición;
    - Sí/No de transferencia, evaluadores, materiales y transporte;
    - vigencia, N° MAGAP y observación.
  - Solo un contrato activo por número. Un contrato con compras no se borra ni cambia de número: solo se desactiva.
  - Filtros: con o sin contrato, no retener y "excede cupo" (cajas compradas en la semana actual).
- **Compra de fruta:**
  - Cada compra de CONTRATO elige **qué contrato** del vendedor es y **qué parte** (1, 1.1, 1.2…, para liquidar un contrato partido): `producer_quota_lines.contract_id` y `contract_part`.
  - Si el vendedor tiene un solo contrato, se elige solo. Al elegir el contrato se propone su precio.
  - Muestra lo comprado contra el cupo semanal; si pasa, dice "EXCEDE CUPO", pero no bloquea.
  - Si el vendedor tiene contratos, elegir uno es obligatorio. Sin contratos registrados se deja pasar y dice "SIN CONTRATO REGISTRADO".
  - SPOT nunca guarda contrato.
- **Perfil LIQUIDACIONES:** las 7 pantallas de LIQUIDACIÓN. Comercial solo **lee** los contratos activos para elegirlos al comprar.
- **Migración** `2026_11_06_000001_liquidacion_parametros_contratos`. Tiene `down()`; se probó la vuelta atrás.
- [SelectBuscable](src/components/common/SelectBuscable.jsx) ahora acepta `aria-label`, para lectores de pantalla.
- **Pruebas (local):**
  - Backend 40/40:
    - Permisos.
    - Parámetros, con la semana repetida.
    - Tramos: con hueco, y último tramo con "hasta".
    - Simulador igual al Excel WK43: 4.761 cajas → 1,20 % → $ 484,48; 5.239 → 1,21 %; 1.900 → 1,12 %; 298 → 1 %.
    - BPA y no retener.
    - Contratos: número repetido, fechas, bitácora, quitar o renumerar uno con compras, desactivar y reemplazar.
    - Compra: falta elegir, contrato de otro vendedor, contrato 2.1, SPOT sin contrato.
  - Pruebas anteriores: seguridad 80, permisos 50 (ahora 11 perfiles), inventario 111, por despachar 18, OC y contabilidad 44, notas de crédito 36, presentación 21.
  - Interfaz 21/21 en Chrome (contratos, parámetros, simulador, celular sin scroll lateral, compra de contrato con cupo excedido); sin errores de JavaScript.
  - Build OK; lint sin errores nuevos (82).

### 05/11/2026 — Órdenes de compra por departamento, aprobación de Contabilidad y archivo de pagos Banco Pichincha (en producción desde 06/11/2026)
- **Pedido:** cada departamento (Compras, Sistemas, Asistente de Gerencia, Logística…) tiene su usuario y llena sus OC. Le llegan a Contabilidad (Andrea), que es la **única que aprueba** y después hace la **carga masiva** al Banco Pichincha con un TXT.
- **Usuarios:** dos tipos base nuevos con su perfil: **DEPARTAMENTO** (pantalla *Órdenes de compra*) y **CONTABILIDAD** (*Aprobación y pago de OC* y *Cuentas bancarias*). En Usuarios hay un campo **Departamento** (obligatorio para el tipo DEPARTAMENTO); las OC lo copian. Cada usuario ve solo las OC de **su** departamento.
- **OC del departamento** (COMPRAS → Órdenes de compra): proveedor, fecha, **concepto** y líneas de **texto libre** (descripción, cantidad, precio, IVA 15/5/0, % descuento, % retención IR). No entran a bodega (`warehouse_id` y `supply_id` NULL). Mismo correlativo OC-AAAA-NNNN que las de bodega. Se corrige mientras está POR APROBAR o RECHAZADA (al guardar vuelve a POR APROBAR); se cancela con motivo mientras no se haya mandado al banco.
- **Contabilidad** (CONTABILIDAD → Aprobación y pago de OC): pestañas POR APROBAR (ver, aprobar, rechazar con motivo), POR PAGAR (marcar y **Generar archivo Pichincha**), LOTES AL BANCO (bajar otra vez el TXT, marcar pagado, anular → las OC vuelven a por pagar) y TODAS. También le llegan las **OC de bodega** nuevas (departamento BODEGA). Una OC en un lote no se puede cambiar, cancelar ni volver a pagar (bloqueo de filas al generar).
- **Valor a pagar** = total de la OC (subtotal − descuento + IVA − retención IR).
- **Cuentas bancarias** (CONTABILIDAD → Cuentas bancarias): banco, tipo (ahorros/corriente), número, cédula/RUC/pasaporte y nombre del titular, correo. Tabla aparte (`third_party_bank_accounts`): **no sale en /third-parties**; solo la ven Contabilidad y el ADMIN; en la bandeja la cuenta va enmascarada (****1234); cambios en la bitácora. Pestaña **Bancos** con el **código de cada banco** para el archivo (se sembraron 20 bancos **sin código**: lo llena Contabilidad con la tabla del banco).
- **Archivo** ([PichinchaPagos.php](../siae-backend/app/Services/PichinchaPagos.php)): una línea por OC, separada por TAB, CRLF: `PA · cédula/RUC · USD · valor en centavos (13 dígitos) · CTA · AHO/CTE · cuenta · OC + concepto (40) · C/R/P · identificación · titular (40) · código del banco`. Texto en mayúsculas sin tildes ni Ñ. ⚠️ **Formato PROVISIONAL**: hay que confirmarlo con un archivo real que Andrea ya haya subido al banco; si cambia, se toca solo esa clase.
- **Migración** `2026_11_05_000001_oc_departamentos_contabilidad`: `users.department`, roles CONTABILIDAD y DEPARTAMENTO, tablas `banks`, `third_party_bank_accounts`, `bank_payment_batches` (código PAG-AAAA-NNNN, TXT guardado), campos de aprobación y pago en `purchase_orders`, `description` en las líneas. Las OC que ya existían quedan **ANTERIOR** (no aparecen por aprobar ni por pagar).
- Corregido de paso: `cancellation_reason` no estaba en `$fillable` de PurchaseOrder (el motivo de cancelar una OC de bodega no se guardaba). La lista de OC de bodega ya no muestra las de departamento.
- **Pruebas (local):** backend 44/44 (visibilidad por departamento, 403 sin permiso, rechazo → corrección → aprobación, cuenta y código de banco, TXT exacto, doble lote, anular y pagar); seguridad 80, permisos 50 (ahora 10 perfiles), inventario 111, por despachar 18; interfaz 27/27 en Chrome (recorrido completo, celular sin scroll lateral). Build OK; lint sin errores nuevos.
- **Producción (06/11/2026 11:13, a pedido del usuario en horario, sin modo mantenimiento):** respaldo `~/respaldos/siae_production_20261106_1613_antes_oc_contabilidad.sql` + `frontend_dist_20261106_1613_antes_oc_contabilidad.tgz` (hora del servidor, UTC). Revisado antes: roles en uso permitidos, 0 líneas sin insumo, sin perfiles con los nombres nuevos. Migración en 0,17 s; las 15 OC quedaron ANTERIOR / BODEGA; 20 bancos; perfiles CONTABILIDAD y DEPARTAMENTO creados; rutas nuevas responden 401 sin sesión. Falta: crear los usuarios por departamento y el de Andrea, códigos de banco y TXT real para confirmar el formato.

### 05/11/2026 — Fecha de "hoy" en hora de Ecuador (antes, desde las 19:00 salía la de mañana)
- **Problema:** varios formularios proponían "hoy" con `new Date().toISOString()`, que es la fecha en **UTC**. Ecuador es UTC−5, así que desde las 19:00 la fecha propuesta era la de **mañana**. El servidor también está en UTC (`app.timezone`), con el mismo efecto en lo que fecha él.
  - Un despacho hecho el domingo después de las 19:00 quedaba en la **semana siguiente**.
  - Un contrato que vence hoy salía como vencido desde las 19:00.
- **Frontend:** nuevo `utils/fecha.js` → `hoyISO(d = new Date())`, fecha local "AAAA-MM-DD". Reemplaza a `toISOString().slice(0, 10)` en 10 lugares:
  - Nuevo movimiento (2), Orden de compra, Pedido semanal (recibido), Contratos de clientes (vigencia).
  - Precios MAG, Anticipos, Tarjas, Liquidar y Detalle de liquidación (pagos).
  - Los cálculos de "lunes de la semana ISO" usan UTC de principio a fin y están bien; no se tocaron.
- **Backend:** nuevo `config('app.zona_operacion')` (`APP_ZONA_OPERACION`, por defecto `America/Guayaquil`). Se usa en `now(config('app.zona_operacion'))` en 9 lugares:
  - Fecha y semana del despacho, y cupo de la semana.
  - Fecha del INGRESO y de la MERMA al recibir una transferencia.
  - Fecha de registro del embarque (Distribución en barcos).
  - Contrato vigente hoy (Clientes) y año del código de la OC.
- **`app.timezone` sigue en UTC a propósito.** Si se cambia, las horas ya guardadas (created_at, Bitácora, tokens) quedarían corridas 5 h respecto de las nuevas.
- **Regla:** fechas de negocio en el servidor → `now(config('app.zona_operacion'))`; en la pantalla → `hoyISO()`. Nunca `toISOString()` para "hoy".
- Pruebas:
  - Servidor 5 OK con el reloj simulado: jueves 21:30 → 05/11; domingo 20:00 → semana 45, no 46; 31/12 22:00 → 2026-12-31; de día sin cambios; `created_at` sigue en UTC.
  - `hoyISO` 5 OK (21:30 y 23:59 → mismo día; 00:01 → día siguiente; 31/12 22:00).
  - Seguridad 80, permisos 50, Por despachar 18, sin cambios.
  - Build OK. Lint: los mismos 82 avisos de antes.

### 05/11/2026 — Bandeja "Por despachar" (grupo B del análisis de experiencia de usuario)
- **Pantalla nueva:** Inventario → **Por despachar** (`/despacho-materiales/pendientes`, `pages/inventario/DispatchPendingPage.jsx`). Usa el permiso de **Despacho** (`pantalla:despacho`), sin cambios en perfiles.
- Es la primera opción de INVENTARIO, así que el bodeguero entra directo a ella (antes entraba a Stock General).
- **Qué muestra:**
  - Una fila por compra de Comercial sin liquidar: cupo + marca + bodega de retiro.
  - Columnas: semana, productor (y finca), marca, cajas, bodega de retiro, estado, último retiro (y cuántos) y el botón **Despachar**.
  - Resumen arriba: por despachar, sin retirar nada, retiro a medias, completos.
  - Filtros POR DESPACHAR / COMPLETOS / TODOS y buscador.
- **Estado:** se calcula con las mismas reglas del despacho (fórmula = cajas × ratio de la receta, menos lo ya retirado de esa marca contra ese cupo).
  - **PENDIENTE:** no retiró nada.
  - **PARCIAL:** falta algún material. Muestra el % y cuántos materiales faltan.
  - **COMPLETO:** no falta nada.
  - **SIN RECETA:** la marca no tiene receta activa.
  - Los despachos anulados no cuentan.
  - Lo retirado se cuenta en la bodega de retiro, salvo que alguna compra de esa marca no tenga bodega (igual que `bodegaParaDescontar`).
- **Bodegas:**
  - El BODEGUERO ve las compras de su bodega; los demás, las de sus bodegas asignadas (`bodegasPermitidas`).
  - Las compras sin bodega fija las ven todos.
- **Despachar →** abre Despacho de materiales con bodega, productor y el cupo de esa fila ya elegidos, por `location.state` (`warehouse_id`, `third_party_id`, `producer_quota_id`, `brand_code`). El bodeguero calcula, revisa y guarda como siempre.
- **Backend:** `GET /material-dispatch/pending` (`MaterialDispatchController@pending`, opcional `?week=&year=`). Es de solo lectura; no hay migración ni cambios en la base.
- Pruebas:
  - `prueba_por_despachar.php` 18 OK, en transacción revertida: pendiente → parcial → completo; retiro en otra bodega no cuenta; anulado no cuenta; bodeguero propio sí y ajeno no; sin bodega la ven todos; filtro de semana; liquidado no aparece; no modifica nada.
  - Usuario sin permiso de despacho → 403.
  - Seguridad 80 y permisos 50, sin cambios.
  - Chrome (`ui_por_despachar.mjs`):
    - Bodeguero de SAN JUAN entra directo a la bandeja, ve la compra, filtra y busca.
    - "Despachar" abre el despacho lleno (bodega, productor, cupo semana 37, PALMS BANANAS, 5.000 cajas) y calcula los materiales.
    - El bodeguero de PROCARSA no la ve; el ADMIN sí.
    - Celular sin scroll horizontal, sin errores de consola.
  - Build OK. Lint: los mismos 82 avisos de antes.

### 05/11/2026 — Ajustes de interfaz (grupo A del análisis de experiencia de usuario)
Solo presentación: no toca datos, base ni backend.
- **Botones de solo icono con nombre:** el lápiz y el de desactivar en Navieras, Bodegas, Insumos, Marcas y Motivos muestran "Editar" / "Desactivar" al pasar el mouse (`title` + `aria-label`). Eran 17 botones en el código.
- **Cancelar en gris:** el token `--color-cancelar` (`index.css`) pasó de rojo a gris (gray-200, texto gray-800). Cambia en los 14 lugares que lo usan (Cancelar, Cerrar, Limpiar). El rojo queda para acciones de peligro: desactivar, anular.
- **Fechas dd/mm/aaaa** en Movimientos y kárdex (antes `2026-09-18`). `fechaVer` muestra la fecha; `fechaCorta` sigue llenando el campo de fecha al corregir.
- **Montos con formato de Ecuador (1.234,56):**
  - Nuevo `utils/formato.js` → `dinero(valor, decimales = 2)`.
  - Se usa en Nuevo movimiento, Orden de compra (formulario y detalle), Precios MAG, Contratos de clientes e historial de tarifas de Puertos.
  - El Dashboard (datos de ejemplo) queda para cuando se conecte a datos reales.
- **Textos:**
  - "Seleccioná / Registrá / Elegí" → "Selecciona / Registra / Elige".
  - Títulos de Despacho e Historial de despachos en minúsculas como el resto.
  - Despacho de materiales usa todo el ancho, como las demás pantallas.
- **Filtros Activos/Inactivos/Todos:** Navieras, Insumos y Marcas usan el mismo estilo de `TablaEstandar` (botón azul, mayúsculas).
- **Login:**
  - Se quitó el selector de idioma, que no hacía nada.
  - Los ejemplos de los campos ahora dicen "Tu correo o usuario" y "Tu contraseña". Antes mostraban el correo del administrador y unos puntos que parecían una contraseña ya escrita.
  - Etiquetas ligadas a los campos, `autoComplete` y cursor en el usuario al abrir.
- **Menú:** "Marca BL" e "Invoice" (Próximamente) ya no se muestran (`menuDe` filtra `proximamente`). Siguen en `menu.js` para cuando existan.
- **Celular:**
  - La barra azul muestra "SIAE · SEM 45" y el botón de salir queda solo con su icono, en una sola línea.
  - En PC la barra no cambia.
- Pruebas:
  - Chrome (`ux_grupoA.mjs`) 32 OK + menú (`ux_menu.mjs`) OK.
  - Inactividad (`ui_inactividad.mjs`) 15 OK.
  - Build OK.
  - Lint: los mismos 82 avisos de React hooks que antes del cambio, ninguno nuevo.

### 05/11/2026 — Cierre de sesión por inactividad y semana bananera en la barra
- **Inactividad (60 min):** `components/common/AvisoInactividad.jsx` (en `Layout`). Cuenta como actividad mover el mouse, escribir, hacer clic, la rueda o tocar; la última se guarda en `localStorage.ultimaActividad`, así varias pestañas cuentan como una. A los 58 min sale **"¿Sigues ahí?"** con cuenta regresiva, **Seguir conectado** y **Cerrar sesión**; a los 60 cierra y va a `/login?inactividad=1`, que explica el motivo.
- Mientras hay actividad, el navegador llama `GET /me` cada 5 min. Así el servidor ve trabajando a quien llena un formulario largo sin guardar.
- **Servidor:** `config/sanctum.php` `inactividad` (`SANCTUM_INACTIVIDAD`, 65 = 60 + margen; 0 = sin límite). `AppServiceProvider` rechaza el token cuyo `last_used_at` (o `created_at` si nunca se usó) pasó ese tiempo, aunque el navegador quede apagado. El máximo de 12 h desde el login (`SANCTUM_EXPIRATION`) sigue igual.
- **Barra azul:** `SEMANA 45 · jueves 05/11/2026 · 09:03` (se actualiza cada 20 s). La semana bananera es la ISO (`utils/semana.js` → `semanaISO`), la misma del backend (`isoWeek`); se comparó día por día 2025–2028 con el cálculo de Despacho, sin diferencias.
- Pruebas:
  - `prueba_inactividad.php`, 10 OK: 30 y 64 min valen; 70 min y nunca usado → 401; 12 h sigue; 0 = sin límite; usuario desactivado.
  - Seguridad 80 y permisos 50, sin cambios.
  - Chrome (`ui_inactividad.mjs`) 15 OK: barra, aviso a los 58,5 min, Seguir conectado, cierre a los 61 min, mensaje del login, token borrado.

### 05/11/2026 — Se quita la pantalla Bookings
- Revisión: **Bookings** guardaba naviera, barco, viaje, ETA, destino y N° de booking sin ligarse al pedido. Eso ya está en **Distribución en barcos** (el plan, por barco) y en **Cierre de embarque** (lo real, un booking por cliente y marca). Distribución y Cierre NO se repiten: plan contra embarcado.
- Se quitó del menú, de las rutas y del catálogo de permisos (`config/pantallas.php`). Los perfiles que la tenían la pierden solos (las claves viejas se ignoran). Las rutas `/api/bookings` quedan solo para ADMIN.
- Producción: 0 registros en `bookings` (11 en `shipment_bookings`, el Cierre). La tabla no se borra todavía.

### 03/11/2026 — Bodegas por usuario (D2), cédula/RUC obligatoria (D4) y revisión de seguridad
- **Bodegas que opera cada usuario** (tabla `user_warehouses`, se asignan en Usuarios; sin ninguna = todas). El BODEGUERO sigue con su bodega (`responsible_user_id`) y el ADMIN con todas. `User::bodegasPermitidas()` / `puedeBodega()` se aplican en el servidor a: registrar, corregir, ver y listar movimientos, kárdex, stock general, transferencias, calcular/guardar/ver/listar despachos. El login y `/me` envían `bodegas` y las pantallas solo muestran esas (`bodegasPermitidas()` en `routes/menu.js`). Las órdenes de compra no se limitan por bodega. Cambios de bodegas quedan en la bitácora (`BODEGAS_USUARIO`).
- **Cédula / RUC obligatoria** para PRODUCTOR y COMERCIALIZADORA nuevos (`App\Support\IdentificacionEcuador`): 10 o 13 dígitos, provincia 01–24 o 30, dígito verificador de la cédula (persona natural); de sociedades solo la estructura, porque el SRI emite RUC que no cumplen el módulo 11. Probado con los 493 RUC del Listado de Proveedores de Contífico: solo rechaza 9999999999999 (consumidor final). Los terceros viejos sin RUC se siguen editando; el RUC que ya tienen no se puede borrar. Proveedores y clientes no cambian.
- **Seguridad:** quien no tiene "Ver costos y valores" ya no fija el costo de un ingreso o devolución: el servidor pone el precio de la OC o el costo promedio del insumo (antes se aceptaba el que mandaba la pantalla y un bodeguero podía alterar el costo promedio). Tampoco recibe precios en Órdenes de compra ni el costo en la lista de Insumos. `composer audit` y `npm audit`: sin vulnerabilidades.
- Pruebas: `prueba_d2_d4.php` 32 OK; sugerencias 33, inventario 111, movimientos 33, costo promedio 23, seguridad 80, permisos 50, exportaciones 88, bitácora 22, NC 36, presentación 21, terceros 18. (`prueba_cierre` y `prueba_proforma_turno` fallan igual sin estos cambios: dependen de datos locales.)

### 03/11/2026 — Inventario: retroalimentación de usuarios (documento SUGERENCIA.docx, partes A y B)
- **Recibo de ingreso:** decía "Invalid Date" (se le agregaba una hora a una fecha que ya traía hora). Ahora muestra DD/MM/AAAA y el título **Fecha de recepción**.
- **Despacho de materiales:** el BODEGUERO ve solo su bodega (fija, con candado; el backend ya lo bloqueaba al guardar). Se quitó el campo Motivo (siempre ENTREGA A PRODUCTOR) y una "W" suelta en la confirmación.
- **Nuevo movimiento:** si el ingreso viene de una orden de compra, el motivo queda fijo en COMPRA A PROVEEDOR. La **guía de remisión es obligatoria** en todo ingreso por compra (con OC o con ese motivo); el backend valida las dos reglas.
- **Orden de compra:** la semana se elige entre la de la fecha y la siguiente (compra el sábado de la sm 44 para el proceso del lunes de la sm 45). Una OC es de una sola semana.
- **Sin decimales en lo que se cuenta por pieza:** solo LIBRAS acepta decimales (`Supply::UNIDADES_CON_DECIMALES`); TAPA, FONDO, FRASCOS, etc. van en enteros en OC, ingresos, transferencias y despachos.
- **Desactivar un insumo:** antes se muestra dónde se usa (recetas activas, stock por bodega, movimientos — `GET /supplies/{id}/usage`). No se desactiva si está en una receta activa o tiene stock.
- **Insumos duplicados:** no se repite el mismo nombre en la misma categoría (sin importar mayúsculas, tildes ni signos), aunque el otro esté inactivo; al escribir el nombre se avisa de insumos parecidos.
- **Permiso "Ver costos y valores"** (`ver_costos` en Perfiles, sección INVENTARIO): sin él no se ven valores en Despacho, Historial de despachos, Movimientos ni Kárdex, y la API no los envía (`Controller::sinCostos`). La migración `2026_11_03_000001` se lo da a los perfiles que tienen Insumos u Órdenes de compra; los bodegueros no lo tienen.
- Pruebas: `prueba_sugerencias_inv.php` 28 OK; inventario 111, movimientos 33, costo promedio 23, seguridad 80 (las viejas, con guía de remisión agregada a sus compras).
- Pendiente de decisión (parte D del documento): unidades exactas sin decimales, bodegas del asistente de compras, listas de precios por proveedor con aprobación, cédula/RUC obligatoria al crear productores.

### 03/11/2026 — Menú angosto de iconos
- El menú de la izquierda (`Sidebar.jsx`) quedó como una barra de 64 px con un icono por sección (la sección de la página actual se marca). Clic en un icono → la lista de opciones de esa sección se abre **encima** del contenido; ☰ abre el menú completo (secciones plegables como antes). Se cierra al elegir una opción, con clic afuera o con Esc. PRINCIPAL (una sola opción) va directo. La pantalla de trabajo gana unos 220 px de ancho.

### 04/11/2026 — Compra de fruta: finca del catálogo y campos solo numéricos
- **Finca** (pedido del usuario, para trazabilidad): en Compra de fruta se elige de una lista con búsqueda con las fincas del **productor real** (en compra directa, del vendedor); muestra `NOMBRE · MAG`. Si tiene una sola, se pone sola; al cambiar vendedor o productor se vuelve a elegir. Si no tiene, **+ NUEVA FINCA** abre un formulario (nombre, código MAG, zona) y la deja en el catálogo: `POST /customer-orders/{id}/purchases/farms` con la pantalla Compra de fruta (Comercial no tiene la pantalla Fincas); no repite el nombre para el mismo productor y solo es para PRODUCTOR o COMERCIALIZADORA activos.
- **El código MAG ya no se escribe**: es de solo lectura y sale de la finca; se corrige en Configuración → Fincas.
- Backend: `producer_quota_lines.farm_id` (migración `2026_11_04_000001`). La finca es **obligatoria en compras nuevas**; a un comercial sin productor real se le pide elegirlo. Se valida que la finca sea de ese productor y esté activa. `farm_name` y `mag_code` quedan como **copia** de la finca al comprar (si después editan la finca, las compras ya hechas no cambian; el MAG que mande la pantalla se ignora). Las compras de antes sin finca se siguen guardando y muestran lo escrito "(SIN CATÁLOGO)"; la migración enlaza solas las que coinciden por nombre con una única finca del productor. En una compra liquidada no se cambia la finca.
- Dato de producción (foto del 02/11): solo 50 de 277 productores activos tienen finca: el catálogo se irá completando con "+ NUEVA FINCA".
- **Campos numéricos**: nuevo `CampoNumero` ([src/components/common/CampoNumero.jsx](src/components/common/CampoNumero.jsx)) en los 46 campos de 15 pantallas que eran `type="number"`: solo dígitos y un separador decimal (la coma se escribe como punto), sin negativos, decimales según el campo (cajas enteras, dinero 2, costo unitario 4, precio de OC 6), al pegar limpia el texto (`$ 1.234,50` → `1234.50`), la rueda del mouse y las flechas ya no cambian el valor, teclado numérico en el celular. Antes Chrome dejaba escribir `e`, `+`, `-` y Firefox cualquier letra, y un valor inválido llegaba vacío y se guardaba 0. Se quitaron los bloqueos de teclado propios de Órdenes de compra.
- **Terceros**: la cédula/RUC de PRODUCTOR y COMERCIALIZADORA solo acepta dígitos (la del cliente extranjero no, un TAX ID puede llevar letras). **Teléfono** (Terceros y Usuarios): dígitos, espacios y `+` al inicio.
- Pruebas: exportaciones 98 OK (10 nuevas de finca: crear desde la compra, repetida, proveedor, permisos, sin finca, comercial sin productor real, finca ajena, copia del MAG, el MAG no cambia al editar la finca); bitácora 22, NC 36, permisos 50, seguridad 80, presentación 21 (las que crean compras ahora mandan finca). Chrome 16 OK (`ui_finca_numeros.mjs`: finca automática, limpiar al cambiar, + NUEVA FINCA, MAG de solo lectura, letras/e/-/coma, pegar, rueda y flecha, guardar sin finca). Linter: los mismos 19 avisos de antes, ninguno nuevo.

### 04/11/2026 — Revisión del SEGUIMIENTO DE COMPRAS 2026 y catálogo de Barcos (datos de producción)
- Revisado el Excel anual de Comercial (WK-13 a WK-45: 6.862 filas, 4,2 millones de cajas terminadas; hojas PROGRAMA y CONTRATOS). Problemas divididos en 7 partes (catálogos fijos, nombres de terceros, celdas mezcladas, tarifa de transporte, IDs, cupos/cumplimiento, MAG/contratos); se resuelven por parte con la aprobación del usuario.
- Parte 1 (catálogos): ejecutivos confirmados = **MARIA ELENA** (jefa comercial), **JORGE ZERNA** y **ROMAN KOROTKOV** (comerciales).
- **Barcos**: un barco = un nombre, sin el N° de viaje (el viaje UNIxxxx va en cada embarque, `shipments.voyage`), todos de UNIREEFER. Cargados los **35 que faltaban** (42 en total) con respaldo `siae_production_20261104_1426_antes_barcos.sql`. En producción no había nombres con viaje ni repetidos; en local se unieron COOL EAGLE / COOL EAGLE UNI1398.
- **Pedidos semanales y Distribución en barcos WK-30 a WK-44** cargados desde la hoja PROGRAMA (respaldo `siae_production_20261104_1448_antes_pedidos_barcos_wk30_44.sql`), pasando por los mismos controladores que las pantallas: 15 pedidos (#36–#50), 130 líneas, 54 barcos, 2.241.900 cajas, todo distribuido. Reglas acordadas: GLOBAL VILLAGE → RVI, PALMS y DOÑA ELENA → GT; zarpe = domingo de la semana (aproximado, en el comentario del barco); precio de venta vacío; si la hoja no dice CONTRATO/SPOT, bajo cubierta = CONTRATO y contenedor = SPOT; CONTRATO sin precio en el contrato del cliente (PACKED, DOÑA ELENA) queda SPOT; un barco que carga en 2 puertos = un barco por puerto; el saldo que el PROGRAMA repite en la semana siguiente ("IVAR WEEK43") queda solo en su semana; si una semana tiene revisiones (WK-42 REV. 2) se usa la última. Cada pedido dice "POR VALIDAR POR COMERCIAL"; Comercial valida con `Validacion_Pedidos_Barcos_WK30-44.xlsx`
- **Ver pedido semanal** (prueba de interfaz en 1920/1366/1024): columnas **CARGA** y **NEGOCIACIÓN** (antes "Modalidad"/"Tipo", al revés de lo esperado), el incoterm va debajo de la negociación, N° pedido y notas debajo del cliente (solo si tienen), nada se parte en dos líneas, resumen por cliente arriba (cajas contrato/spot, monto conocido, cajas sin precio), fila TOTAL en la tabla, encabezado fijo al bajar, comentario en fila propia. Sin barra horizontal en 1024. La hoja impresa usa los mismos nombres y lleva la fila de total ([CustomerOrderViewModal.jsx](src/components/CustomerOrderViewModal.jsx)).
- **Corrección**: en el modal de Bookings y en Distribución en barcos salían también las navieras desactivadas (y los barcos desactivados en Bookings): las pantallas mandan `?status=1` y el backend solo entendía `only_active`. `ShippingLineController@index` y `VesselController@index` aceptan ahora `?status` (como Puertos y Destinos). Backend `7549679`, respaldo `siae_production_20261104_1456_antes_filtro_navieras.sql`. (26 líneas a revisar; WK-42 y WK-43 no cuadran con el cupo de la hoja: −1.200 y −5.800).

### 03/11/2026 — Terceros validados de la compra WK-44 (datos de producción)
- Cruce de los vendedores (columna COMERCIAL) y productores de la hoja de compra WK-44 con Terceros, el Listado de Proveedores de Contífico y PRODUCTORES 2026. Solo dos tipos: **PRODUCTOR** (vende su propia fruta) y **COMERCIALIZADORA** (junta fruta de varios productores).
- Aplicado con respaldo `siae_production_20261103_1904_antes_terceros_wk44.sql` (script con simulación previa y verificación de la foto): **9 fusiones** (el registro de nombre corto sin RUC se desactiva, sus fincas pasan al registro con RUC: KAREN SANCHEZ, PROBADECUA, PATRICIO y MANUEL ZUMBA, ROBERT AGUILAR, WILSON VERGARA, RODRIGO GOMEZ, ADRIAN FISCHERT, JOEL y HOLGER VARGAS → VARGAS LOZANO HOLGER JOEL); **2 RUC completados** (VEGA BRITO ANGEL GERARDO, VEGA BRITO MARIA ROSA); **4 creados** (ASOPROABAORE, MULVENSER, RAMON LOPEZ BYRON PORFIRIO, VEGA BRITO JORGE EFRAIN).
- Pendiente con la asistente comercial (Excel `WK44_Terceros_para_validar.xlsx`): RUC de 6 vendedores (ASOPRODMAR, JOSE LUIS SALDAÑA, ORODELTI, AGROSIGAL, GODCORP, ANDER ALVAREZ) y datos de los productores que venden por medio de comercializadoras (opcionales). El SRI no se puede consultar de forma automática (captcha / no responde).

### 02/11/2026 — WK-45: pedido corregido, barcos y proforma/turno pagados en el cierre
- Pedido WK-45 corregido según el correo de Rusia y la hoja de Logística (respaldo `siae_production_20261103_0313_antes_corregir_wk45.sql`, por la API de Pedido semanal): GT 4.800 y RVI 14.400 pasan a **bodega** (no contenedor), RVI 65.000 a **CONTRATO 002 ($8,10)**, RVI 20.000 a **Puerto Bolívar**. El pedido queda con 35 contenedores, como la naviera.
- Distribución de barcos WK-45 (UNIREEFER) cargada según la "Asignación de carga WK-45" de Logística (respaldos `..._0323_antes_distribucion_wk45.sql` y `..._0331_antes_ajuste_dist_wk45.sql`): KANO REEFER 10.000 · CS ENDEAVOUR 84.000 · ICE GLACIER 34.800 · BALTIC WINTER 37.400 = 166.200, 0 pendientes. Zarpe = fin de la ventana de carga; ETA al puerto y ventana en el comentario de cada barco. El contrato RVI va 8.600 en BALTIC WINTER y 56.400 en CS ENDEAVOUR (la tabla del correo ruso lo repartía 23.000/42.000; manda la hoja de Logística, que cuadra con las bodegas).
- Cierre de embarque: columnas **Proforma** y **Turno** por booking (botón PAGADO verde / NO PAGADO rojo, como en la hoja). Migración `2026_11_02_000008` (`shipment_bookings.proforma_paid`, `turn_paid`, booleanos con valor por defecto falso).
- Pendiente de negocio: en la hoja, GT 10.800 (contenedores) y GT 4.800 (CFR) dicen CONTRATO banda azul (= PACKED), pero el contrato de GT solo tiene precio CONVENCIONAL; en el pedido siguen SPOT hasta tener el precio PACKED.
- Pruebas: proforma/turno 8 OK (nueva).

### 02/11/2026 — Se quita la pantalla Comercializadoras: filtro por tipo en Terceros
- "Comercializadoras" era la misma pantalla de Terceros filtrada (mismos datos, formulario y permiso). Se quitó del menú y del catálogo de pantallas (`config/pantallas.php`); la ruta vieja `/comercializadoras` abre `/terceros?tipo=COMERCIALIZADORA`.
- Terceros tiene un **filtro por tipo** (Todos · Productores · Comercializadoras · Proveedores · Clientes) con la cantidad de activos; con un tipo elegido, "Nuevo tercero" ya viene con ese tipo.
- Migración `2026_11_02_000007`: quien tenía la pantalla `comercializadoras` en su perfil o como excepción pasa a tener `terceros` (en producción nadie la tenía salvo el ADMIN).
- `TablaEstandar`: si la página filtra los datos por fuera y quedan menos páginas, muestra la última que existe (antes podía quedar vacía).
- Pruebas: comercializadoras 10 OK (nueva), permisos 50, seguridad 80, clientes/terceros 18; Chrome: filtro, vista filtrada, "Nuevo tercero" con el tipo y redirección OK.

### 02/11/2026 — ETL de productores y comercializadoras (datos de producción)
- Fuentes: Personas de Contífico ("Listado de Proveedores.xls", 493) y "PRODUCTORES 2026.xlsx" (hoja RUC: 157 vendedores con RUC; hoja CODIGOS MAGAP: 194 productores reales con finca y código MAGAP, sin RUC). Excel quitó el 0 inicial de los RUC. El SRI no responde a consultas automáticas: el nombre se validó contra Contífico (razón social del SRI) y el RUC con su dígito verificador.
- Decidido con el usuario: nombres completos **APELLIDOS NOMBRES**; una persona que estaba como PRODUCTOR y como COMERCIALIZADORA queda en **un solo registro PRODUCTOR**; se carga **solo lo limpio** y lo demás lo ingresan los usuarios.
- Aplicado en producción (respaldo `siae_production_20261102_2139_antes_etl_terceros.sql`, una transacción, verificación contra la foto, bitácora `ETL_TERCEROS`): 10 fusiones (se conserva el registro con RUC como PRODUCTOR, su finca pasa a él y el duplicado se desactiva) y 12 terceros nuevos validados (7 PRODUCTOR, 5 COMERCIALIZADORA). Resultado: 281 productores activos (17 con RUC), 125 comercializadoras.
- Quedan para los usuarios: 54 RUC sin confirmar en Contífico, 2 RUC mal escritos (HERITAGEBLOOM, ADRIAN FISCHERT), nombres que no corresponden a su RUC (RONALD AYALA, TERRABANANAS), RUC repetidos para personas distintas, ~20 duplicados que el archivo no confirma y los productores reales sin RUC.

### 02/11/2026 — Contífico: explorador de solo lectura (solo en local, sin subir)
- API documentada en https://contifico.github.io/: URL base `https://api.contifico.com/sistema/api/v1/`, clave en el encabezado `Authorization` (la entrega el soporte de Contífico). Lectura: categorías, bodegas, marcas, variantes, productos (y stock), movimientos de inventario, guías, personas, documentos, registro de transacciones, cuentas contables, centros de costo, cuentas y movimientos bancarios. La documentación no dice si pagina, si hay límites ni si hay ambiente de pruebas.
- Backend: `config/services.php` → `contifico` (`CONTIFICO_API_KEY`, `CONTIFICO_API_URL`, `CONTIFICO_TIMEOUT`); `App\Services\ContificoClient` **solo con GET** (no tiene cómo escribir en Contífico; reintenta solo sin conexión o con 5xx); comando `php artisan contifico:explorar [recursos...] [--filtro=clave=valor] [--muestra] [--guardar]`: muestra cuántos registros y qué campos trae cada recurso; `--guardar` deja el JSON en `storage/app/private/contifico/` (fuera de git). No toca la base del SIAE.
- Probado con respuestas simuladas (`Http::fake`): sin clave avisa cómo configurarla; arreglo directo y paginado; 400/403 explicados; solo envía GET con la clave en `Authorization`.
- **Siguiente**: la empresa pide la clave (ojalá de solo lectura), la pone en el `.env` local, se corre el explorador y se decide qué traer (proveedores, productos/costos, facturas de compra, movimientos bancarios).

### 02/11/2026 — Revisión de seguridad y optimización
- **Revisado y bien**: sin sesión, todas las rutas de la API dan 401; `.env`/`.git` bloqueados; `APP_DEBUG` apagado; HTTP → HTTPS; solo los puertos 22/80/443 abiertos (PostgreSQL no se ve desde internet); 0 vulnerabilidades en npm y composer; SQL siempre con parámetros; el BODEGUERO limitado a su bodega en el backend.
- **Lecturas con precios**: antes cualquier pantalla de `$lectura` (ej. Bodegas o Insumos) leía por API los contratos de venta, el pedido de Rusia y las compras a productores. Ahora cada lectura exige su pantalla: contratos = Contratos o Pedido semanal; lista de pedidos = Pedido semanal, Distribución, Cierre, Compra de fruta, Tarjas, Gastos o Ganancia; pedido = Pedido semanal; distribución = Distribución; compras = Compra de fruta; cierre = Cierre. Los catálogos (puertos, clientes, barcos, navieras, destinos) siguen abiertos al personal.
- **Liquidación por acción**: las tres pantallas leen; crear y anular = Liquidar; registrar/deshacer pagos = Pagos; factura y N° de NC = Notas de crédito o Liquidar. El detalle oculta los botones que el usuario no puede usar.
- **Inventario**: cada registro exige su pantalla (movimiento y transferencia = Nuevo movimiento; confirmar/cancelar transferencia = Transferencias o Recibir; despacho = Despacho; anular despacho = Historial de despachos; OC = Órdenes de compra). Antes solo "Stock general" bastaba para registrar por API.
- **Sesión**: un token solo vale si el usuario sigue activo (`Sanctum::authenticateAccessTokensUsing` en AppServiceProvider). **Login**: límite `throttle:login` = 5/min por usuario + IP y 30/min por IP (antes 5/min por IP: bloqueaba a la oficina entera). **Contraseñas**: 8 caracteres con letras y números (las actuales siguen valiendo). **CORS**: en producción, sin `CORS_ALLOWED_ORIGINS`, solo `https://siae.datalytica.cloud`.
- **Índices**: migración `2026_11_02_000006` con 37 índices en llaves foráneas de las tablas que crecen (líneas de movimientos, pedidos, cupos, embarques, tarjas, liquidaciones). Solo agrega índices.
- Revisado en producción antes de subir: ningún perfil ni excepción pierde algo que use hoy (Liquidación solo la usa el ADMIN).
- Pruebas: seguridad 80 OK (nueva); permisos 50, exportaciones 88, presentación 21, dashboard 14 (contraseñas de prueba con letras), clientes 18, bitácora 22, nc 36, inventario 111, movimientos 33, costo promedio 23.
- **Pendiente en el servidor (necesita sudo)**: compresión gzip y caché larga de `/assets` en nginx (el JS principal pesa 328 KB sin comprimir); confirmar el cron de `schedule:run` y un respaldo diario copiado fuera del servidor.

### 02/11/2026 — Finanzas: gastos y ganancia por viaje
- **Decidido con el usuario**: cada nave cobra distinto **por contenedor** (ej. $2.400 o $600); el flete solo es gasto de la empresa en ventas **CFR/CIF** (en FOB lo paga el cliente); bajo cubierta se cobra un **total por viaje**; otros gastos: puerto y trámites, transporte, termógrafos y sellos (como gasto del viaje, no como material), seguro, comisiones u otro; los registra **Finanzas/Contabilidad**; la ganancia es por viaje y por cliente y resta todo.
- Tablas `shipment_costs` (tarifa por contenedor, flete bajo cubierta, notas; una por barco) y `shipment_expenses` (categoría, cliente o todo el viaje, descripción, proveedor, factura, fecha, monto). Tipo base nuevo **FINANZAS** (perfil FINANZAS con las dos pantallas); GERENCIA también ve la ganancia. Pantallas `gastos_viaje` y `ganancia_viaje` (sección FINANZAS).
- `VoyageCostController`: `GET /voyage-costs?customer_order_id=` (barcos de la semana), `GET/PUT /voyage-costs/{shipment}`, `GET /voyage-profit?customer_order_id=`. Cálculo por cliente en cada barco: **venta** = cajas (del Cierre; sin cierre, de la Distribución) × precio promedio de sus líneas del pedido en ese barco; **fruta** = compras de los bloques de ese barco × precio real (cajas pagadas según tarjas; sin tarjas, las compradas); **materiales** = lo despachado al cupo repartido entre sus compras por cajas, menos lo **cobrable al productor** (se le descuenta al liquidar); **flete contenedor** = contenedores × parte CFR/CIF × tarifa; **bajo cubierta** repartido por cajas bajo cubierta; **otros gastos** del cliente + su parte por cajas de los de todo el viaje; **+ transporte** descontado al productor. Avisos (INCOMPLETO): falta tarifa o flete bajo cubierta, cajas sin precio de venta, compras sin precio, compras sin carga en el barco.
- `validate()` de Laravel arma los arreglos campo por campo: un gasto con cliente podía quedar antes que el anterior; se reordena con `ksort`.
- Pruebas: sección 7B en exportaciones (18 casos: venta 48.199,38, fruta 33.704, FOB sin flete, gastos repartidos, permisos FINANZAS/GERENCIA/COMERCIAL) → 88 OK; permisos 50, dashboard 14, presentación 21; Chrome 6 OK.

### 02/11/2026 — Fruta PACKED: compra siempre SPOT
- Decidido: al productor la fruta packed (banda) se le compra **siempre SPOT**, sin contrato, aunque la venta a Rusia sea por contrato; el precio real se negocia con cada productor al comprar (unos $6.80, otros $7.00: no hay recargo fijo). Compra sin precio ya se permitía ("SIN PRECIO"); la liquidación exige el precio.
- Compra de fruta: en un bloque PACKED el tipo queda fijo en SPOT (pago 80/20) y al pasar un bloque a PACKED sus compras pasan a SPOT; el backend rechaza CONTRATO en un bloque PACKED (422 "LA FRUTA PACKED SE COMPRA SIEMPRE SPOT"). Prueba en exportaciones (70 OK).

### 02/11/2026 — Cerrar sesión arriba a la derecha
- Usuario, perfil y botón "Cerrar sesión" pasaron a la barra superior (Layout.jsx); se quitó el bloque del pie del menú (Sidebar.jsx), que además deja más espacio al menú.

### 02/11/2026 — Precio de venta por marca + presentación (convencional / packed)
- **Decidido con el usuario**: el precio del contrato depende de la **marca y la presentación**; **PACKED** es una presentación de la misma marca (cinta/banda), no otra marca; el correo de Rusia trae marca y presentación en cada línea; un cliente puede tener contratos FOB y CFR/CIF a la vez (ya se podía: un contrato por incoterm).
- Tabla nueva `customer_contract_prices` (contrato + marca + presentación + precio, única por las tres); se quitó `customer_contracts.box_price`. El contrato exige al menos un precio; las marcas deben ser del cliente; no se repite marca + presentación. Pantalla: tabla de precios con "Poner todas las marcas del cliente" (marca × presentación) y aviso de que lo SPOT no usa contrato.
- `customer_order_lines.brand_id` y `presentation` (obligatorios en la API). Precio CONTRATO = el de esa marca + presentación en el contrato vigente; si el contrato no lo tiene, 422 "EL CONTRATO FOB DE X NO TIENE PRECIO PARA PALMS BANANAS PACKED". El precio congelado también se recalcula si cambia la marca o la presentación.
- `purchase_blocks.presentation` (default CONVENCIONAL). Compra de fruta: selector de presentación en el bloque y, por cliente, lo pedido por marca + presentación contra lo comprado (`pedido_detalle`).
- **PALMS CON BANDA** desactivada (es Palms PACKED). `Brand::PRESENTACIONES`, `src/utils/presentaciones.js`.
- Migración `2026_11_02_000004`: contratos existentes copian su precio a cada marca del cliente en las dos presentaciones; líneas existentes toman la primera marca del cliente, convencional (producción no tenía contratos ni pedidos).
- Pruebas: presentación 21 OK; exportaciones 69, notas de crédito 36, bitácora 22, permisos 50, clientes 18, inventario 111, movimientos 33, costo promedio 23; Chrome 9 OK. `prueba_cierre` ya no corre: depende de datos locales viejos (quiere quitar un barco que tiene compras); el cierre lo cubre exportaciones.

### 02/11/2026 — Se quitó la pantalla Clientes (todo en Terceros)
- Clientes repetía Terceros. Lo único que tenía de más, las **marcas del cliente** (las usan Compra de fruta y Cierre de embarque), pasó al formulario de Terceros cuando el tipo es CLIENTE, y la lista de Terceros tiene columna Marcas (y se busca por marca).
- `ThirdPartyController`: acepta `brand_ids` (solo se tocan si vienen; quedan en la bitácora con `Customer::sincronizarMarcas()`); desactivar/reactivar el tercero, o desmarcar "Tercero activo", también desactiva/reactiva su ficha de cliente (antes la ficha tenía su propio estado y solo se cambiaba en Clientes).
- `/customers` queda solo de lectura (selectores); se quitaron sus rutas de crear/editar/desactivar, la pantalla `clientes` de `config/pantallas.php` y del menú, CustomersPage y CustomerModal. `/exportaciones/clientes` redirige a Terceros. Migración `2026_11_02_000003`: quien tenía Clientes pasa a tener Terceros.
- La columna "Contrato vigente" que tenía Clientes se ve en Contratos de clientes.
- Pruebas: clientes en Terceros 18 OK; exportaciones 69, bitácora 22, permisos 50, dashboard 14 (las de exportaciones y bitácora ahora asignan marcas desde Terceros).

### 02/11/2026 — Corregido: no se podían crear clientes en producción
- Error `null value in column negotiation_type of relation customers`. Dos cambios hechos a mano en la base local nunca tuvieron migración: `customers.negotiation_type` opcional (desde 28/10 la modalidad va en cada línea) y la columna `third_parties.address`. Migración `2026_11_02_000002_corregir_clientes_produccion` (no hace nada donde ya están bien).
- Se comparó la estructura completa (columnas, tipos, nulos, defaults) local vs producción: esas dos eran las únicas diferencias.

### 02/11/2026 — Dashboard solo para gerencia
- Tipo base nuevo **GERENCIA** (`Profile::TIPOS_BASE`, `users_role_check`) y perfil inicial **GERENCIA** con solo el Dashboard. Migración `2026_11_02_000001_dashboard_solo_gerencia`: quita el Dashboard de todos los demás perfiles y de las excepciones de cada persona.
- `config/pantallas.php`: clave opcional `'solo' => [tipos base]` = únicos tipos que pueden tener esa pantalla. Se aplica en tres lugares: `User::pantallas()` la descarta para otros tipos (aunque esté en la base), Perfiles y Usuarios responden 422 si se intenta dar a otro tipo, y el catálogo `/screens` la devuelve para que el selector de pantallas no la ofrezca (`pantallasDelTipo` en menu.js). El ADMIN la ve igual.
- Un perfil GERENCIA puede llevar otras pantallas además del Dashboard (ej. ver compras).
- Pruebas: dashboard/gerencia 14 OK; permisos 50 OK.

### 31/10/2026 — Costo promedio ponderado de los insumos
- **Decidido**: costo **promedio ponderado por insumo, uno solo para toda la empresa**; al productor se le cobra el material **al costo**. Antes el costo era el último precio de compra (si quedaban 50 cartones a $1.10 y entraban 50 a $1.20, los 100 salían a $1.20).
- **Cálculo** (`app/Services/CostoPromedio.php`), desde cero en orden de fecha cada vez que algo cambia: INGRESO con costo → promedio = (saldo × promedio + cantidad × costo neto de descuento) ÷ (saldo + cantidad); INGRESO sin costo y DEVOLUCIÓN entran al promedio vigente; EGRESO baja el saldo; transferencias (motivos 5 y 9) no cuentan. Así corregir o anular una compra vieja corrige el promedio. Se recalcula al crear/corregir/anular movimientos, confirmar transferencias (merma) y crear/anular despachos.
- **Cada despacho guarda el costo del día** (no se recalcula después): el costo de materiales de cada nave/semana es el de cuando se despachó.
- `supplies.last_purchase_cost`: último precio de compra, solo referencia (null = sin compras). Con compras, el costo del insumo **no se edita a mano** (422: se corrige la compra); sin compras sigue siendo un costo de referencia editable.
- **Corregido — costos con fracción de centavo**: `inventory_movement_lines.unit_cost` guardaba 2 decimales y el modelo `Supply` leía el costo con 2 (el SACHET de $0.0456 se despachaba a $0.05 y las etiquetas de $0.0005 a $0.00). Ahora 6 decimales en costos (migración `2026_10_31_000003`, que además calcula el promedio de los insumos con compras).
- **Kárdex valorizado**: costo del movimiento, costo promedio después de cada movimiento, valor del saldo (saldo de la bodega × promedio de la empresa), saldo inicial valorizado, promedio actual y última compra. Insumos: columna "Costo promedio" (la última compra en el tooltip).
- Pruebas: costo promedio 23 OK (el ejemplo 1000 a $1.10 → salen 950 → 1000 a $1.20 = $1.195238; descuentos, transferencias con faltante, corregir/anular compras, edición manual, fracciones de centavo, kárdex). Regresión: inventario 111, movimientos 33, permisos 50, exportaciones 69, bitácora 22, nota de crédito 36 = **344 OK**; Chrome 14 OK.

### 31/10/2026 — Movimientos y kárdex
- **Pantalla nueva `movimientos`** ("Movimientos y Kárdex" en el menú de Inventario, agregada a los perfiles COORDINADOR_INVENTARIO, JEFE_BODEGA y BODEGUERO por la migración `2026_10_31_000002`).
- **Movimientos**: `GET /inventory-movements` ahora filtra por `estado` (activos/anulados/todos), `supply_id`, `movement_reason_id` y `q` (número, referencia, guía, tercero u OC); trae el total, la bodega destino y `bloqueo_edicion`/`bloqueo_anulacion` (por qué no se puede tocar aquí). Máximo 1000 filas.
- **Corregir**: fecha, motivo (mismo tipo), tercero, guía, referencia y líneas. Tipo, bodega y OC no se cambian (anular y registrar de nuevo); si viene de una OC, los insumos quedan fijos. Usa el mismo `PUT` (no deja stock negativo). **Anular**: con diálogo; lo recibido vuelve a quedar pendiente en la OC.
- **Kárdex**: `GET /inventory/kardex?warehouse_id&supply_id&date_from&date_to` → saldo inicial, entradas/salidas activas en orden, saldo acumulado y totales. El BODEGUERO siempre recibe su bodega.
- El recibo abierto desde esta pantalla vuelve a ella ("Volver a Movimientos").
- Pruebas: movimientos y kárdex 33 OK (API) + 13 OK (Chrome con COORDINADOR, JEFE y BODEGUERO); regresión inventario 111, permisos 50, exportaciones 69, bitácora 22, nota de crédito 36 = **321 OK**.

### 31/10/2026 — Prueba completa del inventario (local) y correcciones
- **Prueba de punta a punta por la API (111 OK)** con los usuarios reales de bodega (Coordinador, Jefe de bodega, Bodeguero MACHALA y TRIUNFO), transacción revertida: insumos → OC (correlativo, IVA, permisos) → recepción parcial y total (OC PARCIAL/COMPLETA, no más de lo pendiente, costo actualizado) → cancelar/cerrar OC → transferencia MACHALA→TRIUNFO (en tránsito, recepción con faltante, cancelación) → despacho a productor por receta → devolución al cupo → mermas, saldo inicial → editar/anular → stock por bodega y permisos. **Recorrido en Chrome**: 31 pantallas con COORDINADOR, JEFE y BODEGUERO, sin errores.
- **Corregido — editar un movimiento podía dejar stock negativo** (p. ej. bajar un ingreso cuyo material ya salió): ahora se rechaza si la edición deja negativa alguna bodega + insumo (antes solo lo impedía anular).
- **Corregido — anular un despacho dejaba activa la devolución** del productor de esa semana (stock fantasma): ahora se anulan juntas las devoluciones que quedarían por encima de lo retirado, y se avisa. Si ese material devuelto ya volvió a salir, no se deja anular.
- **Corregido — proveedor nuevo sin insumos en la OC** (la tabla `third_party_supplies` no la llenaba ninguna pantalla): el formulario de OC tiene "Ver todos los insumos" (automático si el proveedor no tiene ninguno) y al guardar la OC sus insumos quedan vinculados al proveedor.
- **Corregido (API)**: una OC solo se recibe en SU bodega y con SU proveedor (si el ingreso no trae tercero, se toma el de la OC); un bodeguero solo abre el detalle de OC de su bodega; el motivo debe ser del mismo tipo que el movimiento; movimientos, transferencias y OC solo en bodegas activas (las pantallas ya no listan bodegas desactivadas).
- **Decidido y hecho — recepción de transferencias por el bodeguero de destino**: pantalla nueva `recibir_transferencias` ("Recibir transferencias", agregada al perfil BODEGUERO por la migración `2026_10_31_000001`); solo ve y confirma lo que llega a su bodega; cancelar sigue siendo del Coordinador.
- **Decidido y hecho — faltante de transferencia = MERMA**: al confirmar, el INGRESO entra con todo lo enviado y lo que no llegó sale como MERMA/DAÑO en la bodega destino (con la nota de recepción y valorizado al costo). Se puede confirmar 0 de un insumo.
- Decidido: el Jefe de bodega sigue pudiendo registrar movimientos en cualquier bodega.
- Total de pruebas automáticas: inventario 111 + exportaciones 69 + permisos 50 + bitácora 22 + nota de crédito 36 = **288 OK**.

### 30/10/2026 — Prueba completa del módulo de exportaciones (local)
- **Prueba de punta a punta por la API (69 OK)**: arma una semana completa desde cero (semana 50/2026, datos propios, transacción revertida) con los perfiles ADMIN, EXPORTACIONES y COMERCIAL: cliente + marca + contrato + puertos + destino + vendedores + precio MAG → navieras, barcos y bookings → pedido semanal (precio de contrato, línea sin contrato rechazada, semana repetida, edición) → distribución en 2 barcos (repartir de más se rechaza, versión 409) → compra de fruta (proveedor y marca ajena rechazados, CONTRATO + SPOT del mismo productor, 100 cajas de más permitidas) → cierre (booking repetido, contenedor sin cantidad, mayúsculas) → tarjas → liquidación con nota de crédito → pago (sin fecha / repetido rechazados) → factura y NC → anulación → bitácora → pedido anulado. En cada paso se verifica que los otros perfiles reciban 403.
- **Recorrido en Chrome (41 pantallas)**: todas las de exportaciones, comercial, liquidación y configuración con ADMIN, EXPORTACIONES y COMERCIAL, formularios "Nuevo" abiertos y rutas de otros módulos bloqueadas. Sin errores de consola ni llamadas fallidas. (Recargando una pantalla tras otra se llega al límite de 120 peticiones/minuto por usuario → 429; con uso normal no ocurre.)
- Corregido: contratos de clientes registraban un error de Carbon en el log por `after_or_equal:start_date` (ahora se compara a mano); Navieras usaba `$request->get()` (obsoleto en Symfony 7.4) → `input()`; mientras llegan los permisos (`/me`) las rutas muestran "Cargando..." en vez de quedar en blanco.
- Total de pruebas automáticas: exportaciones 69 + permisos 50 + bitácora 22 + nota de crédito 36 = **177 OK**.

### 30/10/2026 — Permisos por persona (perfiles + excepciones)
Pedido del usuario: las jefaturas trabajan con asistentes; dar permisos por persona. Decisiones: solo el ADMIN asigna; permiso **por pantalla** (la ve y hace todo en ella, o no la ve).
- Catálogo de 30 pantallas en `config/pantallas.php` (clave, sección, nombre y qué tipos base la tienen al inicio). Usuarios, Perfiles y Bitácora no se delegan (solo ADMIN).
- Migración `2026_10_30_000003_create_profiles_and_user_permissions`: tabla `profiles` (nombre, `base_role`, descripción, `screens` jsonb) y en `users`: `profile_id`, `boss_id` ("asistente de"), `screens_added`, `screens_removed`. Crea un perfil por rol con las pantallas que ese rol veía y se lo asigna a sus usuarios: **nadie gana ni pierde acceso al migrar**.
- `User::pantallas()` = perfil + agregadas − quitadas (ADMIN: todas; perfil desactivado: ninguna; sin perfil: las iniciales de su tipo base). `User::puede(...)`.
- **Tipo base** (`users.role`, lo pone el perfil): conserva las reglas internas del rol — BODEGUERO solo su bodega y sus motivos; COORDINADOR/ADMIN corrigen y anulan movimientos y despachos; GERENCIA es el único que puede tener el Dashboard. Un perfil no puede ser de tipo ADMIN (solo ADMINISTRADOR, que no se edita) y no cambia de tipo base si tiene usuarios.
- API: middleware `pantalla:` reemplaza a `rol:`/`admin` en todas las rutas de pantallas (lectura de exportaciones: cualquier pantalla salvo las 4 del bodeguero, igual que antes). Transferencias pendientes ahora se valida por pantalla. `GET /me` devuelve el usuario con sus pantallas; `GET /screens`, CRUD `/profiles` (ADMIN).
- Frontend: [menu.js](src/routes/menu.js) (menú + `puede`, `menuDe`, `inicioDe`) usado por Sidebar, AppRouter (`RutaPantalla`) y Login; se borró `routes/roles.js`. Layout pide `/me` al abrir: los cambios de permisos se ven sin volver a iniciar sesión. Pantallas [ProfilesPage](src/pages/configuracion/ProfilesPage.jsx) y [UsersPage](src/pages/configuracion/UsersPage.jsx) con [SelectorPantallas](src/components/common/SelectorPantallas.jsx). Usuario sin pantallas → `/sin-acceso`.
- Bitácora: los campos JSON (pantallas) se guardan como lista, no como texto.
- Pruebas: **50 automáticas** (los 6 roles con los mismos accesos de antes, perfil nuevo, excepciones, validaciones) + 22 de bitácora + 36 de nota de crédito, todas OK; Chrome con un asistente de prueba (menú, rutas permitidas y bloqueadas) sin errores.

### 30/10/2026 — Instalación en producción (siae.datalytica.cloud)
- Servidor 72.62.97.139 (Ubuntu 24.04, PHP 8.3, PostgreSQL 16, nginx + Certbot). Se entra por SSH con el usuario **`peter`** (root no admite login). Código en `/var/www/siae/backend` y `/var/www/siae/frontend` (clones de GitHub); base `siae_production`. CHAUNE está en el mismo servidor: no se toca.
- Respaldo previo en `~/respaldos/` del servidor (`siae_db_20261030_2030.dump` + `siae_codigo_20261030_2030.tgz`).
- Producción tenía datos reales (9 usuarios, 418 terceros, 50 fincas, 85 insumos, OC y movimientos): se **actualizó** con las migraciones, no se reemplazó la base. Antes se probaron las migraciones sobre una copia de esa base.
- La tabla `brands` existía en producción sin su migración registrada: `2026_09_21_053407_create_brands_table` ahora no la recrea si ya existe.
- Actualizar: `git pull` en ambas carpetas; backend `composer install --no-dev -o`, `php artisan migrate --force`, `php artisan optimize`; frontend `npm ci && npm run build` (con `VITE_API_URL=https://siae.datalytica.cloud/api`).

### 30/10/2026 — Bitácora de auditoría
Pedido del usuario: debe quedar registrado lo que cada usuario registra en el sistema, con fecha y hora.
- Migración `2026_10_30_000002_create_audit_logs_table`: `audit_logs` (usuario y su nombre en ese momento, acción, tabla, id del registro, `changes` jsonb, IP, método + ruta de la API, fecha y hora). Solo se inserta; no se edita ni se borra.
- Trait [Auditable](../siae-backend/app/Models/Concerns/Auditable.php) en **todos los modelos**: CREAR (valores), EDITAR (`{campo: [antes, después]}`, sin `updated_at`; guardar sin cambios no registra nada), DESACTIVAR / REACTIVAR (cuando solo cambia `status`), BORRAR (valores que tenía). La contraseña se registra como "CAMBIADA", nunca su valor.
- Si la operación falla y se revierte, su registro en la bitácora también se revierte (va en la misma transacción).
- Sesión: INICIO_SESION, CIERRE_SESION y LOGIN_FALLIDO (con el usuario intentado, sin la contraseña; también usuario desactivado).
- **Regla nueva**: no usar escrituras masivas (`Modelo::where(...)->update/delete`, `->lines()->delete()`), porque no disparan eventos y no quedarían en la bitácora. Se cambiaron 12 (pedido, distribución, compras, cierre, tarjas, movimientos, barcos, bodega del usuario, recetas al renombrar marca) a registro por registro. Las marcas del cliente (`sync` de la tabla pivote) se registran a mano como `brand_ids` antes → después.
- Consulta: `GET /audit-logs` (ADMIN; filtros `user_id`, `table_name`, `action`, `record_id`, `desde`, `hasta`, `q` = texto dentro de los cambios; 50 por página). Pantalla CONFIGURACIÓN → **Bitácora** ([AuditLogPage.jsx](src/pages/configuracion/AuditLogPage.jsx)) con nombres de módulo en lenguaje de negocio.
- Pruebas: **22 automáticas** (sesión con IP, crear/editar/desactivar/reactivar, contraseña oculta, marcas del cliente, bloque de compra borrado desde la hoja, filtros, permiso) + se repitieron las 36 de nota de crédito (OK) + Chrome sin errores.

### 30/10/2026 — Precio oficial MAG y nota de crédito
Reglas del usuario: (1) precio oficial − precio real = **nota de crédito** que entrega el productor/comercializadora; (2) un productor de CONTRATO también puede cortar SPOT; (3) el precio oficial es el del **MAG**, y depende del tipo de caja.
- Migración `2026_10_30_000001_official_prices_credit_notes`: tabla **`official_box_prices`** (tipo de caja, desde, hasta, precio, N° de acuerdo ministerial); **`brands.box_type_id`** (las marcas existentes quedaron en 22XU); en `settlement_lines` `official_price`, `invoice_amount`, `credit_note_amount`; en `settlements` `invoice_amount`, `credit_note_amount`, `invoice_number`, `credit_note_number`, `credit_note_date`, `documents_by`. Las liquidaciones anteriores se completaron con el precio oficial de su compra.
- **Precios oficiales MAG** (COMERCIAL → *Precios oficiales MAG*, `OfficialBoxPriceController`, `/official-prices`; escriben ADMIN y COMERCIAL). Para un precio nuevo se cierra el anterior con fecha "hasta". `GET /box-types` (nuevo `BoxTypeController`).
- **Marca**: el tipo de caja es obligatorio (define qué precio MAG se propone).
- **Compra de fruta**: la compra nueva propone el precio MAG vigente según la caja de la marca y la fecha de corte (o el lunes de la semana). Si el precio escrito es distinto, aparece "MAG: x" para aplicarlo. Columna **Nota créd. $** = cajas × (oficial − real) ("REAL > OFICIAL" en rojo) y total de notas de crédito en el avance. Las compras ya registradas conservan su precio.
- **Liquidación**: factura = pagadas × oficial; nota de crédito = factura − fruta (el neto se sigue pagando al precio real). Sin precio oficial **no se puede liquidar** (no se sabría la NC). El detalle registra el N° de factura y de NC con su fecha (no bloquea los pagos), y lo imprime. Nueva pantalla **Notas de crédito** y filtro `GET /settlements?nc_pendiente=1`. `PATCH /settlements/{id}/documents`.
- **CONTRATO y SPOT del mismo productor**: ya funcionaba (el tipo va en cada compra); se probó que se liquidan juntos.
- Pruebas: **36 automáticas** en transacción revertida (marcas, precios MAG con cruces de fechas y permisos, compra CONTRATO + SPOT, tarjas, liquidación con NC = 367 sobre 970 cajas pagadas, documentos, bandeja) + Chrome sin errores de consola.

### 30/10/2026 — Listas desplegables con búsqueda
- Nuevo componente [SelectBuscable.jsx](src/components/common/SelectBuscable.jsx): reemplaza a `<select>` y permite **escribir para buscar** (sin importar tildes ni mayúsculas), flechas ↑↓, Enter elige, Esc cierra la lista sin cerrar el modal. Respeta `required`, `disabled`, opciones deshabilitadas y grupos (`<optgroup>`). La lista se dibuja sobre la página para que no la corten los modales ni las tablas con scroll.
- Se cambiaron los **65 `<select>` de 23 pantallas** (modales, Compra de fruta, Pedido semanal, Distribución, Cierre, Movimientos, Despacho, Órdenes de compra, Tarjas, Usuarios, Login). Probado en Chrome en el modal de Booking.

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
Menú **LIQUIDACIÓN** (solo ADMIN): *Tarjas*, *Anticipos y préstamos*, *Liquidar*, *Pagos e historial*, *Notas de crédito* (30/10).
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
- Barcos UNIREEFER cargados: COOL EXPLORER UNI1406, SNOW FLOWER UNI1404, WILD PEONY UNI1405, DITLEV UNI1402, BALTIC HOLLYHOCK UNI1403, CS CARE UNI1399, BALTIC SPIRIT UNI1397, COOL EAGLE UNI1398. (04/11/2026: decidido, el barco va sin el N° de viaje; el viaje va en el embarque.)
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
- [x] **Permisos por persona** — hecho el 30/10/2026 (ver historial).
- [ ] Registrar el **precio oficial MAG vigente** (22XU y otros tipos de caja si los hay) en COMERCIAL → Precios oficiales MAG, antes de comprar.
- [ ] **Subir a producción** en el VPS (faltan los datos de acceso): ver [Checklist](#9-checklist-para-producción).
- [ ] Crear los usuarios reales de Exportaciones y Comercial en CONFIGURACIÓN → Usuarios.
- [ ] Confirmar qué significa el estado "21" de la DAE (el usuario lo va a preguntar).
- [x] Pantalla **Bookings** antigua: quitada del menú y de los permisos el 05/11/2026. Falta borrar el código viejo (`BookingsPage`, `BookingModal`, `api/bookings.js`, `BookingController`) y la tabla cuando nadie la extrañe.
- [ ] Liquidación de cupos **manuales** (despachos sin compra de Comercial): hoy no se liquidan porque no tienen precio real ni tarjas.
- [ ] Probar la Liquidación en el navegador con datos reales (el backend está probado; las pantallas compilan).
- [ ] Dashboard: reemplazar los datos de ejemplo por un endpoint `/dashboard` con datos reales.
- [ ] Notificaciones por WhatsApp a gerencia (ej. "operación de la semana lista"): por decidir la vía (Meta WhatsApp Cloud API, Twilio o enlace wa.me).
- [ ] Cargar los **contratos MAGAP** de los productores (tabla `contracts` vacía): hoy la referencia MAGAP muestra "SIN CONTRATO".
- [ ] Decidir si se elimina el **cupo manual** del despacho (productores sin compra de Comercial) cuando todo el flujo esté en uso.
- [ ] Antiguos `ShipmentController`/`ShipmentLineController` (basados en SKU) en el backend: sin uso; el SKU aún no existe (la pantalla `ShipmentFormPage` ya se borró).
- [ ] Confirmar si **GT** y **GRAND TRADE - JSC** son el mismo cliente (hoy son dos fichas distintas).

- [ ] Órdenes de compra y Contífico: decidir si las OC se crean en el SIAE o se traen de Contífico (depende de si Compras trabaja allá y de lo que permita su API).

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
