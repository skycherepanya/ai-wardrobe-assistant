/**
 * Unified E2E Test Runner for AI Wardrobe Assistant PWA
 * Executes Tiers 1-4, reports structured metrics, and exits 0 on full success.
 */

import { registry, type SuiteSummary } from './harness.ts';
import { runTier1Tests } from './tier1_features.test.ts';
import { runTier2Tests } from './tier2_boundaries.test.ts';
import { runTier3Tests } from './tier3_combinations.test.ts';
import { runTier4Tests } from './tier4_scenarios.test.ts';

interface TierMetrics {
  tier: string;
  name: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
}

async function main() {
  console.log('======================================================================');
  console.log('      AI WARDROBE ASSISTANT PWA — E2E TEST TRACK EXECUTION             ');
  console.log('======================================================================\n');

  const overallStart = Date.now();
  const tierSummaries: TierMetrics[] = [];
  let allPassed = true;

  // -------------------------------------------------------------------------
  // Tier 1: Feature Coverage (>=5 tests per feature across 14 features = 70 tests)
  // -------------------------------------------------------------------------
  console.log('▶ [TIER 1] Registering and executing Feature Coverage suite...');
  registry.clear();
  runTier1Tests();
  const tier1Suites = await registry.runAll();
  const tier1Metrics = summarizeTier('Tier 1', 'Feature Coverage (14 Features x 5)', tier1Suites);
  tierSummaries.push(tier1Metrics);
  printTierResults(tier1Metrics, tier1Suites);
  if (tier1Metrics.failed > 0) allPassed = false;

  // -------------------------------------------------------------------------
  // Tier 2: Boundary Value Analysis & Corner Cases (70 tests)
  // -------------------------------------------------------------------------
  console.log('▶ [TIER 2] Registering and executing Boundary Value Analysis suite...');
  registry.clear();
  runTier2Tests();
  const tier2Suites = await registry.runAll();
  const tier2Metrics = summarizeTier('Tier 2', 'Boundary & Corner Cases (14 Features x 5)', tier2Suites);
  tierSummaries.push(tier2Metrics);
  printTierResults(tier2Metrics, tier2Suites);
  if (tier2Metrics.failed > 0) allPassed = false;

  // -------------------------------------------------------------------------
  // Tier 3: Cross-Feature Interactions (15 pairwise tests)
  // -------------------------------------------------------------------------
  console.log('▶ [TIER 3] Registering and executing Pairwise Combinations suite...');
  registry.clear();
  runTier3Tests();
  const tier3Suites = await registry.runAll();
  const tier3Metrics = summarizeTier('Tier 3', 'Cross-Feature Interactions (Pairwise)', tier3Suites);
  tierSummaries.push(tier3Metrics);
  printTierResults(tier3Metrics, tier3Suites);
  if (tier3Metrics.failed > 0) allPassed = false;

  // -------------------------------------------------------------------------
  // Tier 4: Real-World Scenarios (5 multi-step workflows)
  // -------------------------------------------------------------------------
  console.log('▶ [TIER 4] Registering and executing Real-World Scenarios suite...');
  registry.clear();
  runTier4Tests();
  const tier4Suites = await registry.runAll();
  const tier4Metrics = summarizeTier('Tier 4', 'Real-World Scenarios (Multi-Step Workflows)', tier4Suites);
  tierSummaries.push(tier4Metrics);
  printTierResults(tier4Metrics, tier4Suites);
  if (tier4Metrics.failed > 0) allPassed = false;

  // -------------------------------------------------------------------------
  // Final Structured Summary
  // -------------------------------------------------------------------------
  const totalDurationMs = Date.now() - overallStart;
  const totalTests = tierSummaries.reduce((sum, t) => sum + t.total, 0);
  const totalPassed = tierSummaries.reduce((sum, t) => sum + t.passed, 0);
  const totalFailed = tierSummaries.reduce((sum, t) => sum + t.failed, 0);

  console.log('\n======================================================================');
  console.log('                   E2E TEST SUITE EXECUTION SUMMARY                    ');
  console.log('======================================================================');
  console.log('| Tier   | Scope / Category                         | Passed | Failed | Total |');
  console.log('|--------|------------------------------------------|--------|--------|-------|');
  for (const t of tierSummaries) {
    const padName = t.name.padEnd(40, ' ');
    const padPassed = String(t.passed).padStart(6, ' ');
    const padFailed = String(t.failed).padStart(6, ' ');
    const padTotal = String(t.total).padStart(5, ' ');
    console.log(`| ${t.tier} | ${padName} | ${padPassed} | ${padFailed} | ${padTotal} |`);
  }
  console.log('|--------|------------------------------------------|--------|--------|-------|');
  const padOverallPassed = String(totalPassed).padStart(6, ' ');
  const padOverallFailed = String(totalFailed).padStart(6, ' ');
  const padOverallTotal = String(totalTests).padStart(5, ' ');
  console.log(`| TOTAL  | All Tiers (1–4) Comprehensive Test Suite | ${padOverallPassed} | ${padOverallFailed} | ${padOverallTotal} |`);
  console.log('======================================================================');
  console.log(`Total Execution Time: ${totalDurationMs} ms`);
  console.log(`Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`);
  console.log('======================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

function summarizeTier(tier: string, name: string, suites: SuiteSummary[]): TierMetrics {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let durationMs = 0;

  for (const suite of suites) {
    total += suite.total;
    passed += suite.passed;
    failed += suite.failed;
    durationMs += suite.durationMs;
  }

  return { tier, name, total, passed, failed, durationMs };
}

function printTierResults(metrics: TierMetrics, suites: SuiteSummary[]) {
  for (const suite of suites) {
    const statusMark = suite.failed === 0 ? '✓' : '✗';
    console.log(`  ${statusMark} ${suite.name} (${suite.passed}/${suite.total} passed, ${suite.durationMs}ms)`);
    for (const t of suite.tests) {
      if (!t.passed) {
        console.error(`    ❌ [FAIL] ${t.name}: ${t.error?.message}`);
      }
    }
  }
  console.log(`  => ${metrics.tier} Result: ${metrics.passed}/${metrics.total} passed (${metrics.durationMs}ms)\n`);
}

main().catch((err) => {
  console.error('Fatal unhandled error in E2E test runner:', err);
  process.exit(1);
});
