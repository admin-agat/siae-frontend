# Documentos de exportación: Factura (INVOICE + PRICE LIST) y Packing list

Diseño de `siae-architect`, 12/11/2026. **Estado: propuesta.** Peter confirmó el 12/11/2026 cuatro decisiones (ver §7): **una factura por booking**, **el número lo escribe Exportaciones**, el **precio CFR** y el **flujo con los datos bancarios**. Falta su aprobación del diseño completo. Es un **cambio grande** (tablas nuevas, permisos y aprobación de facturas).

Insumos revisados:
- las 3 facturas reales de la WK41/42 (SPOT JSC, CFR JSC y CONTRATO RVI) y los 2 packing lists (WK21 JSC en contenedores y WK23 RVI bajo cubierta);
- las memorias de Logística, Finanzas y Comercial;
- `DESARROLLO.md`;
- el código del Cierre de embarque, los contratos y pedidos de clientes y los gastos por viaje;
- la base local `SIAE`, consultada solo con lecturas.

Los RUC, cuentas, sellos y contenedores reales van enmascarados (`#####`).

---

## 1. Proceso de negocio

1. **Logística cierra el embarque.** En el **Cierre de embarque** registra, por booking:
   - lo embarcado, la DAE, el B/L y el consignee;
   - lo nuevo: el **incoterm** y la **presentación**;
   - en contenedor, la **ficha de cada contenedor**: número, 2 sellos o más, 2 termógrafos y cajas;
   - en bajo cubierta, los **sellos de bodega**.
2. **Exportaciones arma la factura.** En la pantalla **Facturas de exportación**:
   - elige el barco y **un booking**: **una factura por booking** (CONFIRMADO 12/11/2026);
   - el SIAE propone todo: comprador, "facturar a" (por ejemplo, BLUESTAR en el SPOT de JSC), consignee, contrato legal, orden, nave, puertos, precio, pesos, condiciones de pago y total en letras;
   - **Exportaciones escribe el N° de factura** (CONFIRMADO). El SIAE sugiere el siguiente de la serie del cliente y valida el formato y que no se repita;
   - la factura queda en **BORRADOR**.
3. **Exportaciones descarga el borrador.** Saca el Excel (INVOICE + PRICE LIST, con el mismo formato de hoy) para revisarlo. El borrador dice "BORRADOR" y no lleva datos bancarios.
4. **Revisión (Comercial o Gerencia).** Revisa el precio, el contrato y las condiciones:
   - si está bien, la marca **REVISADA**;
   - si no, la **devuelve** a BORRADOR con una nota.
5. **Aprobación (Contabilidad).** Contabilidad **APRUEBA**:
   - **congela** el número que escribió Exportaciones y todos los valores;
   - desde ahí el Excel o PDF sale con número, datos bancarios y firmas.
   - La factura electrónica del SRI la sigue emitiendo Contabilidad **fuera del SIAE** (CONFIRMADO). Si quiere, registra aquí el N° de autorización (campo opcional).
6. **Packing list.** Con el mismo booking (con o sin factura), Exportaciones genera el **Packing list** del booking:
   - en contenedores, una fila por contenedor con sus sellos;
   - en bajo cubierta, una fila **BULK**;
   - los totales siempre los calcula el SIAE.
7. **Corrección.** Una factura APROBADA **no se edita**: Contabilidad la **ANULA** con motivo (el número queda usado) y Exportaciones arma otra. El booking queda libre para facturarse de nuevo.
8. **Lo que viene después** (fases 2 y 3): PDF, contenedor ligado a las tarjas (productores por contenedor), versión rusa e instrucciones de B/L ("Marca BL").

---

## 2. Qué ya existe y qué se reutiliza

| Pieza | Qué es hoy | Uso en este módulo |
|---|---|---|
| `shipment_bookings` (Cierre de embarque) | Un booking por barco con cliente, marca, CONTRATO/SPOT, modalidad, N° de contenedores, booking, DAE, B/L, orden, consignee/notify, cajas embarcadas, pesos neto y bruto por caja | **Unidad base** de la factura y del packing. Se le agregan `incoterm`, `presentation` y `hold_seals`, y se amplía `order_ref` |
| `ShipmentClosingController` | `PUT /customer-orders/{id}/closing` **reemplaza** los bookings de la semana y borra los que se quitaron | Hay que **bloquear** los cambios y el borrado de un booking con factura activa (ver §5) |
| `shipments` | Nave (`vessel_id`, `vessel_name`), viaje, naviera, puertos de salida y destino, semana | Nave, viaje, naviera, puertos y semana de la factura |
| `customers` → `third_parties` | Nombre, identificación (INN), dirección, país | Comprador y "facturar a" |
| `customer_contracts` + `customer_contract_prices` | Contrato por cliente con incoterm, vigencia y precio por marca × presentación | Precio de CONTRATO. Se le agrega el **N° legal**, su **fecha** y la **plantilla de pago** |
| `customer_order_lines` | Línea del pedido: incoterm, negociación, `box_price` congelado (CONTRATO) o escrito a mano (SPOT), `boxes_per_container` | **Fuente principal del precio**: precio congelado del pedido, por `shipment_lines.customer_order_line_id` |
| `shipment_costs` | Tarifa por contenedor y flete bajo cubierta por viaje (Finanzas) | Flete por caja en CFR/CIF (desglose; FOB + flete solo cuando no hay precio CFR, CONFIRMADO) |
| `tally_sheets.container_number` | Número de contenedor suelto por tarja | Fase 2: la tarja apunta al contenedor (`booking_container_id`) |
| `banks` | Catálogo de bancos | Banco de la cuenta de cobro del exportador |
| `config/pantallas.php`, `profiles.screens` | Permisos por pantalla | 4 pantallas nuevas (§5) |
| `ControlVersion` (409) | Control de guardados al mismo tiempo | Se usa al editar el borrador |
| Impresión con `window.print` (Cierre, Despachos) | Hojas imprimibles | Base del PDF de la fase 2 |
| Menú: "Invoice" y "Marca BL" en "próximamente" | Sin pantalla | "Invoice" pasa a **Facturas de exportación**. "Marca BL" queda para la fase 3 |

**Tablas viejas sin uso: `invoices`, `invoice_lines` y `bills_of_lading`** (migraciones de 09/2026):
- **Se reemplazan.** No tienen modelo, controlador ni pantalla. En la base local tienen 0 filas, y `invoice_lines` depende de `skus`, que no se usa.
- **Su diseño no sirve:**
  - la factura es por barco + cliente;
  - el número se escribe a mano;
  - no tienen serie, estado, aprobación, incoterm, negociación ni contrato;
  - la línea va por SKU.
- **Se borran** con el mismo resguardo que `bookings` (migración `2026_11_10_000003`): si alguna tiene filas, la migración se detiene y no borra nada.
- Las tablas nuevas se llaman `export_invoices*` para no confundirlas con facturas de proveedores u OC.
- El B/L ya vive en `shipment_bookings.bl_number`, así que `bills_of_lading` no hace falta.

**Ya resuelto en el SIAE y no se toca:** peso neto y bruto por caja por booking (19,4 / 19,6 y 20,8 / 20,9) y CONTRATO/SPOT por booking.

**Datos en la base local.** Las tablas con datos están casi vacías (3 contratos de clientes, 0 bookings), así que el diseño se validó contra la estructura, no contra datos de producción.

---

## 3. Tablas y columnas nuevas o cambiadas

Convenciones:
- Montos en `decimal(12,2)`; precios por caja en `decimal(12,4)`; kilos en `decimal(12,2)`.
- Baja lógica con `status`. Catálogos cerrados con `in:` y CHECK.
- Toda tabla nueva tiene un modelo con `Auditable`.

### 3.1 Configuración (fase 1)

**`payment_term_templates`**: plantillas de condiciones de pago.

| Columna | Tipo | Nota |
|---|---|---|
| id | bigserial | |
| code | varchar(30) UNIQUE | `RVI_70_30`, `JSC_50_50`, `JSC_50_50_RUB` |
| name | varchar(120) | Nombre en pantalla |
| text_en | text | Texto en inglés tal como sale en la factura |
| text_ru | text NULL | Versión rusa (fase 3) |
| status | boolean | |
| created_by | FK users NULL | |

**`invoice_series`**: series de numeración tipo SRI.

| Columna | Tipo | Nota |
|---|---|---|
| establishment | char(3) | `001` |
| emission_point | char(3) | `003` (JSC), `007` (RVI) |
| name | varchar(80) | `SERIE JSC / BLUESTAR` |
| last_number | integer ≥ 0 | **Solo ayuda** (CONFIRMADO 12/11/2026: el número lo escribe Exportaciones). Último secuencial que se conoce. Sirve para **sugerir** `last_number + 1` en el borrador. Al aprobar se actualiza a `GREATEST(last_number, secuencial aprobado)` |
| status | boolean | |

Restricciones:
- UNIQUE(`establishment`, `emission_point`).
- CHECK: 3 dígitos en cada código.

**`export_settings`**: datos del exportador. Es una sola fila (CHECK `id = 1`).

| Grupo | Columnas |
|---|---|
| Exportador | `exporter_name`, `exporter_tax_id` (lo escribe Contabilidad en pantalla; no va en semillas), `exporter_address`, `exporter_city`, `exporter_country`, `exporter_phone`, `exporter_email`, `logo_path` |
| Producto | `farmer_text` (AGAT-ECUAGREEN), `origin_country` (ECUADOR), `product_description` (FRESH GREEN BANANAS…), `variety` (CAVENDISH), `tariff_code` (NANDINA 0803.90.10.00 como texto), `temperature_text` (13,3 °C) |
| Packing | `packing_legal_text` (texto del pie con `{net}`, `{gross}` y `{box_type}`) |
| Firmante | `signer_name`, `signer_title`, `signer_id_number` (**cifrado**: es una cédula), `signer_phone`, `signer_email` |
| Control | `updated_by`, timestamps |

**`export_bank_accounts`**: cuentas de cobro del exportador.
- Sigue la regla de cuentas bancarias: solo las ven y editan Contabilidad y ADMIN, y el número va cifrado igual que `third_party_bank_accounts`.

| Columna | Tipo | Nota |
|---|---|---|
| bank_id | FK banks | Banco Pichincha |
| account_type | varchar(10) | CHECK CORRIENTE/AHORROS |
| account_number | text | cast `encrypted` |
| swift | varchar(11) | |
| beneficiary_name | varchar(150) | |
| intermediary_bank_name | varchar(150) NULL | Banco intermediario (JP Morgan) |
| intermediary_swift | varchar(11) NULL | |
| intermediary_account | text NULL | cast `encrypted` |
| is_default | boolean | UNIQUE parcial: una sola por defecto activa |
| status, updated_by | | |

**`customer_billing_profiles`**: ficha de facturación por cliente × negotiation_type (CONTRATO / SPOT).
- Así se modelan el "facturar a" y la serie, y también el contrato legal del SPOT, que no tiene contrato de precio.

| Columna | Tipo | Nota |
|---|---|---|
| customer_id | FK customers | Cliente del pedido (consignee comercial, por ejemplo JSC GRAND TRADE) |
| negotiation_type | varchar(8) | CHECK CONTRATO/SPOT |
| bill_to_customer_id | FK customers NULL | **Facturar a**: NULL = el mismo cliente. En el SPOT de JSC es BLUESTAR TRADING |
| invoice_series_id | FK invoice_series | Serie que usa (001-003 o 001-007) |
| payment_term_template_id | FK NULL | Plantilla por defecto, sobre todo para el SPOT |
| contract_reference | varchar(80) NULL | Contrato marco del SPOT (R-BLU-FROV/…). **No es un contrato de precio** |
| contract_date | date NULL | |
| buyer_tax_label | varchar(10) | `INN` por defecto (lo que se imprime antes de la identificación) |
| notes, status | | |

Restricción: UNIQUE(`customer_id`, `negotiation_type`).

**`customer_contracts`**, columnas nuevas:

| Columna | Tipo | Nota |
|---|---|---|
| legal_number | varchar(80) NULL | N° legal del contrato ruso (por ejemplo, GT/1104/26) |
| legal_date | date NULL | Fecha del contrato legal |
| payment_term_template_id | FK NULL | Plantilla del contrato. Manda sobre la de la ficha |

### 3.2 Booking y contenedor (fase 1)

**`shipment_bookings`**, cambios:

| Columna | Cambio | Nota |
|---|---|---|
| incoterm | NUEVA varchar(3) NULL | CHECK FOB/CFR/CIF. Se propone desde las líneas del pedido del cliente en ese barco. Obligatoria para facturar |
| presentation | NUEVA varchar(15) NULL | CHECK CONVENCIONAL/PACKED (`Brand::PRESENTACIONES`). Define el precio del contrato |
| hold_seals | NUEVA varchar(300) NULL | Sellos de bodega en bajo cubierta (los 9 números de RVI) |
| order_ref | varchar(20) → **varchar(60)** | "RVI-2026-41-46-AGAT-CONTRACT-1" tiene 30 caracteres y hoy no cabe |

**`booking_containers`** (NUEVA): la ficha del contenedor.

| Columna | Tipo | Nota |
|---|---|---|
| shipment_booking_id | FK shipment_bookings (RESTRICT) | |
| container_number | varchar(11) | CHECK `^[A-Z]{4}[0-9]{7}$` (ISO 6346). El dígito de control da un aviso, no bloquea |
| seal_1, seal_2 | varchar(30) NULL | Obligatorios para el packing (validación del backend, no de la base) |
| extra_seals | varchar(200) NULL | Más sellos, separados por coma |
| thermograph_1, thermograph_2 | varchar(30) NULL | |
| boxes | integer ≥ 0 | Normalmente 1.200. Puede ir con una caja menos |
| pallets | smallint NULL | |
| temperature | decimal(4,1) NULL | |
| loading_place | varchar(10) NULL | CHECK FINCA/ACOPIO |
| loading_date | date NULL | |
| notes | varchar(255) NULL | |
| status, created_by | | |

Índices y control:
- UNIQUE parcial (`shipment_booking_id`, `container_number`) WHERE status.
- Índice en `container_number`.
- El backend **valida** que un contenedor no aparezca dos veces en el mismo barco. En la base no se puede forzar sin repetir `shipment_id`, y los contenedores vuelven a circular en otros viajes.
- **Bajo cubierta no lleva filas.** El packing arma la fila BULK con `shipped_boxes` y `hold_seals`.

### 3.3 Factura (fase 1)

**`export_invoices`**: **una factura por booking** (CONFIRMADO 12/11/2026).

| Grupo | Columnas |
|---|---|
| Booking | `shipment_booking_id` FK shipment_bookings NULL (NULL ON DELETE; solo puede quedar NULL en una ANULADA cuyo booking se quitó en el Cierre) y la copia `booking_number`. UNIQUE parcial WHERE `status`: **un booking tiene una sola factura no anulada** |
| Número | `invoice_number` varchar(17) NULL: **lo escribe Exportaciones** (CONFIRMADO). Formato `000-000-000000000`, editable solo en BORRADOR y congelado al aprobar. `invoice_series_id` FK NULL y `sequential` integer NULL los **deriva el backend** del número (primeros 7 caracteres = serie, últimos 9 = secuencial) |
| Estado | `state` varchar(10) CHECK BORRADOR/REVISADA/APROBADA/ANULADA; `status` boolean (false solo si está ANULADA, para las pestañas de `TablaEstandar`) |
| Fechas | `issue_date`, `week`, `year` (semana del barco, por defecto) |
| Copiado del booking | `shipment_id`, `customer_id`, `bill_to_customer_id`, `brand_id`, `negotiation_type`, `incoterm`, `incoterm_port_id` (FOB → puerto de salida; CFR/CIF → destino). Se guardan para filtrar e imprimir aunque el booking cambie después de anular |
| Origen | `customer_contract_id` NULL, `payment_term_template_id` NULL, `export_bank_account_id` NULL |
| Copias (se refrescan en BORRADOR y se congelan al aprobar) | `booking_number`, `buyer_name`, `buyer_tax_label`, `buyer_tax_id`, `buyer_address`, `consignee_name`, `consignee_address`, `contract_reference`, `contract_date`, `order_reference`, `vessel_name`, `voyage`, `shipping_line_name`, `departure_port_name`, `destination_port_name`, `brand_print_name`, `payment_terms_text`, `bank_details` (text cifrado; solo se llena al aprobar) |
| Totales (calculados) | `total_boxes`, `total_net_kg`, `total_gross_kg`, `subtotal_vat` (SUBTOTAL 15 %, siempre 0), `subtotal_zero`, `discount`, `total`, `amount_in_words` |
| SRI (opcional) | `sri_authorization` varchar(60) NULL. La factura electrónica la emite Contabilidad **fuera del SIAE** (CONFIRMADO) |
| Flujo | `notes`, `review_note`, `created_by`, `reviewed_by` / `reviewed_at`, `approved_by` / `approved_at`, `voided_by` / `voided_at`, `void_reason` |

CHECK:
- `(state = 'ANULADA') = (status = false)`;
- `invoice_number IS NULL OR invoice_number ~ '^[0-9]{3}-[0-9]{3}-[0-9]{9}$'`;
- `state NOT IN ('REVISADA','APROBADA') OR invoice_number IS NOT NULL` (no se envía a revisión sin número);
- `discount >= 0`;
- `total = subtotal_vat + subtotal_zero - discount`;
- `subtotal_vat = 0` (exportación con tarifa 0 %).

Índices:
- UNIQUE parcial (`shipment_booking_id`) WHERE `status`: una sola factura viva por booking. Al anularla, el booking queda libre;
- UNIQUE parcial (`invoice_number`) WHERE `status`: **el número no se repite entre facturas no anuladas**. Como el número incluye la serie, esto cubre "no repetido en la misma serie". Una anulada libera su número (ver la pregunta 3b);
- (`year`, `week`);
- `shipment_id`, `customer_id` y `state`.

**`export_invoice_lines`**: filas de detalle de la factura (QUANTITY / DETAILS / PRICE / AMOUNT).
- Normalmente es **una sola**, la del booking. Se deja como tabla para poder imprimir más de una fila, por ejemplo dos descripciones, sin cambiar el esquema.
- **No** apunta al booking: el booking va en la cabecera.

| Columna | Tipo | Nota |
|---|---|---|
| export_invoice_id | FK (RESTRICT) | |
| line_no | smallint | |
| description | varchar(300) | "FRESH GREEN BANANAS CAVENDISH 22XU – 19.4 KG NET" |
| presentation | varchar(15) | |
| boxes | integer > 0 | La suma de las líneas debe ser igual a `shipped_boxes` del booking (la valida el backend) |
| unit_price | decimal(12,4) | Precio congelado |
| amount | decimal(12,2) | CHECK `amount = ROUND(boxes * unit_price, 2)` |
| net_weight_per_box, gross_weight_per_box | decimal(6,2) | Copia del booking |
| net_kg, gross_kg | decimal(12,2) | CHECK `= ROUND(boxes * peso_por_caja, 2)` |
| containers_count | smallint | |
| price_source | varchar(10) | CHECK PEDIDO / CONTRATO / FOB_FLETE / MANUAL |
| fob_price, freight_per_box | decimal(12,4) NULL | Desglose en CFR/CIF |
| price_review_ok | boolean default false | Solo cuenta si `price_source = FOB_FLETE`: el revisor confirma ese precio antes de marcar REVISADA |

**De dónde sale el precio** (CONFIRMADO 12/11/2026 para CFR), en orden:
1. **PEDIDO**: el `box_price` congelado de la línea del pedido del mismo cliente, negociación, incoterm, marca y presentación en ese barco (por `shipment_lines.customer_order_line_id`). En CFR es el **precio CFR**.
2. **CONTRATO**: si la línea no tiene precio, el `customer_contract_prices.box_price` del contrato vigente al lunes de la semana, por marca × presentación. En CFR, el del contrato CFR.
   - En CFR/CIF, el **flete por caja** (`shipment_costs.container_rate` ÷ cajas por contenedor) se guarda en `freight_per_box`, y `fob_price = precio − flete`. Es **solo un desglose**: no cambia el precio.
3. **FOB_FLETE**: solo si es CFR/CIF y **solo hay precio FOB**. Se **propone** FOB + flete por caja y la línea queda **marcada para revisar**: la factura no pasa a REVISADA hasta que el revisor confirma ese precio (`price_review_ok`).
4. **MANUAL**: un SPOT sin precio; se exige escribirlo.

Si hay dos precios posibles, el borrador avisa y el usuario elige.

### 3.4 Fase 2 (se anota ahora y se programa después)

- `tally_sheets.booking_container_id`: FK NULL a `booking_containers`. La tarja de un contenedor apunta a su ficha, y así salen los **productores por contenedor** y el cuadre de cajas ficha vs. tarjas.
- `container_number` se queda como texto de respaldo.
- No cambia la liquidación.

---

## 4. Migraciones de Laravel propuestas

Son tres archivos de la fase 1. Fechas tentativas: se renombran al programar.

### 4.1 `2026_11_13_000001_facturacion_exportacion_configuracion.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 13/11/2026 (diseño docs/modulos/documentos-exportacion.md): configuración para que el SIAE genere la
// factura de exportación (INVOICE + PRICE LIST) que hoy Exportaciones hace a mano en Excel:
// plantillas de condiciones de pago, series de numeración tipo SRI (001-003 JSC, 001-007 RVI),
// datos del exportador, cuentas de cobro (cifradas, solo Contabilidad/ADMIN), ficha de facturación
// por cliente × CONTRATO/SPOT ("facturar a" BLUESTAR en el SPOT de JSC) y N° legal del contrato ruso.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_term_templates', function (Blueprint $t) {
            $t->id();
            $t->string('code', 30)->unique();
            $t->string('name', 120);
            $t->text('text_en');            // tal como sale en la factura
            $t->text('text_ru')->nullable(); // versión rusa (fase 3)
            $t->boolean('status')->default(true);
            $t->foreignId('created_by')->nullable()->constrained('users');
            $t->timestamps();
        });

        Schema::create('invoice_series', function (Blueprint $t) {
            $t->id();
            $t->char('establishment', 3);
            $t->char('emission_point', 3);
            $t->string('name', 80);
            $t->integer('last_number')->default(0); // solo ayuda: sugiere el siguiente N° (el N° lo escribe Exportaciones)
            $t->boolean('status')->default(true);
            $t->timestamps();
            $t->unique(['establishment', 'emission_point']);
        });
        DB::statement("ALTER TABLE invoice_series ADD CONSTRAINT invoice_series_codes_check
            CHECK (establishment ~ '^[0-9]{3}$' AND emission_point ~ '^[0-9]{3}$' AND last_number >= 0)");

        // Una sola fila (id = 1): datos fijos del exportador para factura y packing
        Schema::create('export_settings', function (Blueprint $t) {
            $t->id();
            $t->string('exporter_name', 150);
            $t->string('exporter_tax_id', 20)->nullable();   // lo escribe Contabilidad en pantalla
            $t->string('exporter_address', 300)->nullable();
            $t->string('exporter_city', 80)->nullable();
            $t->string('exporter_country', 60)->default('ECUADOR');
            $t->string('exporter_phone', 40)->nullable();
            $t->string('exporter_email', 120)->nullable();
            $t->string('logo_path', 255)->nullable();
            $t->string('farmer_text', 150)->nullable();
            $t->string('origin_country', 60)->default('ECUADOR');
            $t->string('product_description', 300)->nullable();
            $t->string('variety', 60)->default('CAVENDISH');
            $t->string('tariff_code', 20)->nullable();        // NANDINA
            $t->string('temperature_text', 40)->nullable();
            $t->text('packing_legal_text')->nullable();       // con {net} {gross} {box_type}
            $t->string('signer_name', 150)->nullable();
            $t->string('signer_title', 80)->nullable();
            $t->text('signer_id_number')->nullable();         // cédula: cast 'encrypted'
            $t->string('signer_phone', 40)->nullable();
            $t->string('signer_email', 120)->nullable();
            $t->foreignId('updated_by')->nullable()->constrained('users');
            $t->timestamps();
        });
        DB::statement('ALTER TABLE export_settings ADD CONSTRAINT export_settings_single_row CHECK (id = 1)');

        // Cuentas de cobro del exportador: solo Contabilidad y ADMIN (regla de cuentas bancarias)
        Schema::create('export_bank_accounts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('bank_id')->constrained('banks');
            $t->string('account_type', 10);
            $t->text('account_number');                       // cast 'encrypted'
            $t->string('swift', 11)->nullable();
            $t->string('beneficiary_name', 150);
            $t->string('intermediary_bank_name', 150)->nullable();
            $t->string('intermediary_swift', 11)->nullable();
            $t->text('intermediary_account')->nullable();     // cast 'encrypted'
            $t->boolean('is_default')->default(false);
            $t->boolean('status')->default(true);
            $t->foreignId('updated_by')->nullable()->constrained('users');
            $t->timestamps();
        });
        DB::statement("ALTER TABLE export_bank_accounts ADD CONSTRAINT export_bank_accounts_type_check
            CHECK (account_type IN ('CORRIENTE','AHORROS'))");
        DB::statement('CREATE UNIQUE INDEX export_bank_accounts_one_default ON export_bank_accounts (is_default)
            WHERE is_default AND status');

        Schema::create('customer_billing_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_id')->constrained('customers');
            $t->string('negotiation_type', 8);
            $t->foreignId('bill_to_customer_id')->nullable()->constrained('customers'); // NULL = el mismo cliente
            $t->foreignId('invoice_series_id')->constrained('invoice_series');
            $t->foreignId('payment_term_template_id')->nullable()->constrained('payment_term_templates');
            $t->string('contract_reference', 80)->nullable(); // contrato marco (SPOT): no es contrato de precio
            $t->date('contract_date')->nullable();
            $t->string('buyer_tax_label', 10)->default('INN');
            $t->string('notes', 255)->nullable();
            $t->boolean('status')->default(true);
            $t->timestamps();
            $t->unique(['customer_id', 'negotiation_type']);
        });
        DB::statement("ALTER TABLE customer_billing_profiles ADD CONSTRAINT customer_billing_profiles_negotiation_check
            CHECK (negotiation_type IN ('CONTRATO','SPOT'))");

        Schema::table('customer_contracts', function (Blueprint $t) {
            $t->string('legal_number', 80)->nullable();   // N° del contrato ruso (GT/1104/26…)
            $t->date('legal_date')->nullable();
            $t->foreignId('payment_term_template_id')->nullable()->constrained('payment_term_templates');
        });
    }

    public function down(): void
    {
        Schema::table('customer_contracts', function (Blueprint $t) {
            $t->dropForeign(['payment_term_template_id']);
            $t->dropColumn(['legal_number', 'legal_date', 'payment_term_template_id']);
        });
        Schema::dropIfExists('customer_billing_profiles');
        Schema::dropIfExists('export_bank_accounts');
        Schema::dropIfExists('export_settings');
        Schema::dropIfExists('invoice_series');
        Schema::dropIfExists('payment_term_templates');
    }
};
```

### 4.2 `2026_11_13_000002_booking_incoterm_y_contenedores.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 13/11/2026 (diseño documentos-exportacion): el booking necesita incoterm y presentación para el precio
// de la factura; sellos de bodega para el packing bajo cubierta; order_ref más largo (las órdenes de RVI
// tienen 30 caracteres). Ficha del contenedor: número ISO, 2+ sellos, 2 termógrafos, cajas.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipment_bookings', function (Blueprint $t) {
            $t->string('incoterm', 3)->nullable();
            $t->string('presentation', 15)->nullable();
            $t->string('hold_seals', 300)->nullable();
            $t->string('order_ref', 60)->nullable()->change();
        });
        DB::statement("ALTER TABLE shipment_bookings ADD CONSTRAINT shipment_bookings_incoterm_check
            CHECK (incoterm IS NULL OR incoterm IN ('FOB','CFR','CIF'))");
        DB::statement("ALTER TABLE shipment_bookings ADD CONSTRAINT shipment_bookings_presentation_check
            CHECK (presentation IS NULL OR presentation IN ('CONVENCIONAL','PACKED'))");

        Schema::create('booking_containers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('shipment_booking_id')->constrained('shipment_bookings'); // RESTRICT: el Cierre los quita uno por uno
            $t->string('container_number', 11);
            $t->string('seal_1', 30)->nullable();
            $t->string('seal_2', 30)->nullable();
            $t->string('extra_seals', 200)->nullable();
            $t->string('thermograph_1', 30)->nullable();
            $t->string('thermograph_2', 30)->nullable();
            $t->integer('boxes')->default(0);
            $t->smallInteger('pallets')->nullable();
            $t->decimal('temperature', 4, 1)->nullable();
            $t->string('loading_place', 10)->nullable();
            $t->date('loading_date')->nullable();
            $t->string('notes', 255)->nullable();
            $t->boolean('status')->default(true);
            $t->foreignId('created_by')->nullable()->constrained('users');
            $t->timestamps();
            $t->index('shipment_booking_id');
            $t->index('container_number');
        });
        DB::statement("ALTER TABLE booking_containers ADD CONSTRAINT booking_containers_checks CHECK (
            container_number ~ '^[A-Z]{4}[0-9]{7}$' AND boxes >= 0 AND (pallets IS NULL OR pallets >= 0)
            AND (loading_place IS NULL OR loading_place IN ('FINCA','ACOPIO')))");
        DB::statement('CREATE UNIQUE INDEX booking_containers_unique_active
            ON booking_containers (shipment_booking_id, container_number) WHERE status');
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_containers');
        DB::statement('ALTER TABLE shipment_bookings DROP CONSTRAINT IF EXISTS shipment_bookings_incoterm_check');
        DB::statement('ALTER TABLE shipment_bookings DROP CONSTRAINT IF EXISTS shipment_bookings_presentation_check');
        // order_ref vuelve a 20: si hay órdenes más largas, no se recorta en silencio
        $largas = DB::table('shipment_bookings')->whereRaw('length(order_ref) > 20')->count();
        if ($largas) {
            throw new RuntimeException("$largas bookings tienen order_ref de más de 20 caracteres: no se puede volver atrás sin perder datos.");
        }
        Schema::table('shipment_bookings', function (Blueprint $t) {
            $t->string('order_ref', 20)->nullable()->change();
            $t->dropColumn(['incoterm', 'presentation', 'hold_seals']);
        });
    }
};
```

### 4.3 `2026_11_13_000003_facturas_exportacion.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 13/11/2026 (diseño documentos-exportacion, decisiones de Peter del 12/11/2026): una factura por booking;
// el N° lo escribe Exportaciones. Flujo BORRADOR → REVISADA → APROBADA (congela número y
// congela) → ANULADA. Reemplaza las tablas del primer diseño (invoices, invoice_lines, bills_of_lading),
// que nunca se usaron: si alguna tiene datos, NO se borra nada.
return new class extends Migration
{
    private const PANTALLAS = [
        'EXPORTACIONES' => ['facturas_exportacion'],
        'COMERCIAL'     => ['revisar_facturas'],
        'GERENCIA'      => ['revisar_facturas'],
        'CONTABILIDAD'  => ['aprobar_facturas', 'config_facturacion'],
    ];

    public function up(): void
    {
        // 1) Tablas viejas sin uso
        foreach (['invoice_lines', 'invoices', 'bills_of_lading'] as $vieja) {
            if (Schema::hasTable($vieja) && DB::table($vieja)->exists()) {
                throw new RuntimeException("La tabla $vieja tiene datos: no se borra. Revisar antes.");
            }
        }
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('bills_of_lading');

        // 2) Cabecera
        Schema::create('export_invoices', function (Blueprint $t) {
            $t->id();
            // 12/11/2026 (CONFIRMADO por Peter): una factura por booking. Si el Cierre borra el booking de una
            // factura ANULADA, queda NULL y la copia booking_number; con factura viva el backend no deja borrarlo.
            $t->foreignId('shipment_booking_id')->nullable()->constrained('shipment_bookings')->nullOnDelete();
            $t->string('booking_number', 30)->nullable();
            // 12/11/2026 (CONFIRMADO): el N° lo escribe Exportaciones; serie y secuencial los deriva el backend
            $t->string('invoice_number', 17)->nullable();
            $t->foreignId('invoice_series_id')->nullable()->constrained('invoice_series');
            $t->integer('sequential')->nullable();
            $t->string('state', 10)->default('BORRADOR');
            $t->boolean('status')->default(true);
            $t->date('issue_date');
            $t->smallInteger('week');
            $t->smallInteger('year');
            $t->foreignId('shipment_id')->constrained('shipments');
            $t->foreignId('customer_id')->constrained('customers');
            $t->foreignId('bill_to_customer_id')->constrained('customers');
            $t->foreignId('brand_id')->constrained('brands');
            $t->string('negotiation_type', 8);
            $t->string('incoterm', 3);
            $t->foreignId('incoterm_port_id')->nullable()->constrained('ports');
            $t->foreignId('customer_contract_id')->nullable()->constrained('customer_contracts');
            $t->foreignId('payment_term_template_id')->nullable()->constrained('payment_term_templates');
            $t->foreignId('export_bank_account_id')->nullable()->constrained('export_bank_accounts');
            // Copias: se refrescan en BORRADOR, se congelan al aprobar
            $t->string('buyer_name', 150)->nullable();
            $t->string('buyer_tax_label', 10)->nullable();
            $t->string('buyer_tax_id', 30)->nullable();
            $t->string('buyer_address', 500)->nullable();
            $t->string('consignee_name', 150)->nullable();
            $t->string('consignee_address', 500)->nullable();
            $t->string('contract_reference', 80)->nullable();
            $t->date('contract_date')->nullable();
            $t->string('order_reference', 60)->nullable();
            $t->string('vessel_name', 80)->nullable();
            $t->string('voyage', 30)->nullable();
            $t->string('shipping_line_name', 80)->nullable();
            $t->string('departure_port_name', 80)->nullable();
            $t->string('destination_port_name', 80)->nullable();
            $t->string('brand_print_name', 80)->nullable();
            $t->text('payment_terms_text')->nullable();
            $t->text('bank_details')->nullable();            // cast 'encrypted'; solo al aprobar
            // Totales: siempre calculados por el backend
            $t->integer('total_boxes')->default(0);
            $t->decimal('total_net_kg', 12, 2)->default(0);
            $t->decimal('total_gross_kg', 12, 2)->default(0);
            $t->decimal('subtotal_vat', 12, 2)->default(0);  // SUBTOTAL 15 %: exportación = 0
            $t->decimal('subtotal_zero', 12, 2)->default(0);
            $t->decimal('discount', 12, 2)->default(0);
            $t->decimal('total', 12, 2)->default(0);
            $t->string('amount_in_words', 400)->nullable();
            $t->string('sri_authorization', 60)->nullable(); // opcional: la electrónica se emite fuera del SIAE
            // Flujo
            $t->string('notes', 500)->nullable();
            $t->string('review_note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users');
            $t->foreignId('reviewed_by')->nullable()->constrained('users');
            $t->timestamp('reviewed_at')->nullable();
            $t->foreignId('approved_by')->nullable()->constrained('users');
            $t->timestamp('approved_at')->nullable();
            $t->foreignId('voided_by')->nullable()->constrained('users');
            $t->timestamp('voided_at')->nullable();
            $t->string('void_reason', 300)->nullable();
            $t->timestamps();
            $t->index(['year', 'week']);
            $t->index('shipment_id');
            $t->index('customer_id');
            $t->index('state');
        });
        DB::statement("ALTER TABLE export_invoices ADD CONSTRAINT export_invoices_checks CHECK (
            state IN ('BORRADOR','REVISADA','APROBADA','ANULADA')
            AND ((state = 'ANULADA') = (status = false))
            AND (shipment_booking_id IS NOT NULL OR state = 'ANULADA')
            AND (invoice_number IS NULL OR invoice_number ~ '^[0-9]{3}-[0-9]{3}-[0-9]{9}$')
            AND (state NOT IN ('REVISADA','APROBADA') OR invoice_number IS NOT NULL)
            AND negotiation_type IN ('CONTRATO','SPOT')
            AND incoterm IN ('FOB','CFR','CIF')
            AND discount >= 0 AND subtotal_vat = 0
            AND total = subtotal_vat + subtotal_zero - discount)");
        // Una sola factura no anulada por booking
        DB::statement('CREATE UNIQUE INDEX export_invoices_booking_active
            ON export_invoices (shipment_booking_id) WHERE status AND shipment_booking_id IS NOT NULL');
        // El N° no se repite entre facturas no anuladas (incluye la serie: 001-003-…)
        DB::statement('CREATE UNIQUE INDEX export_invoices_number_active
            ON export_invoices (invoice_number) WHERE status AND invoice_number IS NOT NULL');

        // 3) Líneas de detalle (normalmente una por factura)
        Schema::create('export_invoice_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('export_invoice_id')->constrained('export_invoices');
            $t->smallInteger('line_no');
            $t->string('description', 300);
            $t->string('presentation', 15)->nullable();
            $t->integer('boxes');
            $t->decimal('unit_price', 12, 4);
            $t->decimal('amount', 12, 2);
            $t->decimal('net_weight_per_box', 6, 2);
            $t->decimal('gross_weight_per_box', 6, 2);
            $t->decimal('net_kg', 12, 2);
            $t->decimal('gross_kg', 12, 2);
            $t->smallInteger('containers_count')->default(0);
            $t->string('price_source', 10);
            $t->decimal('fob_price', 12, 4)->nullable();
            $t->decimal('freight_per_box', 12, 4)->nullable();
            $t->boolean('price_review_ok')->default(false); // FOB_FLETE: el revisor confirma el precio propuesto
            $t->timestamps();
            $t->index('export_invoice_id');
        });
        DB::statement("ALTER TABLE export_invoice_lines ADD CONSTRAINT export_invoice_lines_checks CHECK (
            boxes > 0 AND unit_price >= 0
            AND amount = ROUND(boxes * unit_price, 2)
            AND net_kg = ROUND(boxes * net_weight_per_box, 2)
            AND gross_kg = ROUND(boxes * gross_weight_per_box, 2)
            AND price_source IN ('PEDIDO','CONTRATO','FOB_FLETE','MANUAL'))");

        // 4) Pantallas nuevas en los perfiles iniciales (no se le quita nada a nadie)
        foreach (self::PANTALLAS as $tipo => $claves) {
            foreach ($claves as $clave) {
                DB::statement("UPDATE profiles SET screens = screens || ?::jsonb, updated_at = now()
                    WHERE base_role = ? AND NOT jsonb_exists(screens, ?)", [json_encode([$clave]), $tipo, $clave]);
            }
        }
    }

    public function down(): void
    {
        foreach (self::PANTALLAS as $tipo => $claves) {
            foreach ($claves as $clave) {
                DB::statement('UPDATE profiles SET screens = screens - ?, updated_at = now() WHERE base_role = ?', [$clave, $tipo]);
            }
        }
        Schema::dropIfExists('export_invoice_lines');
        Schema::dropIfExists('export_invoices');
        // Tablas del primer diseño, vacías (misma estructura que tenían)
        Schema::create('bills_of_lading', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments');
            $table->foreignId('customer_id')->constrained('customers');
            $table->string('bl_number');
            $table->date('issue_date');
            $table->text('comment')->nullable();
            $table->boolean('status')->default(true);
            $table->timestamps();
            $table->unique(['shipment_id', 'customer_id', 'bl_number']);
        });
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained('shipments');
            $table->foreignId('customer_id')->constrained('customers');
            $table->foreignId('bill_of_lading_id')->nullable()->constrained('bills_of_lading');
            $table->string('invoice_number');
            $table->date('issue_date');
            $table->string('currency', 3)->default('USD');
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->text('comment')->nullable();
            $table->boolean('status')->default(true);
            $table->timestamps();
            $table->unique(['shipment_id', 'customer_id', 'invoice_number']);
        });
        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('shipment_line_id')->nullable()->constrained('shipment_lines');
            $table->foreignId('sku_id')->constrained('skus');
            $table->enum('unit_type', ['CAJA', 'CONTENEDOR']);
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 12, 4);
            $table->decimal('subtotal', 14, 2);
            $table->boolean('status')->default(true);
            $table->timestamps();
            $table->index('invoice_id');
        });
    }
};
```

> Nota: se usa `jsonb_exists(screens, ?)` y no el operador `?` de jsonb, porque con PDO ese `?` se confunde con un parámetro.

### 4.4 Modelos: `$fillable` y `$casts`

| Modelo | Nuevo o cambia | `$fillable` | `$casts` |
|---|---|---|---|
| `PaymentTermTemplate` | nuevo | code, name, text_en, text_ru, status, created_by | status: boolean |
| `InvoiceSeries` | nuevo (`$table = 'invoice_series'`) | establishment, emission_point, name, last_number, status | last_number: integer, status: boolean |
| `ExportSetting` | nuevo | todas las columnas menos id | signer_id_number: **encrypted** |
| `ExportBankAccount` | nuevo | bank_id, account_type, account_number, swift, beneficiary_name, intermediary_bank_name, intermediary_swift, intermediary_account, is_default, status, updated_by | account_number y intermediary_account: **encrypted**, más `$hidden` para ambos (solo se entregan enmascarados `####1234`) |
| `CustomerBillingProfile` | nuevo | customer_id, negotiation_type, bill_to_customer_id, invoice_series_id, payment_term_template_id, contract_reference, contract_date, buyer_tax_label, notes, status | contract_date: date:Y-m-d, status: boolean |
| `CustomerContract` | cambia | + legal_number, legal_date, payment_term_template_id | + legal_date: date:Y-m-d |
| `ShipmentBooking` | cambia | + incoterm, presentation, hold_seals | — (más `containers()` hasMany y la constante `INCOTERMS`) |
| `BookingContainer` | nuevo | shipment_booking_id, container_number, seal_1, seal_2, extra_seals, thermograph_1, thermograph_2, boxes, pallets, temperature, loading_place, loading_date, notes, status, created_by | boxes y pallets: integer, temperature: decimal:1, loading_date: date:Y-m-d, status: boolean |
| `ExportInvoice` | nuevo | todo menos los totales, `invoice_series_id` y `sequential` (los deriva el servicio del número) | issue_date y contract_date: date:Y-m-d, montos y kilos: decimal:2, bank_details: **encrypted**, timestamps del flujo: datetime, status: boolean |
| `ExportInvoiceLine` | nuevo | todas | unit_price, fob_price y freight_per_box: decimal:4, montos y kilos: decimal:2, price_review_ok: boolean |

Todos llevan el trait `Auditable`. Los cambios se hacen modelo por modelo; por ejemplo, al anular, las líneas se desactivan con `->get()->each->update(...)`.

---

## 5. Permisos

### 5.1 Pantallas nuevas (`config/pantallas.php`)

| Clave | Sección | Nombre | Tipos base iniciales |
|---|---|---|---|
| `facturas_exportacion` | EXPORTACIONES | Facturas de exportación | EXPORTACIONES |
| `revisar_facturas` | EXPORTACIONES | Revisar facturas de exportación | COMERCIAL, GERENCIA |
| `aprobar_facturas` | CONTABILIDAD | Aprobar y anular facturas de exportación | CONTABILIDAD |
| `config_facturacion` | CONTABILIDAD | Series, condiciones de pago y datos del exportador | CONTABILIDAD |

Pantallas que ya existen y se reutilizan:
- `cierre_embarque`: ficha del contenedor, incoterm y presentación del booking, y Packing list.
- `cuentas_bancarias` (CONTABILIDAD): sección nueva "Cuentas de cobro del exportador".
- `contratos_clientes` (ADMIN): N° legal, fecha y plantilla de pago del contrato.
- `terceros` (ADMIN): crear el cliente BLUESTAR TRADING.

En `src/routes/menu.js`, "Invoice" (próximamente) pasa a "Facturas de exportación" con `pantalla: "facturas_exportacion"`. "Marca BL" sigue en próximamente.

### 5.2 API (todo con `->middleware('pantalla:…')`; el backend valida siempre)

| Endpoint | Pantalla | Qué valida el backend |
|---|---|---|
| `GET /export-invoices?year&week&state` | facturas_exportacion, revisar_facturas, aprobar_facturas | — |
| `GET /export-invoices/candidates?shipment_id=` | facturas_exportacion | Bookings del barco sin factura viva |
| `GET /export-invoices/next-number?booking_id=` | facturas_exportacion | Solo **sugiere** el siguiente número: serie de la ficha del cliente, mayor entre `last_number` y el último secuencial no anulado de esa serie, + 1 |
| `POST /export-invoices` (shipment_booking_id, invoice_number opcional, issue_date, notes) | facturas_exportacion | **Un booking por factura**; el booking no tiene otra factura viva; incoterm, pesos y cajas > 0 llenos; ficha de facturación del cliente × negociación existente; precio resuelto. Si viene número: formato `000-000-000000000`, serie existente y activa, y que no esté repetido entre las no anuladas |
| `PUT /export-invoices/{id}` | facturas_exportacion | Solo en **BORRADOR**: número, fecha, notas y líneas; `ControlVersion` (409); recalcula todo y vuelve a validar el número |
| `PATCH /export-invoices/{id}/review` | revisar_facturas | BORRADOR → REVISADA. **No la puede revisar quien la elaboró** (salvo ADMIN). Exige el número escrito, y si hay líneas FOB_FLETE, que el revisor confirme ese precio (`price_review_ok`) |
| `PATCH /export-invoices/{id}/return` (nota) | revisar_facturas, aprobar_facturas | REVISADA → BORRADOR, con nota obligatoria |
| `PATCH /export-invoices/{id}/approve` | aprobar_facturas | Solo REVISADA. **No asigna número**: vuelve a validar el número que escribió Exportaciones (formato y que no esté repetido), lo **congela** con todo lo demás, copia `bank_details` y sube `invoice_series.last_number` si el secuencial es mayor (bloqueando la fila de la serie) |
| `PATCH /export-invoices/{id}/void` (motivo) | aprobar_facturas (cualquier estado vivo); facturas_exportacion (solo su BORRADOR) | Motivo obligatorio. `status = false`: el booking queda libre para otra factura. El número de una anulada deja de bloquear (ver la pregunta 3b) |
| `PATCH /export-invoices/{id}/sri` | aprobar_facturas | Solo APROBADA; guarda la autorización |
| `GET /export-invoices/{id}/excel` | las tres de facturas | Si no está APROBADA, sale con la marca "BORRADOR", sin número y sin banco |
| `GET /shipment-bookings/{id}/packing-list` y `GET /export-invoices/{id}/packing-list` | cierre_embarque, facturas_exportacion | **Un packing por booking** (o por su factura). Las cajas de los contenedores deben sumar `shipped_boxes`; sellos 1 y 2 llenos |
| `PUT /shipment-bookings/{id}/containers` | cierre_embarque | ISO válido; sin repetir en el barco; booking en modalidad contenedor; si hay factura viva, no se pueden cambiar las cajas |
| `/invoice-series`, `/payment-term-templates`, `/export-settings`, `/customer-billing-profiles` (CRUD + PATCH deactivate/reactivate) | config_facturacion | Una serie con facturas aprobadas no cambia de código. `last_number` es solo la ayuda para sugerir; Contabilidad lo ajusta |
| `/export-bank-accounts` (CRUD + PATCH) | cuentas_bancarias | El número completo nunca vuelve en el JSON |

**Cambios en el Cierre de embarque** (`ShipmentClosingController::update`):
- Si un booking tiene una factura **viva** (BORRADOR, REVISADA o APROBADA), no se pueden cambiar cliente, marca, negociación, incoterm, presentación, cajas embarcadas ni pesos, ni quitar el booking. Mensaje: `EL BOOKING UNIEC… ESTÁ EN LA FACTURA 001-003-… (APROBADA): PIDE A CONTABILIDAD QUE LA ANULE PRIMERO.` En BORRADOR, el mensaje pide anular el borrador.
- Antes de borrar un booking se borran sus contenedores uno por uno, para que queden en la bitácora.

Mensajes de validación (ejemplos, en MAYÚSCULAS):
- `EL BOOKING UNIEC… YA TIENE LA FACTURA 001-003-… (BORRADOR): EDÍTALA O ANÚLALA.`
- `EL N° DE FACTURA DEBE TENER EL FORMATO 000-000-000000000.`
- `EL N° 001-003-… YA ESTÁ EN OTRA FACTURA NO ANULADA: ESCRIBE OTRO.`
- `LA SERIE 001-009 NO EXISTE O ESTÁ INACTIVA: REVÍSALA CON CONTABILIDAD.`
- `ESCRIBE EL N° DE FACTURA ANTES DE ENVIARLA A REVISIÓN.`
- `EL PRECIO CFR SE CALCULÓ COMO FOB + FLETE: CONFÍRMALO ANTES DE MARCARLA REVISADA.`
- `EL BOOKING UNIEC… NO TIENE INCOTERM: LLÉNALO EN EL CIERRE DE EMBARQUE.`
- `EL CLIENTE JSC GRAND TRADE NO TIENE FICHA DE FACTURACIÓN SPOT: PÍDELA A CONTABILIDAD.`
- `NO HAY PRECIO PARA PALMS BANANAS CONVENCIONAL CFR EN LA SEMANA 41: ESCRÍBELO O REVISA EL CONTRATO.`
- `LOS 4 CONTENEDORES SUMAN 4.799 CAJAS Y EL BOOKING DICE 4.800 EMBARCADAS: CORRIGE LA FICHA O EL CIERRE.`

**Datos bancarios:**
- Solo se copian a la factura al **aprobarla** (lo hace Contabilidad).
- Las pantallas de factura nunca los muestran en el JSON. Solo salen dentro del Excel o PDF de una factura APROBADA, que se genera en el servidor.
- Así se cumple que las cuentas las vean solo Contabilidad y ADMIN, aunque el documento lo descargue Exportaciones (CONFIRMADO 12/11/2026).

---

## 6. Impacto en datos existentes

| Qué | Cómo | Simulación |
|---|---|---|
| Borrar `invoices`, `invoice_lines` y `bills_of_lading` | Lo hace la migración 4.3, que se detiene si alguna tiene filas. En local tienen 0. Antes de subir, revisa el conteo en producción | La migración misma (falla sin borrar) |
| Incoterm y presentación de los bookings que ya existen | Script `cargar_incoterm_bookings` con `CARGA_BD` y `CARGA_SIMULAR=1`. Por cada booking toma las líneas del pedido del mismo cliente + negociación en ese barco (`shipment_lines` → `customer_order_lines`). Si hay un solo incoterm y una sola presentación, los llena. Si no, los deja en una lista para Exportaciones. Guarda modelo por modelo (bitácora) | Sí: primero simulación, luego respaldo, luego real |
| Series (001-003 y 001-007) con el **último número usado** | Contabilidad las crea en la pantalla nueva. El último número solo sirve para la sugerencia, porque el número lo escribe Exportaciones. Son pocos registros, no hace falta script | — |
| 3 plantillas de pago (RVI 70/30, JSC 50/50, JSC 50/50 con cláusula en rublos) | En pantalla, copiando el texto exacto de las facturas WK41 | — |
| Datos del exportador y firmante | Contabilidad o Peter en pantalla. **No van en semillas ni en código** (RUC y cédula) | — |
| Cuenta de cobro (Pichincha + intermediario) | Contabilidad, en Cuentas bancarias | — |
| Cliente **BLUESTAR TRADING FZCO** | ADMIN en Terceros (tipo CLIENTE). Luego la ficha SPOT de JSC con "facturar a" = BLUESTAR | — |
| N° legal de los contratos (GT/1104/26, RVI-N20-…) | ADMIN, en Contratos de clientes | — |
| Contenedores de semanas pasadas | **No se cargan.** La ficha empieza con la primera semana que se facture desde el SIAE. Si Peter lo pide, la fase 2 los importa desde los Excel de Logística (script con simulación) | Fase 2 |
| Facturas históricas WK41–46 | **No se cargan.** Solo hace falta que la serie arranque en el número correcto | — |

Nada de esto toca compras, tarjas ni liquidaciones.

### Reglas de negocio que este diseño toca

- **Flete por contenedor solo en CFR/CIF**: se respeta.
  - El flete por caja solo se usa en facturas CFR/CIF: como desglose, o como propuesta FOB + flete marcada para revisar cuando solo hay precio FOB (CONFIRMADO 12/11/2026).
  - La ganancia por viaje no cambia. Ya trata el precio CFR del pedido como venta y resta el flete como gasto.
  - Si una factura se aprueba con un precio FOB + flete, que no está en el pedido, la ganancia debería leer el precio de la factura aprobada. Es una mejora de la fase 2.
- **Contrato por marca × presentación; SPOT sin contrato**: se respeta.
  - El "contrato marco" del SPOT en la ficha de facturación es solo una **referencia legal impresa**. No crea precio ni cupo.
- **Semana de compra, liquidación y OC**: no se tocan.

---

## 7. Decisiones y preguntas abiertas

### 7.1 CONFIRMADAS por Peter (12/11/2026)

1. **Una factura por booking.** No se agrupan bookings. `export_invoices.shipment_booking_id` es único entre las facturas no anuladas, y el packing list es por booking o por su factura.
2. **Numeración.**
   - El N° lo **escribe Exportaciones** en el borrador. No se asigna solo al aprobar.
   - El SIAE **sugiere** el siguiente número de la serie del cliente: `invoice_series` queda solo como ayuda.
   - Se valida el formato `000-000-000000000` y que no se repita entre las facturas no anuladas (de la misma serie, porque el número la incluye).
   - Se **congela al aprobar**.
   - La factura electrónica del SRI la sigue emitiendo Contabilidad **fuera del SIAE**. El N° de autorización es un campo opcional.
3. **Precio CFR.**
   - Es el del contrato o pedido CFR; el flete por caja va solo como desglose.
   - Si solo hay precio FOB, se propone FOB + flete y la línea queda **marcada para revisar** (`FOB_FLETE` + `price_review_ok`).
4. **Flujo.**
   - Exportaciones elabora; Comercial o Gerencia revisa (quien elabora no revisa); Contabilidad aprueba y anula.
   - La aprobada no se edita.
   - Los datos bancarios solo se imprimen en la factura **APROBADA**, generada en el servidor.

### 7.2 POR CONFIRMAR (no bloquean: se programa con el valor por defecto)

2. **Cajas que se facturan.** Por defecto, las **embarcadas** (`shipped_boxes`), no el ingreso al puerto ni las tarjas. **POR CONFIRMAR.**
3. **Series.** Por defecto, una serie por cliente: 001-003 para JSC y BLUESTAR, 001-007 para RVI, tomada de la ficha de facturación del cliente para la sugerencia. **POR CONFIRMAR.**

   3b. **Número de una factura anulada.** Por defecto, al anularla su número deja de bloquear y se puede volver a usar. Si Contabilidad quiere que un número anulado nunca se reutilice, basta con quitar `WHERE status` del índice único. **POR CONFIRMAR.**
5. **Facturar a un tercero.** Por defecto, la **ficha de facturación del cliente × negociación** lleva un "facturar a": el SPOT de JSC se factura a BLUESTAR TRADING, y el consignee sigue siendo JSC Grand Trade. Hay que crear a BLUESTAR como cliente. **POR CONFIRMAR** si siempre es así o cambia por pedido.
6. **Redondeo de FOB + flete.** Por defecto, el precio propuesto se redondea a 2 decimales (como 18,67). **POR CONFIRMAR.**
8. **Semana de la factura.** Por defecto, la **semana del barco** (`shipments.week_start`), y la fecha de emisión la elige Exportaciones. Ejemplo de la duda: los archivos decían WK42 y las facturas WK41. **POR CONFIRMAR.**
10. **Marca PALM vs PALMS.** La factura dice PALM BANANAS y el SIAE dice PALMS BANANAS. Por defecto, la factura imprime `brand_print_name`, que se propone desde `brands.name` y se puede corregir en el borrador. Si siempre es "PALM", conviene un campo `brands.invoice_name` (fase 2). **Solo se señala; POR CONFIRMAR** cuál es el nombre correcto.
11. **Condiciones de pago.** Por defecto, son **plantillas** (texto en inglés, y en ruso después). La del **contrato** manda; si no hay contrato (SPOT), se usa la de la ficha del cliente. **POR CONFIRMAR.**
12. **N° legal del contrato ruso.** Por defecto, va en `customer_contracts.legal_number` y `legal_date` en CONTRATO, y en `contract_reference` de la ficha en SPOT. **POR CONFIRMAR.**
13. **Peso neto 19,4 o 19,6.** Por defecto, manda el **booking** (`net_weight_per_box`), que llena Logística en el Cierre. **POR CONFIRMAR** si depende de la marca o del cliente.
14. **Formato de salida.** Por defecto, en la **fase 1 sale Excel** con el mismo formato de hoy:
    - se llena una **plantilla .xlsx real** que entrega Exportaciones (con logo y formato), con PhpSpreadsheet;
    - las fórmulas de AMOUNT, pesos y SUBTOTAL quedan vivas;
    - la hoja PRICE LIST sale con la firma SALES DEPARTMENT.

    El **PDF** llega en la fase 2. Requiere agregar `phpoffice/phpspreadsheet` al backend y revisar que el servidor tenga `ext-zip` y `ext-gd`. **POR CONFIRMAR** el formato y la librería nueva.
15. **Packing list.** Por defecto:
    - uno por booking o por su factura (CONFIRMADO);
    - en Excel;
    - con columnas CONTAINER, SEALS (en su propia columna, ya no en TERMS), BOXES, BRAND, TERMS (incoterm), KG NET y KG GROSS;
    - el precio unitario **vacío**;
    - el número sin etiqueta del encabezado se imprime como **DAE** (con etiqueta);
    - los termógrafos **no** se imprimen (quedan en la ficha).

    **POR CONFIRMAR.**
16. **Sellos en bajo cubierta.** Por defecto, se tratan como **sellos de bodega** del booking (`hold_seals`, texto libre). **POR CONFIRMAR** qué eran los 9 números de RVI.
17. **Versión rusa.** Por defecto, va en la **fase 3**: `text_ru` en las plantillas y etiquetas en ruso en el Excel, con el botón ES/RU que ya existe. **POR CONFIRMAR** quién revisa el ruso.

---

## Plan por fases

| Fase | Qué entra | Para qué |
|---|---|---|
| **1. Lo mínimo útil** | Migraciones 4.1, 4.2 y 4.3. Configuración de facturación (series, plantillas, exportador, fichas por cliente) y cuentas de cobro. En el Cierre de embarque: incoterm, presentación, sellos de bodega y **ficha del contenedor**. Pantalla **Facturas de exportación**: borrador desde **un booking**, con el **N° escrito por Exportaciones** (con sugerencia y validación), revisar (con confirmación de las líneas FOB_FLETE), aprobar (congela) y anular. **Excel INVOICE + PRICE LIST** con plantilla real. **Packing list en Excel por booking** con totales calculados. Script del incoterm de los bookings que ya existen | Exportaciones deja de hacer la factura y el packing a mano |
| **2. Control y PDF** | PDF de la factura y del packing, generado en el servidor. `tally_sheets.booking_container_id` (productores por contenedor y cuadre ficha vs. tarja). Importar contenedores desde los Excel de Logística (opcional, con simulación). `brands.invoice_name`. La ganancia por viaje lee el precio de la factura aprobada | Cuadre fino y documentos firmables |
| **3. Extensiones** | Versión rusa (plantillas y etiquetas). "Marca BL" (instrucciones de B/L desde el booking). El booking nace en la Distribución en barcos. Enlace con el sistema contable o SRI cuando se retome Contífico | Cubrir lo que sigue a mano |

Las decisiones clave ya están confirmadas (§7.1). Las preguntas de §7.2 no bloquean. Antes de programar falta que Peter **apruebe el diseño completo**, que es un cambio grande.
