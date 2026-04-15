// Landing page pública — punto de entrada de nuevos clientes
import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
        <span className="text-xl font-bold text-brand-600">Regenera</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-sm">
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Prueba gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <span className="inline-block bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          Cumplimiento ambiental sin complicaciones
        </span>
        <h1 className="text-5xl font-bold text-surface-900 leading-tight mb-6">
          Tu unidad ambiental externa,{' '}
          <span className="text-brand-600">siempre disponible</span>
        </h1>
        <p className="text-xl text-surface-300 mb-10 max-w-2xl mx-auto">
          Resuelve tus dudas ambientales en tiempo real, gestiona tus obligaciones
          y mantén tu empresa en cumplimiento — sin contratar un ingeniero de planta.
        </p>
        <Link href="/register" className="btn-primary text-base px-8 py-3">
          Empieza gratis por 14 días →
        </Link>
        <p className="text-sm text-surface-300 mt-4">Sin tarjeta de crédito requerida</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-surface-900 mb-2">{f.title}</h3>
            <p className="text-sm text-surface-300">{f.description}</p>
          </div>
        ))}
      </section>
    </main>
  )
}

const FEATURES = [
  {
    icon: '💬',
    title: 'Asesoría en tiempo real',
    description:
      'Pregunta cualquier duda ambiental y recibe respuesta inmediata de nuestra IA especializada, respaldada por expertos.',
  },
  {
    icon: '📋',
    title: 'Gestión de obligaciones',
    description:
      'Conoce exactamente qué obligaciones aplican a tu empresa y mantén seguimiento de cada una con alertas de vencimiento.',
  },
  {
    icon: '🔒',
    title: 'Cumplimiento garantizado',
    description:
      'Mantente al día con la normativa ambiental colombiana y evita sanciones ante autoridades como IDEAM, CAR y SDA.',
  },
]
