import { requireUser } from "@/lib/auth/session";

// Every route in this group is behind a session. requireUser() redirects to
// /login when there is none. This is a convenience, not the security boundary:
// a layout does not stop its page from rendering, and it does not re-run on
// client navigation, so every page, Server Action and route handler that reads
// private data checks the session itself — see §C-4.
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  await requireUser();
  return children;
}
