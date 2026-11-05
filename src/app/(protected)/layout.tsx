import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await requireAdmin();
  const label = profile.full_name || user.email || "Administrador";  
  const supabase = await createClient();
  const { count } = await supabase.from("client_intakes").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return <div className="app-shell"><Sidebar pendingClients={count || 0}/><div className="main-area"><header className="topbar"><div className="topbar-title">Painel administrativo <span style={{ color: "#c7a32d" }}> / </span> Brindare</div><div className="user-chip"><div className="avatar">{label.charAt(0).toUpperCase()}</div><span>{label}</span><SignOutButton/></div></header>{children}</div></div>;
}
