import { useEffect, useState } from 'react'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
const fmtFecha = s => s ? new Date(s).toLocaleDateString('es-AR') : '—'

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function Dashboard({ onNav }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats)
  }, [])

  if (!stats) return <p className="empty">Cargando dashboard...</p>

  const deudaTotal = stats.deuda_tt + stats.deuda_lf

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Resumen general del negocio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Deuda TT" value={fmt(stats.deuda_tt)} color="text-orange-600" />
        <KpiCard label="Deuda LF" value={fmt(stats.deuda_lf)} color="text-orange-600" />
        <KpiCard label="Deuda Total" value={fmt(deudaTotal)} color="text-red-700" />
        <KpiCard label="Stock" value={`${stats.stock_unidades} u`} sub={fmt(stats.stock_valor)} />
        <KpiCard label="Clientes c/deuda" value={stats.clientes_con_deuda} sub={fmt(stats.monto_deudas_clientes)} />
        <KpiCard label="Valor stock" value={fmt(stats.stock_valor)} color="text-green-700" />
      </div>

      {/* Acciones rápidas */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => onNav('pago-new')}>+ Registrar pago</button>
          <button className="btn-primary" onClick={() => onNav('mercaderia')}>+ Ingresar mercadería</button>
          <button className="btn-secondary" onClick={() => onNav('saldos')}>Ver saldos</button>
          <button className="btn-secondary" onClick={() => onNav('pedidos')}>Ver pedidos</button>
          <button className="btn-secondary" onClick={() => onNav('stock')}>Ver stock</button>
        </div>
      </div>

      {/* Últimos movimientos */}
      {stats.ultimos_movimientos?.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Últimos movimientos</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {stats.ultimos_movimientos.map((m, i) => (
                  <tr key={i}>
                    <td className="text-gray-500">{fmtFecha(m.fecha)}</td>
                    <td><span className={`tag-${m.tipo}`}>{m.tipo}</span></td>
                    <td>{m.concepto || '—'}</td>
                    <td className="font-semibold">{fmt(m.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
