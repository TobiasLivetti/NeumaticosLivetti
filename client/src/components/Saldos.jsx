import { useEffect, useState } from 'react'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Saldos() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    fetch('/api/saldos').then(r => r.json()).then(setDatos)
  }, [])

  if (!datos) return <p className="empty">Cargando...</p>

  const totalTT = datos.reduce((s, d) => s + Number(d.saldo_tt), 0)
  const totalLF = datos.reduce((s, d) => s + Number(d.saldo_lf), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saldos con proveedores</h1>
        <p className="text-sm text-gray-400 mt-0.5">Para registrar un pago, ir a Pedidos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Deuda TT" monto={totalTT} color="text-orange-600" />
        <KpiCard label="Deuda LF" monto={totalLF} color="text-orange-600" />
        <KpiCard label="Deuda total" monto={totalTT + totalLF} dark />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Cuenta</th>
              <th>Facturado TT</th>
              <th>Pagado TT</th>
              <th>Saldo TT</th>
              <th>Facturado LF</th>
              <th>Pagado LF</th>
              <th>Saldo LF</th>
            </tr>
          </thead>
          <tbody>
            {datos.map(d => {
              const sTT = Number(d.saldo_tt)
              const sLF = Number(d.saldo_lf)
              return (
                <tr key={d.id}>
                  <td className="font-semibold">{d.nombre}</td>
                  <td className="text-gray-400">{d.cuenta || '—'}</td>
                  <td>{fmt(d.total_facturado_tt)}</td>
                  <td>{fmt(d.total_pagado_tt)}</td>
                  <td className={`font-bold ${sTT > 0 ? 'text-orange-600' : 'text-green-700'}`}>{fmt(sTT)}</td>
                  <td>{fmt(d.total_facturado_lf)}</td>
                  <td>{fmt(d.total_pagado_lf)}</td>
                  <td className={`font-bold ${sLF > 0 ? 'text-orange-600' : 'text-green-700'}`}>{fmt(sLF)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, monto, dark, color }) {
  return (
    <div className={`rounded-xl p-5 ${dark ? 'bg-[#1a1a2e] text-white' : 'bg-white border border-gray-200'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/50' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-2xl font-bold ${dark ? 'text-white' : (color || 'text-gray-900')}`}>{fmt(monto)}</p>
    </div>
  )
}
