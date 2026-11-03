import { signOut } from "@/actions/auth";
export function SignOutButton() { return <form action={signOut}><button type="submit" style={{ border: 0, background: "transparent", color: "#77746d", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Sair</button></form>; }
