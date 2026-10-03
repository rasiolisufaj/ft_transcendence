type Level = "info" | "warn" | "error";

export function log(level: Level, msg: string, extra: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra });

  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
