import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const TAGS = ['estado', 'pagador', 'tipo']

const LABELS = {
  // columnas visibles
  medida: 'Medida', marca: 'Marca', rodado: 'Rodado', tipo: 'Tipo',
  rotacion: 'Rotación', estado: 'Estado', cantidad: 'Cantidad', costo: 'Costo',
  nombre: 'Nombre', cuenta: 'Cuenta', numero_factura: 'Factura',
  ingreso: 'Ingreso', fecha_pagar: 'A pagar', importe_tt: 'TT', importe_lf: 'LF',
  observaciones: 'Obs.', proveedor: 'Proveedor', fecha: 'Fecha', monto: 'Monto',
  metodo: 'Método', pagador: 'Pagador', telefono: 'Teléfono', zona: 'Zona',
  medio_pago: 'Medio pago', total: 'Total', concepto: 'Concepto',
  cliente: 'Cliente', monto_original: 'Monto orig.', monto_pendiente: 'Pendiente',
  vencimiento: 'Vencimiento',
  // columnas ocultas (null = no mostrar)
  id: null, created_at: null, cliente_id: null, venta_id: null,
  proveedor_id: null, referencia_tipo: null, referencia_id: null,
  scc_id: null, precio_manual: null, precio_minorista_x2: null,
  precio_minorista_x4: null, precio_minorista_6c: null,
  precio_reventa_a: null, precio_reventa_b: null,
}

const MONEDA = new Set(['costo','monto','total','importe_tt','importe_lf','monto_original','monto_pendiente'])

function formatVal(key, val) {
  if (val === null || val === undefined || val === '') return <span className="text-gray-300">—</span>
  if (TAGS.includes(key)) return <span className={`tag-${val}`}>{val}</span>
  if (key.includes('fecha') || key === 'ingreso' || key === 'vencimiento')
    return new Date(val).toLocaleDateString('es-AR')
  if (MONEDA.has(key)) return `$${Number(val).toLocaleString('es-AR')}`
  return String(val)
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
        <button
          onClick={() => setPagina(p => Math.max(0, p - 1))}
          disabled={pagina === 0}
          className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
        ><ChevronLeft className="w-3.5 h-3.5" /></button>
        {rango.map(i => (
          <button
            key={i}
            onClick={() => setPagina(i)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              i === pagina ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setPagina(p => Math.min(totalPags - 1, p + 1))}
          disabled={pagina === totalPags - 1}
          className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
        ><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

const POR_PAGINA = 20

export default function Tabla({ titulo, url }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    fetch(url).then(r => r.json()).then(setDatos).catch(e => setError(e.message))
  }, [url])

  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>
  if (!datos) return <p className="empty">Cargando...</p>

  const cols = datos.length ? Object.keys(datos[0]).filter(k => LABELS[k] !== null && LABELS[k] !== undefined) : []

  const filtrados = busqueda
    ? datos.filter(f => Object.values(f).some(v => String(v ?? '').toLowerCase().includes(busqueda.toLowerCase())))
    : datos

  const totalPags = Math.ceil(filtrados.length / POR_PAGINA)
  const paginaActual = Math.min(pagina, Math.max(0, totalPags - 1))
  const pagina_ = busqueda ? 0 : paginaActual
  const filasPagina = filtrados.slice(pagina_ * POR_PAGINA, (pagina_ + 1) * POR_PAGINA)

  function onBusqueda(v) {
    setBusqueda(v)
    setPagina(0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {titulo}
          <span className="ml-2 text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {filtrados.length}
          </span>
        </h1>
        <input
          className="input w-full sm:w-56 ml-auto"
          placeholder="Buscar…"
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        {filasPagina.length === 0
          ? <p className="empty">Sin resultados</p>
          : (
            <>
              <table>
                <thead>
                  <tr>{cols.map(c => <th key={c}>{LABELS[c] || c}</th>)}</tr>
                </thead>
                <tbody>
                  {filasPagina.map((fila, i) => (
                    <tr key={i}>
                      {cols.map(c => <td key={c}>{formatVal(c, fila[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Paginacion
                total={filtrados.length}
                pagina={busqueda ? 0 : paginaActual}
                setPagina={setPagina}
                porPagina={POR_PAGINA}
              />
            </>
          )
        }
      </div>
    </div>
  )
}
