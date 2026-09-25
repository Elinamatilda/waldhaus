import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";

type AuthenticatedLayoutProps = {
  children: ReactNode;
};

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  await requireUser();

  return children;
}