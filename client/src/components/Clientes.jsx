import { useEffect, useState } from 'react'

const fmt = n => n != null ? `$${Number(n).toLocaleString('es-AR')}` : '—'
const fmtFecha = s => s ? new Date(s).toLocaleDateString('es-AR') : '—'

export default function Clientes() {
  const [clientes, setClientes] = useState(null)
  const [deudas, setDeudas] = useState(null)
  const [tab, setTab] = useState('clientes')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
    fetch('/api/deudas').then(r => r.json()).then(setDeudas)
  }, [])

  const filtrarClientes = (lista) =>
    !busqueda ? lista : lista.filter(c =>
      (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.zona || '').toLowerCase().includes(busqueda.toLowerCase())
    )

  const filtrarDeudas = (lista) =>
    !busqueda ? lista : lista.filter(d =>
      (d.cliente || '').toLowerCase().includes(busqueda.toLowerCase())
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => { setTab('clientes'); setBusqueda('') }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'clientes' ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            Clientes
          </button>
          <button
            onClick={() => { setTab('deudas'); setBusqueda('') }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'deudas' ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            Deudas
          </button>
        </div>
        <input
          className="input w-full sm:w-48 ml-auto"
          placeholder="Buscar…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {tab === 'clientes' && (
        clientes
          ? <TablaClientes filas={filtrarClientes(clientes)} />
          : <p className="empty">Cargando...</p>
      )}

      {tab === 'deudas' && (
        deudas
          ? <TablaDeudas filas={filtrarDeudas(deudas)} />
          : <p className="empty">Cargando...</p>
      )}
    </div>
  )
}

function TablaClientes({ filas }) {
  if (!filas.length) return <p className="empty">Sin clientes</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Teléfono</th>
            <th>Zona</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(c => (
            <tr key={c.id}>
              <td className="font-medium">{c.nombre}</td>
              <td>
                {c.tipo
                  ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.tipo}</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="text-gray-500">{c.telefono || '—'}</td>
              <td className="text-gray-500">{c.zona || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaDeudas({ filas }) {
  if (!filas.length) return <p className="empty">Sin deudas</p>
  const total = filas.filter(d => d.estado === 'PENDIENTE').reduce((s, d) => s + Number(d.monto_pendiente || 0), 0)
  return (
    <div className="space-y-3">
      {total > 0 && (
        <div className="card flex items-center gap-3 py-3">
          <span className="text-sm text-gray-500">Total pendiente:</span>
          <span className="text-xl font-bold text-orange-600">{fmt(total)}</span>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Pendiente</th>
              <th>Original</th>
              <th>Vencimiento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.cliente}</td>
                <td className={`font-bold ${d.estado === 'PENDIENTE' ? 'text-orange-600' : 'text-green-700'}`}>
                  {fmt(d.monto_pendiente)}
                </td>
                <td className="text-gray-400">{fmt(d.monto_original)}</td>
                <td className="text-gray-500 text-sm">{fmtFecha(d.vencimiento)}</td>
                <td><span className={`tag-${d.estado}`}>{d.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
