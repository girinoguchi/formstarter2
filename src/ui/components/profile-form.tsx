"use client";

import { Check, FileText, User } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ProfileFormState {
  companyName: string;
  companyNameKana: string;
  lastName: string;
  firstName: string;
  fullName: string;
  lastNameKana: string;
  firstNameKana: string;
  furigana: string;
  department: string;
  jobTitle: string;
  industry: string;
  employeeCount: string;
  email: string;
  phone1: string;
  phone2: string;
  phone3: string;
  postalCode: string;
  address: string;
  websiteUrl: string;
  inquiryType: string;
  inquiryBody: string;
  consentPolicy: boolean;
}

const EMPTY_STATE: ProfileFormState = {
  companyName: "",
  companyNameKana: "",
  lastName: "",
  firstName: "",
  fullName: "",
  lastNameKana: "",
  firstNameKana: "",
  furigana: "",
  department: "",
  jobTitle: "",
  industry: "",
  employeeCount: "",
  email: "",
  phone1: "",
  phone2: "",
  phone3: "",
  postalCode: "",
  address: "",
  websiteUrl: "",
  inquiryType: "",
  inquiryBody: "",
  consentPolicy: true,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</h3>;
}

const TABS = [
  { key: "profile", label: "プロフィール", icon: User },
  { key: "template", label: "テンプレート", icon: FileText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProfileForm({ profileId }: { profileId: string }) {
  const [form, setForm] = useState<ProfileFormState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/profiles/${profileId}`)
      .then((res) => res.json())
      .then((body: { profile: ProfileFormState | null }) => {
        setForm(body.profile ? { ...EMPTY_STATE, ...body.profile } : EMPTY_STATE);
      })
      .finally(() => setIsLoading(false));
  }, [profileId]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  function set<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setFlash({ kind: "success", message: "保存しました" });
    } catch (error) {
      setFlash({ kind: "error", message: error instanceof Error ? error.message : "保存に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {activeTab === "profile" && (
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionHeader>担当者情報</SectionHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="姓">
                  <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="山田" />
                </Field>
                <Field label="名">
                  <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="太郎" />
                </Field>
                <Field label="氏名（フルネーム）" hint="空欄時は姓＋名から自動入力">
                  <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="山田 太郎" />
                </Field>
                <Field label="部署">
                  <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="営業部" />
                </Field>
                <Field label="役職">
                  <Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="主任" />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader>フリガナ</SectionHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="セイ">
                  <Input value={form.lastNameKana} onChange={(e) => set("lastNameKana", e.target.value)} placeholder="ヤマダ" />
                </Field>
                <Field label="メイ">
                  <Input value={form.firstNameKana} onChange={(e) => set("firstNameKana", e.target.value)} placeholder="タロウ" />
                </Field>
                <Field label="氏名カナ（フル）" hint="空欄時はセイ＋メイから自動入力">
                  <Input value={form.furigana} onChange={(e) => set("furigana", e.target.value)} placeholder="ヤマダ タロウ" />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader>会社情報</SectionHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="会社名">
                  <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
                </Field>
                <Field label="会社名カナ">
                  <Input
                    value={form.companyNameKana}
                    onChange={(e) => set("companyNameKana", e.target.value)}
                    placeholder="カブシキガイシャ..."
                  />
                </Field>
                <Field label="業種">
                  <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="情報通信業" />
                </Field>
                <Field label="従業員数">
                  <Input value={form.employeeCount} onChange={(e) => set("employeeCount", e.target.value)} placeholder="50" />
                </Field>
                <Field label="送信元URL">
                  <Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader>連絡先</SectionHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="メールアドレス">
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="電話番号">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="03"
                      value={form.phone1}
                      onChange={(e) => set("phone1", e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-400">-</span>
                    <Input
                      placeholder="1234"
                      value={form.phone2}
                      onChange={(e) => set("phone2", e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-400">-</span>
                    <Input
                      placeholder="5678"
                      value={form.phone3}
                      onChange={(e) => set("phone3", e.target.value)}
                      className="w-24"
                    />
                  </div>
                </Field>
                <Field label="郵便番号">
                  <Input
                    placeholder="100-0001"
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                  />
                </Field>
                <Field label="住所">
                  <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
              </div>
            </section>

            <div className="flex items-center gap-2">
              <Checkbox
                id="consentPolicy"
                checked={form.consentPolicy}
                onCheckedChange={(checked) => set("consentPolicy", checked === true)}
              />
              <Label htmlFor="consentPolicy" className="text-xs font-normal text-gray-600">
                個人情報保護方針への同意チェックボックスを自動でONにする
              </Label>
            </div>

            <SaveBar isSaving={isSaving} flash={flash} onSave={handleSave} />
          </div>
        )}

        {activeTab === "template" && (
          <div className="space-y-5">
            <Field label="件名" hint="変数: {{company}} {{url}}">
              <Input
                value={form.inquiryType}
                onChange={(e) => set("inquiryType", e.target.value)}
                placeholder="例: 【ご提案】サービスのご紹介"
              />
            </Field>
            <Field label="本文" hint="変数: {{company}}（会社名） {{url}}（サイトURL）">
              <Textarea
                className="h-[260px] min-h-[260px] resize-y"
                value={form.inquiryBody}
                onChange={(e) => set("inquiryBody", e.target.value)}
                placeholder={"例:\n{{company}} 担当者様\n\nはじめまして。〇〇株式会社の山田と申します。\n..."}
              />
            </Field>
            <SaveBar isSaving={isSaving} flash={flash} onSave={handleSave} />
          </div>
        )}
      </div>
    </div>
  );
}

function SaveBar({
  isSaving,
  flash,
  onSave,
}: {
  isSaving: boolean;
  flash: { kind: "success" | "error"; message: string } | null;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
      <Button onClick={onSave} disabled={isSaving} className="rounded-lg">
        {isSaving ? "保存中..." : "保存する"}
      </Button>
      {flash && (
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm",
            flash.kind === "success" ? "text-emerald-600" : "text-destructive",
          )}
        >
          {flash.kind === "success" && <Check size={14} />}
          {flash.message}
        </span>
      )}
    </div>
  );
}
