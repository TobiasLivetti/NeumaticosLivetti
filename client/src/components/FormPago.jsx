import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'

const hoy = () => new Date().toISOString().split('T')[0]

export default function FormPago({ onSuccess, compact }) {
  const [proveedores, setProveedores] = useState([])
  const [form, setForm] = useState({
    proveedor_id: '',
    fecha: hoy(),
    monto_tt: '',
    monto_lf: '',
    metodo: 'TRANSFERENCIA',
    observaciones: '',
  })
  const [estado, setEstado] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/proveedores').then(r => r.json()).then(setProveedores)
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    const tt = Number(form.monto_tt) || 0
    const lf = Number(form.monto_lf) || 0
    if (!form.proveedor_id || !form.fecha) {
      setEstado('error'); setMsg('Seleccioná proveedor y fecha.'); return
    }
    if (tt <= 0 && lf <= 0) {
      setEstado('error'); setMsg('Ingresá al menos un monto (TT o LF).'); return
    }
    setEstado('loading')
    try {
      const r = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: form.proveedor_id,
          fecha: form.fecha,
          monto_tt: tt,
          monto_lf: lf,
          metodo: form.metodo,
          observaciones: form.observaciones || undefined,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error del servidor')
      setEstado('ok')
      setMsg(`${data.pagos.length} pago(s) registrado(s)`)
      setForm(f => ({ ...f, monto_tt: '', monto_lf: '', observaciones: '' }))
      setTimeout(() => { setEstado(null); onSuccess?.() }, 1500)
    } catch (err) {
      setEstado('error'); setMsg(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Registrar pago</h1>
            <p className="text-sm text-gray-400">Nuevo pago a proveedor</p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className={compact ? 'space-y-4' : 'card space-y-5'}>
        <div>
          <label className="label">Proveedor</label>
          <select className="input" value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)}>
            <option value="">Seleccioná un proveedor…</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}{p.cuenta ? ` (${p.cuenta})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div>
            <label className="label">Método</label>
            <select className="input" value={form.metodo} onChange={e => set('metodo', e.target.value)}>
              <option>TRANSFERENCIA</option>
              <option>EFECTIVO</option>
              <option>RESERVA</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Pago <span className="text-purple-600 font-bold">TT</span>
              <span className="normal-case font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input type="number" className="input" placeholder="0" value={form.monto_tt}
              onChange={e => set('monto_tt', e.target.value)} min="0" />
          </div>
          <div>
            <label className="label">
              Pago <span className="text-indigo-600 font-bold">LF</span>
              <span className="normal-case font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input type="number" className="input" placeholder="0" value={form.monto_lf}
              onChange={e => set('monto_lf', e.target.value)} min="0" />
          </div>
        </div>

        <div>
          <label className="label">Observaciones <span className="normal-case font-normal text-gray-400">(opcional)</span></label>
          <textarea className="input resize-none" rows={2} value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)} />
        </div>

        {estado === 'error' && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{msg}</div>}
        {estado === 'ok'    && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{msg}</div>}

        <button type="submit" className="btn-primary w-full" disabled={estado === 'loading'}>
          {estado === 'loading' ? 'Guardando…' : 'Registrar pago'}
        </button>
      </form>
    </div>
  )
}
