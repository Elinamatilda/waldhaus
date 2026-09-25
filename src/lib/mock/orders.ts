export type OrderStage = "cutting" | "assembly" | "finishing" | "ready";

export type OrderRow = {
  id: string;
  client: string;
  project: string;
  material: string;
  due: string;
  stage: OrderStage;
  progress: number;
};

export const orders: OrderRow[] = [
  {
    id: "ORD-4091",
    client: "Apex Architecture",
    project: "Executive Boardroom Table",
    material: "Board stock",
    due: "2026-10-24",
    stage: "cutting",
    progress: 25,
  },
  {
    id: "ORD-4088",
    client: "Hearth and Home Design",
    project: "Kitchen Cabinetry",
    material: "Certified stock",
    due: "2026-10-19",
    stage: "assembly",
    progress: 60,
  },
  {
    id: "ORD-4075",
    client: "Vanguard Hospitality",
    project: "Lobby Reception Desk",
    material: "Structural stock",
    due: "2026-10-15",
    stage: "finishing",
    progress: 85,
  },
  {
    id: "ORD-4062",
    client: "Sterling Clinic",
    project: "Built-In Bookshelves",
    material: "Secondary stock",
    due: "2026-10-12",
    stage: "ready",
    progress: 100,
  },
  {
    id: "ORD-4059",
    client: "Boutique Stays",
    project: "Platform Bed Set",
    material: "Board stock",
    due: "2026-11-02",
    stage: "cutting",
    progress: 15,
  },
];
