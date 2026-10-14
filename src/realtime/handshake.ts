
export function readTicket(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  const url = new URL(path, "http://localhost");
  return url.searchParams.get("ticket");
}
