import type { ParsedForm } from "../../domain/entities/form-field";
import type { BrowserSession } from "../../domain/ports/browser-session.port";
import type { FormParser } from "../../domain/ports/form-parser.port";

/** ページ内評価で使う抽出結果。frameUrlはあとから呼び出し側で埋める（フレーム内では自分自身のURLを知らないため）。 */
export type ExtractedField = Omit<ParsedForm["fields"][number], "frameUrl">;
export type ExtractedForm = {
  formSelector: string;
  fields: readonly ExtractedField[];
};

/**
 * トップページに加えて、同一ページ内の子フレーム（iframe）も走査する。
 * 日本の企業サイトでは外部フォームサービス（formrun等）をクロスオリジンiframeで
 * 埋め込むケースが多く、hotel-okada.co.jp等の実データで「トップページのform（無関係な
 * 予約検索ウィジェット）を誤って選んでしまう」実バグとして顕在化した。Playwrightは
 * ページJSの同一オリジンポリシーを受けずにiframe内部を操作できるため、
 * BrowserSession側にフレームスコープの概念を持たせることで対応する。
 */
export class DomFormParser implements FormParser {
  async parseForms(session: BrowserSession): Promise<readonly ParsedForm[]> {
    const topLevel = await session.evaluate<ExtractedForm[]>(extractFormsInCurrentDocument);
    const tagged: ParsedForm[] = topLevel.map((form) => ({
      ...form,
      frameUrl: null,
      fields: form.fields.map((field) => ({ ...field, frameUrl: null })),
    }));

    const frameUrls = await session.listFrameUrls();
    const perFrame = await Promise.all(
      frameUrls.map(async (frameUrl) => {
        try {
          const forms = await session.evaluate<ExtractedForm[]>(extractFormsInCurrentDocument, undefined, {
            frameUrl,
          });
          return forms.map((form) => ({
            ...form,
            frameUrl,
            fields: form.fields.map((field) => ({ ...field, frameUrl })),
          }));
        } catch {
          // フレームがナビゲーション中/detach済み等で読めないことがあるが、
          // 1フレームの失敗で探索全体を止めない（他の候補で継続する）。
          return [] as ParsedForm[];
        }
      }),
    );

    return [...tagged, ...perFrame.flat()];
  }
}

/**
 * page.evaluate()に渡す関数そのもの。外部の変数を参照しない自己完結した関数なので、
 * ブラウザへ渡す用途とテスト用途（jsdomへ直接呼び出す）の両方でそのまま使い回せる。
 */
export function extractFormsInCurrentDocument(): ExtractedForm[] {
  function cssEscapeId(value: string): string {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  }

  function labelFor(el: Element): string | null {
    const id = el.getAttribute("id");
    if (id) {
      const labelEl = document.querySelector(`label[for="${cssEscapeId(id)}"]`);
      const text = labelEl?.textContent?.trim();
      if (text) return text;
    }

    const closestLabel = el.closest("label");
    const closestText = closestLabel?.textContent?.trim();
    if (closestText) return closestText;

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const parts = labelledBy
        .split(/\s+/)
        .map((refId) => document.getElementById(refId)?.textContent?.trim())
        .filter((text): text is string => !!text);
      if (parts.length > 0) return parts.join(" ");
    }

    // 昔ながらのtable/dlレイアウト（<tr><td>お名前</td><td><input></td></tr>や
    // <dt>お名前</dt><dd><input></dd>）では、ラベルはinput自身の兄弟ではなく
    // 「inputの親要素」の直前の兄弟（前のtd/dt等）に書かれている。<label>タグも
    // aria属性も無いため、これが無いとお名前・メール等の基本項目まで
    // UNKNOWNになってしまう実バグがあった（oh-ami.com等の実データで確認）。
    // Contact Form 7の<p class="ttl">見出し</p><p class="cnt"><span><input></span></p>
    // のような3階層構造では、ラベルは「親の兄弟」ではなく「祖父母の兄弟」にある
    // （kurashi-no-techo.co.jp等の実データで確認、ご住所欄がUNKNOWNのままになる
    // 実バグがあった）。親→祖父母の順で試し、最初に見つかった候補を使う。
    for (const ancestor of [el.parentElement, el.parentElement?.parentElement]) {
      const prevSibling = ancestor?.previousElementSibling;
      const text = prevSibling?.textContent?.trim();
      if (text && !prevSibling?.querySelector("input, select, textarea")) {
        return text.slice(0, 200);
      }
    }

    // 同意チェックボックスなど、<label>で明示的に紐付けられていないケース
    // （例: <div><input type=checkbox><span>利用規約に同意する<a>詳細</a></span></div>）
    // への最後の手段として、親要素のテキストから他のフォーム部品を除いたものを使う。
    const parent = el.parentElement;
    if (parent) {
      const clone = parent.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input, select, textarea, script, style").forEach((n) => n.remove());
      const text = clone.textContent?.trim();
      if (text) return text.slice(0, 200);
    }

    return null;
  }

  type FieldType =
    | "text"
    | "email"
    | "tel"
    | "url"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio"
    | "button"
    | "submit"
    | "hidden"
    | "other";

  function resolveType(el: Element): FieldType {
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (tag === "button") {
      const buttonType = (el.getAttribute("type") ?? "submit").toLowerCase();
      return buttonType === "submit" ? "submit" : "button";
    }

    const inputType = (el.getAttribute("type") ?? "text").toLowerCase();
    const known: readonly FieldType[] = [
      "text",
      "email",
      "tel",
      "url",
      "number",
      "checkbox",
      "radio",
      "hidden",
      "submit",
    ];
    return (known as readonly string[]).includes(inputType) ? (inputType as FieldType) : "other";
  }

  let fieldIndex = 0;
  const forms = Array.from(document.querySelectorAll("form"));
  const results: ExtractedForm[] = [];

  forms.forEach((form, formIndex) => {
    form.setAttribute("data-fs-form-idx", String(formIndex));
    const formSelector = `form[data-fs-form-idx="${formIndex}"]`;

    const elements = Array.from(form.querySelectorAll("input, textarea, select, button"));

    const fields = elements.map((el) => {
      // React等のクライアントサイド再レンダリングでDOMノードが差し替わると、
      // 後から付与したdata-fs-idx属性は失われセレクタが壊れる（並列実行時の負荷で顕在化した実バグ）。
      // id/nameはコンポーネントの再レンダリングでも維持されるため、あればそちらを優先する。
      const id = el.getAttribute("id");
      const name = el.getAttribute("name");
      const value = el.getAttribute("value");
      const tag = el.tagName.toLowerCase();

      let selector: string;
      if (id) {
        selector = `#${cssEscapeId(id)}`;
      } else if (name && (tag === "input" || tag === "select" || tag === "textarea")) {
        const inputType = (el.getAttribute("type") ?? "").toLowerCase();
        selector =
          (inputType === "radio" || inputType === "checkbox") && value
            ? `${formSelector} [name="${cssEscapeId(name)}"][value="${cssEscapeId(value)}"]`
            : `${formSelector} [name="${cssEscapeId(name)}"]`;
      } else {
        el.setAttribute("data-fs-idx", String(fieldIndex));
        selector = `[data-fs-idx="${fieldIndex}"]`;
      }
      fieldIndex += 1;

      const options =
        el.tagName.toLowerCase() === "select"
          ? Array.from(el.querySelectorAll("option")).map((opt) => ({
              value: opt.getAttribute("value") ?? opt.textContent ?? "",
              label: (opt.textContent ?? "").trim(),
            }))
          : null;

      return {
        selector,
        type: resolveType(el),
        name: el.getAttribute("name"),
        id: el.getAttribute("id"),
        placeholder: el.getAttribute("placeholder"),
        label: labelFor(el),
        required: el.hasAttribute("required"),
        value: el.getAttribute("value"),
        ariaLabel: el.getAttribute("aria-label"),
        autocomplete: el.getAttribute("autocomplete"),
        options,
      };
    });

    results.push({ formSelector, fields });
  });

  return results;
}
