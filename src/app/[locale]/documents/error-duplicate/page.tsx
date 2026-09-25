import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

export default async function DocumentFileType({ params }: PageProps<"/[locale]/documents/error-file-type">) {
  const { locale } = await params;

  return (
    <div className="mx-auto max-w-xl pt-12">
      <Card className="border border-red-500/40 bg-red-500/5">
        <h1 className="mb-2 text-2xl font-semibold text-red-500">
          This file type is not accepted
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Only PDF, PNG and JPG files can be uploaded. We check the contents of
          the file, not its name: renaming a file is not enough to make it
          valid.
        </p>

        <div className="space-y-3">
          <Link
            href={`/${locale}/documents/new`}
            className="block w-full rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-red-700"
          >
            Choose another file
          </Link>
          <Link
            href={`/${locale}`}
            className="block w-full rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm hover:bg-zinc-800"
          >
            See my documents
          </Link>
        </div>
      </Card>
    </div>
  );
}
