import type { Run } from "../domain/entities/run";

/**
 * 並列実行数を上限内に制御するキュー。runFnには必ず「完了まで待つ」版
 * （RunOrchestrator.exploreAndAwaitCompletion）を渡すこと——fire-and-forget版だと
 * 即座に解決してしまい上限が機能しない。EXPLORE（可視タブを持たない探索）専用。
 * FILL（可視タブでの入力）は一覧の行ボタンから1件ずつ手動で開始するため、
 * このプールは使わない——勝手にタブが増えていく体験を避けるため。
 */
export class RunPool {
  private activeCount = 0;
  private readonly queue: string[] = [];

  constructor(
    private readonly runFn: (targetId: string) => Promise<Run>,
    private readonly concurrency: number,
  ) {}

  enqueueMany(targetIds: readonly string[]): void {
    this.queue.push(...targetIds);
    this.pump();
  }

  private pump(): void {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const targetId = this.queue.shift();
      if (targetId === undefined) break;

      this.activeCount += 1;
      this.runFn(targetId)
        .catch((error: unknown) => {
          console.error(`[RunPool] run failed for target ${targetId}:`, error);
        })
        .finally(() => {
          this.activeCount -= 1;
          this.pump();
        });
    }
  }
}
