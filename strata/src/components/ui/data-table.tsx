import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A column definition: a header label + a function that renders the cell for a given row.
// `cell` returns a ReactNode so callers keep full control over formatting (badges, links, etc.).
export interface DataTableColumn<T> {
  /** Stable identifier for the column (also used as the React key for header/cells). */
  id: string;
  /** Header content. */
  header: ReactNode;
  /** Renders the cell for a row. */
  cell: (row: T) => ReactNode;
  /** Optional className applied to the <td> for this column (e.g. muted text, alignment). */
  className?: string;
  /** Optional className applied to the <th> for this column. */
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Unique key per row. Falls back to array index if omitted (fine for static lists). */
  getRowKey?: (row: T, index: number) => string;
  /** Row click handler; when provided, rows get a pointer cursor and hover affordance. */
  onRowClick?: (row: T) => void;
  /** Rows per page. Pass 0 to disable pagination entirely. Default 10. */
  pageSize?: number;
  /** Rendered instead of the table when `data` is empty. */
  emptyState?: ReactNode;
}

// Reusable, self-paginating table. Owns its page state, clamps out-of-range pages when the data
// shrinks, and resets to page 1 when the dataset identity changes (e.g. a new search/filter).
// Callers only describe columns + provide data — no pagination boilerplate at the call site.
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  pageSize = 10,
  emptyState,
}: DataTableProps<T>) {
  const paginate = pageSize > 0;
  const [page, setPage] = useState(0); // 0-indexed

  const total = data.length;
  const pageCount = paginate ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  // Reset to the first page whenever the dataset changes size (search/filter narrowed it), so
  // results aren't hidden on a page that no longer exists.
  useEffect(() => {
    setPage(0);
  }, [total]);

  // Clamp if we somehow end up past the last page.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const pageRows = useMemo(() => {
    if (!paginate) return data;
    const start = page * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize, paginate]);

  if (total === 0 && emptyState !== undefined) {
    return <>{emptyState}</>;
  }

  const rangeStart = total === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id} className={col.headerClassName}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row, i) => (
            <TableRow
              key={getRowKey ? getRowKey(row, i) : i}
              className={cn(onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.id} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {paginate && pageCount > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
