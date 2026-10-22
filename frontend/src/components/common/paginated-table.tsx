import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Paginated } from "@/types/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, StateView } from "./state-view";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string | undefined;
}
export interface FilterDef {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export function PaginatedTable<T extends { id: string }>({
  path,
  queryKey,
  columns,
  filters = [],
  searchable = true,
  actions,
  pageSize = 10,
  enabled = true,
  emptyText,
}: {
  path: string;
  queryKey: readonly unknown[];
  columns: Column<T>[];
  filters?: FilterDef[] | undefined;
  searchable?: boolean | undefined;
  actions?: ((row: T) => ReactNode) | undefined;
  pageSize?: number | undefined;
  enabled?: boolean | undefined;
  emptyText?: string | undefined;
}) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: [...queryKey, { page, q, ...f }],
    queryFn: () => api.get<Paginated<T>>(path, { page, pageSize, q, ...f }),
    placeholderData: keepPreviousData,
    enabled,
  });
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;
  return (
    <div className="surface-card overflow-hidden">
      {(searchable || filters.length > 0) && (
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          {searchable && (
            <div className="relative min-w-48 flex-1">
              <Search
                className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Buscar"
                placeholder="Buscar…"
                className="pl-8"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
          {filters.map((fl) => (
            <Select
              key={fl.name}
              value={f[fl.name] ?? "all"}
              onValueChange={(v) => {
                setF((p) => ({ ...p, [fl.name]: v === "all" ? "" : v }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label={fl.label}>
                <SelectValue placeholder={fl.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{fl.label}: todos</SelectItem>
                {fl.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}
      {query.isPending ? (
        <div className="p-4">
          <StateView kind="loading" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <StateView kind="empty" description={emptyText} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.header} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                {actions && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.header} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {query.data && query.data.total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm text-muted-foreground">
          <span>
            {query.data.total} resultados · página {page} de {pages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Página siguiente"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
