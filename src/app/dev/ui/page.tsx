import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function UiGalleryPage() {
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
    </div>
  );
}