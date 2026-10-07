import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";

import { ConditionalSiteHeader } from "@/components/ConditionalSiteHeader";
import { AppLanguageProvider } from "@/components/i18n/AppLanguageProvider";
import { EmbeddedEmailWalletProvider } from "@/components/wallet/EmbeddedEmailWalletProvider";

import "./globals.css";
import "./travel-agent.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agentic AI Gateway",
  description:
    "AI Agent Control Plane for deterministic authority, approvals and execution.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={geistMono.variable + " h-full antialiased"}
    >
      <head>
        {process.env.NODE_ENV === "development" ? (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        ) : null}
      </head>
      <body className="min-h-full">
        <AppLanguageProvider>
          <EmbeddedEmailWalletProvider>
            <ConditionalSiteHeader />
            {children}
          </EmbeddedEmailWalletProvider>
        </AppLanguageProvider>
      </body>
    </html>
  );
}
