---
name: review-progress
description: Publish concise evidence-grounded progress updates during Deep Proof reviews and validation repairs.
---

# Review progress

Apply at the beginning of each review or repair cycle, at least once per minute during ongoing work, whenever a live progress checkpoint arrives, after a meaningful group of source checks, and before final validation. Maintain `progress.md` in the analysis folder. The application streams its latest entry to the user. Separate entries with a blank line, `---`, and a blank line. Write complete entries atomically via a temporary file and rename so partial sentences are not displayed.

Each entry is two or three short sentences, at most 100 words:
- State the specific evidence or criterion currently being checked.
- When useful, identify an observation grounded in a named source and page or line range; label unresolved discrepancies as preliminary.
- State the concrete next verification, especially what could resolve uncertainty.

Use the report's language and plain business language. Updates must reflect work actually performed. Do not invent discoveries, percentages, elapsed-time estimates or completion. Avoid repeating generic “analyzing” messages. Do not expose private deliberation, raw tool logs, commands, credentials, internal file paths, agent or model names. Refer to the service only as Deep Proof. Summarize externally verifiable actions and evidence; never narrate hidden reasoning.

A live checkpoint is a reminder within the current task, not a new analysis. Publish the update at the next available tool boundary, then continue from the current work. During a long tool operation, provide the update as soon as control returns; do not interrupt the operation or invent an outcome. If there is no new finding, name the ongoing verification and explain what remains unresolved. Do not reread all evidence just to produce an update. If validation already passed and the task is complete, finish rather than creating extra work.

Before validation, report that evidence references and completeness are being checked. If validation fails, describe the correction in user terms (for example, checking unsupported references), without stack traces. Do not claim the report is published: the application decides that after independent validation.
