import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brindare | Gestão de eventos",
  description: "Sistema de gestão de eventos, clientes, financeiro e estoque da Brindare.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
