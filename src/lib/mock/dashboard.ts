export type AdminKpi = {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "warning" | "destructive" | "operational";
};

export type RawMaterialAvailabilityRow = {
  materialGroup: string;
  onHandM3: number;
  reservedM3: number;
  availableM3: number;
  coverageDays: number;
  status: "healthy" | "watch" | "critical";
};

export type PurchasingAttention = {
  material: string;
  available: string;
  target: string;
  incoming: string;
  nextDelivery: string;
  status: "ok" | "watch" | "critical";
};

export type ProductionStatus = {
  stage: "queued" | "in_production" | "waiting_for_material" | "ready" | "delayed";
  count: number;
  note: string;
};

export type OperationalAttention = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "warning" | "error";
};

export type EmployeeAssignedJob = {
  id: string;
  product: string;
  stage: string;
  requiredMaterial: string;
  progress: number;
  due: string;
};

export const adminKpis: AdminKpi[] = [
  { label: "Active Production", value: "18", hint: "6 lines currently in progress", tone: "operational" },
  { label: "Open Orders", value: "24", hint: "5 waiting for material confirmation", tone: "default" },
  { label: "Raw Material Inventory Value", value: "EUR 1.42M", hint: "Current valuation of available stock", tone: "success" },
  { label: "Purchasing Alerts", value: "4", hint: "2 critical, 2 warning", tone: "destructive" },
];

export const rawMaterialAvailability: RawMaterialAvailabilityRow[] = [
  { materialGroup: "Boards", onHandM3: 45.2, reservedM3: 17.6, availableM3: 27.6, coverageDays: 29, status: "healthy" },
  { materialGroup: "Structural Stock", onHandM3: 26.4, reservedM3: 11.3, availableM3: 15.1, coverageDays: 17, status: "watch" },
  { materialGroup: "Certified PEFC Stock", onHandM3: 12.7, reservedM3: 8.4, availableM3: 4.3, coverageDays: 9, status: "critical" },
  { materialGroup: "Offcuts / Secondary", onHandM3: 9.8, reservedM3: 2.1, availableM3: 7.7, coverageDays: 33, status: "healthy" },
];

export const purchasingAttention: PurchasingAttention[] = [
  { material: "Boards", available: "27.6 m3", target: "30.0 m3", incoming: "5.0 m3", nextDelivery: "2026-09-29", status: "watch" },
  { material: "Certified PEFC Stock", available: "4.3 m3", target: "10.0 m3", incoming: "0.0 m3", nextDelivery: "Not scheduled", status: "critical" },
  { material: "Structural Stock", available: "15.1 m3", target: "18.0 m3", incoming: "6.0 m3", nextDelivery: "2026-09-27", status: "watch" },
  { material: "Offcuts / Secondary", available: "7.7 m3", target: "6.0 m3", incoming: "0.0 m3", nextDelivery: "Not required", status: "ok" },
];

export const productionStatus: ProductionStatus[] = [
  { stage: "queued", count: 7, note: "Ready for line assignment" },
  { stage: "in_production", count: 9, note: "Actively running" },
  { stage: "waiting_for_material", count: 4, note: "Blocked by raw material shortages" },
  { stage: "ready", count: 5, note: "Ready for dispatch" },
  { stage: "delayed", count: 3, note: "Overdue against plan" },
];

export const operationalAttention: OperationalAttention[] = [
  {
    id: "att-1",
    title: "Certified stock below safety coverage",
    detail: "Coverage fell to 9 days. Purchasing decision required today.",
    tone: "error",
  },
  {
    id: "att-2",
    title: "Order ORD-4302 waiting for incoming material",
    detail: "Assembly cannot start until the incoming lot is received.",
    tone: "warning",
  },
  {
    id: "att-3",
    title: "Supplier truck delayed by 18 hours",
    detail: "Expected oak delivery shifted to tomorrow morning.",
    tone: "warning",
  },
  {
    id: "att-4",
    title: "Production order WO-891 overdue",
    detail: "Finishing stage exceeded the target completion by 1 day.",
    tone: "info",
  },
];

export const employeeToday = {
  assignedJobs: 4,
  currentJob: "WO-912 Edge Finishing",
  nextJob: "WO-917 Sanding Prep",
};

export const employeeCurrentWork: EmployeeAssignedJob[] = [
  {
    id: "WO-912",
    product: "Cabinet Front Set",
    stage: "Finishing",
    requiredMaterial: "Board stock",
    progress: 62,
    due: "Today 15:00",
  },
  {
    id: "WO-917",
    product: "Tabletop Panel",
    stage: "Sanding",
    requiredMaterial: "Certified stock",
    progress: 18,
    due: "Today 17:30",
  },
  {
    id: "WO-920",
    product: "Bookshelf Frame",
    stage: "Assembly",
    requiredMaterial: "Secondary stock",
    progress: 0,
    due: "Tomorrow",
  },
];

export const employeeAttention: OperationalAttention[] = [
  {
    id: "emp-1",
    title: "Missing material for WO-917",
    detail: "Required material bundle is still in receiving. Coordinate with inventory.",
    tone: "warning",
  },
  {
    id: "emp-2",
    title: "Updated production instruction",
    detail: "Apply revised edge profile spec v2.3 for WO-912.",
    tone: "info",
  },
  {
    id: "emp-3",
    title: "Quality hold on previous batch",
    detail: "Do not continue packing until QA release is posted.",
    tone: "error",
  },
];
