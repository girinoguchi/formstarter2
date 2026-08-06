import { NextRequest, NextResponse } from "next/server";

import { getProfileRepository } from "../../../../src/lib/di";
import { requireSession } from "../../../../src/lib/ownership";

const STRING_FIELDS = [
  "companyName",
  "companyNameKana",
  "lastName",
  "firstName",
  "fullName",
  "lastNameKana",
  "firstNameKana",
  "furigana",
  "department",
  "jobTitle",
  "industry",
  "employeeCount",
  "email",
  "phone1",
  "phone2",
  "phone3",
  "postalCode",
  "address",
  "websiteUrl",
  "inquiryType",
  "inquiryBody",
] as const;

/**
 * 送信内容を書き換えられるのは作成者だけ。割り当てられただけの作業者はGETで読めるが
 * PUT/PATCH/DELETEは403にする——リポジトリ側もownerIdで弾くが、そちらは0件更新に
 * なるだけで成功に見えてしまうため、ここで明示的に落とす。
 */
async function requireOwnerOf(
  id: string,
  userId: string,
): Promise<{ ok: true } | { response: Response }> {
  const profile = await getProfileRepository().findById(id, userId);
  if (!profile) return { response: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (profile.ownerId !== userId) {
    return {
      response: NextResponse.json({ error: "作成者のみ変更できます" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const profile = await getProfileRepository().findById(id, guard.user.id);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const owner = await requireOwnerOf(id, guard.user.id);
  if ("response" in owner) return owner.response;

  const body = await request.json();
  const data = Object.fromEntries(
    STRING_FIELDS.map((field) => [field, typeof body[field] === "string" ? body[field] : ""]),
  ) as Record<(typeof STRING_FIELDS)[number], string>;

  const profile = await getProfileRepository().updateFields(
    id,
    { ...data, consentPolicy: Boolean(body.consentPolicy ?? true) },
    guard.user.id,
  );

  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const owner = await requireOwnerOf(id, guard.user.id);
  if ("response" in owner) return owner.response;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  await getProfileRepository().rename(id, name, guard.user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const owner = await requireOwnerOf(id, guard.user.id);
  if ("response" in owner) return owner.response;

  await getProfileRepository().remove(id, guard.user.id);
  return NextResponse.json({ ok: true });
}
