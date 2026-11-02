// Purely decorative: soft, blurred color fields in the page's own left/right
// margins (beyond the max-w-5xl column), so wide screens don't read as
// lopsided. aria-hidden and pointer-events-none since there is nothing here
// to read or click; hidden below lg, where there is no margin to fill anyway.
export function DashboardDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
      <div className="absolute -left-16 top-4 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -right-24 top-56 size-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -left-10 bottom-0 size-56 rounded-full bg-primary/10 blur-3xl" />
    </div>
  );
}
