"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, FileText, LayoutDashboard, Menu, Package, Settings, Users, Wallet, X } from "lucide-react";

const items = [
  { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Estoque", href: "/estoque", icon: Package },
  { label: "Contratos", href: "/contratos", icon: FileText },
];

export function MobileNavigation({ pendingClients = 0 }: { pendingClients?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="mobile-navigation">
      <button type="button" className="mobile-navigation-toggle" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="mobile-navigation-panel" onClick={() => setOpen(value => !value)}>
        {open ? <X size={21}/> : <Menu size={21}/>}<span>Menu</span>
      </button>
      {open && <>
        <button type="button" className="mobile-navigation-backdrop" aria-label="Fechar menu" onClick={close}/>
        <nav id="mobile-navigation-panel" className="mobile-navigation-panel" aria-label="Navegação principal">
          
          {items.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} onClick={close} aria-current={pathname === href ? "page" : undefined} className={"mobile-navigation-link" + (pathname === href ? " active" : "")}>
              <Icon size={18} strokeWidth={1.8}/><span>{label}</span>
              {href === "/clientes" && pendingClients > 0 && <span className="nav-count">{pendingClients > 99 ? "99+" : pendingClients}</span>}
            </Link>
          ))}
          <div className="mobile-navigation-divider"/>
          <Link href="/configuracoes" onClick={close} aria-current={pathname === "/configuracoes" ? "page" : undefined} className={"mobile-navigation-link" + (pathname === "/configuracoes" ? " active" : "")}><Settings size={18}/><span>Configurações</span></Link>
          
        </nav>
      </>}
    </div>
  );
}
