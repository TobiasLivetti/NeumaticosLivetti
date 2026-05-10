require('dotenv').config();
const { leerRango } = require('../src/sheets');
const db = require('../src/db');

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseMonto(str) {
  if (str === null || str === undefined || str === '') return null;
  const n = Number(String(str).replace(/[$,]/g, '').replace('#REF!', '').trim());
  return isNaN(n) ? null : n;
}

function parseFecha(str, añoBase) {
  if (!str || typeof str !== 'string') return null;
  // Formatos: "21/12", "22-12", "7/5/2026", "19/12"
  const conAño = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (conAño) return `${conAño[3]}-${conAño[2].padStart(2,'0')}-${conAño[1].padStart(2,'0')}`;
  const sinAño = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (sinAño) {
    const d = sinAño[1].padStart(2,'0');
    const m = sinAño[2].padStart(2,'0');
    return `${añoBase}-${m}-${d}`;
  }
  return null;
}

function normalizarCuenta(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes('TRANSF') || v.includes('KARI') || v.includes('TRANSFER')) return 'TRANSFERENCIA';
  if (v.includes('RESERVA')) return 'RESERVA';
  return 'EFECTIVO';
}

function splitMedidaMarca(texto) {
  const m = texto.match(/^(\d[\d\/\s]*R\d+(?:\.\d+)?)\s+(.+)$/i);
  if (m) return { medida: m[1].trim(), marca: m[2].trim() };
  return { medida: texto.trim(), marca: '' };
}

function inferirAño(filas, colFecha) {
  // Detecta saltos de mes para asignar año correcto a cada fila
  const result = [];
  let año = 2024;
  let mesAnterior = null;

  for (const fila of filas) {
    const fechaStr = fila[colFecha];
    if (!fechaStr || typeof fechaStr !== 'string') {
      result.push({ fila, año });
      continue;
    }
    const m = fechaStr.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{4})?$/);
    if (!m) { result.push({ fila, año }); continue; }
    const mes = parseInt(m[2]);
    if (mesAnterior !== null && mes < mesAnterior && mesAnterior >= 11) año++;
    mesAnterior = mes;
    result.push({ fila, año });
  }
  return result;
}

// ── 1. STOCK → productos ────────────────────────────────────────────────────

async function migrarProductos() {
  console.log('\n[1/5] Migrando STOCK → productos...');
  const filas = await leerRango(process.env.SHEET_ID_PRINCIPAL, '◉ STOCK!A:U');
  // Datos desde fila 5 (índice 4)
  const datos = filas.slice(4).filter(f => f && f[2] && f[3]); // necesita MEDIDA y MARCA

  let ok = 0, skip = 0;
  for (const f of datos) {
    const medida = (f[2] || '').trim();
    const marca  = (f[3] || '').trim();
    if (!medida || !marca) { skip++; continue; }

    const rodado = parseInt(f[1]) || null;
    await db.query(`
      INSERT INTO productos
        (medida, marca, rodado, tipo, rotacion, estado, cantidad, costo,
         precio_manual, precio_minorista_x2, precio_minorista_x4, precio_minorista_6c,
         precio_reventa_a, precio_reventa_b)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (medida, marca) DO UPDATE SET
        cantidad = EXCLUDED.cantidad, costo = EXCLUDED.costo,
        rodado = EXCLUDED.rodado, tipo = EXCLUDED.tipo,
        rotacion = EXCLUDED.rotacion, estado = EXCLUDED.estado
    `, [
      medida, marca, rodado,
      f[19] || null,  // TIPO
      f[18] || null,  // ROTACION
      f[6]  || null,  // ESTADO
      parseMonto(f[4]) || 0,  // CANT
      parseMonto(f[5]) || 0,  // COSTO
      parseMonto(f[7]),   // PRECIO MANUAL
      parseMonto(f[9]),   // X2 (minorista)
      parseMonto(f[10]),  // X4
      parseMonto(f[11]),  // 6 cuotas
      parseMonto(f[14]),  // LISTA 1 = Reventa A
      parseMonto(f[16]),  // LISTA 2 = Reventa B
    ]);
    ok++;
  }
  console.log(`   ✓ ${ok} productos insertados, ${skip} saltados`);
}

// ── 2. PROVEEDOR CC → pedidos + pagos ──────────────────────────────────────

async function migrarCC(nombreSheet, ccTab, formatoSplit, proveedorNombre, proveedorCuenta) {
  const filas = await leerRango(process.env.SHEET_ID_PROVEEDOR, `${ccTab}!A:R`);

  // Obtener proveedor_id
  const { rows: [prov] } = await db.query(
    'SELECT id FROM proveedores WHERE nombre=$1 AND ($2::text IS NULL AND cuenta IS NULL OR cuenta=$2)',
    [proveedorNombre, proveedorCuenta || null]
  );
  if (!prov) { console.log(`   ⚠ Proveedor no encontrado: ${proveedorNombre} ${proveedorCuenta}`); return 0; }

  // Filas de datos (saltamos las primeras 3 que son encabezados)
  const datosRaw = filas.slice(3).filter(f => f && f.length > 0 && f[0]);
  const datos = inferirAño(datosRaw, 0);

  let pedidos = 0, pagos = 0;

  for (const { fila: f, año } of datos) {
    const tipo = (f[2] || '').toUpperCase();
    if (!tipo || tipo === 'TIPO') continue;
    if (f[0] === 'INICIO EN EXCEL' || String(f[4]).includes('#REF')) continue;

    const ingreso   = parseFecha(f[0], año);
    const fechaPagar = parseFecha(f[8] || f[4], año); // col PAGAR o fallback

    if (tipo === 'FACTURA') {
      let importeTT, importeLF;
      if (formatoSplit) {
        importeTT = parseMonto(f[9])  || 0;  // PARTE TT
        importeLF = parseMonto(f[13]) || 0;  // PARTE LF
      } else {
        importeTT = parseMonto(f[4]) || 0;
        importeLF = 0;
      }
      const estado = (f[formatoSplit ? 16 : 7] || 'ABIERTO').toUpperCase();
      await db.query(`
        INSERT INTO pedidos_proveedor
          (proveedor_id, numero_factura, ingreso, fecha_pagar, importe_tt, importe_lf, estado, observaciones)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT DO NOTHING
      `, [prov.id, f[1] || null, ingreso, parseFecha(f[8], año), importeTT, importeLF,
          ['ABIERTO','CERRADO'].includes(estado) ? estado : 'ABIERTO',
          f[formatoSplit ? 17 : 9] || null]);
      pedidos++;
    } else if (tipo === 'PAGO') {
      const monto = parseMonto(formatoSplit ? f[4] : f[4]);
      if (!monto || monto <= 0) continue;
      const metodo  = (f[3] || '').toUpperCase() || 'EFECTIVO';
      await db.query(`
        INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador, observaciones)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [prov.id, ingreso, Math.abs(monto), metodo, 'TT', f[formatoSplit ? 17 : 9] || null]);
      pagos++;
    }
  }
  console.log(`   ✓ ${nombreSheet}: ${pedidos} pedidos, ${pagos} pagos`);
  return pedidos;
}

async function migrarTodosCC() {
  console.log('\n[2/5] Migrando CC proveedores → pedidos_proveedor + pagos_proveedor...');
  await migrarCC('NEUMASUR',        '➤  NEUMASUR',       false, 'NEUMASUR',  null);
  await migrarCC('CALZETTA',        '➤  CALZETTA.',       true,  'CALZETTA',  null);
  await migrarCC('SARACHO mat',     '➤  SARACHO mat',     true,  'SARACHO',   'mat');
  await migrarCC('SARACHO escobar', '➤  SARACHO escobar', true,  'SARACHO',   'escobar');
  await migrarCC('MIX',             '➤  MIX',             true,  'MIX',       null);
}

// ── 3. DET → factura_items ───────────────────────────────────────────────────

async function migrarDET(detTab, proveedorNombre, proveedorCuenta) {
  const filas = await leerRango(process.env.SHEET_ID_PROVEEDOR, `${detTab}!A:F`);
  let items = 0, noProducto = 0;

  let facturaActual = null;
  for (const f of filas) {
    if (!f || f.length === 0) { facturaActual = null; continue; }

    // Fila de encabezado de bloque
    if (f[0] === 'CARGADAS') continue;

    // Fila de resumen del pedido: col0=proveedor, col1=cant, col2=total, col3=factura
    if (f[0] && f[3] && String(f[3]).match(/^[A-Z0-9]+/i) && !f[0].match(/\d+\/\d+/)) {
      const numFact = String(f[3]).trim();
      const { rows } = await db.query(
        `SELECT pp.id FROM pedidos_proveedor pp
         JOIN proveedores p ON p.id = pp.proveedor_id
         WHERE p.nombre=$1 AND ($2::text IS NULL AND p.cuenta IS NULL OR p.cuenta=$2)
           AND pp.numero_factura=$3 LIMIT 1`,
        [proveedorNombre, proveedorCuenta || null, numFact]
      );
      facturaActual = rows[0]?.id || null;
      continue;
    }

    // Fila de producto: col0=medida+marca, col1=cantidad, col2=precio
    if (facturaActual && f[0] && f[1] && f[0].match(/\d+\/\d+/)) {
      const { medida, marca } = splitMedidaMarca(f[0]);
      const cant = parseInt(f[1]) || 0;
      const costo = parseMonto(f[2]);
      if (!cant || !costo) continue;

      const { rows: [prod] } = await db.query(
        `SELECT id FROM productos WHERE medida ILIKE $1 AND marca ILIKE $2 LIMIT 1`,
        [medida, marca]
      );
      if (!prod) { noProducto++; continue; }

      await db.query(
        `INSERT INTO factura_items (pedido_id, producto_id, cantidad, costo_unitario) VALUES ($1,$2,$3,$4)`,
        [facturaActual, prod.id, cant, costo]
      );
      items++;
    }
  }
  console.log(`   ✓ ${detTab}: ${items} items insertados, ${noProducto} sin producto encontrado`);
}

async function migrarTodosDET() {
  console.log('\n[3/5] Migrando DET → factura_items...');
  await migrarDET('NEUMASUR DET',  'NEUMASUR',  null);
  await migrarDET('CALZETTA DET',  'CALZETTA',  null);
  await migrarDET('SARACHO DET',   'SARACHO',   'mat');
  await migrarDET('MIX DET',       'MIX',       null);
}

// ── 4. MOVIMIENTOS ──────────────────────────────────────────────────────────

async function migrarMovimientos() {
  console.log('\n[4/5] Migrando MOVIMIENTOS...');
  const filas = await leerRango(process.env.SHEET_ID_PRINCIPAL, '◉ MOVIMIENTOS!A:G');
  const datosRaw = filas.slice(4).filter(f => f && f[0] && f[2]);
  const datos = inferirAño(datosRaw, 2024);

  let ok = 0, skip = 0;
  for (const { fila: f, año } of datos) {
    const fecha = parseFecha(f[0], año);
    const tipo  = (f[2] || '').toUpperCase();
    if (!fecha || !['INGRESO', 'EGRESO'].includes(tipo)) { skip++; continue; }

    const monto = Math.abs(parseMonto(f[5]) || parseMonto(f[4]) || 0);
    if (!monto) { skip++; continue; }

    await db.query(`
      INSERT INTO movimientos (fecha, tipo, concepto, cuenta, monto, referencia_tipo)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [fecha, tipo, f[3] || null, normalizarCuenta(f[1]), monto, null]);
    ok++;
  }
  console.log(`   ✓ ${ok} movimientos insertados, ${skip} saltados`);
}

// ── 5. DEUDAS → clientes + deudas_clientes ──────────────────────────────────

async function migrarDeudas() {
  console.log('\n[5/5] Migrando DEUDAS → clientes + deudas_clientes...');
  const filas = await leerRango(process.env.SHEET_ID_PRINCIPAL, '◉ DEUDAS!A:F');
  const datos = filas.slice(6).filter(f => f && f[0] && f[1] && f[2]);

  let clientes = 0, deudas = 0;
  for (const f of datos) {
    const nombre = (f[0] || '').trim();
    const estado = (f[2] || '').includes('DEBEN') ? 'PENDIENTE' : 'COBRADO';
    const monto  = parseMonto(f[1]);
    if (!nombre || !monto || monto <= 0) continue;

    // Crear o traer cliente
    const { rows: [c] } = await db.query(
      `INSERT INTO clientes (nombre) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,
      [nombre]
    );
    const clienteId = c?.id || (await db.query('SELECT id FROM clientes WHERE nombre=$1', [nombre])).rows[0]?.id;
    if (!clienteId) continue;
    if (c) clientes++;

    const venc = parseFecha(f[3], 2026);
    await db.query(`
      INSERT INTO deudas_clientes (cliente_id, monto_original, monto_pendiente, fecha, vencimiento, estado)
      VALUES ($1,$2,$3,NOW()::date,$4,$5)
    `, [clienteId, monto, monto, venc, estado]);
    deudas++;
  }
  console.log(`   ✓ ${clientes} clientes, ${deudas} deudas insertadas`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Iniciando migración desde Google Sheets → PostgreSQL ===');
  try {
    await migrarProductos();
    await migrarTodosCC();
    await migrarTodosDET();
    await migrarMovimientos();
    await migrarDeudas();
    console.log('\n=== Migración completa ===');
  } catch (e) {
    console.error('\n❌ Error en migración:', e.message);
    console.error(e.stack);
  }
  process.exit(0);
}

main();
