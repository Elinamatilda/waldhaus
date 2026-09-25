export type SalesSearchParams = {
  org?: string;
  q?: string;
  year?: string;
  scenario?: string;
  customer?: string;
  product?: string;
  variant?: string;
};

export async function resolveSalesSearchParams(
  searchParams?: SalesSearchParams | Promise<SalesSearchParams>,
) {
  return (await searchParams) ?? {};
}
