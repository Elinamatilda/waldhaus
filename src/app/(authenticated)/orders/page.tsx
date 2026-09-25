import {
  Badge,
  Button,
  Card,
  Icon,
  IconButton,
  PageHeader,
  Pagination,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { orders } from "@/lib/mock/orders";

export default async function OrdersPage() {
  await requireRole("admin");

  const segment = "all";
  const filtered = orders.filter(
    (order) => segment === "all" || order.stage === segment,
  );

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-primary/30 bg-primary-subtle">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-label-small uppercase tracking-wide text-primary">Active Batch WB-892</p>
            <h2 className="text-section-title text-text-primary">Oak and Walnut Custom Cabinetry Line</h2>
            <p className="text-body text-text-secondary">42 units in production, shift A, operator lane 4.</p>
          </div>
          <Button>Batch Details</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_1fr] md:items-center">
          <p className="text-label text-text-secondary">Batch progress: 68%</p>
          <ProgressBar value={68} />
        </div>
      </Card>

      <PageHeader
        title="Orders and Job Tracking"
        description="Monitor fabrication stages, material allocation, and fulfillment schedules."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="download" className="h-4 w-4" />
              Export CSV
            </Button>
            <Button>
              <Icon name="plus" className="h-4 w-4" />
              New Order
            </Button>
          </>
        }
      />

      <SegmentedControl
        value={segment}
        onChange={() => undefined}
        options={[
          { value: "all", label: "All Orders", count: 24 },
          { value: "cutting", label: "Cutting", count: 6 },
          { value: "assembly", label: "Assembly", count: 8 },
          { value: "finishing", label: "Finishing", count: 5 },
          { value: "ready", label: "Ready", count: 5 },
        ]}
      />

      <Card className="overflow-hidden p-0">
        <div className="p-4">
          <SectionHeader title="Active Orders" description="Workflow-oriented table for operational coordination" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">Order ID</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Material</th>
                <th className="px-4 py-3 text-left">Due</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-semibold text-primary">{order.id}</TableCell>
                  <TableCell>{order.client}</TableCell>
                  <TableCell>{order.project}</TableCell>
                  <TableCell>
                    <Badge>{order.material}</Badge>
                  </TableCell>
                  <TableCell>{order.due}</TableCell>
                  <TableCell>
                    <div className="w-44 space-y-1">
                      <div className="flex items-center justify-between text-body-small">
                        <Stage stage={order.stage} />
                        <span className="text-text-primary">{order.progress}%</span>
                      </div>
                      <ProgressBar value={order.progress} tone={order.progress === 100 ? "success" : "primary"} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton variant="icon" aria-label="View order specs">
                        <Icon name="eye" className="h-4 w-4" />
                      </IconButton>
                      <IconButton variant="icon" aria-label="Schedule delivery">
                        <Icon name="truck" className="h-4 w-4" />
                      </IconButton>
                      {order.progress === 100 ? <Button variant="secondary">Schedule</Button> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination page={1} total={5} onPage={() => undefined} />
      </Card>
    </div>
  );
}

function Stage({ stage }: { stage: string }) {
  if (stage === "ready") {
    return <StatusBadge status="success">Ready for dispatch</StatusBadge>;
  }
  if (stage === "finishing") {
    return <StatusBadge status="operational">Finishing</StatusBadge>;
  }
  if (stage === "cutting") {
    return <StatusBadge status="warning">Cutting</StatusBadge>;
  }
  return <StatusBadge status="info">Assembly</StatusBadge>;
}
