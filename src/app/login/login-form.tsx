"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginFormState } from "@/app/actions/auth";
import { Button, FormField, Input } from "@/components/ui";

const initialLoginFormState: LoginFormState = {
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(
    loginAction,
    initialLoginFormState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required name="email" />
      </FormField>
      <FormField label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required name="password" />
      </FormField>
      {state.error ? (
        <p className="rounded-lg border border-destructive/20 bg-[#ffdad6] px-3 py-2 text-body text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}