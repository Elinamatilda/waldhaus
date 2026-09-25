"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginFormState = {
  error: string | null;
};

export async function loginAction(
  _: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Email and password are required.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (process.env.NODE_ENV === "development") {
    console.info("[auth][login] signInWithPassword_result", {
      success: !error,
      hasUser: Boolean(data.user),
      hasSession: Boolean(data.session),
    });
  }

  if (error) {
    return {
      error: "Invalid email or password.",
    };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}