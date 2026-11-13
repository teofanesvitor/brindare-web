"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, LayoutDashboard, Package, Settings, Users, Wallet } from "lucide-react";
const items = [
  { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Estoque", href: "/estoque", icon: Package },
  { label: "Contratos", href: "/contratos", icon: FileText },
];
export function Sidebar({ pendingClients = 0 }: { pendingClients?: number }) {
  const pathname = usePathname();
  return <aside className="sidebar"><Link href="/dashboard" className="side-logo">brindare<span>.</span></Link>
    
    {items.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`nav-link${pathname === href ? " active" : ""}`}><Icon size={17} strokeWidth={1.8}/>{label}{href === "/clientes" && pendingClients > 0 && <span className="nav-count">{pendingClients > 99 ? "99+" : pendingClients}</span>}</Link>)}
    <div className="sidebar-bottom"><Link href="/configuracoes" className={`nav-link${pathname === "/configuracoes" ? " active" : ""}`}><Settings size={17}/>Configurações</Link></div>
  </aside>;
}
