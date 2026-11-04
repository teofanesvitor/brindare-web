import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const authError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (authError) {
    console.error("Erro retornado pelo Supabase:", {
      authError,
      errorDescription,
    });
  }

  if (!code) {
    console.error("Callback sem código de autenticação.");
    return NextResponse.redirect(
      `${origin}/login?error=invalid_credentials`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Falha ao validar convite:", error.message);

    return NextResponse.redirect(
      `${origin}/login?error=invalid_credentials`
    );
  }

  return NextResponse.redirect(`${origin}/definir-senha`);
}