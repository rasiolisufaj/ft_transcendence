"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { AVATAR_TYPES, type AvatarFormState } from "@/lib/users/schemas";
import { uploadAvatar } from "./actions";

const initialState: AvatarFormState = {};
const SIDE = 256;

/**
 * Draws the picture, centre-cropped, onto a 256 × 256 canvas and returns it as a PNG.
 * A 3–12 MB phone photo becomes a few hundred KB (under the 2 MB cap), and its EXIF
 * metadata, GPS included, is dropped. Browsers apply the EXIF orientation when they draw,
 * so a portrait photo comes out upright. Null when the browser cannot decode the file.
 */
async function toSquarePng(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = SIDE;
    canvas.height = SIDE;
    canvas
      .getContext("2d")
      ?.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        SIDE,
        SIDE,
      );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob && new File([blob], "avatar.png", { type: "image/png" });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarForm() {
  const t = useTranslations("profile");
  const [state, formAction, pending] = useActionState(uploadAvatar, initialState);
  const [undecodable, setUndecodable] = useState(false);
  const errorKey = undecodable ? "avatarType" : state.error;

  // With JavaScript, the re-encoded PNG is sent instead of the original. Without it, the
  // form posts the original file and the server's checks still apply.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("avatar");
    if (file instanceof File && file.size > 0) {
      const png = await toSquarePng(file);
      if (!png) {
        setUndecodable(true);
        return;
      }
      data.set("avatar", png);
    }
    setUndecodable(false);
    startTransition(() => formAction(data));
  }

  return (
    // noValidate: an empty submit gets the translated avatarMissing, not the browser's bubble.
    <form action={formAction} onSubmit={onSubmit} className="space-y-3" noValidate>
      <label htmlFor="avatar" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t("avatar.label")}
      </label>
      <input
        id="avatar"
        name="avatar"
        type="file"
        accept={AVATAR_TYPES.join(",")}
        required
        aria-describedby={errorKey ? "avatar-hint avatar-error" : "avatar-hint"}
        aria-invalid={!!errorKey}
        className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
      />
      <p id="avatar-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("avatar.hint")}
      </p>
      {errorKey ? (
        <p id="avatar-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`errors.${errorKey}`)}
        </p>
      ) : state.saved ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {t("avatar.saved")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("avatar.pending") : t("avatar.submit")}
      </Button>
    </form>
  );
}
