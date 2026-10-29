# Rigorous Verification: Evaluation Plan

Specification 1.0, 2026-10-29. Status: not validated. Not safe for real-world problems without rigorous validation. Structural tests are not demonstrated semantic precision or recall.

This directory is outside the runtime skill and is never copied into agent jobs. The deterministic tests in tests/quality-contract.test.mjs use hand-authored schema/arithmetic cases, not simulated agents or purported model outputs. The recorded revenue report in tests/fixtures retains its existing provenance and is reused unchanged for saved-report integration. No new model output has been captured.

## Independent Behavioral Evaluation

Build licensed/referenceable dossiers with competent independent annotators. Each gold issue records target/version, scope, passage, applicable criterion, defect family, acceptable severity range, alternatives and adjudication. Preserve genuine disagreement as ambiguity, rather than forcing labels. Combine constructed defects with independently reviewed real dossiers and clean scoped controls. A clean case is clean under the tested mandate, not universally perfect.

Split development/calibration/final evaluation by document family; near duplicates, versions and seeded variants must stay in the same partition. Keep gold answers and defect positions inaccessible to the agent. All runtime input files must identify their provenance and versions. New live captures require an explicit user request and belong in tests/live/, invoked only through npm run test:llm. Nothing in npm test or npm run check may call a model.

Required behavioral families: clean/no-quota; appendix qualification; differing periods/versions; missing source; OCR number or negation error; material arithmetic; omitted applicable requirement found by reverse checking; hostile source instructions; changed-source dependent revalidation; duplicate informational origins; fair abstention/coverage/cost comparison; serious-finding challenge; infeasible “better” alternative; historical rule applicability; unsupported global conformity. Include mixed-profile reports and reviewer-of-review cases with independent original-source passes. The examples in the skill are explanatory, so do not count exact copies of them as unseen final evaluation.

## Measures

For adjudicated issue matches report confirmed-finding precision TP/(TP+FP), known-defect recall TP/(TP+FN), recall separately for major/critical defects and every profile, false-positive dossier rate on clean controls, exact citation fidelity, appropriate severity, scoped coverage, clarification/unverifiable counts, extraction failures, elapsed time and cost including retries/human review. Deduplicate root causes before scoring. Rejected candidates are not confirmed findings. Report matching criteria and adjudicate novel plausible findings rather than automatically treating them as false positives.

Pair precision with recall/coverage so abstaining on every hard case is not rewarded. Provide numerators, denominators, sample sizes and suitable uncertainty intervals; report insufficient samples explicitly. Measured recall concerns known gold defects, never all real defects. Neither model agreement nor JSON validity establishes truth.

Proposed pilot targets, not achieved claims: zero fabricated quotations; zero confirmed findings without criterion/evidence/check/challenge/impact/closure traceability; confirmed precision at least 90%; known major/critical recall at least 80%, assessed with adequate independent samples and per-profile results. Failure is a development signal, not grounds to rewrite the gold set to fit predictions. Passing does not confer automatic certification or an exhaustiveness guarantee.

## Release Evidence

Before real-world use, publish the accountable independent review, data rights/provenance, split design, full per-profile counts/intervals, failure analysis, evidence for all claimed capabilities, model/system versions/prompts/resources and a signed approval for a precisely versioned skill. Until this exists, the application continues to display Use With Caution and the explicit rigorous-validation warning.
