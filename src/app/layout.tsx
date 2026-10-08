import type { Metadata } from "next";
import { Jost, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-jost", display: "swap" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Fabio Tobón Odontología", template: "%s · Fabio Tobón Odontología" },
  icons: { icon: { url: "/brand/diente.svg", type: "image/svg+xml" } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${jost.variable} ${sourceSerif.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
