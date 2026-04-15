import type { Metadata } from 'next'
import { AuthProvider } from '@/context/AuthProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Regenera — Asesoría Ambiental para tu Empresa',
    template: '%s | Regenera',
  },
  description:
    'Plataforma de cumplimiento ambiental para pymes colombianas. Asesoría en tiempo real, gestión de obligaciones y seguimiento normativo.',
  keywords: ['cumplimiento ambiental', 'RESPEL', 'RUA', 'asesoría ambiental', 'Colombia', 'pymes'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es-CO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
