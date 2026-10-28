import type { Metadata, Viewport } from "next"
import { Bangers, Cinzel, Fredoka, Geist_Mono, Inter, Orbitron, Pacifico, Righteous, Silkscreen } from "next/font/google"

import { Providers } from "@/components/providers"

import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Display name fonts (profile cosmetics). Not preloaded: a font only downloads once a
// name on screen uses it.
const nameRounded = Fredoka({ variable: "--font-name-rounded", subsets: ["latin"], weight: "600", preload: false })
const nameSerif = Cinzel({ variable: "--font-name-serif", subsets: ["latin"], weight: "700", preload: false })
const namePixel = Silkscreen({ variable: "--font-name-pixel", subsets: ["latin"], weight: "400", preload: false })
const nameScript = Pacifico({ variable: "--font-name-script", subsets: ["latin"], weight: "400", preload: false })
const nameToon = Bangers({ variable: "--font-name-toon", subsets: ["latin"], weight: "400", preload: false })
const nameTech = Orbitron({ variable: "--font-name-tech", subsets: ["latin"], weight: "700", preload: false })
const nameRetro = Righteous({ variable: "--font-name-retro", subsets: ["latin"], weight: "400", preload: false })
const nameFonts = [nameRounded, nameSerif, namePixel, nameScript, nameToon, nameTech, nameRetro]

export const metadata: Metadata = {
  title: { default: "KTCord", template: "%s | KTCord" },
  description: "Real-time chat for your communities.",
  applicationName: "KTCord",
}

export const viewport: Viewport = {
  themeColor: "#1e1f22",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${nameFonts.map((f) => f.variable).join(" ")} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
