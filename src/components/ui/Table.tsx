import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

type TableProps = HTMLAttributes<HTMLTableElement>;
export function Table({ className = "", ...props }: TableProps) {
  return <table className={`w-full text-left text-sm ${className}`} {...props} />;
}

type TableHeadProps = HTMLAttributes<HTMLTableSectionElement>;
export function TableHead({ className = "", ...props }: TableHeadProps) {
  return (
    <thead
      className={`border-b border-border text-xs uppercase text-foreground-muted ${className}`}
      {...props}
    />
  );
}

type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;
export function TableBody({ className = "", ...props }: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-border ${className}`} {...props} />
  );
}

type TableRowProps = HTMLAttributes<HTMLTableRowElement>;
export function TableRow({ className = "", ...props }: TableRowProps) {
  return (
    <tr className={`hover:bg-surface-hover ${className}`} {...props} />
  );
}

type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement>;
export function TableHeaderCell({ className = "", ...props }: TableHeaderCellProps) {
  return <th className={`px-3 py-3 font-medium sm:px-4 ${className}`} {...props} />;
}

type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;
export function TableCell({ className = "", ...props }: TableCellProps) {
  return <td className={`px-3 py-3 sm:px-4 ${className}`} {...props} />;
}