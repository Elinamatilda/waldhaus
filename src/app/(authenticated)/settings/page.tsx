import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";

export default async function SettingsPage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Organization and system controls for administrators."
      />
      <Card>
        <p className="text-body text-text-secondary">
          Admin-only placeholder for organization settings and system configuration.
        </p>
      </Card>
    </div>
  );
}
