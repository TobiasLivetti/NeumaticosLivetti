require('dotenv').config();
const { leerRango } = require('../src/sheets');
const db = require('../src/db');

function parseMonto(str) {
  if (!str) return 0;
  const n = Number(String(str).replace(/[$,]/g, '').trim());
  return isNaN(n) ? 0 : n;
}

function parseFecha(str, año) {
  if (!str) return null;
  const conAño = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (conAño) return `${conAño[3]}-${conAño[2].padStart(2,'0')}-${conAño[1].padStart(2,'0')}`;
  const sinAño = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (sinAño) return `${año}-${sinAño[2].padStart(2,'0')}-${sinAño[1].padStart(2,'0')}`;
  return null;
}

function inferirAño(filas) {
  const result = [];
  let año = 2024, mesAnterior = null;
  for (const fila of filas) {
    const m = (fila[0] || '').match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
      const mes = parseInt(m[2]);
      if (mesAnterior !== null && mes < mesAnterior && mesAnterior >= 11) año++;
      mesAnterior = mes;
    }
    result.push({ fila, año });
  }
  return result;
}

async function recorregirSheet(ccTab, proveedorNombre, proveedorCuenta) {
  const { rows: [prov] } = await db.query(
    'SELECT id FROM proveedores WHERE nombre=$1 AND ($2::text IS NULL AND cuenta IS NULL OR cuenta=$2)',
    [proveedorNombre, proveedorCuenta || null]
  );
  if (!prov) return;

  // Borrar pagos anteriores de este proveedor
  await db.query('DELETE FROM pagos_proveedor WHERE proveedor_id=$1', [prov.id]);

  const filas = await leerRango(process.env.SHEET_ID_PROVEEDOR, `${ccTab}!A:R`);
  const datos = inferirAño(filas.slice(3).filter(f => f && f.length > 0 && f[0]));

  let insertados = 0;
  for (const { fila: f, año } of datos) {
    if ((f[2] || '').toUpperCase() !== 'PAGO') continue;
    if (f[0] === 'INICIO EN EXCEL') continue;

    const fecha  = parseFecha(f[0], año);
    const metodo = (f[3] || 'EFECTIVO').toUpperCase();
    const obs    = f[17] || null;

    const montoTT = Math.abs(parseMonto(f[8]));  // col I: REAL TT - (negativo)
    const montoLF = Math.abs(parseMonto(f[12])); // col M: REAL LF- (negativo)

    if (montoTT > 0) {
      await db.query(
        'INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador, observaciones) VALUES ($1,$2,$3,$4,$5,$6)',
        [prov.id, fecha, montoTT, metodo, 'TT', obs]
      );
      insertados++;
    }
    if (montoLF > 0) {
      await db.query(
        'INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador, observaciones) VALUES ($1,$2,$3,$4,$5,$6)',
        [prov.id, fecha, montoLF, metodo, 'LF', obs]
      );
      insertados++;
    }
  }
  console.log(`✓ ${proveedorNombre} ${proveedorCuenta || ''}: ${insertados} pagos (TT+LF)`);
}

async function main() {
  console.log('Recorrigiendo pagos TT/LF para CALZETTA, SARACHO, MIX...');
  await recorregirSheet('➤  CALZETTA.',       'CALZETTA', null);
  await recorregirSheet('➤  SARACHO mat',     'SARACHO',  'mat');
  await recorregirSheet('➤  SARACHO escobar', 'SARACHO',  'escobar');
  await recorregirSheet('➤  MIX',             'MIX',      null);

  const { rows } = await db.query(`
    SELECT p.nombre, p.cuenta, pg.pagador, COUNT(*) AS pagos, SUM(pg.monto) AS total
    FROM pagos_proveedor pg JOIN proveedores p ON p.id = pg.proveedor_id
    WHERE p.nombre != 'NEUMASUR'
    GROUP BY p.nombre, p.cuenta, pg.pagador ORDER BY p.nombre, p.cuenta, pg.pagador
  `);
  console.log('\nResumen:');
  rows.forEach(r => console.log(`  ${r.nombre} ${r.cuenta||''} [${r.pagador}]: ${r.pagos} pagos = $${Number(r.total).toLocaleString('es-AR')}`));
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
