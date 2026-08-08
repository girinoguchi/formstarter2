"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ProfileForm } from "../../../src/ui/components/profile-form";
import { ProfileOnboarding } from "../../../src/ui/components/profile-onboarding";
import { ProfileSwitcher } from "../../../src/ui/components/profile-switcher";
import { useProfileList } from "../../../src/ui/hooks/use-profiles";

export default function ProfilePage() {
  const { data: profiles, isLoading } = useProfileList();
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (activeId === null && profiles && profiles.length > 0) {
      const active = profiles.find((p) => p.isActive) ?? profiles[0];
      if (active) setActiveId(active.id);
    }
  }, [activeId, profiles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profiles && profiles.length === 0) {
    return (
      <ProfileOnboarding
        onCreated={(id) => {
          setActiveId(id);
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <div>
        <h1 className="text-xl font-bold text-gray-800">送信内容設定</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          フォーム自動入力に使う既定の会社情報・お問い合わせ内容を設定します。
        </p>
      </div>

      <ProfileSwitcher activeId={activeId} onActiveChange={setActiveId} />

      {activeId && <ProfileForm profileId={activeId} />}
    </div>
  );
}
