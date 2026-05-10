import { useEffect, useState } from 'react'
import { LayoutGrid, List, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import SlideOver from './SlideOver'
import FormMercaderia from './FormMercaderia'

const fmt = n => n != null && n !== '' ? `$${Number(n).toLocaleString('es-AR')}` : '—'

const PRECIOS = [
  { key: 'precio_manual',       label: 'P. Manual' },
  { key: 'precio_reventa_a',    label: 'Reventa A' },
  { key: 'precio_reventa_b',    label: 'Reventa B' },
  { key: 'precio_minorista_x2', label: 'Minorista x2' },
  { key: 'precio_minorista_x4', label: 'Minorista x4' },
  { key: 'precio_minorista_6c', label: '6 cuotas' },
]

export default function Stock() {
  const [datos, setDatos] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [rodadoFiltro, setRodadoFiltro] = useState('TODOS')
  const [precioKey, setPrecioKey] = useState('precio_manual')
  const [modo, setModo] = useState('lista') // 'lista' | 'cards'
  const [editando, setEditando] = useState({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [pagina, setPagina] = useState(0)

  const POR_PAGINA = 20

  function cargar() {
    fetch('/api/productos').then(r => r.json()).then(setDatos)
  }

  useEffect(() => { cargar() }, [])

  if (!datos) return <p className="empty">Cargando productos...</p>

  const rodados = ['TODOS', ...new Set(datos.filter(d => d.rodado).map(d => String(d.rodado)))]

  const filtrados = datos.filter(d => {
    const matchBusq = !busqueda ||
      d.medida.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.marca.toLowerCase().includes(busqueda.toLowerCase())
    const matchRod = rodadoFiltro === 'TODOS' || String(d.rodado) === rodadoFiltro
    return matchBusq && matchRod
  })

  const totalUnidades = filtrados.reduce((s, d) => s + Number(d.cantidad || 0), 0)
  const totalValor    = filtrados.reduce((s, d) => s + Number(d.cantidad || 0) * Number(d.costo || 0), 0)
  const precioLabel   = PRECIOS.find(p => p.key === precioKey)?.label || 'Precio'

  const totalPags = Math.ceil(filtrados.length / POR_PAGINA)
  const paginaActual = Math.min(pagina, Math.max(0, totalPags - 1))
  const pagina_ = paginaActual
  const filtradosPagina = filtrados.slice(pagina_ * POR_PAGINA, (pagina_ + 1) * POR_PAGINA)

  function onFiltro(fn) { fn(); setPagina(0) }

  async function guardarCantidad(id) {
    const nueva = Number(editando[id])
    if (isNaN(nueva) || nueva < 0) { cancelar(id); return }
    await fetch(`/api/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: nueva }),
    })
    setDatos(ds => ds.map(d => d.id === id ? { ...d, cantidad: nueva } : d))
    cancelar(id)
  }

  function cancelar(id) {
    setEditando(e => { const n = { ...e }; delete n[id]; return n })
  }

  function CantidadEditable({ d }) {
    if (editando[d.id] !== undefined) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="input w-16 py-1 text-center"
            value={editando[d.id]}
            onChange={e => setEditando(ev => ({ ...ev, [d.id]: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') guardarCantidad(d.id)
              if (e.key === 'Escape') cancelar(d.id)
            }}
            autoFocus min="0"
          />
          <button onClick={() => guardarCantidad(d.id)} className="text-green-600 hover:text-green-800 px-1"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => cancelar(d.id)} className="text-gray-400 hover:text-gray-600 px-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      )
    }
    return (
      <button
        onClick={() => setEditando(e => ({ ...e, [d.id]: String(d.cantidad) }))}
        title="Click para editar"
        className={`font-semibold text-sm px-2 py-0.5 rounded hover:bg-gray-100 transition-colors ${Number(d.cantidad) === 0 ? 'text-red-500' : 'text-gray-900'}`}
      >
        {d.cantidad}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtrados.length} productos · {totalUnidades} u · {fmt(totalValor)}{totalPags > 1 ? ` · pág ${paginaActual + 1}/${totalPags}` : ''}
          </p>
        </div>
        <button className="btn-primary flex-shrink-0" onClick={() => setPanelOpen(true)}>
          + Ingresar
        </button>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input flex-1 min-w-36"
          placeholder="Buscar medida o marca…"
          value={busqueda}
          onChange={e => onFiltro(() => setBusqueda(e.target.value))}
        />
        <select className="input w-28" value={rodadoFiltro} onChange={e => onFiltro(() => setRodadoFiltro(e.target.value))}>
          {rodados.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="input w-36" value={precioKey} onChange={e => setPrecioKey(e.target.value)}>
          {PRECIOS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setModo('lista')}
            className={`px-3 py-2 text-sm transition-colors ${modo === 'lista' ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="Vista lista"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModo('cards')}
            className={`px-3 py-2 text-sm transition-colors ${modo === 'cards' ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="Vista cards"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Vista lista */}
      {modo === 'lista' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medida</th>
                <th>Marca</th>
                <th>R</th>
                <th>Tipo</th>
                <th>Cant.</th>
                <th>Costo</th>
                <th>{precioLabel}</th>
              </tr>
            </thead>
            <tbody>
              {filtradosPagina.map(d => (
                <tr key={d.id}>
                  <td className="font-medium">{d.medida}</td>
                  <td>{d.marca}</td>
                  <td className="text-gray-500 text-xs">{d.rodado || '—'}</td>
                  <td>
                    {d.tipo
                      ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{d.tipo}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td><CantidadEditable d={d} /></td>
                  <td className="text-gray-600">{fmt(d.costo)}</td>
                  <td className="font-medium">{fmt(d[precioKey])}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
          <Paginacion total={filtrados.length} pagina={paginaActual} setPagina={setPagina} porPagina={POR_PAGINA} />
        </div>
      )}

      {/* Vista cards */}
      {modo === 'cards' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtrados.length === 0 && <p className="col-span-full empty">Sin resultados</p>}
          {filtradosPagina.map(d => (
            <div key={d.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-1">
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight">{d.medida}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.marca}</p>
                </div>
                {d.rodado && (
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    R{d.rodado}
                  </span>
                )}
              </div>
              {d.tipo && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full self-start">
                  {d.tipo}
                </span>
              )}
              <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Cant.</p>
                  <CantidadEditable d={d} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">{precioLabel}</p>
                  <p className="text-sm font-semibold text-gray-800">{fmt(d[precioKey])}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400">Costo: {fmt(d.costo)}</div>
            </div>
          ))}
          </div>
          <Paginacion total={filtrados.length} pagina={paginaActual} setPagina={setPagina} porPagina={POR_PAGINA} />
        </div>
      )}

      {/* Panel slide-over */}
      <SlideOver open={panelOpen} onClose={() => setPanelOpen(false)} title="Ingresar mercadería">
        <FormMercaderia
          compact
          onSuccess={() => {
            setPanelOpen(false)
            cargar()
          }}
        />
      </SlideOver>
    </div>
  )
}

function Paginacion({ total, pagina, setPagina, porPagina }) {
  const totalPags = Math.ceil(total / porPagina)
  if (totalPags <= 1) return null
  const inicio = pagina * porPagina + 1
  const fin = Math.min((pagina + 1) * porPagina, total)
  const rango = []
  for (let i = Math.max(0, pagina - 2); i <= Math.min(totalPags - 1, pagina + 2); i++) rango.push(i)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-400">Mostrando {inicio}–{fin} de {total}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
          className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {rango.map(i => (
          <button key={i} onClick={() => setPagina(i)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${i === pagina ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 hover:bg-gray-50'}`}>
            {i + 1}
          </button>
        ))}
        <button onClick={() => setPagina(p => Math.min(totalPags - 1, p + 1))} disabled={pagina === totalPags - 1}
          className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
