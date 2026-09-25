import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

export default function DocumentDuplicate() {
  return (
    <div className="mx-auto max-w-xl pt-12">
      <Card className="border border-red-500/40 bg-red-500/5">
        <h1 className="mb-2 text-2xl font-semibold text-red-500">
          Ce document existe déjà
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Un fichier du même nom est déjà enregistré dans votre espace. Renommez
          votre fichier avant de l'envoyer, ou supprimez l'ancien document.
        </p>

        <div className="space-y-3">
          <Link
            href="/documents/new"
            className="block w-full rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-red-700"
          >
            Choisir un autre fichier
          </Link>
          <Link
            href="/"
            className="block w-full rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm hover:bg-zinc-800"
          >
            Voir mes documents
          </Link>
        </div>
      </Card>
    </div>
  );
}
