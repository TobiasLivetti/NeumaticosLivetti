const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/mercaderia/ingresar
router.post('/ingresar', async (req, res) => {
  const { proveedor, cuenta, factura, fecha, fecha_pagar, importe_tt, importe_lf, observaciones, productos, pago } = req.body;

  if (!proveedor || !factura || !fecha || !productos?.length) {
    return res.status(400).json({ error: 'Faltan campos: proveedor, factura, fecha, productos' });
  }

  const { rows: [prov] } = await db.query(
    `SELECT id FROM proveedores WHERE nombre = $1 AND ($2::text IS NULL AND cuenta IS NULL OR cuenta = $2)`,
    [proveedor.toUpperCase(), cuenta || null]
  );
  if (!prov) return res.status(400).json({ error: `Proveedor no encontrado: ${proveedor}` });

  const totalImporte = productos.reduce((s, p) => s + p.cantidad * p.costo_unitario, 0);
  const tt = importe_tt != null ? Number(importe_tt) : totalImporte;
  const lf = importe_lf != null ? Number(importe_lf) : 0;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [pedido] } = await client.query(
      `INSERT INTO pedidos_proveedor (proveedor_id, numero_factura, ingreso, fecha_pagar, importe_tt, importe_lf, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [prov.id, factura, fecha, fecha_pagar || null, tt, lf, observaciones || null]
    );

    for (const p of productos) {
      const medida = p.medida.trim();
      const marca = p.marca.trim();
      const { rows: [prod] } = await client.query(
        `INSERT INTO productos (medida, marca, cantidad, costo)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (medida, marca) DO UPDATE SET
           cantidad = productos.cantidad + EXCLUDED.cantidad,
           costo    = EXCLUDED.costo
         RETURNING id`,
        [medida, marca, p.cantidad, p.costo_unitario]
      );
      await client.query(
        `INSERT INTO factura_items (pedido_id, producto_id, cantidad, costo_unitario) VALUES ($1, $2, $3, $4)`,
        [pedido.id, prod.id, p.cantidad, p.costo_unitario]
      );
    }

    // Pago opcional (factura ya pagada)
    const pagosCreados = [];
    if (pago) {
      const pagoTT = Number(pago.monto_tt) || 0;
      const pagoLF = Number(pago.monto_lf) || 0;
      const fechaPago = pago.fecha || fecha;
      const metodoPago = pago.metodo || 'TRANSFERENCIA';
      if (pagoTT > 0) {
        const { rows: [p] } = await client.query(
          `INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador) VALUES ($1,$2,$3,$4,'TT') RETURNING *`,
          [prov.id, fechaPago, pagoTT, metodoPago]
        );
        pagosCreados.push(p);
      }
      if (pagoLF > 0) {
        const { rows: [p] } = await client.query(
          `INSERT INTO pagos_proveedor (proveedor_id, fecha, monto, metodo, pagador) VALUES ($1,$2,$3,$4,'LF') RETURNING *`,
          [prov.id, fechaPago, pagoLF, metodoPago]
        );
        pagosCreados.push(p);
      }
    }

    await client.query('COMMIT');
    res.json({
      ok: true,
      pedido_id: pedido.id,
      proveedor,
      factura,
      total_unidades: productos.reduce((s, p) => s + p.cantidad, 0),
      importe_tt: tt,
      importe_lf: lf,
      pagos: pagosCreados,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
