"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

export default function UiGalleryPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <h1 className="text-2xl font-semibold">UI Gallery</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">Button</h2>
        <div className="flex gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">Card</h2>
        <Card>Card content</Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">Badge</h2>
        <div className="flex gap-3">
          <Badge>Neutral</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Input</h2>
        <div className="max-w-sm space-y-4">
          <Input label="Email" type="email" placeholder="you@example.com" />
          <Input label="Password" type="password" error="Password must be at least 8 characters" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">EmptyState</h2>
        <EmptyState
          title="No documents yet"
          description="Upload your first document to get started."
          action={<Button>Add Document</Button>}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Dialog</h2>
        <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Confirm action">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to do this?
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
          </div>
        </Dialog>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Table</h2>
        <Card className="bg-zinc-50 dark:bg-zinc-900/50">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Titre de séjour</TableCell>
                <TableCell><Badge tone="warning">Expiring Soon</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Assurance auto</TableCell>
                <TableCell><Badge tone="success">Valid</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </section>

    </div>
  );
}