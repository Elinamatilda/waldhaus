import "server-only";

import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";

const invalidSessionCodes = new Set([
  "bad_jwt",
  "no_authorization",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "user_not_found",
  "user_banned",
  "unexpected_audience",
]);

export function isInvalidSessionError(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (!isAuthApiError(error) || error.status < 400 || error.status >= 500 ||
      error.status === 408 || error.status === 429) {
    return false;
  }
  return error.code
    ? invalidSessionCodes.has(error.code)
    : error.status === 401;
}

export async function getVerifiedUser(auth: Pick<SupabaseClient["auth"], "getUser">) {
  // Only getUser verifies the identity here. Never fall back to getSession().user.
  // Thrown transport errors propagate unchanged; returned service errors retain
  // their cause for server diagnostics instead of becoming a signed-out state.
  let result;
  try {
    result = await auth.getUser();
  } catch (error) {
    if (isInvalidSessionError(error)) return null;
    throw error;
  }
  const { data, error } = result;
  if (error) {
    if (isInvalidSessionError(error)) return null;
    // Do not copy upstream messages: they can contain request/user details.
    // Keep the original cause for server diagnostics, but make network versus
    // HTTP failures distinguishable even when Next.js only displays the wrapper.
    const status = error.status;
    const detail = isAuthRetryableFetchError(error) && status === 0
      ? " Supabase Auth could not be reached (no HTTP response)."
      : Number.isInteger(status) && status !== undefined && status >= 400 && status <= 599
        ? ` Supabase Auth returned HTTP ${status}.`
        : " Supabase Auth returned an unexpected error.";
    throw new Error(`Failed to verify the current user.${detail}`, { cause: error });
  }
  return data.user;
}
