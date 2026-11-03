import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await requireAdmin();
  const label = profile.full_name || user.email || "Administrador";
  return <div className="app-shell"><Sidebar/><div className="main-area"><header className="topbar"><div className="topbar-title">Painel administrativo <span style={{ color: "#c7a32d" }}> / </span> Brindare</div><div className="user-chip"><div className="avatar">{label.charAt(0).toUpperCase()}</div><span>{label}</span><SignOutButton/></div></header>{children}</div></div>;
}
