import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export type IMSColumn<T> = {
  key: string;
  header: ReactNode;
  /** plain text for export / search / copy */
  value: (row: T) => string | number | null | undefined;
  /** optional custom JSX render */
  cell?: (row: T) => ReactNode;
  className?: string;
  exportable?: boolean;
};

type Props<T> = {
  title?: string;
  subtitle?: string;
  columns: IMSColumn<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  emptyText?: string;
  /** filename without extension */
  exportName?: string;
  /** elements rendered above the toolbar (filters etc) */
  filters?: ReactNode;
  /** rendered right of buttons */
  rightSlot?: ReactNode;
  defaultPageSize?: number;
  rowKey?: (row: T, idx: number) => string | number;
};

const LENGTHS = [10, 25, 50, 100];

export function IMSDataTable<T>({
  title,
  subtitle,
  columns,
  rows,
  loading,
  emptyText = "No data available in table",
  exportName = "export",
  filters,
  rightSlot,
  defaultPageSize = 25,
  rowKey,
}: Props<T>) {
  const [pageSize, setPageSize] = useState<number | "all">(defaultPageSize);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showColPicker, setShowColPicker] = useState(false);
  const [exportCols, setExportCols] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.exportable !== false).map((c) => c.key)),
  );
  const toggleCol = (key: string) =>
    setExportCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const data = rows ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((r) =>
      columns.some((c) => {
        const v = c.value(r);
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [data, search, columns]);

  const total = filtered.length;
  const size = pageSize === "all" ? total || 1 : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * size;
  const end = Math.min(start + size, total);
  const pageRows = filtered.slice(start, end);

  const buildMatrix = (includeHeader = true) => {
    const cols = columns.filter(
      (c) => c.exportable !== false && exportCols.has(c.key),
    );
    const head = cols.map((c) =>
      typeof c.header === "string" ? c.header : c.key,
    );
    const body = filtered.map((r) =>
      cols.map((c) => {
        const v = c.value(r);
        return v == null ? "" : String(v);
      }),
    );
    return includeHeader ? [head, ...body] : body;
  };

  const doCopy = async () => {
    const matrix = buildMatrix();
    const tsv = matrix.map((r) => r.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success(`Copied ${matrix.length - 1} rows to clipboard`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const doCSV = () => {
    const matrix = buildMatrix();
    const csv = matrix
      .map((r) =>
        r
          .map((c) => {
            const s = String(c).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const matrix = buildMatrix();
      const ws = XLSX.utils.aoa_to_sheet(matrix);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${exportName}.xlsx`);
    } catch {
      toast.error("Excel export failed");
    }
  };

  const doPDF = async () => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const matrix = buildMatrix(false);
      const head = [
        columns
          .filter((c) => c.exportable !== false && exportCols.has(c.key))
          .map((c) => (typeof c.header === "string" ? c.header : c.key)),
      ];
      const pdf = new jsPDF({ orientation: "landscape" });
      pdf.setFontSize(14);
      pdf.text(title || exportName, 14, 14);
      autoTable(pdf, {
        head,
        body: matrix,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 97, 242] },
      });
      pdf.save(`${exportName}.pdf`);
    } catch {
      toast.error("PDF export failed");
    }
  };

  const doPrint = () => {
    const matrix = buildMatrix();
    const html = `<!doctype html><html><head><title>${title || exportName}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:16px;color:#2b3a4a}
        h1{font-size:18px;margin:0 0 12px}
        table{border-collapse:collapse;width:100%;font-size:11px}
        th,td{border:1px solid #e3e6ec;padding:6px 8px;text-align:left}
        thead{background:#f8f9fc}
      </style></head><body>
      <h1>${title || exportName}</h1>
      <table><thead><tr>${matrix[0].map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${matrix
        .slice(1)
        .map(
          (r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Pop-up blocked");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const colCount = columns.length;

  const pageNumbers = useMemo(() => {
    const max = 5;
    const out: number[] = [];
    let s = Math.max(1, safePage - Math.floor(max / 2));
    let e = Math.min(pageCount, s + max - 1);
    s = Math.max(1, e - max + 1);
    for (let i = s; i <= e; i++) out.push(i);
    return out;
  }, [safePage, pageCount]);

  const btnCls =
    "h-8 px-3 text-[11px] font-bold uppercase rounded-md border border-[#0061f2] bg-[#0061f2] text-white hover:bg-[#0052ce] hover:border-[#0052ce]";
  const pageBtnCls =
    "h-8 min-w-8 px-2 text-[11px] font-bold rounded-none border border-[#e3e6ec] text-[#69707a] bg-white hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="space-y-4">
      {(title || subtitle) && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {title && (
              <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {rightSlot}
        </div>
      )}

      <div className="bg-white border border-[#e3e6ec] rounded-md shadow-sm">
        {filters && (
          <div className="px-5 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
            {filters}
          </div>
        )}

        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center gap-2">
          <Button onClick={doCopy} size="sm" className={btnCls}>
            Copy
          </Button>
          <Button onClick={doCSV} size="sm" className={btnCls}>
            CSV
          </Button>
          <Button onClick={doExcel} size="sm" className={btnCls}>
            Excel
          </Button>
          <Button onClick={doPDF} size="sm" className={btnCls}>
            PDF
          </Button>
          <Button onClick={doPrint} size="sm" className={btnCls}>
            Print
          </Button>

          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase text-[#69707a]">
              Show
              <select
                value={pageSize === "all" ? "all" : pageSize}
                onChange={(e) => {
                  const v = e.target.value;
                  setPageSize(v === "all" ? "all" : Number(v));
                  setPage(1);
                }}
                className="h-8 border border-[#c5ccd6] rounded px-2 text-xs font-medium text-[#2b3a4a] focus:outline-none focus:ring-1 focus:ring-[#0061f2]"
              >
                {LENGTHS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="all">All</option>
              </select>
              records
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase text-[#69707a]">
              Search:
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-56 h-8 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0 text-xs"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-[#e3e6ec] overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f8f9fc]">
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={
                      "font-bold text-[10px] uppercase text-[#69707a] py-3 h-auto " +
                      (c.className ?? "")
                    }
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="text-center py-10 text-gray-500 text-sm italic"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="text-center py-10 text-gray-500 text-sm italic"
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, idx) => (
                  <TableRow
                    key={rowKey ? rowKey(row, start + idx) : start + idx}
                    className="border-b border-[#f2f4f8] hover:bg-gray-50 transition-colors"
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={"text-xs text-[#2b3a4a] py-3 " + (c.className ?? "")}
                      >
                        {c.cell ? c.cell(row) : (c.value(row) ?? "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-5 py-4 border-t border-[#e3e6ec] bg-[#f8f9fc] flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-bold text-[#69707a] uppercase tracking-wider">
            Showing {total === 0 ? 0 : start + 1} to {end} of {total} entries
          </p>
          <div className="flex">
            <button
              className={pageBtnCls + " rounded-l-md"}
              disabled={safePage === 1}
              onClick={() => setPage(1)}
            >
              First
            </button>
            <button
              className={pageBtnCls + " border-l-0"}
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={
                  "h-8 min-w-8 px-3 text-[11px] font-bold border border-l-0 border-[#e3e6ec] " +
                  (n === safePage
                    ? "bg-[#0061f2] text-white border-[#0061f2]"
                    : "bg-white text-[#69707a] hover:bg-gray-50")
                }
              >
                {n}
              </button>
            ))}
            <button
              className={pageBtnCls + " border-l-0"}
              disabled={safePage === pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
            <button
              className={pageBtnCls + " border-l-0 rounded-r-md"}
              disabled={safePage === pageCount}
              onClick={() => setPage(pageCount)}
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
