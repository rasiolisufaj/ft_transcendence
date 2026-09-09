"use client";

import { useState } from "react";
import { createDocument } from "./actions";

export default function NewDocumentPage() {
  const [category, setCategory] = useState<"IDENTITY" | "INSURANCE">(
    "IDENTITY",
  );

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Add a Document</h1>

      <form action={createDocument} className="space-y-6">
        {/* Category selector */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Category</legend>
          <div className="flex gap-3">
            {(["IDENTITY", "INSURANCE"] as const).map((cat) => (
              <label
                key={cat}
                className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 text-center text-sm font-medium transition ${
                  category === cat
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={cat}
                  checked={category === cat}
                  onChange={() => setCategory(cat)}
                  className="sr-only"
                />
                {cat === "IDENTITY" ? "Identity Document" : "Insurance"}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Common fields */}
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">
              Title *
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder={
                category === "IDENTITY"
                  ? "e.g. Carte d'identite"
                  : "e.g. Assurance habitation"
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label
              htmlFor="issuingAuthority"
              className="mb-1 block text-sm font-medium"
            >
              Issuing Authority
            </label>
            <input
              id="issuingAuthority"
              name="issuingAuthority"
              placeholder={
                category === "IDENTITY"
                  ? "e.g. Prefecture de Paris"
                  : "e.g. MAIF"
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="issueDate"
                className="mb-1 block text-sm font-medium"
              >
                Issue Date
              </label>
              <input
                id="issueDate"
                name="issueDate"
                type="date"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label
                htmlFor="targetDate"
                className="mb-1 block text-sm font-medium"
              >
                {category === "IDENTITY" ? "Expiry Date" : "Renewal Date"}
              </label>
              <input
                id="targetDate"
                name="targetDate"
                type="date"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
        </div>

        {/* Identity-specific fields */}
        {category === "IDENTITY" && (
          <fieldset className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <legend className="px-2 text-sm font-medium">
              Identity Details
            </legend>
            <div>
              <label
                htmlFor="holderName"
                className="mb-1 block text-sm font-medium"
              >
                Holder Name
              </label>
              <input
                id="holderName"
                name="holderName"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="documentNumber"
                  className="mb-1 block text-sm font-medium"
                >
                  Document Number
                </label>
                <input
                  id="documentNumber"
                  name="documentNumber"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label
                  htmlFor="nationality"
                  className="mb-1 block text-sm font-medium"
                >
                  Nationality
                </label>
                <input
                  id="nationality"
                  name="nationality"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
          </fieldset>
        )}

        {/* Insurance-specific fields */}
        {category === "INSURANCE" && (
          <fieldset className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <legend className="px-2 text-sm font-medium">
              Insurance Details
            </legend>
            <div>
              <label
                htmlFor="coverageType"
                className="mb-1 block text-sm font-medium"
              >
                Coverage Type
              </label>
              <select
                id="coverageType"
                name="coverageType"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="HOME">Home Insurance</option>
                <option value="CAR">Car Insurance</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="insurer"
                  className="mb-1 block text-sm font-medium"
                >
                  Insurer
                </label>
                <input
                  id="insurer"
                  name="insurer"
                  placeholder="e.g. MAIF, AXA"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label
                  htmlFor="policyNumber"
                  className="mb-1 block text-sm font-medium"
                >
                  Policy Number
                </label>
                <input
                  id="policyNumber"
                  name="policyNumber"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="premiumPerYear"
                  className="mb-1 block text-sm font-medium"
                >
                  Annual Premium
                </label>
                <input
                  id="premiumPerYear"
                  name="premiumPerYear"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label
                  htmlFor="anniversaryDate"
                  className="mb-1 block text-sm font-medium"
                >
                  Anniversary Date
                </label>
                <input
                  id="anniversaryDate"
                  name="anniversaryDate"
                  type="date"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
          </fieldset>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Save Document
        </button>
      </form>
    </div>
  );
}
