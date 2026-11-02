import type { ReactNode } from "react";

const SCENES = [
  "drag",
  "loading",
  "cta",
  "chat-typing1",
  "chat-thinking1",
  "chat-answer1",
  "chat-typing2",
  "chat-thinking2",
  "chat-answer2",
];

/**
 * A 24-second loop through real screenshots of the app — not a hand-built
 * mockup, not a video asset. Every scene was captured with Playwright
 * against the running dev server, logged in as a seeded user:
 *
 *   1. dragging a file over the real `/documents/new` dropzone (a genuine
 *      React `dragActive` state, triggered with a real `DragEvent`) — the
 *      cursor/file-name badge is a drawn overlay, composited in so the drag
 *      reads in a still image
 *   2. the real upload in flight (`useFormStatus`'s own progress bar), the
 *      cursor resting on the button it just clicked (ringed, so it's clear
 *      which control fired)
 *   3. the dashboard's real "Parler à l'assistant" button, which only
 *      renders once a document exists — same clicked/ringed cursor
 *   4–9. two full, real round-trips in `/documents/view/[id]`'s chat panel:
 *      the question typed in (not sent yet), the real empty/pulsing
 *      "thinking" state (`Message`'s own streaming indicator, nothing
 *      drawn), then the real streamed answer — twice. The network call
 *      was mocked at the browser level (the API route's own SSE wire
 *      format, deliberately delayed), so the real `Chat`/`Message`
 *      components rendered every state themselves, in sequence.
 *
 * Light and dark captures both exist since the real UI supports both.
 * `.auth-preview-scene-*` (globals.css) crossfade the nine scenes;
 * prefers-reduced-motion there collapses it to one instant pass landing on
 * the final answer.
 */
export function AuthPreviewSlot() {
  return (
    <div aria-hidden="true" className="flex w-full items-center justify-center">
      <LaptopFrame>
        {/* A plain browser-window silhouette inside the screen — a top bar
            and a body, enough to read as a window without pretending to be
            a real screenshot of the browser itself. */}
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </div>

        <div className="relative h-52 bg-background">
          {SCENES.map((name) => (
            <div
              key={name}
              className={`auth-preview-scene-${name} absolute inset-0 flex items-center justify-center p-5`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative static screenshot, not a Next-optimized content image */}
              <img
                src={`/auth-preview/${name}.png`}
                alt=""
                className="max-h-full max-w-full rounded-lg shadow-card dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/auth-preview/${name}-dark.png`}
                alt=""
                className="hidden max-h-full max-w-full rounded-lg shadow-card dark:block"
              />
            </div>
          ))}
        </div>
      </LaptopFrame>
    </div>
  );
}

/**
 * A plain laptop silhouette — a bezel with a camera dot around the screen,
 * a hinge line, and a wider keyboard deck below with a small front notch.
 * Deliberately not a fake macOS/Windows chrome (no keys drawn): just enough
 * shape to read as "a laptop" rather than a screenshot floating in a box,
 * same craft rule as `HowItWorksIllustrations`'s `PhoneFrame`.
 */
function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-sm">
      <div className="mx-3 rounded-t-xl bg-border-strong px-2 pb-2 pt-1.5 sm:mx-6">
        <div className="mb-1.5 flex justify-center">
          <span className="size-1 rounded-full bg-background/60" />
        </div>
        <div className="flex flex-col overflow-hidden rounded-md bg-surface shadow-elevated">{children}</div>
      </div>
      <div className="mx-1 h-1.5 bg-border-strong sm:mx-3" />
      <div className="relative h-4 rounded-b-2xl bg-gradient-to-b from-border-strong to-border-strong/70">
        <span className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-md bg-border" />
      </div>
    </div>
  );
}
