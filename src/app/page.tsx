import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  redirect(profile?.is_active ? "/dashboard" : "/login");
}
