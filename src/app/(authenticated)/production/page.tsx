import {
  Badge,
  Card,
  PageHeader,
  ProgressBar,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { employeeCurrentWork } from "@/lib/mock/dashboard";

export default async function ProductionPage() {
  await requireRole("admin", "employee");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Production Work"
        description="Current production jobs and stage progress."
      />

      <Card className="overflow-hidden p-0">
        <div className="p-4">
          <SectionHeader title="My Work Queue" description="Priority sorted shift assignments" />
        </div>
        <Table>
          <TableHeader>
            <tr>
              <th className="px-4 py-3 text-left">Job</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Material</th>
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
    </div>
  );
}
