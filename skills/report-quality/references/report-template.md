# Rigorous Report Verification

## Decision Implications
State completion (complete, incomplete or triage), confirmed finding count, decision implications and material limitations. Zero confirmed defects is allowed; it is not a universal guarantee. Cite target scope and substantive implications. Refer to finding IDs.

## Mandate and Coverage
Describe the target and version, decision question, entities/periods/sections, audience, dates, temporal basis, profiles, external permissions and materiality. Report actual counts from coverage.json. Distinguish extraction, reading, claim checking and requirement checking. Identify missing originals, annexes and OCR limits.

<!-- role: criteria -->
## Verification Against Criteria
Assess every configured criterion with its stable ID. These assessments describe what the review established about the target, not certification of the review itself. Cite relevant dossier passages and link registers for executed procedural checks.

## Prioritized Findings
List only confirmed or narrowed-confirmed findings, with stable finding markers `<!-- finding: ID -->`, title, defect codes, severity, urgency and confidence. If none survive, say none were identified within the verified scope. Each finding has exactly one detail heading below this chapter.

## Detailed Findings
For each confirmed finding use `<!-- finding-detail: ID -->` followed by a short ### title. Provide object and exact source locator, applicable criterion and source, favorable/contrary evidence, check and result, strongest alternative and its test, impact, separate severity/urgency/confidence reasons, remedy, closure and dependencies. Cite exact evidence using the caller's citation contract. Use narrative and two-column field/details tables; no forced criticism quota.

## Questions and Missing Evidence
Separate unresolved candidates, clarification questions, inaccessible material and optional improvements. Explain which conclusions depend on each missing item. Do not present a question as a confirmed defect.

## Executed Checks and Coverage
Describe executed calculations, comparisons, omission searches, profile checks, serious-finding revisits and independent source-review passes. Link preserved artifacts with relative quality/ paths. Explain failures, skipped work and prerequisites. Coverage counts describe registered work, not probability of correctness.

## Limitations and Completion
State every unmet gate and remaining material uncertainty. Separate an incomplete assessment from the completed execution of checks that legitimately resulted in an unavailable/unverifiable outcome. Do not assert exhaustive correctness or global conformity with insufficient evidence.

## Challenged and Rejected Criticisms
Summarize rejected and narrowed candidates and the evidence that changed the verdict, including appendix clarifications, date/version differences and valid exceptions. Keep the full candidate register even when a detailed rejected register was not requested in prose.
