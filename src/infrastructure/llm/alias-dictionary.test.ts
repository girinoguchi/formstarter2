import { describe, expect, it } from "vitest";

import type { ParsedFormField } from "../../domain/entities/form-field";

import { RuleBasedFieldClassifier } from "./rule-based-classifier";

function field(overrides: Partial<ParsedFormField>): ParsedFormField {
  return {
    selector: "#f",
    type: "text",
    name: null,
    id: null,
    placeholder: null,
    label: null,
    required: false,
    value: null,
    ariaLabel: null,
    autocomplete: null,
    options: null,
    frameUrl: null,
    ...overrides,
  };
}

async function categoryOf(overrides: Partial<ParsedFormField>) {
  const result = await new RuleBasedFieldClassifier().classify([field(overrides)], {
    hostKey: "test",
    formSignatureHash: "test",
  });
  return result[0]?.category;
}

describe("ラベルが一語の英語フォーム", () => {
  it("ラベル「Name」を氏名として扱う", async () => {
    expect(await categoryOf({ label: "Name", name: "name" })).toBe("FULL_NAME");
  });

  // ラベル要素に必須マーカーが同居する構造（<label>Name <span>Required</span></label>）。
  it("必須マーカーが混ざったラベルでも氏名として扱う", async () => {
    expect(await categoryOf({ label: "Name\n  Required\n", name: "name" })).toBe("FULL_NAME");
    expect(await categoryOf({ label: "お名前（必須）", name: "f1" })).toBe("FULL_NAME");
    expect(await categoryOf({ label: "Name *", name: "f1" })).toBe("FULL_NAME");
  });

  it("ラベル「Post」を役職として扱う", async () => {
    expect(await categoryOf({ label: "Post", name: "post" })).toBe("JOB_TITLE");
  });
});

describe("誤爆しないこと", () => {
  // JOB_TITLEに /\bpost\b/ を足したため、郵便番号系を巻き込まないことを固定する。
  it("Zip / Postal Code は郵便番号のまま", async () => {
    expect(await categoryOf({ label: "Zip / Postal Code", name: "zipcode" })).toBe("POSTAL_CODE");
  });

  it("Post code（スペース区切り）も郵便番号として扱う", async () => {
    expect(await categoryOf({ label: "Post code", name: "zip" })).toBe("POSTAL_CODE");
  });

  it("Postcode / post-code も郵便番号として扱う", async () => {
    expect(await categoryOf({ label: "Postcode", name: "f1" })).toBe("POSTAL_CODE");
    expect(await categoryOf({ label: "Post-Code", name: "f1" })).toBe("POSTAL_CODE");
  });

  // ラベル専用パターンは^name$のような完全一致なので、部分一致で拾ってはいけない。
  it("「Company Name」は会社名のまま（氏名にしない）", async () => {
    expect(await categoryOf({ label: "Company Name", name: "company_name" })).toBe("COMPANY_NAME");
  });

  it("「File name」のような無関係なラベルを氏名にしない", async () => {
    expect(await categoryOf({ label: "File name", name: "file_name" })).toBe("UNKNOWN");
  });

  it("name属性が file_name だけの場合も氏名にしない", async () => {
    expect(await categoryOf({ name: "file_name" })).toBe("UNKNOWN");
  });
});
