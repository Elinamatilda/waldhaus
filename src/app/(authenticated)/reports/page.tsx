import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";

export default async function ReportsPage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Reports"
        description="Management reporting will be delivered on top of the new data foundations."
      />
      <Card>
        <p className="text-body text-text-secondary">
          Admin-only report space reserved for KPI and forecasting modules.
        </p>
      </Card>
    </div>
  );
}
