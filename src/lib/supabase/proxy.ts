import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (process.env.NODE_ENV === "development") {
    const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
    const hasSupabaseAuthCookie = cookieNames.some((name) =>
      name.startsWith("sb-") && name.endsWith("-auth-token"),
    );

    console.info("[auth][proxy] getUser_result", {
      hasUser: Boolean(user),
      hasAuthCookie: hasSupabaseAuthCookie,
      hasError: Boolean(error),
    });
  }

  return response;
}