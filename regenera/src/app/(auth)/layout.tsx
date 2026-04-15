// Layout para rutas de autenticación: login, register
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-brand-600">Regenera</span>
          <p className="text-sm text-surface-300 mt-1">Asesoría ambiental para tu empresa</p>
        </div>
        {children}
      </div>
    </div>
  )
}
