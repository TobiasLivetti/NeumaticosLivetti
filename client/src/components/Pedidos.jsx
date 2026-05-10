import { useEffect, useState } from 'react'
import { ChevronRight, CreditCard, X } from 'lucide-react'

const fmt = n => (n === null || n === undefined) ? '—' : `$${Number(n).toLocaleString('es-AR')}`
const fmtFecha = str => str ? new Date(str).toLocaleDateString('es-AR') : '—'
const hoy = () => new Date().toISOString().split('T')[0]

export default function Pedidos() {
  const [datos, setDatos] = useState(null)
  const [filtroProv, setFiltroProv] = useState('TODOS')
  const [expandidos, setExpandidos] = useState({})
  const [pagandoId, setPagandoId] = useState(null)
  const [formPago, setFormPago] = useState({ fecha: hoy(), metodo: 'TRANSFERENCIA', monto_tt: '', monto_lf: '' })
  const [pagoEstado, setPagoEstado] = useState(null)
  const [pagoMsg, setPagoMsg] = useState('')

  function cargar() {
    fetch('/api/pedidos').then(r => r.json()).then(setDatos)
  }

  useEffect(() => { cargar() }, [])

  if (!datos) return <p className="empty">Cargando...</p>

  const proveedores = ['TODOS', ...new Set(datos.map(d => d.proveedor + (d.cuenta ? ` ${d.cuenta}` : '')))]

  const filtrados = filtroProv === 'TODOS'
    ? datos
    : datos.filter(d => (d.proveedor + (d.cuenta ? ` ${d.cuenta}` : '')) === filtroProv)

  const pendientes = filtrados.filter(d => d.pago_estado === 'PENDIENTE')
  const pagados    = filtrados.filter(d => d.pago_estado === 'PAGADO')

  const pagadosPorProv = pagados.reduce((acc, d) => {
    const key = d.proveedor + (d.cuenta ? ` ${d.cuenta}` : '')
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})
  const provsPagados = Object.keys(pagadosPorProv).sort()

  function abrirPago(pedido) {
    if (pagandoId === pedido.id) { setPagandoId(null); return }
    setPagandoId(pedido.id)
    setPagoEstado(null)
    setFormPago({
      fecha: hoy(),
      metodo: 'TRANSFERENCIA',
      monto_tt: Number(pedido.saldo_tt) > 0 ? String(Math.round(Number(pedido.saldo_tt))) : '',
      monto_lf: Number(pedido.saldo_lf) > 0 ? String(Math.round(Number(pedido.saldo_lf))) : '',
    })
  }

  async function registrarPago(pedido) {
    const tt = Number(formPago.monto_tt) || 0
    const lf = Number(formPago.monto_lf) || 0
    if (tt <= 0 && lf <= 0) {
      setPagoEstado('error'); setPagoMsg('Ingresá al menos un monto.'); return
    }
    if (tt > Number(pedido.saldo_tt) + 0.01 || lf > Number(pedido.saldo_lf) + 0.01) {
      setPagoEstado('error'); setPagoMsg('El monto no puede superar el saldo pendiente.'); return
    }
    setPagoEstado('loading')
    try {
      const r = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: pedido.proveedor_id,
          fecha: formPago.fecha,
          monto_tt: tt,
          monto_lf: lf,
          metodo: formPago.metodo,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error')
      setPagoEstado('ok')
      setPagoMsg('Pago registrado')
      setTimeout(() => {
        setPagandoId(null)
        setPagoEstado(null)
        cargar()
      }, 1000)
    } catch (err) {
      setPagoEstado('error'); setPagoMsg(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtrados.length}</span>
        <select className="input w-44 ml-auto" value={filtroProv} onChange={e => setFiltroProv(e.target.value)}>
          {proveedores.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-600 mb-3">
            Pendientes ({pendientes.length})
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Factura</th>
                  <th>Ingreso</th>
                  <th>A pagar</th>
                  <th>Saldo TT</th>
                  <th>Saldo LF</th>
                  <th>Obs.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(f => (
                  <>
                    <tr key={f.id} className={pagandoId === f.id ? 'bg-blue-50' : ''}>
                      <td className="font-medium">
                        {f.proveedor}
                        {f.cuenta && <span className="text-gray-400 text-xs ml-1">{f.cuenta}</span>}
                      </td>
                      <td className="text-gray-500 text-xs">{f.numero_factura || '—'}</td>
                      <td className="text-gray-500 text-xs">{fmtFecha(f.ingreso)}</td>
                      <td className="text-gray-500 text-xs">{fmtFecha(f.fecha_pagar)}</td>
                      <td className="font-semibold text-orange-600">{fmt(f.saldo_tt)}</td>
                      <td className="font-semibold text-orange-600">{fmt(f.saldo_lf)}</td>
                      <td className="text-gray-400 text-xs max-w-32 truncate">{f.observaciones || '—'}</td>
                      <td>
                        <button
                          onClick={() => abrirPago(f)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            pagandoId === f.id
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-[#1a1a2e] text-white hover:bg-[#2d2d4e]'
                          }`}
                        >
                          {pagandoId === f.id
                            ? <><X className="w-3 h-3" /> Cerrar</>
                            : <><CreditCard className="w-3 h-3" /> Pagar</>
                          }
                        </button>
                      </td>
                    </tr>
                    {pagandoId === f.id && (
                      <tr key={`pago-${f.id}`}>
                        <td colSpan={8} className="bg-blue-50 border-t border-blue-100 px-4 py-4">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div>
                              <label className="label">Fecha</label>
                              <input type="date" className="input w-36" value={formPago.fecha}
                                onChange={e => setFormPago(p => ({ ...p, fecha: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label">Método</label>
                              <select className="input w-36" value={formPago.metodo}
                                onChange={e => setFormPago(p => ({ ...p, metodo: e.target.value }))}>
                                <option>TRANSFERENCIA</option>
                                <option>EFECTIVO</option>
                                <option>RESERVA</option>
                              </select>
                            </div>
                            {Number(f.saldo_tt) > 0 && (
                              <div>
                                <label className="label">
                                  Pago <span className="text-purple-600 font-bold">TT</span>
                                  <span className="text-gray-400 font-normal normal-case ml-1">máx {fmt(f.saldo_tt)}</span>
                                </label>
                                <input type="number" className="input w-36" placeholder="0"
                                  value={formPago.monto_tt} min="0" max={Number(f.saldo_tt)}
                                  onChange={e => setFormPago(p => ({ ...p, monto_tt: e.target.value }))} />
                              </div>
                            )}
                            {Number(f.saldo_lf) > 0 && (
                              <div>
                                <label className="label">
                                  Pago <span className="text-indigo-600 font-bold">LF</span>
                                  <span className="text-gray-400 font-normal normal-case ml-1">máx {fmt(f.saldo_lf)}</span>
                                </label>
                                <input type="number" className="input w-36" placeholder="0"
                                  value={formPago.monto_lf} min="0" max={Number(f.saldo_lf)}
                                  onChange={e => setFormPago(p => ({ ...p, monto_lf: e.target.value }))} />
                              </div>
                            )}
                            <div className="flex gap-2 items-end pb-0.5">
                              <button
                                onClick={() => registrarPago(f)}
                                disabled={pagoEstado === 'loading'}
                                className="btn-primary flex items-center gap-1.5"
                              >
                                <CreditCard className="w-4 h-4" />
                                {pagoEstado === 'loading' ? 'Guardando…' : 'Registrar'}
                              </button>
                              <button onClick={() => setPagandoId(null)} className="btn-ghost">
                                Cancelar
                              </button>
                            </div>
                            {pagoEstado === 'error' && (
                              <p className="text-red-600 text-sm font-medium w-full">{pagoMsg}</p>
                            )}
                            {pagoEstado === 'ok' && (
                              <p className="text-green-600 text-sm font-medium w-full">{pagoMsg}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendientes.length === 0 && pagados.length === 0 && <p className="empty">Sin pedidos</p>}

      {/* Pagados — acordeón por proveedor */}
      {provsPagados.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-3">
            Pagados ({pagados.length})
          </p>
          <div className="space-y-2">
            {provsPagados.map(prov => {
              const filas = pagadosPorProv[prov]
              const total = filas.reduce((s, f) => s + Number(f.importe_tt || 0) + Number(f.importe_lf || 0), 0)
              const abierto = !!expandidos[prov]
              return (
                <div key={prov} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setExpandidos(e => ({ ...e, [prov]: !e[prov] }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                      <span className="font-semibold text-gray-800">{prov}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {filas.length} {filas.length === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-500">{fmt(total)}</span>
                  </button>
                  {abierto && (
                    <div className="border-t border-gray-100">
                      <TablaPagados filas={filas} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TablaPagados({ filas }) {
  return (
    <div className="table-wrap opacity-70">
      <table>
        <thead>
          <tr>
            <th>Factura</th>
            <th>Ingreso</th>
            <th>Importe TT</th>
            <th>Importe LF</th>
            <th>Obs.</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.id}>
              <td className="text-gray-500 text-xs">{f.numero_factura || '—'}</td>
              <td className="text-gray-500 text-xs">{f.ingreso ? new Date(f.ingreso).toLocaleDateString('es-AR') : '—'}</td>
              <td>{f.importe_tt > 0 ? `$${Number(f.importe_tt).toLocaleString('es-AR')}` : '—'}</td>
              <td>{f.importe_lf > 0 ? `$${Number(f.importe_lf).toLocaleString('es-AR')}` : '—'}</td>
              <td className="text-gray-400 text-xs">{f.observaciones || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
