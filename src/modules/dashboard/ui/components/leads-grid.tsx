"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";

import { SAMPLE_LEADS, formatMoney, type Lead } from "../../constants";

// Signed is the only stage that means money, so it is the only one that gets
// a filled chip. Everything else is work in progress and reads as outline.
const stageClass = (stage: Lead["stage"]) =>
  stage === "Signed"
    ? "bg-primary dark:bg-primary text-primary-foreground border-primary"
    : "text-muted-foreground";

export const LeadsGrid = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 6,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "value", desc: true },
  ]);

  const columns = useMemo<ColumnDef<DataGridFeatures, Lead>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader title="Business" column={column} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {/* Initials, not a logo — every business here is one that does
                not have a website yet, so there is no mark to pull. */}
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {row.original.name
                .split(" ")
                .slice(0, 2)
                .map((word) => word[0])
                .join("")}
            </span>
            <div className="space-y-px">
              <div className="text-foreground font-medium">
                {row.original.name}
              </div>
              <div className="text-muted-foreground">{row.original.trade}</div>
            </div>
          </div>
        ),
        size: 240,
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "city",
        header: ({ column }) => (
          <DataGridColumnHeader title="City" column={column} />
        ),
        cell: (info) => <span>{info.getValue() as string}</span>,
        size: 120,
        enableSorting: true,
      },
      {
        accessorKey: "stage",
        header: ({ column }) => (
          <DataGridColumnHeader title="Stage" column={column} />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
              stageClass(row.original.stage),
            )}
          >
            {row.original.stage}
          </span>
        ),
        size: 120,
        enableSorting: true,
      },
      {
        accessorKey: "value",
        header: ({ column }) => (
          <DataGridColumnHeader title="Worth" column={column} />
        ),
        cell: (info) => (
          <span className="tabular-nums">
            {formatMoney(info.getValue() as number)}
          </span>
        ),
        size: 110,
        meta: { cellClassName: "font-semibold" },
        enableSorting: true,
      },
      {
        accessorKey: "found",
        header: ({ column }) => (
          <DataGridColumnHeader title="Found" column={column} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">
            {info.getValue() as string}
          </span>
        ),
        size: 100,
        enableSorting: true,
      },
    ],
    [],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: SAMPLE_LEADS,
    pageCount: Math.ceil(SAMPLE_LEADS.length / pagination.pageSize),
    getRowId: (row: Lead) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  return (
    <DataGrid
      table={table}
      recordCount={SAMPLE_LEADS.length}
      tableLayout={{
        headerBackground: true,
        rowBorder: true,
        headerBorder: true,
        dense: true,
      }}
    >
      <div className="w-full space-y-2.5">
        {/* Matches the panel it sits inside — a square-cornered table inside
            a rounded card reads as two different components. */}
        <DataGridContainer className="rounded-xl border">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        {/* The default sizes list starts at 5, so a pageSize of 6 matched no
            option and the trigger rendered empty. */}
        <DataGridPagination sizes={[6, 12, 24, 48]} />
      </div>
    </DataGrid>
  );
};
