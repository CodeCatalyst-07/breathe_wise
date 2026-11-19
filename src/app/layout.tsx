/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BreatheWise — Urban Air Quality Assistant",
  description:
    "Actionable, hyper-local daily routines and indoor smog guidance tailored to your household and neighborhood during winter smog inversions.",
  openGraph: {
    title: "BreatheWise — Urban Air Quality Assistant",
    description:
      "Actionable, hyper-local daily routines and indoor smog guidance tailored to your household.",
    type: "website",
    locale: "en_IN",
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍃</text></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F5F6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Serif+Devanagari:wght@400;600;700&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
