"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { startSetup, confirmSetup, type SetupState } from "./actions";

const idle: SetupState = { step: "idle" };

export function SetupTotpForm() {
  const t = useTranslations("security.twoFactor");
  const [state, setState] = useState<SetupState>(idle);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmSetup, idle);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const current = confirmState.step !== "idle" ? confirmState : state;

  async function handleStart() {
    setStarting(true);
    const result = await startSetup();
    setState(result);
    if (result.uri) {
      const QRCode = await import("qrcode");
      const url = await QRCode.toDataURL(result.uri, { width: 256, margin: 2 });
      setQrDataUrl(url);
    }
    setStarting(false);
  }

  if (current.step === "recovery" && current.recoveryCodes) {
    return (
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("recoveryCodes.title")}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("recoveryCodes.description")}
        </p>
        <div className="mt-4 rounded-lg bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-800">
          {current.recoveryCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            navigator.clipboard.writeText(current.recoveryCodes!.join("\n"));
          }}
        >
          {t("recoveryCodes.copy")}
        </Button>
      </div>
    );
  }

  if (current.step === "setup" && current.secret) {
    return (
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("setup.scanQr")}</p>
        {qrDataUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrDataUrl}
            alt="TOTP QR Code"
            className="mx-auto mt-4 rounded-lg"
            width={256}
            height={256}
          />
        )}
        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 break-all">
          {t("setup.manualEntry")}: {current.secret}
        </p>
        <form action={confirmAction} className="mt-6 space-y-4" noValidate>
          <input type="hidden" name="secret" value={current.secret} />
          <Input
            label={t("setup.codeLabel")}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            error={current.error ? t(`errors.${current.error}`) : undefined}
          />
          <Button type="submit" disabled={confirmPending} className="w-full">
            {confirmPending ? t("setup.pending") : t("setup.confirm")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <Button onClick={handleStart} disabled={starting}>
      {starting ? t("setup.pending") : t("setup.start")}
    </Button>
  );
}
