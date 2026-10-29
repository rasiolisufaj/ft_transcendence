"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import {
  PhoneFrame,
  UploadIllustration,
  ClassifyIllustration,
  ChatIllustration,
} from "./HowItWorksIllustrations";

const STEP_COUNT = 3;
// Permanent, cross-session opt-out ("ne plus jamais afficher"), scoped per
// account: without the user id, a browser shared between accounts (or just
// reused across signups while testing) would silently hide it for everyone.
const SEEN_KEY_PREFIX = "mespapiers:how-it-works-seen";

function noopSubscribe() {
  return () => {};
}

// Unknown on the server: assume "seen" so the tour never flashes into
// server-rendered HTML — useSyncExternalStore reconciles against the real
// client value right after hydration, with no mismatch warning.
function trueServerSnapshot() {
  return true;
}

// A big, centered walkthrough. `showOnArrival` is the dashboard's own
// total === 0 check: as long as the account has no document, every visit to
// the home page reopens it — unless "don't show again" was checked, which
// wins regardless of document count.
export function HowItWorksDialog({ showOnArrival, userId }: { showOnArrival: boolean; userId: string }) {
  const t = useTranslations("dashboard.howItWorks");
  const router = useRouter();
  const checkboxId = useId();
  const seenKey = `${SEEN_KEY_PREFIX}:${userId}`;
  const hasSeenSnapshot = () => {
    try {
      return localStorage.getItem(seenKey) === "1";
    } catch {
      return false;
    }
  };
  const hasSeenBefore = useSyncExternalStore(noopSubscribe, hasSeenSnapshot, trueServerSnapshot);
  const shouldAutoOpen = showOnArrival && !hasSeenBefore;
  // null = no explicit choice yet this visit: fall back to the computed default.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const open = openOverride ?? shouldAutoOpen;

  const steps = [
    { title: t("step1Title"), body: t("step1Body"), illustration: <UploadIllustration /> },
    { title: t("step2Title"), body: t("step2Body"), illustration: <ClassifyIllustration /> },
    { title: t("step3Title"), body: t("step3Body"), illustration: <ChatIllustration /> },
  ];
  // step is always kept within [1, STEP_COUNT], matching steps' length.
  const current = steps[step - 1]!;

  function close() {
    setOpenOverride(false);
    setStep(1);
    if (dontShowAgain) {
      try {
        localStorage.setItem(seenKey, "1");
      } catch {
        // Nothing to persist to; it will just show again next time.
      }
    }
  }

  function next() {
    if (step < STEP_COUNT) {
      setStep(step + 1);
      return;
    }
    close();
    router.push("/documents/new");
  }

  return (
    <Dialog open={open} onClose={close} title={current.title} size="lg">
        <div className="flex flex-col items-center gap-6">
          <PhoneFrame>{current.illustration}</PhoneFrame>
          <p className="text-center text-base text-foreground-muted">{current.body}</p>
        </div>

        <label htmlFor={checkboxId} className="mt-6 flex items-center gap-2 text-sm text-foreground-muted">
          <input
            id={checkboxId}
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="size-4 rounded border-border-strong accent-primary"
          />
          {t("dontShowAgain")}
        </label>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((_, index) => (
              <span
                key={index}
                className={`size-1.5 rounded-full ${index + 1 === step ? "bg-primary" : "bg-border-strong"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={close}
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              {t("skip")}
            </button>
            <Button type="button" onClick={next}>
              {step < STEP_COUNT ? t("next") : t("cta")}
            </Button>
          </div>
        </div>
    </Dialog>
  );
}
