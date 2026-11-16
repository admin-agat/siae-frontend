# Módulo VACACIONES Y PERMISOS (sección LEGAL)

**Estado:** APROBADO por Peter (16/11/2026) — ver respuestas en la sección 13
**Fecha:** 16/11/2026 · **Autor:** siae-architect
**Tamaño:** CAMBIO GRANDE (tablas nuevas + permisos + datos personales sensibles)

> Ninguna de las 5 reglas protegidas (semana de compra, liquidación, contrato por marca × presentación, flete CFR/CIF, OC por departamento con único aprobador) se toca en este diseño. Sí cambia la **lógica de permisos** (`User::pantallas()`) y la **campanita** (la ven todos los usuarios). Por eso es un cambio grande.

---

## 1. Proceso de negocio (en simple)

1. **LEGAL registra al personal** en la ficha de EMPLEADOS: APELLIDOS NOMBRES, cédula, departamento, cargo, fecha de ingreso, jefe inmediato y, si tiene, su usuario del SIAE. También carga el **saldo de vacaciones que hoy tiene cada uno** (fecha de corte).
2. **El sistema suma los días ganados solo**: cada vez que una persona cumple un año más en la empresa, le acredita 15 días (más los adicionales por antigüedad).
3. **La persona pide** vacaciones o un permiso desde "Mis solicitudes" (ve su saldo antes de enviar). Si no tiene usuario, LEGAL lo registra por ella.
4. **Le llega un aviso al jefe inmediato** en la campanita. El jefe abre "Aprobar solicitudes", revisa el calendario de su equipo y **aprueba o rechaza** (si rechaza, escribe el motivo).
5. **Le llega el aviso al solicitante**. Si fue aprobada y descuenta vacaciones, los días salen del saldo en ese momento.
6. **LEGAL ve todo**: el calendario de vacaciones de toda la empresa, los saldos y el kárdex de cada persona. Puede **anular** una solicitud con motivo, **cortar** unas vacaciones ya empezadas (la persona regresó antes) y hacer **ajustes** de saldo con motivo.
7. **Al salir un empleado**, LEGAL lo desactiva; el kárdex queda guardado y muestra los días pendientes para el finiquito.

---

## 2. Qué ya existe y qué se reutiliza

| Ya existe | Dónde | Cómo se usa aquí |
|---|---|---|
| `users.department` (texto libre, MAYÚSCULAS, 60) | migración `2026_11_05_000001` | El empleado usa el **mismo formato** de departamento. Al crear un empleado con usuario, se sugiere el departamento del usuario. |
| `users.boss_id` | migración `2026_10_30_000003` | **No se reutiliza.** Hoy significa "asistente de" (solo informativo, ninguna regla lo usa) y solo cubre a quienes tienen usuario. El jefe inmediato va en la ficha del empleado (`employees.supervisor_id`), porque el jefe y el subordinado pueden no tener usuario. Ver pregunta P12. |
| Campanita `user_notifications` + `App\Services\Notificaciones` + `NotificationController` + `Campanita.jsx` | 12/11/2026 | Se agregan 4 tipos de aviso. Se agrega la columna `leave_request_id` (como `producer_quota_line_id`) para marcar leídos los avisos de una solicitud cuando ya se decidió. La campanita navega con `link` + `data`, así que sirve sin cambios en el clic. **Cambio:** `Layout.jsx` hoy la muestra solo a BODEGUERO y COORDINADOR_INVENTARIO (`ROLES_CAMPANITA`); pasa a mostrarse a **todos**. |
| Patrón de aprobación de OC (`AccountingController::approve/reject`) | 05/11/2026 | Mismo patrón: estado `POR_APROBAR`→`APROBADA/RECHAZADA`, `rejection_reason` obligatorio en MAYÚSCULAS, `approved_by/approved_at`, chequeo de estado antes de cambiar, bloqueo de fila (`lockForUpdate`). |
| Correlativo OC-AAAA-NNNN (`siguienteLote`) | AccountingController | Mismo patrón para `SOL-AAAA-NNNN`. |
| Tipo base `LEGAL` y su perfil (pantalla `contratos_legal`) | migración `2026_11_12_000002` | Al perfil LEGAL se le agregan las pantallas nuevas `empleados_saldos` y `calendario_vacaciones`. **No hace falta tipo base nuevo.** |
| Middleware `pantalla:` y `User::pantallas()` | 30/10/2026 | Las 4 pantallas nuevas se protegen con `pantalla:`. Dos de ellas son **automáticas** (ver sección 5). |
| Trait `Auditable` + `AuditLog::enmascarar` (****1234) | 30/10 y 09/11/2026 | Los 4 modelos nuevos lo usan. Se agrega `id_card` a `$auditarEnmascarar` para que la cédula no quede completa en la bitácora. |
| Scheduler (`routes/console.php`, ya corre `sanctum:prune-expired`) | 28/10/2026 | Comando diario `vacaciones:acreditar`. Además el saldo se pone al día al consultarlo, por si el cron no corre. |
| Hora de Ecuador para "hoy" | 05/11/2026 | Fechas de inicio, aniversarios y "ya empezó" se calculan con la fecha de Ecuador, no UTC. |
| Componentes UI (`TablaEstandar`, `ModalShell`, `DialogoConfirmacion`, `SelectBuscable`, `CampoNumero`, `EstadoBadge`, `EncabezadoPagina`) | frontend | Todas las pantallas nuevas. |

**Revisado en la base local `SIAE` (solo lectura, 16/11/2026):** no existe ninguna tabla de empleados, feriados, vacaciones, departamentos ni adjuntos. `third_parties` tiene `CHECK type IN (PRODUCTOR, COMERCIALIZADORA, PROVEEDOR, CLIENTE)`. En local hay 9 usuarios, ninguno con `department` ni `boss_id`.

**Tampoco existe hoy manejo de archivos subidos** en el backend (no hay `Storage::` en `app/`). Los certificados serían el primer adjunto del sistema (ver sección 4.6 y pregunta P10).

### ¿Empleados en `third_parties` o tabla propia? → **Tabla propia `employees` (recomendado)**

- `third_parties` es el maestro de **contrapartes comerciales**: tiene CHECK de tipo, régimen de retención, contratos, cajas MAG y cuentas bancarias. Meter empleados obliga a ampliar el CHECK y a filtrar `type <> 'EMPLEADO'` en **todos** los combos de proveedores, productores y clientes que ya existen.
- **Riesgo de privacidad:** `GET /third-parties` lo **leen todos** los usuarios (DESARROLLO.md §2). Las cédulas de los empleados quedarían expuestas a Bodega, Comercial, etc. En una tabla propia, solo LEGAL las ve.
- La ficha de empleado es la base natural de una futura **nómina** (sueldo, cargas, IESS), que nada tiene que ver con terceros.
- No es una "tabla paralela": hoy no existe ningún registro de personas trabajadoras, salvo los usuarios del sistema (que no son lo mismo: hay usuarios compartidos por departamento).

---

## 3. Base legal usada (Código del Trabajo) y lo que debe confirmar LEGAL

> No soy abogado. Lo marcado con **[CONFIRMAR LEGAL]** es una interpretación o una práctica común, no una certeza. Todos los números van en `config/vacaciones.php` para cambiarlos **sin migración**.

| Tema | Lo que se propone | Base / duda |
|---|---|---|
| Días por año | 15 días por **año cumplido**, incluidos los no laborables (días calendario). | Art. 69 CT. |
| Días adicionales | Un día más por cada año **que exceda de 5**, con un máximo de 15 adicionales (tope 30 días). Año 6 = 16 días; año 20 en adelante = 30. | Art. 69 CT dice "más de cinco años … por cada uno de los años excedentes". **[CONFIRMAR LEGAL]** Peter escribió "desde el 5.º año". Si LEGAL lo lee así, el año 5 da 16 días. Es un solo parámetro (`anio_desde_adicional`). |
| Adicionales en dinero | El CT permite pagar los adicionales en dinero en vez de gozarlos. Se registra como movimiento **PAGADO** (resta días con motivo). | Art. 69 CT. **[CONFIRMAR LEGAL]** si AGAT lo usa. |
| Acumulación | Se pueden acumular hasta **3 años** para gozarlas en el 4.º. **No se borran días solos** (es un derecho). El sistema **avisa** a LEGAL cuando alguien tiene días de un periodo con más de 3 años sin usar. | Art. 74 CT. **[CONFIRMAR LEGAL]** qué hacer al pasar el límite. |
| Vacaciones no gozadas al salir | El kárdex muestra días pendientes + proporcional del año en curso para el finiquito. El sistema **no calcula dinero** (eso es del finiquito, fuera de este módulo). | Arts. 71 y 75 CT. |
| Dividir vacaciones / medio día | Se permite pedir por partes y **medio día** (0,5). | **[CONFIRMAR LEGAL]** El CT habla de "descanso ininterrumpido"; en la práctica se dividen por acuerdo. LEGAL define si hay mínimo por bloque. |
| Cómo se cuentan los días de vacaciones | **Opción A (por defecto):** días calendario entre inicio y fin, incluidos sábados, domingos y feriados. | **[CONFIRMAR LEGAL]** Ver P3: con la opción A, pedir lunes a viernes cuesta 5 días y el fin de semana queda "gratis". Muchas empresas usan la opción B o C. |
| Maternidad | 12 semanas pagadas (+10 días si es parto múltiple). **No descuenta** vacaciones. Días calendario. | Art. 152 CT. |
| Paternidad | 10 días (+5 por parto múltiple o cesárea; más días por prematuro o enfermedad grave). **No descuenta.** Días calendario. | Art. 152 CT. **[CONFIRMAR LEGAL]** los días extra exactos. |
| Médico / enfermedad | **No descuenta** con certificado médico (IESS o particular). Por horas o días. | Art. 42 CT y normas del IESS. **[CONFIRMAR LEGAL]** si el certificado es obligatorio y desde cuántos días. |
| Calamidad doméstica | **No descuenta** (permiso pagado, "debidamente comprobada"). | Art. 42 CT. **[CONFIRMAR LEGAL]** cuántos días máximo, qué cuenta como calamidad (fallecimiento de familiar, accidente grave, desastre) y qué respaldo pide. El CT no fija días. |
| Personal | **Por defecto descuenta de vacaciones**, pero LEGAL o el jefe pueden marcarlo como "SIN REMUNERACIÓN". | **[CONFIRMAR LEGAL]** Es política interna, no está en el CT. |
| Otros (sufragio, citación judicial, lactancia, adopción…) | Tipo OTRO: LEGAL elige si descuenta o no al aprobar o registrar. | **[CONFIRMAR LEGAL]** Ver P5: tal vez convenga separar LACTANCIA, ADOPCIÓN y SUFRAGIO como tipos propios. |
| Permiso por horas que descuenta | 8 horas = 1 día del saldo (jornada de 8 h). 2 horas = 0,25 días. | **[CONFIRMAR LEGAL]** la equivalencia. |

---

## 4. Tablas y columnas

### 4.1 `employees` (nueva): ficha del personal

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint PK | |
| `full_name` | varchar(150) | APELLIDOS NOMBRES, MAYÚSCULAS |
| `id_card` | varchar(20) **UNIQUE** | Cédula o pasaporte. Solo la ve LEGAL. Se enmascara en la bitácora (****1234) y en listados. Sin cifrar para poder buscar y validar que no se repita (igual que `third_parties.identification`). |
| `department` | varchar(60) | MAYÚSCULAS, mismo formato que `users.department` |
| `position` | varchar(100) null | Cargo |
| `hire_date` | date | Fecha de ingreso: de aquí salen los años de servicio |
| `supervisor_id` | FK `employees` null | Jefe inmediato. `CHECK (supervisor_id <> id)`. Los ciclos (A→B→A) se validan en el backend. |
| `user_id` | FK `users` null, **UNIQUE** | Usuario del SIAE (opcional). Un usuario es de una sola persona. **No se enlazan usuarios compartidos** de tipo DEPARTAMENTO. |
| `workweek_days` | smallint default 5 | `CHECK IN (5,6)`. 6 = trabaja sábados (campo, bodega). Sirve para contar días hábiles en permisos. |
| `vacation_cutoff_date` | date null | Fecha de corte del saldo inicial. Solo se acreditan aniversarios **posteriores** a esta fecha. |
| `termination_date` | date null | Fecha de salida. `CHECK (termination_date >= hire_date)`. |
| `notes` | varchar(300) null | |
| `status` | boolean default true | Soft-delete. Desactivar exige `termination_date` (ver P13). |
| `created_by` | FK `users` null | |
| `timestamps` | | |

Índices: `supervisor_id`, `user_id` (único), `(department, status)`.

### 4.2 `holidays` (nueva): feriados

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint PK | |
| `holiday_date` | date | El día **ya trasladado** por decreto (LEGAL los carga cada año) |
| `name` | varchar(100) | Ej. NAVIDAD |
| `scope` | varchar(10) default 'NACIONAL' | `CHECK IN ('NACIONAL','LOCAL')` (LOCAL = cantonal, ej. fundación de Machala) |
| `status` | boolean default true | |
| `timestamps` | | |

Índice único parcial: `holiday_date WHERE status`.

### 4.3 `leave_requests` (nueva): solicitudes

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint PK | |
| `code` | varchar(20) UNIQUE | SOL-2026-0001 |
| `employee_id` | FK `employees` | |
| `kind` | varchar(12) | `CHECK IN ('VACACIONES','PERMISO')` |
| `reason_type` | varchar(20) null | `CHECK IN ('MEDICO','CALAMIDAD_DOMESTICA','PERSONAL','MATERNIDAD','PATERNIDAD','OTRO')`. `CHECK ((kind='VACACIONES') = (reason_type IS NULL))` |
| `unit` | varchar(5) | `CHECK IN ('DIAS','HORAS')`; VACACIONES solo DIAS |
| `start_date`, `end_date` | date | `CHECK (end_date >= start_date)` |
| `half_day` | boolean default false | Solo si `start_date = end_date` y `unit = 'DIAS'` |
| `start_time`, `end_time` | time null | Obligatorios si `unit = 'HORAS'` (mismo día, `end_time > start_time`) |
| `days` | decimal(7,3) | Días que cuenta la solicitud, **congelado** al crearla (cambia solo por interrupción) |
| `hours` | decimal(5,2) null | Para permisos por horas |
| `charge_to` | varchar(16) | `CHECK IN ('VACACIONES','NO_DESCUENTA','SIN_REMUNERACION')`. Se llena según el tipo; LEGAL o el jefe lo pueden cambiar en PERSONAL y OTRO. |
| `description` | varchar(500) null | Motivo escrito por la persona (MAYÚSCULAS) |
| `attachment_path` | varchar(255) null | Ruta en el disco privado (no pública) |
| `attachment_name` | varchar(150) null | |
| `attachment_mime` | varchar(60) null | pdf, jpg o png |
| `attachment_size` | integer null | bytes (máx. 5 MB) |
| `state` | varchar(12) default 'PENDIENTE' | `CHECK IN ('PENDIENTE','APROBADA','RECHAZADA','CANCELADA','INTERRUMPIDA','ANULADA')`. Se llama `state` y no `status` para no confundirlo con el boolean de soft-delete. Las solicitudes **no se desactivan**: la "baja" es ANULADA. |
| `requested_by` | FK `users` | Quién la escribió (la persona o LEGAL) |
| `on_behalf` | boolean default false | true = LEGAL la registró por la persona |
| `approver_user_id` | FK `users` null | Aprobador asignado y **congelado** al crearla (null = sin aprobador: va a LEGAL) |
| `decided_by` | FK `users` null | Quién aprobó o rechazó |
| `decided_at` | timestamp null | |
| `decision_note` | varchar(300) null | Obligatorio al rechazar. `CHECK (state <> 'RECHAZADA' OR decision_note IS NOT NULL)` |
| `decided_on_behalf` | boolean default false | true = LEGAL decidió en lugar del jefe |
| `cancelled_by` | FK `users` null | Quién canceló, interrumpió o anuló |
| `cancelled_at` | timestamp null | |
| `cancel_reason` | varchar(300) null | Obligatorio en INTERRUMPIDA y ANULADA (CHECK) |
| `actual_end_date` | date null | Último día realmente tomado (INTERRUMPIDA) |
| `available_at_request` | decimal(7,3) null | Saldo disponible cuando pidió (congelado, para auditoría) |
| `timestamps` | | |

Índices: `(employee_id, start_date)`, `(approver_user_id, state)`, `(state, start_date, end_date)`.

### 4.4 `employee_vacation_movements` (nueva): kárdex de días

Solo se agregan filas; **nunca se editan ni se borran**. Un error se corrige con otra fila (REVERSO o AJUSTE). Por eso no lleva `status`.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint PK | |
| `employee_id` | FK `employees` | |
| `movement_date` | date | Fecha en que afecta el saldo |
| `type` | varchar(14) | `CHECK IN ('SALDO_INICIAL','GANADO','TOMADO','REVERSO','AJUSTE','PAGADO')` |
| `days` | decimal(7,3) | Con signo: GANADO > 0; TOMADO < 0; REVERSO > 0; PAGADO < 0; AJUSTE ≠ 0; SALDO_INICIAL puede ser negativo (vacaciones adelantadas). CHECK por tipo. |
| `service_year` | smallint null | Año de servicio (1, 2, 3…) en GANADO |
| `leave_request_id` | FK `leave_requests` null | En TOMADO y REVERSO |
| `reason` | varchar(300) null | Obligatorio en AJUSTE, PAGADO y SALDO_INICIAL (CHECK) |
| `created_by` | FK `users` null | null = lo acreditó el sistema |
| `timestamps` | | |

Índices únicos parciales (para que acreditar dos veces no duplique):
- `(employee_id, service_year) WHERE type = 'GANADO'`
- `(employee_id) WHERE type = 'SALDO_INICIAL'`
- `(leave_request_id) WHERE type = 'TOMADO'`

Índice: `(employee_id, movement_date)`.

### 4.5 `user_notifications` (cambio)

- `+ leave_request_id` FK `leave_requests` null, **ON DELETE SET NULL** (la lección del 13/11/2026).
- Nuevos `type`: `SOLICITUD_NUEVA` (al aprobador), `SOLICITUD_APROBADA`, `SOLICITUD_RECHAZADA` y `SOLICITUD_ANULADA` (al solicitante si tiene usuario; si LEGAL la registró, también a quien la registró). `type` es varchar(30) y alcanza.

### 4.6 Adjuntos (certificados)

- Disco **privado** `storage/app/private/leave-attachments/{año}/{code}-{aleatorio}.{ext}`. Nunca en `public/`.
- Validación: `file|mimes:pdf,jpg,jpeg,png|max:5120`. El nombre original se guarda solo como texto.
- Se descarga **solo** por `GET /leave-requests/{id}/attachment`, y solo si eres el solicitante, el aprobador asignado o tienes `empleados_saldos`. Si no, 403.
- **Son datos de salud (categoría especial en la LOPDP).** No se muestran en la campanita ni en el calendario, que solo dicen "PERMISO".
- ⚠️ **El respaldo de hoy (base + dist + .env) no incluye `storage/`.** Hay que agregar `storage/app/private/leave-attachments` al respaldo antes de subir (P10).

---

## 5. Permisos y pantallas

### 5.1 `config/pantallas.php`: 4 claves nuevas

```php
// 17/11/2026: VACACIONES Y PERMISOS. 'auto' = el sistema la da sola según la ficha de empleado
// (no se asigna en Perfiles; el ADMIN igual la puede quitar a una persona con screens_removed).
'mis_solicitudes'       => ['seccion' => 'VACACIONES Y PERMISOS', 'nombre' => 'Mis solicitudes', 'roles' => [], 'auto' => 'empleado'],
'aprobar_solicitudes'   => ['seccion' => 'VACACIONES Y PERMISOS', 'nombre' => 'Aprobar solicitudes', 'roles' => [], 'auto' => 'jefe'],
'empleados_saldos'      => ['seccion' => 'LEGAL', 'nombre' => 'Empleados y saldos de vacaciones', 'roles' => ['LEGAL']],
'calendario_vacaciones' => ['seccion' => 'LEGAL', 'nombre' => 'Calendario de vacaciones', 'roles' => ['LEGAL']],
```

En el menú (`menu.js`), las dos primeras van en el grupo "VACACIONES Y PERMISOS" y las de LEGAL bajo la balanza, junto a Contratos de productores.

### 5.2 Pantallas automáticas (recomendado) y alternativa

**Recomendado: automáticas.** Cambio en `User::pantallas()`:
- `mis_solicitudes`: la tiene todo usuario **enlazado a un empleado activo** (`employees.user_id = users.id AND status`).
- `aprobar_solicitudes`: la tiene todo usuario que sea **aprobador** de alguien, es decir, el usuario de un empleado activo que tiene subordinados activos, o que tiene solicitudes PENDIENTES asignadas.
- Se respetan `screens_removed` y `pantallasVedadas`. Para no consultar la base 2 veces en cada petición, el cálculo se guarda en una propiedad del objeto (`$this->pantallasCache`).
- `SelectorPantallas.jsx` (Perfiles/Usuarios) muestra las `auto` en gris con el texto "AUTOMÁTICA: SEGÚN LA FICHA DE EMPLEADO", sin casilla.

*Por qué:* nadie tiene que acordarse de dar la pantalla a cada jefe ni de quitarla cuando deja de serlo. Además se evita lo que pasaría si se pone en todos los perfiles: usuarios compartidos (DEPARTAMENTO) con "Mis solicitudes" sin ser una persona.

*Alternativa (más simple, más manual):* pantallas normales con `roles` = todos los tipos base. Una migración las agrega a todos los perfiles y el backend igual filtra por empleado/equipo. Ver P11.

### 5.3 Quién ve y hace qué (lo valida el backend)

| Acción | Pantalla (`pantalla:`) | Regla extra en el backend |
|---|---|---|
| Ver mi saldo, kárdex y solicitudes; crear; cancelar | `mis_solicitudes` | Siempre sobre **su** empleado (`employee.user_id = auth`). El `employee_id` nunca viene del frontend. |
| Ver pendientes de mi equipo, aprobar o rechazar | `aprobar_solicitudes` | Solo solicitudes con `approver_user_id = auth`. Nunca la propia (`employee.user_id ≠ auth`). Solo en estado PENDIENTE (con `lockForUpdate`). |
| Calendario de mi equipo | `aprobar_solicitudes` | Solo los subordinados directos activos. |
| Empleados (CRUD, desactivar/reactivar), kárdex, ajustes, saldo inicial, feriados | `empleados_saldos` | Cédula completa solo aquí. |
| Registrar por otro, aprobar o rechazar en lugar del jefe, reasignar aprobador, interrumpir, anular | `empleados_saldos` | Nunca sobre su propia solicitud. Aprobar o rechazar en lugar del jefe exige motivo y marca `decided_on_behalf`. |
| Calendario de toda la empresa | `calendario_vacaciones`, `empleados_saldos` | Muestra nombre, departamento, tipo (VACACIONES/PERMISO) y fechas. **Sin motivo ni adjunto.** |
| Descargar adjunto | (cualquiera de las anteriores) | Solicitante, aprobador asignado o `empleados_saldos`. |

**Tipos base:** no se crea ninguno. LEGAL recibe `empleados_saldos` y `calendario_vacaciones` en su perfil por migración. Si Peter quiere que GERENCIA vea el calendario, se le da `calendario_vacaciones` por excepción en Usuarios (P9).

**Qué nunca sale por la API a quien no es LEGAL:** cédula, notas, adjuntos de otros, motivo de permisos de otros (el jefe sí ve el motivo de su equipo).

---

## 6. Estados de la solicitud y transiciones

```
            (persona o LEGAL)
                 crear
                   │
                   ▼
              PENDIENTE ──── cancelar (solicitante o LEGAL) ───────────► CANCELADA
                   │  \
     aprobar       │   \ rechazar con motivo (jefe o LEGAL en su lugar)
 (jefe o LEGAL)    │    └───────────────────────────────────────────────► RECHAZADA
                   ▼
              APROBADA ──── cancelar ANTES del inicio (solicitante o LEGAL) ► CANCELADA (+REVERSO total)
                   │
                   ├── interrumpir YA EMPEZADA (LEGAL, motivo + último día tomado) ► INTERRUMPIDA (+REVERSO parcial)
                   │
  cualquiera menos ANULADA ── anular (LEGAL, motivo) ───────────────────► ANULADA (+REVERSO de lo tomado)
```

| De → A | Quién | Efecto en el kárdex | Aviso |
|---|---|---|---|
| (nueva) → PENDIENTE | solicitante o LEGAL | ninguno (los días quedan "comprometidos" en pantalla) | SOLICITUD_NUEVA al aprobador |
| PENDIENTE → APROBADA | aprobador o LEGAL | si `charge_to = VACACIONES`: **TOMADO −días** | SOLICITUD_APROBADA al solicitante; los avisos sin leer de la solicitud quedan leídos |
| PENDIENTE → RECHAZADA | aprobador o LEGAL (motivo obligatorio) | ninguno | SOLICITUD_RECHAZADA |
| PENDIENTE → CANCELADA | solicitante o LEGAL | ninguno | se marca leído el aviso del jefe |
| APROBADA (antes del inicio) → CANCELADA | solicitante o LEGAL | REVERSO +días | aviso al aprobador |
| APROBADA (ya empezó) → INTERRUMPIDA | solo LEGAL | REVERSO +días no tomados; `actual_end_date` | aviso al solicitante |
| PENDIENTE/APROBADA/INTERRUMPIDA/RECHAZADA/CANCELADA → ANULADA | solo LEGAL (motivo) | REVERSO del neto tomado (si lo hubo) | SOLICITUD_ANULADA |

Ya decidida, una solicitud **no se edita**. Si hay que corregirla, se cancela o anula y se crea otra (igual que las OC ya en un lote).

---

## 7. Cálculo del saldo

### 7.1 Fórmulas (`App\Services\SaldoVacaciones`)

- **Días por año de servicio `n`** = `15 + min(15, max(0, n − 5))` (con `anio_desde_adicional = 5`; si LEGAL dice "desde el 5.º año", el parámetro pasa a 4).

| Año cumplido | 1–5 | 6 | 7 | 10 | 15 | 20 | 21+ |
|---|---|---|---|---|---|---|---|
| Días | 15 | 16 | 17 | 20 | 25 | 30 | 30 |

- **Acreditar:** por cada aniversario `hire_date + n años` que sea ≤ hoy (Ecuador), mayor que `vacation_cutoff_date` y anterior a `termination_date` (si la hay), se crea `GANADO` con `service_year = n` si no existe (índice único). Lo hace el comando diario `vacaciones:acreditar` y también cada consulta de saldo, por si el cron no corrió.
- **Saldo** = suma de `days` del kárdex.
- **Comprometido** = días de solicitudes PENDIENTES que descuentan.
- **Disponible para pedir** = saldo − comprometido.
- **Proporcional en curso** (solo informativo, para el finiquito) = días del año que corre × días transcurridos desde el último aniversario ÷ 365.
- **Antigüedad de los días (aviso del Art. 74):** se reparten los TOMADO contra los GANADO más viejos primero, y se avisa si queda saldo de un periodo con más de 3 años desde que se ganó. Es un cálculo al vuelo, no se guarda.
- **Días de la solicitud:**
  - VACACIONES: días calendario de inicio a fin (opción A), o 0,5 si es medio día.
  - PERMISO por días: MATERNIDAD y PATERNIDAD en días calendario; el resto en días hábiles (lunes a viernes, o a sábado si `workweek_days = 6`, menos feriados activos).
  - PERMISO por horas: `hours / 8` si descuenta.

### 7.2 Ejemplos (datos inventados)

**Ejemplo 1: empleado antiguo con saldo migrado.** EMPLEADO A, ingreso 15/03/2020. LEGAL pone corte 30/11/2026 y SALDO_INICIAL 10 días.
- 15/03/2027 cumple 7 años → GANADO +17 (año 7). Saldo 27.
- Pide del 05/04/2027 al 11/04/2027 (lunes a domingo) = 7 días calendario. El jefe aprueba → TOMADO −7. Saldo 20.
- Los años 1 a 6 **no se acreditan**: ya están dentro de los 10 del saldo inicial.

**Ejemplo 2: empleado nuevo.** EMPLEADO B, ingreso 01/12/2025, sin saldo inicial (corte vacío).
- 01/12/2026 → GANADO +15 (año 1).
- Pide del 21/12/2026 al 27/12/2026 = 7 días (incluye el fin de semana y el 25/12, porque cuentan los no laborables). Saldo 8.
- Pide 3 días más del 28/12 al 30/12 mientras la anterior sigue PENDIENTE: disponible = 15 − 7 comprometidos = 8 → se acepta y queda en 5 disponibles.

**Ejemplo 3: permiso personal por horas.** EMPLEADO B pide el 12/01/2027 de 14:00 a 16:00 (2 horas), PERSONAL, descuenta → 0,25 días. Saldo 4,75.

**Ejemplo 4: interrupción.** EMPLEADO A tenía aprobado del 05/04 al 11/04 (7 días). Lo llaman a trabajar y regresa el 09/04. LEGAL interrumpe con último día tomado 08/04 → tomó 4 días → REVERSO +3. Estado INTERRUMPIDA.

**Ejemplo 5: permiso médico.** 2 días hábiles con certificado → `charge_to = NO_DESCUENTA`. El kárdex no cambia, pero el calendario muestra "PERMISO".

---

## 8. Casos borde

| Caso | Propuesta |
|---|---|
| **Jefe sin usuario, desactivado o sin jefe** | Al crear la solicitud se busca el aprobador subiendo por la cadena de `supervisor_id` hasta el primer empleado activo con usuario activo. Si no hay ninguno, `approver_user_id = null` y aparece en LEGAL en la pestaña "SIN APROBADOR". |
| **Jefe ausente (de vacaciones el día que llega la solicitud)** | Si el aprobador tiene vacaciones APROBADAS que cubren hoy, se salta al siguiente de la cadena. LEGAL puede **reasignar** el aprobador de una PENDIENTE (con motivo, queda en la bitácora) o **aprobar en su lugar**. Ver P6 sobre si se quiere un "reemplazo" fijo por jefe. |
| **El jefe se pide a sí mismo** | Su solicitud va a **su** jefe. El backend nunca deja aprobar la propia, ni desde Aprobar ni desde LEGAL. Si la cadena volviera a él (ciclo), se salta. Los ciclos se impiden al guardar la ficha. |
| **El de más arriba (gerente general) no tiene jefe** | Queda SIN APROBADOR y la decide LEGAL, o quien Peter diga (P7). |
| **La persona de LEGAL pide vacaciones** | Va a su jefe como cualquiera. No puede aprobarse a sí misma desde LEGAL. |
| **Solicitudes que se cruzan (misma persona)** | Se rechaza crear una que se cruce en fechas (y en horas, si es por horas) con otra PENDIENTE o APROBADA: "YA TIENES UNA SOLICITUD DEL dd/mm AL dd/mm (SOL-…). CANCÉLALA O CAMBIA LAS FECHAS." Se valida con un bloqueo por empleado (`pg_advisory_xact_lock`), igual que el bloqueo por bodega. |
| **Cruces dentro del equipo** | No se bloquea. Al aprobar, el jefe ve "TAMBIÉN ESTARÁN FUERA: …" y tiene el calendario del equipo. |
| **Saldo insuficiente** | Por defecto se rechaza: "SALDO INSUFICIENTE: TIENES X DÍAS DISPONIBLES." LEGAL sí puede registrarla con anticipo (el saldo queda negativo y lo dice en el kárdex). Ver P4. |
| **Cancelar aprobada ya empezada** | El solicitante no puede. Solo LEGAL la **interrumpe** con el último día tomado y devuelve el resto. |
| **Fechas pasadas** | VACACIONES: desde hoy en adelante (LEGAL puede registrar fechas pasadas). PERMISO: hasta 30 días atrás (médico después del hecho), parámetro en config. |
| **Feriado dentro de unas vacaciones** | Con la opción A cuenta como día de vacaciones (Art. 69 dice "incluidos los no laborables"). En permisos hábiles no cuenta. |
| **Cambia la fecha de ingreso después de acreditar** | La edición recalcula: los GANADO mal puestos se compensan con AJUSTE automático con motivo "CORRECCIÓN DE FECHA DE INGRESO", nunca borrando filas. Pide confirmación con `DialogoConfirmacion`. |
| **Empleado desactivado con pendientes** | Al desactivarlo, sus PENDIENTES pasan a CANCELADA (motivo "SALIDA DEL EMPLEADO") y ya no se acreditan aniversarios después de `termination_date`. |
| **Jefe cambia** | Las PENDIENTES conservan el aprobador congelado. LEGAL las reasigna si hace falta (o se reasignan solas al cambiar el jefe; ver P6). |
| **Usuario desactivado** | Pierde las pantallas (no inicia sesión). Sus PENDIENTES por aprobar caen en la regla de "jefe sin usuario" cuando LEGAL reasigna. |

---

## 9. Endpoints

Todos con sesión. En `routes/api.php`, bloque nuevo "VACACIONES Y PERMISOS (17/11/2026)".

**Mis solicitudes** (`pantalla:mis_solicitudes`, controlador `MyLeaveController`)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/my-leave/summary` | Mi ficha (sin cédula), saldo, comprometido, disponible, proporcional, kárdex y próximas |
| GET | `/my-leave/requests` | Mis solicitudes |
| POST | `/my-leave/preview` | Calcula días y saldo sin guardar (para la vista previa del formulario) |
| POST | `/my-leave/requests` | Crear (multipart si lleva adjunto) |
| PATCH | `/my-leave/requests/{id}/cancel` | Cancelar (PENDIENTE, o APROBADA que no empezó) |

**Aprobar** (`pantalla:aprobar_solicitudes`, `LeaveApprovalController`)
| GET | `/leave-approvals?state=PENDIENTE` | Asignadas a mí |
| GET | `/leave-approvals/team-calendar?from=&to=` | Ausencias de mis subordinados directos |
| PATCH | `/leave-approvals/{id}/approve` | `decision_note` opcional; `charge_to` solo en PERSONAL/OTRO |
| PATCH | `/leave-approvals/{id}/reject` | `decision_note` obligatorio |

**LEGAL** (`pantalla:empleados_saldos`, `EmployeeController` y `LegalLeaveController`)
| GET/POST | `/employees` | Lista (cédula enmascarada) / crear |
| GET/PUT | `/employees/{id}` | Ficha completa / editar |
| PATCH | `/employees/{id}/deactivate` · `/reactivate` | Soft-delete (pide fecha de salida) |
| GET | `/employees/{id}/ledger` | Kárdex con saldo acumulado |
| POST | `/employees/{id}/movements` | SALDO_INICIAL, AJUSTE o PAGADO con motivo |
| GET | `/legal/leave-requests?state=&department=&from=&to=` | Todas |
| POST | `/legal/leave-requests` | Registrar por otro (`employee_id` obligatorio) |
| PATCH | `/legal/leave-requests/{id}/approve` · `/reject` | En lugar del jefe (motivo obligatorio) |
| PATCH | `/legal/leave-requests/{id}/reassign` | Cambiar aprobador (PENDIENTE) |
| PATCH | `/legal/leave-requests/{id}/interrupt` | `actual_end_date` + motivo |
| PATCH | `/legal/leave-requests/{id}/annul` | Motivo |
| GET/POST/PUT | `/holidays` · PATCH `/holidays/{id}/deactivate` · `/reactivate` | Feriados |

**Calendario** (`pantalla:calendario_vacaciones,empleados_saldos`)
| GET | `/leave-calendar?from=&to=&department=` | Ausencias aprobadas y pendientes, sin motivo ni adjunto |

**Adjunto** (sin pantalla fija; el controlador valida solicitante, aprobador o `empleados_saldos`)
| GET | `/leave-requests/{id}/attachment` | Descarga |

Rutas con `/{id}` llevan `->whereNumber('id')`, y las fijas (`/preview`, `/summary`) van antes.

**Validaciones (mensajes en MAYÚSCULAS):** `kind in:VACACIONES,PERMISO`; `reason_type in:...`; `unit in:DIAS,HORAS`; fechas `date` y `end_date >= start_date` (comparado a mano, como en contratos de clientes); `half_day` solo en un día; horas en el mismo día y `end_time > start_time`; `charge_to in:...`; adjunto `mimes:pdf,jpg,jpeg,png|max:5120`; cédula con 10 dígitos y dígito verificador si es cédula ecuatoriana (o pasaporte alfanumérico, ver P14); `user_id` único y no de tipo DEPARTAMENTO ni ADMIN (P12); `supervisor_id` activo, distinto de sí mismo y sin ciclos. Ejemplos: "ELIGE EL TIPO DE PERMISO.", "LA FECHA FINAL NO PUEDE SER ANTES DE LA INICIAL.", "ESCRIBE EL MOTIVO DEL RECHAZO.", "EL CERTIFICADO DEBE SER PDF, JPG O PNG DE HASTA 5 MB.", "ESA CÉDULA YA ESTÁ REGISTRADA EN OTRO EMPLEADO."

---

## 10. Pantallas (frontend)

Carpeta nueva `src/pages/rrhh/` (rutas `/rrhh/...`), con los componentes comunes.

1. **Mis solicitudes** (`/rrhh/mis-solicitudes`): tarjetas SALDO · COMPROMETIDO · DISPONIBLE · PRÓXIMO ANIVERSARIO (+N días). Botón verde "+ Nueva solicitud" que abre un `ModalShell`: tipo (barra VACACIONES | PERMISO de un clic, como Presentación), motivo del permiso, por días u horas, fechas, medio día, motivo escrito, adjunto. Muestra la vista previa "SON 7 DÍAS · TE QUEDAN 8". Debajo, `TablaEstandar` con pestañas PENDIENTES / APROBADAS / TODAS y el kárdex en otra pestaña. Si el usuario no está enlazado, dice "TU USUARIO NO ESTÁ ENLAZADO A UNA FICHA DE EMPLEADO. PÍDELE A LEGAL QUE LO ENLACE."
2. **Aprobar solicitudes** (`/rrhh/aprobar`): bandeja POR APROBAR / DECIDIDAS, con el saldo del empleado, el aviso de cruces en el equipo y los botones Aprobar (verde) y Rechazar (rojo, pide motivo con `DialogoConfirmacion`). Pestaña CALENDARIO DEL EQUIPO.
3. **Empleados y saldos** (`/legal/empleados`): `TablaEstandar` (ACTIVOS/INACTIVOS/TODOS) con nombre, departamento, cargo, jefe, usuario, años, saldo y un aviso si tiene más de 3 periodos acumulados. Ficha en modal y kárdex con "Ajuste" (motivo obligatorio). Pestañas SOLICITUDES (todas, con las acciones de LEGAL y la pestaña SIN APROBADOR) y FERIADOS.
4. **Calendario de vacaciones** (`/legal/calendario`): vista de mes; filas = personas (agrupadas por departamento), columnas = días. Colores: aprobada verde, pendiente ámbar, feriado gris. Filtro por departamento. Sin motivos.
5. **Campanita:** se muestra a todos los usuarios (`Layout.jsx` deja de usar `ROLES_CAMPANITA`). Los avisos nuevos abren `/rrhh/aprobar` o `/rrhh/mis-solicitudes` con `data.leave_request_id`.

---

## 11. Migración de Laravel propuesta

Archivo: `database/migrations/2026_11_17_000001_vacaciones_permisos.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 17/11/2026 (diseño docs/modulos/vacaciones-permisos.md, aprobado por Peter el __/__/2026):
// VACACIONES Y PERMISOS. Ficha de EMPLEADOS (todo el personal, tenga o no usuario), feriados,
// solicitudes con aprobación del jefe inmediato y kárdex de días (solo se agregan filas).
// Avisos de la campanita enlazados a la solicitud. El perfil LEGAL gana 2 pantallas.
// No cambia datos existentes salvo el perfil LEGAL.
return new class extends Migration
{
    private const PANTALLAS_LEGAL = ['empleados_saldos', 'calendario_vacaciones'];

    public function up(): void
    {
        // 1) Ficha del personal. Tabla propia (no third_parties): GET /third-parties lo leen todos
        //    y las cédulas del personal solo las debe ver LEGAL.
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('full_name', 150);                       // APELLIDOS NOMBRES
            $table->string('id_card', 20)->unique();                // cédula o pasaporte (solo LEGAL; enmascarada en la bitácora)
            $table->string('department', 60);                       // mismo formato que users.department
            $table->string('position', 100)->nullable();            // cargo
            $table->date('hire_date');                              // de aquí salen los años de servicio
            $table->foreignId('supervisor_id')->nullable()->constrained('employees'); // jefe inmediato
            $table->foreignId('user_id')->nullable()->unique()->constrained('users'); // usuario del SIAE (opcional)
            $table->smallInteger('workweek_days')->default(5);      // 5 = lunes a viernes, 6 = hasta sábado
            $table->date('vacation_cutoff_date')->nullable();       // corte del saldo inicial
            $table->date('termination_date')->nullable();           // fecha de salida
            $table->string('notes', 300)->nullable();
            $table->boolean('status')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
            $table->index(['department', 'status']);
            $table->index('supervisor_id');
        });
        DB::statement('ALTER TABLE employees ADD CONSTRAINT employees_supervisor_check CHECK (supervisor_id IS NULL OR supervisor_id <> id)');
        DB::statement('ALTER TABLE employees ADD CONSTRAINT employees_workweek_check CHECK (workweek_days IN (5, 6))');
        DB::statement('ALTER TABLE employees ADD CONSTRAINT employees_termination_check CHECK (termination_date IS NULL OR termination_date >= hire_date)');

        // 2) Feriados (LEGAL los carga cada año con el día ya trasladado por decreto)
        Schema::create('holidays', function (Blueprint $table) {
            $table->id();
            $table->date('holiday_date');
            $table->string('name', 100);
            $table->string('scope', 10)->default('NACIONAL');       // NACIONAL | LOCAL
            $table->boolean('status')->default(true);
            $table->timestamps();
        });
        DB::statement("ALTER TABLE holidays ADD CONSTRAINT holidays_scope_check CHECK (scope IN ('NACIONAL', 'LOCAL'))");
        DB::statement('CREATE UNIQUE INDEX holidays_date_activo_unique ON holidays (holiday_date) WHERE status');

        // 3) Solicitudes. 'state' (no 'status'): no se desactivan, la baja es ANULADA.
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();                   // SOL-AAAA-NNNN
            $table->foreignId('employee_id')->constrained('employees');
            $table->string('kind', 12);                             // VACACIONES | PERMISO
            $table->string('reason_type', 20)->nullable();          // solo PERMISO
            $table->string('unit', 5)->default('DIAS');             // DIAS | HORAS
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('half_day')->default(false);
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->decimal('days', 7, 3)->default(0);              // congelado al crear
            $table->decimal('hours', 5, 2)->nullable();
            $table->string('charge_to', 16);                        // VACACIONES | NO_DESCUENTA | SIN_REMUNERACION
            $table->string('description', 500)->nullable();
            $table->string('attachment_path', 255)->nullable();     // disco privado
            $table->string('attachment_name', 150)->nullable();
            $table->string('attachment_mime', 60)->nullable();
            $table->integer('attachment_size')->nullable();
            $table->string('state', 12)->default('PENDIENTE');
            $table->foreignId('requested_by')->constrained('users');
            $table->boolean('on_behalf')->default(false);           // la registró LEGAL
            $table->foreignId('approver_user_id')->nullable()->constrained('users'); // congelado al crear
            $table->foreignId('decided_by')->nullable()->constrained('users');
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note', 300)->nullable();
            $table->boolean('decided_on_behalf')->default(false);   // LEGAL decidió en lugar del jefe
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 300)->nullable();
            $table->date('actual_end_date')->nullable();            // INTERRUMPIDA: último día tomado
            $table->decimal('available_at_request', 7, 3)->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'start_date']);
            $table->index(['approver_user_id', 'state']);
            $table->index(['state', 'start_date', 'end_date']);
        });
        foreach ([
            "leave_requests_kind_check CHECK (kind IN ('VACACIONES', 'PERMISO'))",
            "leave_requests_reason_check CHECK (reason_type IN ('MEDICO', 'CALAMIDAD_DOMESTICA', 'PERSONAL', 'MATERNIDAD', 'PATERNIDAD', 'OTRO'))",
            "leave_requests_kind_reason_check CHECK ((kind = 'VACACIONES') = (reason_type IS NULL))",
            "leave_requests_unit_check CHECK (unit IN ('DIAS', 'HORAS') AND (kind = 'PERMISO' OR unit = 'DIAS'))",
            'leave_requests_dates_check CHECK (end_date >= start_date)',
            'leave_requests_half_day_check CHECK (NOT half_day OR (start_date = end_date AND unit = \'DIAS\'))',
            "leave_requests_hours_check CHECK (unit = 'DIAS' OR (start_date = end_date AND start_time IS NOT NULL AND end_time > start_time))",
            "leave_requests_charge_check CHECK (charge_to IN ('VACACIONES', 'NO_DESCUENTA', 'SIN_REMUNERACION'))",
            "leave_requests_state_check CHECK (state IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'INTERRUMPIDA', 'ANULADA'))",
            "leave_requests_reject_note_check CHECK (state <> 'RECHAZADA' OR decision_note IS NOT NULL)",
            "leave_requests_cancel_reason_check CHECK (state NOT IN ('INTERRUMPIDA', 'ANULADA') OR cancel_reason IS NOT NULL)",
            "leave_requests_interrupt_check CHECK (state <> 'INTERRUMPIDA' OR actual_end_date BETWEEN start_date AND end_date)",
        ] as $check) {
            DB::statement("ALTER TABLE leave_requests ADD CONSTRAINT $check");
        }

        // 4) Kárdex de días: solo se agregan filas (los errores se corrigen con REVERSO o AJUSTE)
        Schema::create('employee_vacation_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees');
            $table->date('movement_date');
            $table->string('type', 14);                             // SALDO_INICIAL | GANADO | TOMADO | REVERSO | AJUSTE | PAGADO
            $table->decimal('days', 7, 3);                          // con signo
            $table->smallInteger('service_year')->nullable();       // GANADO: año de servicio
            $table->foreignId('leave_request_id')->nullable()->constrained('leave_requests');
            $table->string('reason', 300)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users'); // null = el sistema
            $table->timestamps();
            $table->index(['employee_id', 'movement_date']);
        });
        foreach ([
            "evm_type_check CHECK (type IN ('SALDO_INICIAL', 'GANADO', 'TOMADO', 'REVERSO', 'AJUSTE', 'PAGADO'))",
            "evm_sign_check CHECK ((type IN ('GANADO', 'REVERSO') AND days > 0) OR (type IN ('TOMADO', 'PAGADO') AND days < 0) OR (type = 'AJUSTE' AND days <> 0) OR type = 'SALDO_INICIAL')",
            "evm_reason_check CHECK (type NOT IN ('AJUSTE', 'PAGADO', 'SALDO_INICIAL') OR reason IS NOT NULL)",
            "evm_service_year_check CHECK (type <> 'GANADO' OR service_year >= 1)",
            "evm_request_check CHECK (type NOT IN ('TOMADO', 'REVERSO') OR leave_request_id IS NOT NULL)",
        ] as $check) {
            DB::statement("ALTER TABLE employee_vacation_movements ADD CONSTRAINT $check");
        }
        // acreditar o aprobar dos veces no duplica
        DB::statement("CREATE UNIQUE INDEX evm_ganado_unique ON employee_vacation_movements (employee_id, service_year) WHERE type = 'GANADO'");
        DB::statement("CREATE UNIQUE INDEX evm_saldo_inicial_unique ON employee_vacation_movements (employee_id) WHERE type = 'SALDO_INICIAL'");
        DB::statement("CREATE UNIQUE INDEX evm_tomado_unique ON employee_vacation_movements (leave_request_id) WHERE type = 'TOMADO'");

        // 5) Campanita: aviso enlazado a la solicitud (SET NULL, lección del 13/11/2026)
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->foreignId('leave_request_id')->nullable()->after('producer_quota_line_id')
                ->constrained('leave_requests')->nullOnDelete();
        });

        // 6) Perfil LEGAL: + Empleados y saldos, + Calendario de vacaciones (no le quita nada a nadie)
        DB::table('profiles')->where('base_role', 'LEGAL')->orderBy('id')->get()->each(function ($p) {
            $pantallas = json_decode($p->screens ?? '[]', true) ?: [];
            DB::table('profiles')->where('id', $p->id)->update([
                'screens'    => json_encode(array_values(array_unique([...$pantallas, ...self::PANTALLAS_LEGAL]))),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        DB::table('profiles')->where('base_role', 'LEGAL')->orderBy('id')->get()->each(function ($p) {
            $pantallas = json_decode($p->screens ?? '[]', true) ?: [];
            DB::table('profiles')->where('id', $p->id)->update([
                'screens'    => json_encode(array_values(array_diff($pantallas, self::PANTALLAS_LEGAL))),
                'updated_at' => now(),
            ]);
        });
        Schema::table('user_notifications', fn (Blueprint $table) => $table->dropConstrainedForeignId('leave_request_id'));
        Schema::dropIfExists('employee_vacation_movements');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('holidays');
        Schema::dropIfExists('employees');
    }
};
```

> Nota para el desarrollador: `screens_added`/`screens_removed` de usuarios con claves que dejen de existir ya se ignoran (`array_intersect` en `pantallas()`), así que el `down()` no deja basura activa. Los adjuntos en `storage/` **no** los borra el `down()`, a propósito.

### 11.1 Modelos (`$fillable` / `$casts`), todos con `use \App\Models\Concerns\Auditable;`

- **`Employee`** (`employees`)
  - `$fillable`: `full_name, id_card, department, position, hire_date, supervisor_id, user_id, workweek_days, vacation_cutoff_date, termination_date, notes, status, created_by`.
  - `$casts`: `hire_date, vacation_cutoff_date, termination_date => 'date'`, `status => 'boolean'`, `workweek_days => 'integer'`.
  - `$hidden = ['id_card']`: se agrega a mano solo en las respuestas de LEGAL.
  - Relaciones: `supervisor`, `subordinates`, `user`, `movements`, `leaveRequests`.
- **`Holiday`**
  - `$fillable`: `holiday_date, name, scope, status`.
  - `$casts`: `holiday_date => 'date'`, `status => 'boolean'`.
  - `SCOPES = ['NACIONAL','LOCAL']`.
- **`LeaveRequest`**
  - `$fillable`: todas las columnas menos `id` y timestamps.
  - `$casts`: fechas `date`; `decided_at, cancelled_at => 'datetime'`; `days, available_at_request => 'decimal:3'`; `hours => 'decimal:2'`; `half_day, on_behalf, decided_on_behalf => 'boolean'`.
  - Constantes `KINDS`, `REASON_TYPES` (con su `charge_to` por defecto y su conteo CALENDARIO/HABILES), `UNITS`, `CHARGES`, `STATES`.
- **`VacationMovement`** (`protected $table = 'employee_vacation_movements'`)
  - `$fillable`: `employee_id, movement_date, type, days, service_year, leave_request_id, reason, created_by`.
  - `$casts`: `movement_date => 'date'`, `days => 'decimal:3'`.
  - `TYPES`.
- **`UserNotification`**
  - `$fillable` + `leave_request_id`.
  - Constantes `SOLICITUD_NUEVA, SOLICITUD_APROBADA, SOLICITUD_RECHAZADA, SOLICITUD_ANULADA`.
- **`User`**
  - Relación `employee()` (hasOne por `user_id`).
  - Cambio en `pantallas()` para las automáticas, con caché por objeto.
- **Trait `Auditable`**
  - `$auditarEnmascarar = ['account_number', 'id_card']`.
- **Config nuevo `config/vacaciones.php`**
  - Valores: `dias_base 15`, `anio_desde_adicional 5`, `max_adicionales 15`, `horas_por_dia 8`, `conteo_vacaciones 'CALENDARIO'`, `dias_atras_permiso 30`, `adjunto_max_kb 5120`, `anios_acumulacion_aviso 3`.
  - Por tipo de permiso: `charge_to` por defecto y conteo.

### 11.2 Servicios y comando

- `App\Services\SaldoVacaciones`: `diasPorAnio(n)`, `acreditarPendientes(Employee)`, `saldo(Employee)`, `diasSolicitud(...)`, `aprobadorPara(Employee)` (cadena + saltos) y `antiguedadDeDias(Employee)`.
- `App\Services\Notificaciones`: `solicitudNueva()`, `solicitudDecidida()`, `solicitudAnulada()` y `solicitudCerrada()` (marca leídos los avisos de la solicitud, uno por uno).
- Comando `vacaciones:acreditar` en `routes/console.php`, `->dailyAt('06:00')` hora Ecuador. Recorre los empleados activos de uno en uno (bitácora).

---

## 12. Impacto en datos existentes y carga inicial

- **Datos de hoy:** no se toca ningún registro existente, salvo `profiles.screens` del perfil LEGAL (se agregan 2 claves). `user_notifications` gana una columna vacía.
- **Producción:** antes de subir, verificar que exista el perfil LEGAL y que `storage/app/private` tenga permisos de escritura para el usuario del servidor. Agregar `leave-attachments` al respaldo.

### Plan de carga inicial de empleados (agente `siae-datos`, cuando Peter lo pida)

1. **LEGAL entrega un Excel** con: APELLIDOS NOMBRES, CÉDULA, DEPARTAMENTO, CARGO, FECHA DE INGRESO, JEFE INMEDIATO (cédula o nombre), CORREO DEL USUARIO SIAE (si tiene), DÍAS DE VACACIONES PENDIENTES y FECHA DE CORTE (la misma para todos, recomendado).
2. **Se lee** copiándolo a la carpeta temporal y leyendo su XML (nunca con Excel/COM). Nada de cédulas en el chat: se muestran como `#####`.
3. **Cruce y validación:** cédula con dígito verificador, sin repetidos; fecha de ingreso válida y no futura; jefe encontrado y sin ciclos; correo de un usuario activo, no compartido (DEPARTAMENTO); saldo dentro de lo razonable (si supera 60 días se marca para revisión, por el límite del Art. 74). Lo que no cuadra va a una **lista de dudas para LEGAL** y no se carga ("cargar solo lo validado").
4. **Script** con `CARGA_BD` obligatorio y `CARGA_SIMULAR=1`, usando **los mismos endpoints** de la pantalla:
   - pasada 1: `POST /employees` sin jefe;
   - pasada 2: `PUT /employees/{id}` con `supervisor_id`;
   - pasada 3: `POST /employees/{id}/movements` tipo SALDO_INICIAL con motivo "SALDO MIGRADO AL dd/mm/aaaa".
5. **Simulación** → Peter revisa el resumen (cuántos, cuántas dudas) → **Peter aprueba** → respaldo de la base → real → comprobación (saldos en pantalla = Excel).
6. Las copias locales del Excel y del CSV se borran al terminar. La carga se puede repetir: salta las cédulas que ya existen.

---

## 13. Preguntas abiertas

### Respuestas de Peter (16/11/2026)
- **P1:** día adicional **desde el 5.º año** cumplido, como lo dijo Peter. Queda en `config/vacaciones.php` para cambiarlo después si LEGAL dice otra cosa.
- **P3:** opción **C**: días calendario y, si el pedido termina viernes, se cuentan también sábado y domingo.
- **P5 (parte):** calamidad doméstica = **1 día** y, según entiende Peter, **descuenta de vacaciones** (igual el permiso personal). [CONFIRMAR LEGAL: en el sector privado la calamidad doméstica suele ser permiso pagado que no descuenta; dejarlo configurable por tipo.]
- **P7:** todos tienen jefe; quien no lo tenga (gerente general) lo aprueba **GERENCIA**.
- **P10:** **sin adjuntos** por ahora: solo la casilla "CERTIFICADO ENTREGADO" (sin datos de salud en el sistema; el respaldo no cambia).
- **P2:** se permite **medio día** y vacaciones **por partes**, sin mínimo por bloque.
- **P4:** con **saldo insuficiente** solo puede registrar LEGAL, con motivo.
- **P6:** jefe ausente → sube solo al jefe del jefe; si cambia el jefe de alguien, sus pendientes pasan al jefe nuevo.
- **P8:** no se pagan en dinero por ahora; solo aviso a LEGAL al pasar 3 años sin gozarlas.
- **P9:** GERENCIA ve el calendario de toda la empresa; LEGAL lo ve en pantalla (sin aviso por cada aprobación).
- **P11:** pantallas **automáticas** (Mis solicitudes para todo empleado con usuario; Aprobar para todo jefe).
- **P12:** `users.boss_id` ("asistente de") se queda como está; el jefe inmediato va en `employees.supervisor_id`.
- **P14:** pendiente: si hay personal con pasaporte y cuántas personas son (se pregunta en la carga inicial; la cédula se valida solo si el tipo de documento es CÉDULA).
- **P13:** **catálogo de departamentos** (tabla `departments`) y se elige con búsqueda por nombre (`SelectBuscable`). Ojo: conviene que `users.department` también pase al catálogo (otro cambio, coordinarlo).

**Para LEGAL (Código del Trabajo):**
- **P1.** Días adicionales: ¿desde el año **6** cumplido (16 días, "años excedentes de 5") o desde el **5.º** (16 días en el año 5)?
- **P2.** ¿Se permiten **medio día** y vacaciones **por partes**? ¿Hay un mínimo por bloque (ej. 1 bloque de al menos 7 días al año)?
- **P3.** ¿Cómo se cuentan las vacaciones? **A)** días calendario puros (lunes a viernes = 5); **B)** cada 5 días hábiles = 7 días; **C)** calendario, pero si termina viernes se suma el fin de semana. (Por defecto queda A.)
- **P4.** ¿Se puede pedir con **saldo insuficiente** (vacaciones adelantadas)? ¿Solo LEGAL?
- **P5.** Permisos: ¿cuántos días de **calamidad doméstica** y qué respaldo? ¿**Personal** descuenta de vacaciones o es sin sueldo? ¿El **certificado médico** es obligatorio, y desde cuántos días? ¿Se agregan LACTANCIA, ADOPCIÓN y SUFRAGIO como tipos propios? ¿8 horas = 1 día?
- **P8.** ¿Se pagan en **dinero** los días adicionales o el exceso acumulado? ¿Qué se hace al pasar 3 años sin gozarlas?

**Para Peter:**
- **P6.** Jefe ausente: ¿basta con que LEGAL reasigne o apruebe en su lugar, o se quiere un **reemplazo fijo** por jefe? Cuando cambia el jefe de alguien, ¿sus pendientes pasan solas al jefe nuevo?
- **P7.** ¿Quién aprueba las vacaciones del **gerente general** (y de quien no tiene jefe)? ¿LEGAL o un usuario GERENCIA concreto?
- **P9.** ¿**GERENCIA** ve el calendario de toda la empresa? ¿LEGAL recibe aviso en la campanita de cada aprobación, o solo lo ve en pantalla?
- **P10.** Adjuntos: ¿se aceptan certificados en el sistema (datos de salud, LOPDP) o solo se marca "CERTIFICADO ENTREGADO"? Si se aceptan, el respaldo debe incluir `storage/`.
- **P11.** Pantallas **automáticas** (recomendado) o pantallas normales que el ADMIN asigna en cada perfil.
- **P12.** `users.boss_id` ("asistente de") se queda como está. ¿Lo usa alguien? Si no, se puede quitar más adelante para no confundirlo con el jefe inmediato.
- **P13.** Departamentos: ¿texto libre como hoy en Usuarios o un **catálogo** (tabla `departments`) para que no haya "LOGISTICA" y "LOGÍSTICA"? Si se hace catálogo, conviene que también lo use `users.department`; sería otro cambio.
- **P14.** ¿Hay personal **extranjero con pasaporte**? (cambia la validación de la cédula). ¿Cuántas personas son en total y cuántas tienen usuario?

---

## 14. Estimación (cambio grande)

| Parte | Tamaño |
|---|---|
| Migración + 4 modelos + config + cambio en `User::pantallas()` y `Auditable` | medio |
| Servicio de saldo + comando + avisos | medio |
| 4 controladores, unas 25 rutas, adjuntos | grande |
| 4 pantallas + calendario de mes + campanita para todos | grande |
| Pruebas (saldo con años 1 a 21, transiciones, permisos 403, cruces, adjuntos, ciclos de jefe) unas 70 + Chrome | medio |
| Carga inicial (siae-datos) | chico a medio, según el Excel |

**Total aproximado:** 3 a 4 sesiones de desarrollo + 1 de QA + la carga. Propuesta por fases (cada una sube sola):
- **Fase 1:** empleados, feriados, kárdex, saldo y carga inicial. LEGAL ya puede consultar saldos.
- **Fase 2:** solicitudes, aprobación y campanita.
- **Fase 3:** calendario y adjuntos (después de responder P10).

---

## 15. Resumen para Peter

Se propone una ficha de **EMPLEADOS** propia (no en Terceros, para que las cédulas no las vea todo el mundo) con jefe inmediato y usuario opcional. Habría un **kárdex de días** donde el sistema acredita solo 15 días por año cumplido (más los adicionales desde el 6.º año, a confirmar) y donde LEGAL carga el saldo de hoy. Las **solicitudes** las aprueba el jefe inmediato, con aviso en la campanita (que pasa a verla todo el personal). LEGAL ve todo, registra por otros, anula, interrumpe y ajusta. En la base se agregan 4 tablas (`employees`, `holidays`, `leave_requests`, `employee_vacation_movements`) y una columna en `user_notifications`, y el perfil LEGAL gana 2 pantallas. No se toca ninguna regla de compras, liquidación, contratos, flete ni OC. Antes de programar hacen falta tus respuestas y las de LEGAL a P1–P14, sobre todo: cómo se cuentan los días (P3), si el adicional empieza en el año 5 o 6 (P1), quién aprueba al gerente (P7) y si se guardan certificados médicos (P10).
