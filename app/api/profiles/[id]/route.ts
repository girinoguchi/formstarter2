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
  const existing = await getProfileRepository().findById(id, guard.user.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

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
  const existing = await getProfileRepository().findById(id, guard.user.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

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
  const existing = await getProfileRepository().findById(id, guard.user.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await getProfileRepository().remove(id, guard.user.id);
  return NextResponse.json({ ok: true });
}
