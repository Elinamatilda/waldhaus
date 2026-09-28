"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthApiError } from "@supabase/supabase-js";
import { isInvalidSessionError } from "@/lib/auth/verified-user";

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
    if (isAuthApiError(error) && error.status >= 400 && error.status < 500 &&
      ["invalid_credentials", "email_not_confirmed", "phone_not_confirmed", "user_banned"].includes(error.code ?? "")) {
      return { error: "Invalid email or password." };
    }
    throw new Error("Sign-in verification failed.", { cause: error });
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();
  if (error && !isInvalidSessionError(error)) {
    throw new Error("Sign-out failed.", { cause: error });
  }

  redirect("/login");
}
