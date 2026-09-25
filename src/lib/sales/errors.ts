export function isSalesSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybe = error as { message?: string; code?: string; details?: string };
  const message = `${maybe.message ?? ""} ${maybe.details ?? ""}`.toLowerCase();

  return (
    maybe.code === "42P01" ||
    maybe.code === "PGRST205" ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("sales_")
  );
}
