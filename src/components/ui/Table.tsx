import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

type TableProps = HTMLAttributes<HTMLTableElement>;
export function Table({ className = "", ...props }: TableProps) {
  return <table className={`w-full text-left text-sm ${className}`} {...props} />;
}

type TableHeadProps = HTMLAttributes<HTMLTableSectionElement>;
export function TableHead({ className = "", ...props }: TableHeadProps) {
  return (
    <thead
      className={`border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 ${className}`}
      {...props}
    />
  );
}

type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;
export function TableBody({ className = "", ...props }: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${className}`} {...props} />
  );
}

type TableRowProps = HTMLAttributes<HTMLTableRowElement>;
export function TableRow({ className = "", ...props }: TableRowProps) {
  return (
    <tr className={`hover:bg-zinc-100 dark:hover:bg-zinc-800/60 ${className}`} {...props} />
  );
}

type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement>;
export function TableHeaderCell({ className = "", ...props }: TableHeaderCellProps) {
  return <th className={`px-4 py-3 font-medium ${className}`} {...props} />;
}

type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;
export function TableCell({ className = "", ...props }: TableCellProps) {
  return <td className={`px-4 py-3 ${className}`} {...props} />;
}