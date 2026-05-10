const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', async (req, res) => {
  const { proveedor_id, fecha, monto_tt, monto_lf, metodo, observaciones } = req.body;

  const tt = Number(monto_tt) || 0;
  const lf = Number(monto_lf) || 0;

  if (!proveedor_id || !fecha) {
    return res.status(400).json({ error: 'Faltan campos: proveedor_id, fecha' });
  }
  if (tt <= 0 && lf <= 0) {
    return res.status(400).json({ error: 'Al menos uno de monto_tt o monto_lf debe ser mayor a 0' });
  }

  const metodoFinal = metodo || 'TRANSFERENCIA';
  const obs = observaciones || null;
  const pagos = [];

  if (tt > 0) {
    const { rows: [p] } = await db.query(
      `INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador, observaciones)
       VALUES ($1, $2, $3, $4, 'TT', $5) RETURNING *`,
      [proveedor_id, fecha, tt, metodoFinal, obs]
    );
    pagos.push(p);
  }

  if (lf > 0) {
    const { rows: [p] } = await db.query(
      `INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador, observaciones)
       VALUES ($1, $2, $3, $4, 'LF', $5) RETURNING *`,
      [proveedor_id, fecha, lf, metodoFinal, obs]
    );
    pagos.push(p);
  }

  res.json({ ok: true, pagos });
});

module.exports = router;
