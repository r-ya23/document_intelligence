import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

// DataTable owns pagination for every table in the app, so its paging/empty/click behaviour is
// worth guarding: a regression here breaks the document list AND the query results at once.

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", cell: (r) => r.name },
];

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));
}

describe("DataTable", () => {
  it("renders all rows on one page and shows no pager when they fit", () => {
    render(<DataTable columns={columns} data={makeRows(3)} getRowKey={(r) => r.id} pageSize={10} />);
    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.getByText("Row 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("shows only the first page and reveals the rest on Next", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={makeRows(25)} getRowKey={(r) => r.id} pageSize={10} />);

    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.getByText("Row 9")).toBeInTheDocument();
    expect(screen.queryByText("Row 10")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("1–10 of 25")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Row 10")).toBeInTheDocument();
    expect(screen.queryByText("Row 0")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("disables Prev on the first page and Next on the last page", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={makeRows(15)} getRowKey={(r) => r.id} pageSize={10} />);

    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /prev/i })).toBeEnabled();
  });

  it("renders the empty state (and no table) when there is no data", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowKey={(r) => r.id}
        emptyState={<div>Nothing here</div>}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("calls onRowClick with the clicked row", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} data={makeRows(2)} getRowKey={(r) => r.id} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText("Row 1"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Row 1" });
  });

  it("shows all rows and no pager when pagination is disabled (pageSize=0)", () => {
    render(<DataTable columns={columns} data={makeRows(30)} getRowKey={(r) => r.id} pageSize={0} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Row 29")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });
});
