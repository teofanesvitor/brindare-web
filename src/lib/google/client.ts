import { google } from "googleapis";

const REQUIRED = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"] as const;
function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração ausente: ${name}.`);
  return value;
}
export function googleClients() {
  const oauth = new google.auth.OAuth2(env(REQUIRED[0]), env(REQUIRED[1]));
  oauth.setCredentials({ refresh_token: env(REQUIRED[2]) });
  return {
    drive: google.drive({ version: "v3", auth: oauth }),
    docs: google.docs({ version: "v1", auth: oauth }),
  };
}
export const CONTRACT_TEMPLATE_ID = process.env.GOOGLE_CONTRACT_TEMPLATE_ID || "15ZhmqVluSCaMHWeX9gsuaUoikKrol5e8loB4GrxW08M";
