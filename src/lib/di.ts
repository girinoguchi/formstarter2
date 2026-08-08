import { CsvExportService } from "../application/export-runs";
import { CsvImportService } from "../application/import-targets";
import { RunOrchestrator } from "../application/run-orchestrator";
import { RunPool } from "../application/run-pool";
import { FileScreenshotService } from "../infrastructure/browser/screenshot-service";
import {
  HeadlessPlaywrightSessionManager,
  PlaywrightSessionManager,
} from "../infrastructure/browser/playwright-session-manager";
import { HeuristicBlockDetector } from "../infrastructure/crawler/block-detector";
import { HttpContactPageFinder } from "../infrastructure/crawler/http-contact-page-finder";
import { PlaywrightContactPageFinder } from "../infrastructure/crawler/playwright-contact-page-finder";
import { StaticFormChecker } from "../infrastructure/crawler/static-form-checker";
import { HeuristicConfirmationPageDetector } from "../infrastructure/form/confirmation-page-detector";
import { DomFormParser } from "../infrastructure/form/dom-form-parser";
import { PlaywrightFormFiller } from "../infrastructure/form/form-filler";
import { HeuristicSentPageDetector } from "../infrastructure/form/sent-page-detector";
import { DomValidationErrorParser } from "../infrastructure/form/validation-error-parser";
import { RuleBasedFieldClassifier } from "../infrastructure/llm/rule-based-classifier";
import { ListSearchService } from "../application/list-search";
import { SerperWebSearch } from "../infrastructure/search/serper-web-search";
import { PrismaNgEntryRepository } from "../infrastructure/persistence/prisma-ng-entry-repository";
import { PrismaProfileRepository } from "../infrastructure/persistence/prisma-profile-repository";
import { PrismaRunRepository } from "../infrastructure/persistence/prisma-run-repository";
import { PrismaTargetRepository } from "../infrastructure/persistence/prisma-target-repository";
import { PrismaUserRepository } from "../infrastructure/persistence/prisma-user-repository";
import { env } from "../config/env";
import { prisma } from "./prisma";

// composition root: 具象クラスを組み立てる唯一の場所。
// API route handlers はここ経由でのみ application/infrastructure を取得する。

const targetRepository = new PrismaTargetRepository(prisma);
const ngEntryRepository = new PrismaNgEntryRepository(prisma);
// APIキーが無い環境ではnullのまま。呼び出し側（API route）が503で案内する。
const listSearchService = env.SERPER_API_KEY
  ? new ListSearchService(new SerperWebSearch(env.SERPER_API_KEY))
  : null;
const csvImportService = new CsvImportService(targetRepository, ngEntryRepository);
const profileRepository = new PrismaProfileRepository(prisma);
const runRepository = new PrismaRunRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const headedSessionFactory = new PlaywrightSessionManager();
const headlessSessionFactory = new HeadlessPlaywrightSessionManager();
const screenshotService = new FileScreenshotService();
const httpContactPageFinder = new HttpContactPageFinder();
const playwrightContactPageFinder = new PlaywrightContactPageFinder();
const staticFormChecker = new StaticFormChecker();
const formParser = new DomFormParser();
const fieldClassifier = new RuleBasedFieldClassifier();
const formFiller = new PlaywrightFormFiller();
const validationErrorParser = new DomValidationErrorParser();
const confirmationPageDetector = new HeuristicConfirmationPageDetector();
const sentPageDetector = new HeuristicSentPageDetector();
const blockDetector = new HeuristicBlockDetector();
const runOrchestrator = new RunOrchestrator(
  headedSessionFactory,
  headlessSessionFactory,
  screenshotService,
  runRepository,
  targetRepository,
  httpContactPageFinder,
  playwrightContactPageFinder,
  staticFormChecker,
  formParser,
  fieldClassifier,
  formFiller,
  profileRepository,
  ngEntryRepository,
  validationErrorParser,
  confirmationPageDetector,
  sentPageDetector,
  blockDetector,
);
// FILL（可視タブでの入力）は一覧の行ボタンから1件ずつ手動で開始する方式のため、
// 自動でキューへ投入するプールは持たない（勝手にタブが増えていく体験を避けるため）。
// EXPLORE: 可視タブを持たないため、人間が追う必要がなく高い並列数で回してよい（既定8）。
// CSVインポート直後・URL単体追加直後に自動でここへ投入される。
const explorePool = new RunPool(
  (targetId) => runOrchestrator.exploreAndAwaitCompletion(targetId),
  env.EXPLORE_CONCURRENCY,
);
const csvExportService = new CsvExportService(runRepository);

export function getTargetRepository() {
  return targetRepository;
}

export function getCsvImportService() {
  return csvImportService;
}

export function getProfileRepository() {
  return profileRepository;
}

export function getRunRepository() {
  return runRepository;
}

export function getRunOrchestrator() {
  return runOrchestrator;
}

export function getExplorePool() {
  return explorePool;
}

export function getCsvExportService() {
  return csvExportService;
}

export function getUserRepository() {
  return userRepository;
}

export function getNgEntryRepository() {
  return ngEntryRepository;
}

/** SERPER_API_KEYが未設定ならnull。 */
export function getListSearchService() {
  return listSearchService;
}
