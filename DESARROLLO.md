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

---

## 7. Historial de cambios

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
- [x] **Permisos por persona** — hecho el 30/10/2026 (ver historial).
- [ ] Registrar el **precio oficial MAG vigente** (22XU y otros tipos de caja si los hay) en COMERCIAL → Precios oficiales MAG, antes de comprar.
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
