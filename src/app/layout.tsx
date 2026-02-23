import type { Metadata } from 'next'
import { AuthProvider } from '@/hooks/useAuth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Amorph BBS',
  description: 'The formless collective.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600;700&family=Orbitron:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
