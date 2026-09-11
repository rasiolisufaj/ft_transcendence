"use client";

import { useState } from "react";
import { uploadDocument } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewDocumentPage() {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-semibold">Add a Document</h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Upload a document and our AI will identify it for you.
      </p>

      <Card>
        <form action={uploadDocument} className="space-y-6">
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 px-6 py-16 text-center transition hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
          >
            <svg
              className="mb-4 h-10 w-10 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            {fileName ? (
              <span className="text-sm font-medium">{fileName}</span>
            ) : (
              <>
                <span className="text-sm font-medium">
                  Click to choose a file
                </span>
                <span className="mt-1 text-xs text-zinc-400">
                  PDF, image, or scan — max 10 MB
                </span>
              </>
            )}
            <input
              id="file"
              name="file"
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="sr-only"
            />
          </label>

          <Button type="submit" disabled={!fileName} className="w-full">
            Upload
          </Button>
        </form>
      </Card>
    </div>
  );
}
