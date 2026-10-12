# Deep Proof — Contract For Skill Creators

This contract applies to both the integrated creator and externally created skills. A skill describes a human analyst's analytical capability: the decision it supports, the documents it examines, how it evaluates evidence, and the report it produces. The project is the dossier; the user selects the skill separately for each review.

## Instructions For An External Creator

Create an Analyst Skill that can be imported into Deep Proof. Deliver a ZIP containing one SKILL.md at the root or inside a single enclosing directory. Follow the file requirements and report contract below. Explain the purpose, use cases, boundaries, required inputs, methodology, and interpretation of results. Do not assume that the agent has context from previous conversations. Include a Markdown template with chapters suited to the requested capability and concrete guidance for each chapter. Do not impose another skill's structure. Do not include fabricated results or facts about a real project in the reusable methodology. Write the reusable skill package, instructions, and templates in English; the report itself follows the Report Language selected separately for each review run. Do not set a fixed report language in the skill.

## Naming And Identity Conventions

Use three distinct names. The display name is for people; the package slug identifies the external skill; the runtime name is assigned by Deep Proof. Do not use them interchangeably.

| Item | Convention | Example | Enforcement |
| --- | --- | --- | --- |
| Display name | English Title Case, meaningful analytical capability, 1–120 characters. Enter it in Analyst Skill Name during import. | `Supplier Risk Review` | The application requires a nonempty name and limits its length. Title Case is an authoring convention. |
| External `name` in SKILL.md | An unquoted ASCII slug, 1–64 characters: lowercase letters, digits, and single hyphens between words. No spaces, underscores, accents, leading/trailing hyphens, or repeated hyphens. Regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. | `supplier-risk-review` | Required and validated in the YAML frontmatter. |
| External package directory | Use the same slug as `name`. | `supplier-risk-review/` | Creator convention. The importer also accepts SKILL.md at the ZIP root and legacy enclosing-folder names. |
| ZIP filename | Use `<slug>.zip`; an optional release suffix belongs in the ZIP name, not the skill identity. | `supplier-risk-review.zip` or `supplier-risk-review-v1.2.0.zip` | Creator convention. Import requires a `.zip` archive but does not infer identity or version from its filename. |
| Integrated creator output directory | Exactly `generated-skill/`, relative to the supplied job directory. | `generated-skill/SKILL.md` | Required by the integrated validator. |
| Integrated/runtime `name` | Exactly `analysis-type-<typeId>` when the application supplies `input.json.typeId`. The import process assigns this internal name automatically. | `analysis-type-550e8400-e29b-41d4-a716-446655440000` | Required for integrated generation. The historical `analysis-type-` identifier is internal; user-facing terminology is Analyst Skill. |
| Required filenames | Exact case-sensitive paths from the file table below. | `SKILL.md`, `references/report-template.md` | Required. `skill.md` and `Report-Template.md` are not substitutes. |
| Additional files | Use lowercase kebab-case basenames, conventional extensions, and relative links. | `references/risk-thresholds.md`, `scripts/reconcile-deliveries.py` | Creator convention. The importer accepts some legacy underscore/mixed-case names; spaces and unsupported file types are rejected. |
| Criterion IDs | Use `C01`, `C02`, and so on (`C100` after `C99`). Preserve IDs when reordering or clarifying criteria; assign a new ID when meaning changes materially. | `## C01 — Delivery Reliability` | Canonical authoring convention. The parser also accepts legacy criterion formats; duplicate IDs and missing report coverage fail validation. |
| Chapter IDs | Prefer explicit lowercase kebab-case `<!-- section: ID -->` markers, unique within the template. Preserve IDs across title translations and revisions of wording. | `<!-- section: decision-summary -->` | Unique identifiers and report order are validated. Legacy templates may use the heading text as the identifier. |
| Chapter and criterion titles | Short English Title Case in the reusable package. Titles in a generated report follow that run's selected language. | `## Evidence Assessment` | Authoring convention; do not translate stable IDs. |
| Evidence footnotes | Use `e1`, `e2`, and so on; labels are local to one report. | `[^e1]` | Labels may contain ASCII letters, digits, underscores, or hyphens. Definitions, source IDs, line ranges, and quotes are validated. |
| Chart files | Descriptive lowercase kebab-case basename, with matching figure and data basenames. | `charts/revenue-comparison.svg` and `charts/revenue-comparison.csv` | Local SVG/PNG paths and matching CSV evidence are validated. |

Do not include company names, project IDs, dates, language codes, or version numbers in the reusable skill slug unless they are essential to its stable scope. Do not rename the skill for each project or report language. Release suffixes on archives are informational; Deep Proof assigns immutable revision IDs and does not use semantic versions to update an existing skill. Each import creates a new skill record, even if its display name or original slug matches another import.

Use exactly one top-level `name` and one `description` inside the initial YAML frontmatter. `description` must be a nonempty single-line English string of at most 1,024 characters, explaining what the skill analyzes and when to use it. Multiline YAML block values are not supported. Additional metadata is optional and is not an application versioning or access-control mechanism.

```markdown
---
name: supplier-risk-review
description: Review supplier contracts and delivery records to assess reliability, concentration, and contractual exposure.
---

# Supplier Risk Review

Use this skill when reviewing a supplier dossier before onboarding or renewal.
Read [Review Criteria](references/review-criteria.md),
[Review Playbook](references/review-playbook.md),
[Methodology](references/methodology.md), and
[Report Template](references/report-template.md).
```

Recommended external archive layout:

```text
supplier-risk-review.zip
└── supplier-risk-review/
    ├── SKILL.md
    ├── references/
    │   ├── review-criteria.md
    │   ├── review-playbook.md
    │   ├── methodology.md
    │   └── report-template.md
    └── scripts/                       Optional for external imports
        └── reconcile-deliveries.py
```

Use UTF-8 text, preferably LF line endings, `/` in archive paths and relative links, and no absolute filesystem paths. Keep one skill per archive. Do not include other SKILL.md files, a second skill, generated reports, credentials, caches, dependencies, or a copy of the application. Case-sensitive paths must work on Linux.

## Required Import Files

| File | Contents |
| --- | --- |
| `SKILL.md` | YAML frontmatter with `name` and `description`, followed by purpose, applicability, boundaries, inputs, workflow, and links to all core files. The description explicitly identifies the analytical capability. |
| `references/review-criteria.md` | Assessable criteria, each with `## C01 — Short Title`, a unique stable ID, required evidence, tests, justified acceptance conditions, and treatment of uncertainty. The document title and introduction are not criteria. |
| `references/review-playbook.md` | The process for inventory, analysis, comparison, reconciliation, prioritization, and report verification. Explain applicability and handling of insufficient data. |
| `references/methodology.md` | Definitions, formulas, units, assumptions, decision rules, exceptions, and limitations. Separate requirements from examples; do not invent thresholds. |
| `references/report-template.md` | Report chapters in the required order, with `##` headings and guidance below each heading. Mark exactly one chapter with `<!-- role: criteria -->`; all criteria are assessed in this chapter. |

The integrated creator also produces `references/source-map.md`, documenting methodology provenance and coverage of all references, and at least one useful helper in `scripts/`. These are optional for external imports. When included, explain when and how to use them in SKILL.md. A helper must document its inputs, outputs, and limitations and use standard libraries without installation or network access. The server does not execute scripts during import.

## Report Template

Minimal structure example; adapt the chapters to the requested capability:

```markdown
# Analysis Report

<!-- section: decision-summary -->
## Decision Summary

Explain the conclusion, implications, and limitations, with evidence citations.

<!-- role: criteria -->
<!-- section: evidence-assessment -->
## Evidence Assessment

Assess each criterion from review-criteria.md exactly once.

<!-- section: next-actions -->
## Proposed Actions

Prioritize actions based on the findings and explain what information is missing.
```

The template contains between 1 and 40 `##` chapters with unique identifiers. `<!-- section: ID -->` is optional in the template: when omitted, the chapter title becomes its identifier. In the resulting report, the agent places `<!-- section: ID -->` before each `##` heading, preserving the identifier and order; the visible title is translated into the Report Language. `<!-- role: criteria -->` is template metadata, not reader-facing content. Put markers on separate lines before the heading. Use `###` or deeper heading levels for subsections. Do not put chapters inside code blocks.

Instructions below headings guide the author; they are not text to copy into the report. There is no mandatory fixed list of nine chapters. The chapter with the `criteria` role can have any title and position. Interface categories and chapter-order validation come from this template.

A complete nine-chapter example is available in [Example Report Template](example-report-template.md). It covers Executive Assessment, Criterion-by-Criterion Review, Findings, Risks, Contradictions, Missing Evidence, Questions To Ask, Recommendations, and Confidence And Uncertainty. Copy its content to `references/report-template.md` only when those chapters suit the skill. This is an example, not a global mandatory chapter list. Every chapter declared in the selected template is required in that skill's report, in the declared order. Do not silently omit a chapter because evidence is limited; explain the limitation with citations to the relevant source context.

## Document Roles And Editing

| Document | Purpose | Author And Editing Surface |
| --- | --- | --- |
| `SKILL.md` | Entrypoint: scope, routing, instructions, and links. | Creator; inspect the saved version in Skill Files. |
| `references/review-criteria.md` | What must be assessed, identified by stable criterion IDs. | Creator or administrator; Review Criteria supports Preview and Edit Markdown. |
| `references/review-playbook.md` | How to perform the review, in stages. | Creator or administrator; Review Playbook supports Preview and Edit Markdown. |
| `references/methodology.md` | Domain definitions, calculations, assumptions, and decision rules. | Creator; read-only in Skill Files. Regenerate or import a revised package to change supporting methodology. |
| `references/report-template.md` | Which chapters must appear, their order, and chapter-specific authoring guidance. It is not a completed report. | Creator or administrator; Report Template supports Preview and Edit Markdown. |
| `references/source-map.md` | Provenance of the reusable methodology and coverage of design references. | Integrated creator, or external creator when useful; read-only in Skill Files. |
| `references/source-material/*.md` | Preserved methodology-design source extracts. | Application copies uploaded reference extracts. These are not evidence about the review's project. |
| `scripts/*.mjs`, `scripts/*.py` | Documented deterministic helpers for the method. | Creator; read-only in Skill Files. The server does not execute them on import. |
| Reference Files uploads | Material used to design the reusable skill: PDF, DOC, DOCX, PPT, PPTX, TXT, or Markdown. | Administrator uploads and previews them in Reference Files. Changing them requires regeneration. |
| Project Documents | Evidence about the particular project, in the same supported upload formats. | Authorized users upload them in the project's Documents workspace. They are snapshotted for each review. |
| `report.md` | Completed narrative for one review, with evidence citations and any chart embeds. | Review agent; read by chapter in the analysis workspace. It is not edited through Report Template. |
| `report.pdf` | Printable rendering of that review's Markdown, charts, and evidence appendix. | Application, on Download PDF; no second model-generated narrative. |

To view or edit the template, open **Administration → Analyst Skills → select the skill → Report Template**. **Preview** renders the current chapters and their authoring guidance; **Edit Markdown** exposes the exact Markdown and metadata markers. Preview is not a generated review or a PDF layout preview. Switching back to Preview renders your current unsaved text. **Save** validates the template and creates a new skill revision. Future reviews use that revision; already-started and saved reviews retain their snapshot. **Skill Files** shows the saved package, not unsaved editor changes. Regenerate Review Rules replaces the criteria, playbook, template, and supporting methodology with a new generated revision.

## Report Produced By The Skill

The complete report is `report.md`, not JSON or the final chat response. Each chapter must contain substantive analysis. Use prose and tables; the application's current contract does not permit bullet points or numbered lists. Tables have at most two text columns and, when relevant, up to three narrow Low/Medium/High estimate columns. Do not invent scores.

In the chapter with the `criteria` role, write the following for each ID in `criteria.json`:

```markdown
<!-- criterion: C01 -->
### Short Title In The Report Language

<!-- assessment: mixed -->
Explain the assessment and its limitations, supported by citations. [^e1]
```

Allowed assessment values are `supported`, `mixed`, `unsupported`, and `insufficient_evidence`. Assess every criterion exactly once. Do not treat introductory headings as criteria.

Every substantive paragraph, table data row, and chart caption requires citations. Put definitions at the end, using real IDs and exact line ranges from the dossier sources:

```markdown
[^e1]: [Source Title](sources/DOCUMENT_ID.md#L2-L3)
    > Exact quotation from the indicated lines.
```

Skill references explain the method; they are not evidence about the dossier. Do not browse the internet or modify sources. Distinguish source claims from independent verification; cite both sides of contradictions. Limit missing-evidence claims to the material actually reviewed. Explain uncertainty without inventing facts.

Save optional charts in `charts/` as SVG/PNG, with CSV data and supporting evidence, and embed them using `![Caption](charts/name.svg)`. Follow the standard `evidence-review` and `review-progress` skills supplied by the application. Run `node validate-output.mjs`, fix errors, and repeat until validation passes. Structural validation does not prove the logical relevance of citations; the agent must review relevance explicitly.

## Review Output Directory And File Ownership

The application chooses the review working directory before invoking the agent. With the default data directory, its host path is:

```text
.runtime/projects/<project-id>/analyses/<analysis-id>/
```

`ANALYST_DATA_DIR` may replace `.runtime/`. Inside the agent job, use relative paths from the supplied working directory. Do not construct a second project folder, write to the skill package, or choose a different filename for the main report. Write exactly `report.md` at the job root. Each analysis ID has its own directory; different skill or language selections never overwrite another review.

```text
<analysis-id>/
├── report.md                         Required agent output: complete report
├── progress.md                       Agent output: brief progress updates
├── charts/                           Optional agent outputs, only if used
│   ├── revenue-comparison.svg        Figure; PNG is also supported
│   └── revenue-comparison.csv        Matching data with evidence column
├── report.pdf                        Application output, created on PDF export
├── report.html                       Application-generated print rendering
├── report.pdf.sha256                 Application-managed PDF cache fingerprint
├── report-template.md                Read-only snapshot of selected template
├── review-criteria.md                Read-only snapshot of selected criteria
├── review-playbook.md                Read-only snapshot of selected workflow
├── criteria.json                     Canonical criterion IDs and instructions
├── input.json                        Run metadata, language and skill snapshot
├── evidence-lines.json               Source IDs and numbered source text
├── output-contract.json              Output kind and primary artifact name
├── sources/                          Immutable project-evidence snapshot
│   ├── index.md                      Application-generated evidence inventory
│   ├── <document-id>.md              Extracted text used for exact citations
│   ├── <document-id>.pdf             Original PDF, when applicable
│   └── <document-id>.preview.pdf     Converted Office preview, when applicable
├── skills/                           Supplied standard skills and skill revision
├── validate-output.mjs               Supplied validation entrypoint
└── validation/                       Supplied validator code and resources
```

Original Office or text uploads may also be present under `sources/<document-id>.<extension>`. Use real document IDs from `input.json` and line numbers from the source Markdown/evidence metadata. Do not cite `sources/index.md`, methodology references, or the template as factual evidence about the project.

The agent creates `report.md`, maintains `progress.md`, and creates referenced charts and matching CSV data when appropriate. It must not create or alter PDF exports, source snapshots, input metadata, skill snapshots, templates, criteria, or validators. Helper scratch outputs are not report deliverables and must not substitute for report.md.

The application also writes execution/configuration files and validation diagnostics such as `validation-result.json` or `validation-errors.json`. These are operational artifacts, not reader-facing reports. JSON is used for metadata and validation only; a JSON report or chat response cannot replace report.md. DOCX and PPTX report exports are not currently part of the output contract. Input-format support does not imply output-format support.

A completed review is published only after the report and its referenced chart files pass validation. PDF files do not need to exist when the agent finishes: Download PDF renders and caches them on demand. The interface reads the report's `##` chapters as separate sections while preserving one Markdown report. It displays evidence links and charts from that same review folder. A failed review may retain diagnostic or partial files, but these are not published as a completed report.

## Import, Versions, And Storage

The archive is limited to 20 MB compressed, 100 MB expanded, and 2,000 entries. Use text and code files supported by the application, without symlinks, `../` traversal, encrypted archives, or binaries. Core files are limited to 2 MB each; criteria, playbook, and template files are each limited to 100,000 characters. An incomplete package is rejected with a message identifying the missing file; the application does not guess the methodology.

Import does not call a model. The application checks packaging and the structural contract; the agent reads SKILL.md, methodology, criteria, playbook, and template during the review. This supplies the necessary context but does not automatically certify the quality of the method. The administrator inspects imported files in Skill Files.

Each review saves the skill name, ID, revision, template, and sources in its own `.runtime/projects/<project-id>/analyses/<analysis-id>/` directory. Later skill changes do not rewrite saved reports. The interface separates chapters from the same `report.md`; the PDF renders that Markdown report, charts, and citations without a second AI generation.

## Verification And Demo Only Status

Every imported skill is **Demo Only** unless its package contains a valid `verification-certificate.md` at the skill root, next to `SKILL.md`. Reports produced with a Demo Only skill are labelled DEMO ONLY from the moment the analysis starts, in the application and on every PDF page. The full standard, including why every skill must be scientifically evaluated and how to run the evaluation, is in `docs/skill-verification.md` and in the application under Documentation.

The certificate is written by an accountable reviewer after a scientific evaluation, never by the skill creator and never by an AI system. It starts with YAML frontmatter containing `verified_by` (person, role and organization), `verified_on` (`YYYY-MM-DD`, not in the future) and `evaluation_cases` (a positive whole number); `model` is optional. Its body contains the sections `## Scope`, `## Evaluation Dataset`, `## Method`, `## Results` and `## Limitations`. A malformed certificate makes the import fail. Deep Proof checks structure only; the truth of the attestation is the responsibility of the named reviewer.

Verification applies to one exact methodology. Saving changes to Review Criteria, Review Playbook or Report Template, changing reference files or regenerating the skill creates a Demo Only revision. Renaming keeps verification. Evaluation assets may be shipped under `evals/` as Markdown, JSON or CSV files.
