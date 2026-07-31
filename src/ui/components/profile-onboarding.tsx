"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useActivateProfile, useCreateProfile } from "../hooks/use-profiles";

export function ProfileOnboarding({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const create = useCreateProfile();
  const activate = useActivateProfile();

  async function handleCreate() {
    if (!name.trim()) return;
    const body = await create.mutateAsync(name.trim());
    await activate.mutateAsync(body.profile.id);
    onCreated(body.profile.id);
  }

  const isBusy = create.isPending || activate.isPending;

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-12 pb-20">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FileText size={30} className="text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">はじめましょう</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          送信に使うプロフィールと文面テンプレートをまとめた
          <br />
          「プロジェクト」を作成してください。
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label className="text-sm text-gray-700">プロジェクト名</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 2024年春の新規開拓"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <p className="text-xs text-gray-400">あとで変更できます</p>
        </div>
        <Button className="w-full rounded-lg" disabled={!name.trim() || isBusy} onClick={handleCreate}>
          作成して設定をはじめる →
        </Button>
      </div>
    </div>
  );
}
