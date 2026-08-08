import { describe, expect, it } from "vitest";

import type { ParsedForm, ParsedFormField } from "../domain/entities/form-field";

import { pickBestForm } from "./run-orchestrator";

function field(overrides: Partial<ParsedFormField>): ParsedFormField {
  return {
    selector: "input",
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

/** 会社名・お名前・メール・本文を持つ、ありふれた問い合わせフォーム。 */
function contactForm(overrides: Partial<ParsedForm>): ParsedForm {
  return {
    formSelector: 'form[data-fs-form-idx="0"]',
    frameUrl: null,
    visible: true,
    fields: [
      field({ label: "会社名" }),
      field({ label: "お名前" }),
      field({ label: "メールアドレス", type: "email" }),
      field({ label: "お問い合わせ内容", type: "textarea" }),
    ],
    ...overrides,
  };
}

describe("pickBestForm", () => {
  // 2026-08-08の実障害(ashita-team.com)の回帰テスト。Pardotのフォームが4つiframeで
  // 埋め込まれ、表示中の1つ以外は0x0で畳まれていた。可視性を見ずに項目数で選んでいたため
  // 非表示のフォームが選ばれ、入力は成功するのに人が見ている画面は空のままだった。
  it("同じ内容のフォームが複数あるとき、表示されているものを選ぶ", () => {
    const hidden = contactForm({
      formSelector: "hidden-form",
      frameUrl: "https://go.example.com/l/1/hidden",
      visible: false,
      // 非表示側の方が項目数が多い＝スコアが高い状況を作る。
      fields: [
        ...contactForm({}).fields,
        field({ label: "役職名" }),
        field({ label: "従業員数" }),
      ],
    });
    const shown = contactForm({
      formSelector: "shown-form",
      frameUrl: "https://go.example.com/l/1/shown",
      visible: true,
    });

    expect(pickBestForm([hidden, shown]).formSelector).toBe("shown-form");
  });

  it("表示されているフォームが複数あれば、その中でスコアの高いものを選ぶ", () => {
    const searchWidget: ParsedForm = {
      formSelector: "search",
      frameUrl: null,
      visible: true,
      fields: [field({ name: "q", placeholder: "検索" })],
    };
    const contact = contactForm({ formSelector: "contact" });

    expect(pickBestForm([searchWidget, contact]).formSelector).toBe("contact");
  });

  // 可視性が判定できないケース（レイアウト情報が取れない等）で候補ゼロになると、
  // 送信できるフォームがあるのに何もできなくなる。判定できないだけで塞がない。
  it("1つも可視でない場合は、全件から選ぶ", () => {
    const a = contactForm({ formSelector: "a", visible: false });
    const b = contactForm({
      formSelector: "b",
      visible: false,
      fields: [...contactForm({}).fields, field({ label: "役職名" })],
    });

    expect(pickBestForm([a, b]).formSelector).toBe("b");
  });

  it("フォームが1つならそれを返す", () => {
    const only = contactForm({ formSelector: "only", visible: false });

    expect(pickBestForm([only]).formSelector).toBe("only");
  });
});
