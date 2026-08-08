import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // agent/ もテスト対象。顧客PC上で動くローカルエージェントは
    // 手元で再現しづらい異常系を抱えるため、判断部分をここで担保する。
    include: ["src/**/*.test.ts", "agent/**/*.test.ts"],
  },
});
