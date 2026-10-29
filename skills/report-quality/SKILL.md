---
name: report-quality
description: Rigorously assess an existing report or decision against a reference dossier, validate claims and material omissions, challenge candidate criticisms, and produce reproducible findings with explicit coverage and limitations.
---

# Rigorous Report and Decision Verification

Specification: 1.0, 2026-10-29. This skill has not been validated and is not safe for real-world problems without rigorous validation. Proposed evaluation thresholds are project targets, not demonstrated performance. No finite review guarantees discovery of every defect.

This package is self-contained: its references and scripts use only the Python and Node standard libraries. Do not depend on Deep Proof being installed. Work in a private temporary directory; never change the target, reference originals, mandate or supplied validators. In Deep Proof, the caller creates and removes this directory, snapshots the skill and sources, streams progress and publishes validated artifacts. Standalone, run `node /path/to/report-quality/scripts/prepare.mjs /path/to/input.json` to create a temporary workspace, then work there. See [Data Contracts](references/contracts.md) for input and output formats and completion gates. Preserve output artifacts before removing a standalone workspace.

## Establish the Mandate

Identify the target document and version, reviewed entities/sections/periods, decision question, audience, deadline and consequences. Distinguish report dates, covered periods, decision date, evaluation date and the information available at the decision. Do not widen a partner-specific review to the whole consortium. Use user-supplied criteria within their stated scope; record unresolved authority conflicts without inventing a hierarchy. Clarify ambiguities that change the verdict, or provide conditional conclusions. Record other assumptions and continue independent work.

Default to a deep, closed-dossier review. Triage must be labelled and cannot conclude complete verification. Historical review uses the specified information cutoff; later evidence can support an update, not hindsight condemnation. External research requires explicit authorization in the mandate; otherwise do not browse or fill gaps from memory. Date and retain external sources and their applicable versions separately. Authorization to research does not authorize disclosure of confidential dossier contents, active security testing, production changes, paid experiments or new model calls.

## Execute the Common Protocol

Read [Common Protocol](references/protocol.md), [Defect Taxonomy](references/taxonomy.md) and [Data Contracts](references/contracts.md). Read the applicable sections of [Domain Profiles](references/profiles.md); record activation reasons and combine profiles for mixed reports. Profiles add tests; they do not invent mandatory domain standards.

Inventory and hash sources, versions and dependencies. Verify extraction against originals, including tables, notes, appendices, comments, tracked changes and spreadsheet formulas where available. Missing, corrupt, unreadable or unrendered material stays visible. A parser failure or OCR uncertainty is a limitation, never a negative semantic result. Material quoted passages must be checked against available originals; if that cannot be done, record the limitation and narrow the finding. Generated text originals can be checked directly. Extracted Office/PDF text alone is not proof of a visual check. Record physical and printed pages separately where known; retain stable line ranges, paragraph IDs, quotes and source hashes.

Build material claim, requirement, evidence and dependency registers. Preserve populations, periods, conditions, modality and quantifiers. Distinguish observation, interpretation, hypothesis, target, forecast, recommendation and executed activity; keep prototype, implementation, integration, testing, validation and acceptance separate. Trace conclusions backwards to premises and requirements forwards to coverage. Inspect the original sources again when confirming findings; intermediate summaries do not replace them.

Check citation existence, contextual fit, primary provenance, circular sourcing, source independence, measurement strength and inference. Seek contrary evidence, negative results, exceptions and appendix qualifications. A source saying something establishes attribution, not the truth of the claim. Distinguish contradicted, insufficiently supported, ambiguous and unverifiable claims. Inaccessible links are not automatically fabricated. Explain observable premises, applied rule/calculation and permitted conclusion; private internal deliberation is unnecessary.

Actively search material omissions using justified expectations, relevant synonyms, tables, notes, appendices, hidden prerequisites, excluded cases, feasible alternatives and displaced costs. Record where you searched, what you found and the causal impact of absence. “Not identified in the listed accessible sections and annexes” is the default absence wording. A requirement found in an appendix defeats an omission criticism. A desirable practice is not automatically an obligation.

Challenge every candidate against the strongest text-supported explanation favorable to the author: dates, definitions, scope, rounding, versions, exceptions and annexes. Re-execute its test, verify criterion applicability at the relevant time, and separate existence, severity, urgency and confidence. Reject, narrow or request clarification when the criticism does not survive. Keep rejected candidates and reasons. Revisit major/critical findings in original evidence in a distinct final pass; another agent is optional and agreement between models is not evidence. Do not repeat identical searches to fill a finding quota.

For material numbers, use [Numerical Checks](references/numerical.md) and `scripts/check_numbers.py`. It recalculates declared arithmetic using Decimal without evaluating supplied code; it does not decide whether the chosen formula is conceptually appropriate. Inspect formulas separately, state units, denominators, missing-data rules and rounding tolerances, and preserve command, inputs and result in checks.jsonl. Run domain code or experiments only with appropriate resources and authorization, in isolation.

## Report and Validate

Write the registers in `quality/` and the narrative in `report.md`, following [Report Template](references/report-template.md). Each confirmed finding needs a stable ID, exact object, applicable criterion, favorable and contrary evidence, reproducible check, contested alternative, contextual impact, distinct severity/urgency/confidence, minimum remedy, closure test and dependencies. Consolidate manifestations of one root cause unless cause or remedy differs. See [Examples](references/examples.md) for false-positive controls.

Zero confirmed findings is valid. Separate improvement suggestions, open questions and unknowns from confirmed defects. Do not infer a bad decision solely from a bad outcome, or correctness solely from a favorable outcome. No global conformity claim is allowed when criteria or coverage are insufficient. Exhausted budgets and unresolved required checks produce an explicitly incomplete review with useful findings, never a blanket pass.

Run `node /path/to/report-quality/scripts/validate.mjs WORKSPACE` and repair structural, reference, quotation and coverage errors. In Deep Proof also run `node validate-output.mjs`, which validates narrative citations and the integrated report contract. Do not edit validators to make output pass. A structural pass is not semantic certification; review relevance, justified impact and honest coverage separately. Export report.md, quality/ records and referenced check artifacts. Report the actual completion state and limitations. Evaluation materials and answer keys must remain outside this package and outside agent workspaces.

## Integration Resources

[Review Criteria](references/review-criteria.md), [Review Playbook](references/review-playbook.md), [Methodology](references/methodology.md) and [Source Map](references/source-map.md) package the procedure for callers that import Analyst Skills. `scripts/prepare.mjs` prepares trusted inputs, `scripts/validate.mjs` validates records and `scripts/check_numbers.py` replays declared arithmetic. `scripts/io.mjs` is the shared safe file/JSON/hash library used by those helpers; it is imported automatically and is not a separate command. These resources contain no evaluation answer keys.
