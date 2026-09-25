import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/session";

export default async function HomePage() {
  const context = await getCurrentAuthContext();

  if (!context || !context.profile.is_active) {
    redirect("/login");
  }

  if (context.profile.is_system_admin || context.membership?.is_active) {
    redirect("/dashboard");
  }

  redirect("/no-organization-access");
}
