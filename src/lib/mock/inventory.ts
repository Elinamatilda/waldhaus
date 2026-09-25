export type InventoryItem = {
  sku: string;
  name: string;
  quality: string;
  specification: string;
  category: "oak" | "walnut" | "hardware" | "chemicals";
  stock: number;
  unit: string;
  capacity: number;
  location: string;
  unitCost: number;
  low: boolean;
};

export const inventoryItems: InventoryItem[] = [
  {
    sku: "OA-A-044",
    name: "European Oak",
    quality: "rustik",
    specification: "4-4 KD Rough",
    category: "oak",
    stock: 4820,
    unit: "m3",
    capacity: 82,
    location: "Zone A / Bin 04",
    unitCost: 485,
    low: false,
  },
  {
    sku: "OA-B-084",
    name: "European Oak",
    quality: "ab",
    specification: "8-4 Prime",
    category: "oak",
    stock: 340,
    unit: "m3",
    capacity: 14,
    location: "Zone A / Bin 12",
    unitCost: 1120,
    low: true,
  },
  {
    sku: "WA-A-064",
    name: "American Walnut",
    quality: "rustik",
    specification: "6-4 KD",
    category: "walnut",
    stock: 960,
    unit: "m3",
    capacity: 34,
    location: "Zone B / Rack 07",
    unitCost: 980,
    low: true,
  },
  {
    sku: "HW-563H",
    name: "Soft-Close Slides",
    quality: "ab",
    specification: "Heavy Duty Pair",
    category: "hardware",
    stock: 1250,
    unit: "pr",
    capacity: 90,
    location: "Zone C / Rack 02",
    unitCost: 22.4,
    low: false,
  },
  {
    sku: "CH-GL-003",
    name: "Assembly Adhesive",
    quality: "rustik",
    specification: "1 Gallon",
    category: "chemicals",
    stock: 42,
    unit: "gal",
    capacity: 18,
    location: "Zone D / Chem 01",
    unitCost: 48.5,
    low: true,
  },
];
