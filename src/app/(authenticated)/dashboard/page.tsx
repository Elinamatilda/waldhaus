import {
  Alert,
  Badge,
  Button,
  Card,
  MetricCard,
  PageHeader,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { requireProfile } from "@/lib/auth/session";
import {
  adminKpis,
  employeeAttention,
  employeeCurrentWork,
  employeeToday,
  rawMaterialAvailability,
  operationalAttention,
  productionStatus,
  purchasingAttention,
} from "@/lib/mock/dashboard";

export default async function DashboardPage() {
  const { profile, membership, organization } = await requireProfile();

  if (profile.is_system_admin) {
    return <AdminDashboard organizationName="All Organizations" />;
  }

  if (!membership || !organization) {
    return (
      <Alert
        tone="warning"
        title="No organization access"
        description="Your account is authenticated, but no active organization membership is available. Contact a Waldhaus administrator."
      />
    );
  }

  if (membership.role === "employee") {
    return <EmployeeDashboard organizationName={organization.name} />;
  }

  return <AdminDashboard organizationName={organization.name} />;
}

function AdminDashboard({ organizationName }: { organizationName: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enterprise Operations"
        title="Production and Material Readiness"
        description={`Can we produce what we sold, and what could block production at ${organizationName}?`}
        actions={
          <>
            <Button variant="secondary">Current Shift: A-Mill</Button>
            <Button>New Work Order</Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminKpis.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            tone={kpi.tone}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden p-0">
          <div className="p-4">
            <SectionHeader
              title="Raw Material Availability"
              description="On-hand, reserved, and available stock with safety-coverage risk"
            />
          </div>
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">Material Group</th>
                <th className="px-4 py-3 text-right">On Hand m3</th>
                <th className="px-4 py-3 text-right">Reserved m3</th>
                <th className="px-4 py-3 text-right">Available m3</th>
                <th className="px-4 py-3 text-right">Coverage Days</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </TableHeader>
            <TableBody>
              {rawMaterialAvailability.map((row) => (
                <TableRow key={row.materialGroup}>
                  <TableCell className="font-semibold text-primary">{row.materialGroup}</TableCell>
                  <TableCell className="text-right">{row.onHandM3.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-text-secondary">{row.reservedM3.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{row.availableM3.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{row.coverageDays}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        row.status === "critical"
                          ? "error"
                          : row.status === "watch"
                            ? "warning"
                            : "success"
                      }
                    >
                      {row.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <SectionHeader
            title="Production Status"
            description="Waiting for material is highlighted as risk"
          />
          <div className="space-y-2">
            {productionStatus.map((status) => (
              <Alert
                key={status.stage}
                tone={
                  status.stage === "waiting_for_material"
                    ? "error"
                    : status.stage === "delayed"
                      ? "warning"
                      : "info"
                }
                title={`${status.stage.replaceAll("_", " ")}: ${status.count}`}
                description={status.note}
              />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="p-4">
            <SectionHeader title="Purchasing Attention" description="Material thresholds and incoming confirmation" />
          </div>
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">Material Group</th>
                <th className="px-4 py-3 text-left">Available</th>
                <th className="px-4 py-3 text-left">Safety Target</th>
                <th className="px-4 py-3 text-left">Incoming</th>
                <th className="px-4 py-3 text-left">Next Delivery</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </TableHeader>
            <TableBody>
              {purchasingAttention.map((row) => (
                <TableRow key={row.material}>
                  <TableCell>{row.material}</TableCell>
                  <TableCell>{row.available}</TableCell>
                  <TableCell>{row.target}</TableCell>
                  <TableCell>{row.incoming}</TableCell>
                  <TableCell>{row.nextDelivery}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        row.status === "critical"
                          ? "error"
                          : row.status === "watch"
                            ? "warning"
                            : "success"
                      }
                    >
                      {row.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <SectionHeader title="Attention Required" description="Operational exceptions to resolve immediately" />
          <div className="space-y-2">
            {operationalAttention.map((item) => (
              <Alert
                key={item.id}
                tone={item.tone}
                title={item.title}
                description={item.detail}
              />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function EmployeeDashboard({ organizationName }: { organizationName: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Today"
        title="My Production Work"
        description={`Prioritized shift view for ${organizationName}. Focus on what to do now.`}
        actions={
          <>
            <Button>Start Work</Button>
            <Button variant="secondary">Report Issue</Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Assigned Jobs" value={String(employeeToday.assignedJobs)} hint="For this shift" tone="operational" />
        <MetricCard label="Current Job" value={employeeToday.currentJob} hint="In progress now" />
        <MetricCard label="Next Job" value={employeeToday.nextJob} hint="Queue after current stage" />
      </section>

      <Card className="overflow-hidden p-0">
        <div className="p-4">
          <SectionHeader title="Current Work" description="Stage progress and required material" />
        </div>
        <Table>
          <TableHeader>
            <tr>
              <th className="px-4 py-3 text-left">Job</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Required Material</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-left">Progress</th>
              <th className="px-4 py-3 text-left">Due</th>
            </tr>
          </TableHeader>
          <TableBody>
            {employeeCurrentWork.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-semibold text-primary">{job.id}</TableCell>
                <TableCell>{job.product}</TableCell>
                <TableCell>{job.requiredMaterial}</TableCell>
                <TableCell>
                  <Badge>{job.stage}</Badge>
                </TableCell>
                <TableCell>
                  <div className="w-40">
                    <ProgressBar value={job.progress} />
                  </div>
                </TableCell>
                <TableCell className="text-text-secondary">{job.due}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Actions" description="Complete operational updates quickly" />
          <div className="flex flex-wrap gap-2">
            <Button>Start Work</Button>
            <Button variant="secondary">Complete Stage</Button>
            <Button variant="ghost">Report Quality Issue</Button>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Attention" description="Immediate blockers and instructions" />
          <div className="space-y-2">
            {employeeAttention.map((item) => (
              <Alert
                key={item.id}
                tone={item.tone}
                title={item.title}
                description={item.detail}
              />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}