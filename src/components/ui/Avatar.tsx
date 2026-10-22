import Image from "next/image";

const sizes = {
  md: { box: "h-10 w-10 text-sm", px: 40 },
  lg: { box: "h-20 w-20 text-2xl", px: 80 },
};

// Up to two initials, from the first two words of the name. [...word] splits by
// character, so a name that starts with an emoji does not show half of it.
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? "")
    .join("");
}

/** The picture when there is one, else the initials. Decorative: the name is always written next to it. */
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
}) {
  const { box, px } = sizes[size];

  if (src) {
    // unoptimized: the bytes come from an authorised API route, not from public/.
    // eager: on a profile it is the Largest Contentful Paint (lazy logs a console warning).
    return (
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        unoptimized
        loading="eager"
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`}
    >
      {initials(name)}
    </span>
  );
}
