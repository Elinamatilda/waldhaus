import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";

export default async function PurchasingPage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commercial"
        title="Purchasing"
        description="Supplier and replenishment workflows will be connected next."
      />
      <Card>
        <p className="text-body text-text-secondary">
          This screen is reserved for organization admins. The foundation is ready for upcoming purchasing workflows.
        </p>
      </Card>
    </div>
  );
}
