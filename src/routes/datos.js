const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/productos', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM productos ORDER BY rodado, medida, marca');
  res.json(rows);
});

router.get('/proveedores', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM proveedores ORDER BY nombre, cuenta');
  res.json(rows);
});

router.get('/pedidos', async (req, res) => {
  // Para cada pedido calcula cuánto se pagó hasta esa fecha (FIFO por proveedor)
  const { rows } = await db.query(`
    WITH pagos_acum AS (
      SELECT
        proveedor_id,
        pagador,
        fecha,
        SUM(monto) OVER (PARTITION BY proveedor_id, pagador ORDER BY fecha, id) AS pagado_acum
      FROM pagos_proveedor
    ),
    pedidos_acum AS (
      SELECT
        pp.*,
        SUM(pp.importe_tt) OVER (PARTITION BY pp.proveedor_id ORDER BY pp.ingreso, pp.id) AS facturado_tt_acum,
        SUM(pp.importe_lf) OVER (PARTITION BY pp.proveedor_id ORDER BY pp.ingreso, pp.id) AS facturado_lf_acum
      FROM pedidos_proveedor pp
    ),
    pagos_totales AS (
      SELECT
        proveedor_id,
        SUM(monto) FILTER (WHERE pagador = 'TT') AS total_pagado_tt,
        SUM(monto) FILTER (WHERE pagador = 'LF') AS total_pagado_lf
      FROM pagos_proveedor
      GROUP BY proveedor_id
    )
    SELECT
      pa.*,
      p.id AS proveedor_id,
      p.nombre AS proveedor,
      p.cuenta,
      GREATEST(0, pa.importe_tt - GREATEST(0, COALESCE(pt.total_pagado_tt,0) - (pa.facturado_tt_acum - pa.importe_tt))) AS saldo_tt,
      GREATEST(0, pa.importe_lf - GREATEST(0, COALESCE(pt.total_pagado_lf,0) - (pa.facturado_lf_acum - pa.importe_lf))) AS saldo_lf,
      CASE
        WHEN GREATEST(0, pa.importe_tt - GREATEST(0, COALESCE(pt.total_pagado_tt,0) - (pa.facturado_tt_acum - pa.importe_tt)))
           + GREATEST(0, pa.importe_lf - GREATEST(0, COALESCE(pt.total_pagado_lf,0) - (pa.facturado_lf_acum - pa.importe_lf))) = 0
        THEN 'PAGADO'
        ELSE 'PENDIENTE'
      END AS pago_estado
    FROM pedidos_acum pa
    JOIN proveedores p ON p.id = pa.proveedor_id
    LEFT JOIN pagos_totales pt ON pt.proveedor_id = pa.proveedor_id
    ORDER BY pa.ingreso DESC
  `);
  res.json(rows);
});

router.get('/saldos', async (req, res) => {
  const [provRes, pedRes, pagRes] = await Promise.all([
    db.query('SELECT id, nombre, cuenta FROM proveedores ORDER BY nombre, cuenta'),
    db.query('SELECT proveedor_id, SUM(importe_tt) AS total_tt, SUM(importe_lf) AS total_lf FROM pedidos_proveedor GROUP BY proveedor_id'),
    db.query('SELECT proveedor_id, SUM(CASE WHEN pagador=$1 THEN monto ELSE 0 END) AS pagado_tt, SUM(CASE WHEN pagador=$2 THEN monto ELSE 0 END) AS pagado_lf FROM pagos_proveedor GROUP BY proveedor_id', ['TT', 'LF']),
  ]);

  const pedMap = Object.fromEntries(pedRes.rows.map(r => [r.proveedor_id, r]));
  const pagMap = Object.fromEntries(pagRes.rows.map(r => [r.proveedor_id, r]));

  const resultado = provRes.rows.map(p => {
    const ped = pedMap[p.id] || {};
    const pag = pagMap[p.id] || {};
    const tt = Number(ped.total_tt || 0);
    const lf = Number(ped.total_lf || 0);
    const ptt = Number(pag.pagado_tt || 0);
    const plf = Number(pag.pagado_lf || 0);
    return {
      id: p.id, nombre: p.nombre, cuenta: p.cuenta,
      total_facturado_tt: tt, total_facturado_lf: lf,
      total_pagado_tt: ptt, total_pagado_lf: plf,
      saldo_tt: tt - ptt, saldo_lf: lf - plf,
    };
  });
  res.json(resultado);
});

router.get('/pagos', async (req, res) => {
  const { rows } = await db.query(`
    SELECT pg.*, p.nombre AS proveedor, p.cuenta
    FROM pagos_proveedor pg
    JOIN proveedores p ON p.id = pg.proveedor_id
    ORDER BY pg.fecha DESC
  `);
  res.json(rows);
});

router.get('/clientes', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM clientes ORDER BY nombre');
  res.json(rows);
});

router.get('/movimientos', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM movimientos ORDER BY fecha DESC LIMIT 100');
  res.json(rows);
});

router.get('/deudas', async (req, res) => {
  const { rows } = await db.query(`
    SELECT d.*, c.nombre AS cliente
    FROM deudas_clientes d
    JOIN clientes c ON c.id = d.cliente_id
    ORDER BY d.vencimiento ASC
  `);
  res.json(rows);
});

router.get('/stats', async (req, res) => {
  const [deudaRes, stockRes, deudasCliRes, movRes] = await Promise.all([
    db.query(`
      SELECT
        SUM(importe_tt) - COALESCE((SELECT SUM(monto) FROM pagos_proveedor WHERE pagador='TT'),0) AS deuda_tt,
        SUM(importe_lf) - COALESCE((SELECT SUM(monto) FROM pagos_proveedor WHERE pagador='LF'),0) AS deuda_lf
      FROM pedidos_proveedor
    `),
    db.query(`SELECT SUM(cantidad) AS unidades, SUM(cantidad * costo) AS valor FROM productos`),
    db.query(`SELECT COUNT(*) AS clientes_con_deuda, SUM(monto_pendiente) AS monto FROM deudas_clientes WHERE estado='PENDIENTE'`),
    db.query(`SELECT fecha, tipo, concepto, monto FROM movimientos ORDER BY fecha DESC LIMIT 5`),
  ]);

  res.json({
    deuda_tt: Number(deudaRes.rows[0].deuda_tt || 0),
    deuda_lf: Number(deudaRes.rows[0].deuda_lf || 0),
    stock_unidades: Number(stockRes.rows[0].unidades || 0),
    stock_valor: Number(stockRes.rows[0].valor || 0),
    clientes_con_deuda: Number(deudasCliRes.rows[0].clientes_con_deuda || 0),
    monto_deudas_clientes: Number(deudasCliRes.rows[0].monto || 0),
    ultimos_movimientos: movRes.rows,
  });
});

router.patch('/productos/:id', async (req, res) => {
  const { id } = req.params;
  const campos = ['cantidad', 'costo', 'precio_manual', 'precio_reventa_a', 'precio_reventa_b'];
  const updates = campos.filter(c => req.body[c] !== undefined);
  if (!updates.length) return res.status(400).json({ error: 'Nada para actualizar' });

  const sets = updates.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const vals = updates.map(c => req.body[c]);
  const { rows: [prod] } = await db.query(
    `UPDATE productos SET ${sets} WHERE id = $${updates.length + 1} RETURNING *`,
    [...vals, id]
  );
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ ok: true, producto: prod });
});

module.exports = router;
