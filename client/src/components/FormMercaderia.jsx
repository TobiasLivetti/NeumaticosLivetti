import { useEffect, useState } from 'react'
import { Plus, X, Package } from 'lucide-react'

const hoy = () => new Date().toISOString().split('T')[0]
const fmt = n => n ? `$${Number(n).toLocaleString('es-AR')}` : ''
const filaProd = () => ({ medida: '', marca: '', cantidad: '', costo_unitario: '' })

export default function FormMercaderia({ onSuccess, compact }) {
  const [proveedores, setProveedores] = useState([])
  const [form, setForm] = useState({
    proveedor_id: '',
    factura: '',
    fecha: hoy(),
    fecha_pagar: '',
    importe_tt: '',
    importe_lf: '',
    observaciones: '',
  })
  const [productos, setProductos] = useState([filaProd()])
  const [yaPagado, setYaPagado] = useState(false)
  const [pago, setPago] = useState({ monto_tt: '', monto_lf: '', fecha: hoy(), metodo: 'TRANSFERENCIA' })
  const [estado, setEstado] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/proveedores').then(r => r.json()).then(setProveedores)
  }, [])

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setP(k, v) { setPago(p => ({ ...p, [k]: v })) }

  const provSeleccionado = () => proveedores.find(p => p.id === Number(form.proveedor_id))

  function setProd(i, k, v) {
    setProductos(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p))
  }

  const totalCalc = productos.reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.costo_unitario) || 0), 0)

  // Al activar "ya pagado", pre-rellenar con los importes de la factura
  function toggleYaPagado(checked) {
    setYaPagado(checked)
    if (checked) {
      const tt = form.importe_tt !== '' ? form.importe_tt : totalCalc > 0 ? String(Math.round(totalCalc)) : ''
      const lf = form.importe_lf !== '' ? form.importe_lf : ''
      setPago(p => ({ ...p, monto_tt: tt, monto_lf: lf }))
    }
  }

  async function submit(e) {
    e.preventDefault()
    const prov = provSeleccionado()
    if (!prov || !form.factura || !form.fecha) {
      setEstado('error'); setMsg('Completá proveedor, factura y fecha.'); return
    }
    const prodsValidos = productos.filter(p => p.medida && p.marca && Number(p.cantidad) > 0 && Number(p.costo_unitario) > 0)
    if (!prodsValidos.length) {
      setEstado('error'); setMsg('Agregá al menos un producto válido.'); return
    }
    if (yaPagado && (Number(pago.monto_tt) || 0) <= 0 && (Number(pago.monto_lf) || 0) <= 0) {
      setEstado('error'); setMsg('Ingresá al menos un monto de pago (TT o LF).'); return
    }

    setEstado('loading')
    try {
      const body = {
        proveedor: prov.nombre,
        cuenta: prov.cuenta || undefined,
        factura: form.factura,
        fecha: form.fecha,
        fecha_pagar: form.fecha_pagar || undefined,
        importe_tt: form.importe_tt !== '' ? Number(form.importe_tt) : undefined,
        importe_lf: form.importe_lf !== '' ? Number(form.importe_lf) : undefined,
        observaciones: form.observaciones || undefined,
        productos: prodsValidos.map(p => ({
          medida: p.medida, marca: p.marca,
          cantidad: Number(p.cantidad), costo_unitario: Number(p.costo_unitario),
        })),
        ...(yaPagado && {
          pago: {
            monto_tt: Number(pago.monto_tt) || 0,
            monto_lf: Number(pago.monto_lf) || 0,
            fecha: pago.fecha,
            metodo: pago.metodo,
          }
        }),
      }
      const r = await fetch('/api/mercaderia/ingresar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error del servidor')
      setEstado('ok')
      setMsg(`Factura ${data.factura} ingresada${data.pagos?.length ? ` + ${data.pagos.length} pago(s) registrado(s)` : ''}`)
      setTimeout(() => { setEstado(null); onSuccess?.() }, 1800)
    } catch (err) {
      setEstado('error'); setMsg(err.message)
    }
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ingresar mercadería</h1>
            <p className="text-sm text-gray-400">Nueva factura de compra a proveedor</p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Datos de la factura */}
        <div className="card space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Datos de la factura</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Proveedor</label>
              <select className="input" value={form.proveedor_id} onChange={e => setF('proveedor_id', e.target.value)}>
                <option value="">Seleccioná…</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.cuenta ? ` (${p.cuenta})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">N° Factura</label>
              <input className="input" placeholder="F08" value={form.factura} onChange={e => setF('factura', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha ingreso</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setF('fecha', e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha a pagar</label>
              <input type="date" className="input" value={form.fecha_pagar} onChange={e => setF('fecha_pagar', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Importe <span className="text-purple-600 font-bold">TT</span> <span className="normal-case font-normal text-gray-400">(vacío = total)</span></label>
              <input type="number" className="input" placeholder={fmt(totalCalc) || '0'}
                value={form.importe_tt} onChange={e => setF('importe_tt', e.target.value)} min="0" />
            </div>
            <div>
              <label className="label">Importe <span className="text-indigo-600 font-bold">LF</span></label>
              <input type="number" className="input" placeholder="0"
                value={form.importe_lf} onChange={e => setF('importe_lf', e.target.value)} min="0" />
            </div>
          </div>

          <div>
            <label className="label">Observaciones <span className="normal-case font-normal text-gray-400">(opcional)</span></label>
            <textarea className="input resize-none" rows={2} value={form.observaciones}
              onChange={e => setF('observaciones', e.target.value)} />
          </div>
        </div>

        {/* Productos */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Productos</h2>
            {totalCalc > 0 && <span className="text-sm font-semibold text-gray-700">Total: {fmt(totalCalc)}</span>}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 px-0.5">
              <p className="label col-span-4">Medida</p>
              <p className="label col-span-3">Marca</p>
              <p className="label col-span-2">Cant.</p>
              <p className="label col-span-2">Costo u.</p>
              <div className="col-span-1" />
            </div>
            {productos.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input className="input col-span-4" placeholder="205/55 R16" value={p.medida}
                  onChange={e => setProd(i, 'medida', e.target.value)} />
                <input className="input col-span-3" placeholder="HIFLY" value={p.marca}
                  onChange={e => setProd(i, 'marca', e.target.value)} />
                <input type="number" className="input col-span-2" placeholder="4" value={p.cantidad}
                  onChange={e => setProd(i, 'cantidad', e.target.value)} min="1" />
                <input type="number" className="input col-span-2" placeholder="37500" value={p.costo_unitario}
                  onChange={e => setProd(i, 'costo_unitario', e.target.value)} min="0" />
                <button type="button" onClick={() => setProductos(ps => ps.filter((_, idx) => idx !== i))}
                  disabled={productos.length === 1}
                  className="col-span-1 flex justify-center text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setProductos(ps => [...ps, filaProd()])}
            className="btn-ghost text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Agregar producto
          </button>
        </div>

        {/* Ya pagado */}
        <div className="card space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={yaPagado}
              onChange={e => toggleYaPagado(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#1a1a2e]"
            />
            <span className="text-sm font-semibold text-gray-700">Ya está pagado</span>
          </label>

          {yaPagado && (
            <div className="space-y-3 pl-7">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pago <span className="text-purple-600 font-bold">TT</span></label>
                  <input type="number" className="input" placeholder="0"
                    value={pago.monto_tt} onChange={e => setP('monto_tt', e.target.value)} min="0" />
                </div>
                <div>
                  <label className="label">Pago <span className="text-indigo-600 font-bold">LF</span></label>
                  <input type="number" className="input" placeholder="0"
                    value={pago.monto_lf} onChange={e => setP('monto_lf', e.target.value)} min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha del pago</label>
                  <input type="date" className="input" value={pago.fecha}
                    onChange={e => setP('fecha', e.target.value)} />
                </div>
                <div>
                  <label className="label">Método</label>
                  <select className="input" value={pago.metodo} onChange={e => setP('metodo', e.target.value)}>
                    <option>TRANSFERENCIA</option>
                    <option>EFECTIVO</option>
                    <option>RESERVA</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {estado === 'error' && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{msg}</div>}
        {estado === 'ok'    && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{msg}</div>}

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={estado === 'loading'}>
          <Package className="w-4 h-4" />
          {estado === 'loading' ? 'Guardando…' : 'Ingresar factura'}
        </button>
      </form>
    </div>
  )
}
