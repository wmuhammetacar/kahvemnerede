import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kahvem Nerede",
    template: "%s | Kahvem Nerede",
  },
  description: "Kahve siparişlerinizi takip edin",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kahvem Nerede",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0c0a09",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased bg-stone-950 text-stone-100 selection:bg-amber-500/30 selection:text-amber-100">
        {children}
      </body>
    </html>
  );
}
