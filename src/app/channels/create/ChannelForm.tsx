"use client";

import Link from "next/link";
import {createChannel} from "./action";

export default function ChannelForm() {
  return (
    <form className="flex flex-col gap-4" action={createChannel}>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Nom du channel
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={50}
          placeholder="ex. : Assurance auto"
          className="rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Description (facultatif)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="De quoi parle ce channel ?"
          className="resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="mt-2 flex gap-3">
        <Link
          href="/channels"
          className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-center text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Annuler
        </Link>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Créer le channel
        </button>
      </div>
    </form>
  );
}
