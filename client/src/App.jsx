import { useState } from 'react'
import { Menu } from 'lucide-react'
import Dashboard from './components/Dashboard'
import Tabla from './components/Tabla'
import Pedidos from './components/Pedidos'
import Saldos from './components/Saldos'
import Stock from './components/Stock'
import Clientes from './components/Clientes'

const GRUPOS = [
  {
    label: 'Inicio',
    items: [{ key: 'dashboard', label: 'Dashboard', comp: 'dashboard' }],
  },
  {
    label: 'Stock',
    items: [{ key: 'stock', label: 'Productos', comp: 'stock' }],
  },
  {
    label: 'Proveedores',
    items: [
      { key: 'pedidos', label: 'Pedidos',        comp: 'pedidos' },
      { key: 'saldos',  label: 'Saldos',         comp: 'saldos' },
      { key: 'pagos',   label: 'Historial Pagos', comp: 'tabla', url: '/api/pagos' },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { key: 'clientes', label: 'Clientes', comp: 'clientes' },
      { key: 'deudas',   label: 'Deudas',   comp: 'tabla', url: '/api/deudas' },
    ],
  },
  {
    label: 'Contabilidad',
    items: [
      { key: 'movimientos', label: 'Movimientos', comp: 'tabla', url: '/api/movimientos' },
    ],
  },
]

const ALL_ITEMS = GRUPOS.flatMap(g => g.items)

export default function App() {
  const [vistaKey, setVistaKey] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const vista = ALL_ITEMS.find(v => v.key === vistaKey) || ALL_ITEMS[0]

  function navTo(key) {
    setVistaKey(key)
    setSidebarOpen(false)
  }

  function renderVista() {
    switch (vista.comp) {
      case 'dashboard': return <Dashboard onNav={navTo} />
      case 'stock':     return <Stock />
      case 'pedidos':   return <Pedidos />
      case 'saldos':    return <Saldos />
      case 'clientes':  return <Clientes />
      default:          return <Tabla titulo={vista.label} url={vista.url} />
    }
  }

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Neumaticos</p>
        <p className="text-lg font-bold text-white mt-0.5">TT</p>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {GRUPOS.map(grupo => (
          <div key={grupo.label} className="mb-1">
            <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              {grupo.label}
            </p>
            {grupo.items.map(item => (
              <button
                key={item.key}
                onClick={() => navTo(item.key)}
                className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${
                  vistaKey === item.key
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  )

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-56 bg-[#1a1a2e] text-white flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-64 bg-[#1a1a2e] text-white flex flex-col z-50 md:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-900">Neumaticos TT</span>
          <span className="text-sm text-gray-400 ml-1">— {vista.label}</span>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="p-4 md:p-8">
            {renderVista()}
          </div>
        </main>
      </div>
    </div>
  )
}
