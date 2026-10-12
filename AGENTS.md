# Deep Proof development

Run small, local tests by default with `npm test`; `npm run check` must also stay offline with respect to model providers. Never run tests that call an LLM unless the user explicitly requests that live validation. Prior permission for one live check does not authorize repeated model calls during later development.

Live ALA/Codex tests belong in `tests/live/` and run only through the separate `npm run test:llm` command. Browser checks belong in `tests/browser/` and run separately with `npm run test:browser` when relevant.

Reuse recorded input and actual model output in `tests/fixtures/` for report validation, citation checks and saved-analysis regression tests. Do not regenerate fixtures automatically or introduce simulated AI agents into application execution. Keep the provenance of recorded model output with each fixture. New live captures require the user's explicit request.

Keep the Deep Proof development server running at http://127.0.0.1:4174. The user has authorized restarting it whenever changes require it, without asking again. Verify server health after restarting. Check active analyses and project-type generation first; wait for ongoing work to finish before a routine restart, and avoid starting duplicate server instances.

Use “Analyst Skill” / “Analyst Skills” consistently in user-facing labels and messages. Projects remain the dossiers; their review methodology is an analyst skill.

Use Title Case for multiword UI names, labels and actions (for example Analyst Skill, Reference Files, Review Criteria, Users & Access). Keep identifiers and filenames unchanged.

Write all project-authored content shipped to or served by the server in English: code comments, UI labels and messages, documentation, skills, prompts, reusable methodology, report templates, examples, and operational instructions. Translate Romanian project-authored content before shipping it. Choose Report Language independently for each analysis run, never at skill or global level; new runs default to English. User-selected report languages and their localization resources remain supported; preserve original user documents, exact source quotations, recorded model-output fixtures, and historical reports rather than translating evidence or rewriting provenance.

UI localization: browser UI strings live in key/value dictionaries in `web/i18n/{en,de,fr,it,rm}.js` and are read through `t(key, vars)` from `web/i18n.js`; static text in `web/index.html` uses `data-i18n` / `data-i18n-attr`. English (`en.js`) is the source of truth. Every UI text addition or change must be propagated to all five languages in the same change: German uses Swiss orthography (ss, never ß) and formal Sie; French, Italian and Romansh (Rumantsch Grischun) use formal address. Keep Deep Proof, Community Edition, GPL-3.0 and the product term Analyst Skill untranslated. The UI language (header selector, stored in `localStorage` key `lang`) is separate from the per-run Report Language; never translate prompts, skills, fixtures or user content. `tests/i18n.test.mjs` checks key and placeholder parity. New static files must be added to the `files` whitelist in `server.mjs`.
