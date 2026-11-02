"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OnlineDot } from "@/components/OnlineDot";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

export default function UiGalleryPage() {
  const t = useTranslations("devUi");
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.button")}</h2>
        <div className="flex gap-3">
          <Button>{t("button.primary")}</Button>
          <Button variant="secondary">{t("button.secondary")}</Button>
          <Button disabled>{t("button.disabled")}</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.googleButton")}</h2>
        <GoogleButton href="#">{t("google")}</GoogleButton>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.card")}</h2>
        <Card>{t("cardContent")}</Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.badge")}</h2>
        <div className="flex gap-3">
          <Badge>{t("badge.neutral")}</Badge>
          <Badge tone="success">{t("badge.success")}</Badge>
          <Badge tone="warning">{t("badge.warning")}</Badge>
          <Badge tone="danger">{t("badge.danger")}</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.avatar")}</h2>
        <div className="flex items-center gap-4">
          <Avatar name="Marie Curie" />
          <Avatar name="amir" size="lg" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.onlineDot")}</h2>
        <div className="flex gap-6">
          <OnlineDot online />
          <OnlineDot online={false} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.input")}</h2>
        <div className="max-w-sm space-y-4">
          <Input label={t("input.email")} type="email" placeholder={t("input.emailPlaceholder")} />
          <Input label={t("input.password")} type="password" error={t("input.passwordError")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.emptyState")}</h2>
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={<Button>{t("empty.action")}</Button>}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.dialog")}</h2>
        <Button onClick={() => setDialogOpen(true)}>{t("dialog.open")}</Button>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t("dialog.title")}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("dialog.body")}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={() => setDialogOpen(false)}>{t("dialog.confirm")}</Button>
          </div>
        </Dialog>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t("sections.table")}</h2>
        <Card className="bg-zinc-50 dark:bg-zinc-900/50">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("table.document")}</TableHeaderCell>
                <TableHeaderCell>{t("table.status")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{t("table.residencePermit")}</TableCell>
                <TableCell><Badge tone="warning">{t("table.expiringSoon")}</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t("table.carInsurance")}</TableCell>
                <TableCell><Badge tone="success">{t("table.valid")}</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </section>

    </div>
  );
}