import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabio Tobón Odontología",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
