"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  FilterBar,
  Icon,
  IconButton,
  MetricCard,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Select,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { inventoryItems } from "@/lib/mock/inventory";

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return inventoryItems.filter((item) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.specification.toLowerCase().includes(q) ||
        item.quality.toLowerCase().includes(q);
      const matchesCategory = category === "all" || item.category === category;
      const matchesStatus =
        status === "all" || (status === "low" ? item.low : item.capacity > 85);
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [query, category, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory Control / Oak Materials"
        title="Lumber and Hardware Stockroom"
        description="Dense operational stock tracking with status and capacity indicators."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="download" className="h-4 w-4" />
              Export Report
            </Button>
            <Button>
              <Icon name="plus" className="h-4 w-4" />
              Add New Item
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Stock Value" value="EUR 1,428,500" hint="+4.2% from last month" tone="success" />
        <MetricCard label="Low Stock Alerts" value="12 items" hint="Requires immediate reorder" tone="destructive" />
        <MetricCard label="Total SKUs Tracked" value="3,480" hint="Across 4 zones" tone="operational" />
        <MetricCard label="Pending Shipments" value="28 pallets" hint="Expected today" />
      </section>

      <FilterBar>
        <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">
          <div className="min-w-[18rem] flex-1">
            <SearchInput
              placeholder="Search by item name, SKU, grade, dimensions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All Categories</option>
            <option value="oak">Oak</option>
            <option value="walnut">Walnut</option>
            <option value="hardware">Hardware</option>
            <option value="chemicals">Chemicals</option>
          </Select>
        </div>
        <SegmentedControl
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All Items" },
            { value: "low", label: "Low Stock" },
            { value: "high", label: "High Capacity" },
          ]}
        />
      </FilterBar>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Quality / Specification</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-left">Capacity</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.sku}>
                  <TableCell>
                    <div className="font-semibold text-text-primary">{item.name}</div>
                    <div className="text-body-small text-text-secondary">SKU: {item.sku}</div>
                  </TableCell>
                  <TableCell className="text-body-small text-text-secondary">
                    <div className="font-medium">{item.quality}</div>
                    <div className="font-mono">{item.specification}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.category === "oak" || item.category === "walnut" ? "info" : "neutral"}>
                      {item.category}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={item.low ? "text-destructive" : "text-text-primary"}>{item.stock}</span>
                    <span className="ml-1 text-body-small text-text-secondary">{item.unit}</span>
                  </TableCell>
                  <TableCell>
                    <div className="w-36">
                      <div className="mb-1 flex items-center justify-between text-body-small">
                        <span className={item.low ? "text-destructive" : "text-text-secondary"}>{item.capacity}%</span>
                        <span className="text-text-secondary">
                          {item.low ? "Low" : item.capacity > 85 ? "High" : "Optimal"}
                        </span>
                      </div>
                      <ProgressBar
                        value={item.capacity}
                        tone={item.low ? "destructive" : item.capacity > 85 ? "primary" : "success"}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-body-small text-text-secondary">{item.location}</TableCell>
                  <TableCell className="text-right font-semibold">EUR {item.unitCost.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <IconButton variant="icon" aria-label="View item">
                        <Icon name="eye" className="h-4 w-4" />
                      </IconButton>
                      <IconButton variant="icon" aria-label="Edit item">
                        <Icon name="edit" className="h-4 w-4" />
                      </IconButton>
                      <IconButton variant="icon" aria-label="Adjust stock">
                        <Icon name="filter" className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination page={page} total={4} onPage={setPage} />
      </Card>

      <Card>
        <SectionHeader title="Operational Notes" description="Reference-aligned compact information density and table scanability" />
        <div className="flex flex-wrap gap-2">
          <Badge>Desktop-first dense tables</Badge>
          <Badge>Status color semantics</Badge>
          <Badge>Role-ready navigation</Badge>
        </div>
      </Card>
    </div>
  );
}
