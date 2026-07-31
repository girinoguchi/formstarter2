"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

import { useImportCsv } from "../hooks/use-targets";

export function TargetImportForm({
  profileId,
  onImported,
}: {
  profileId: string;
  onImported: (result: { fileName: string; importedCount: number; skippedLineCount: number }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCsv = useImportCsv();

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await importCsv.mutateAsync({ file, profileId });
    onImported({ fileName: file.name, ...result });
    event.target.value = "";
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileSelected}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={importCsv.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        {importCsv.isPending ? "取込中..." : "CSVで一括取込"}
      </Button>
    </>
  );
}
