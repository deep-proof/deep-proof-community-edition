# Chart design and evidence

Choose figures that make a material relationship easier to understand. Normally two to four strong figures suffice for a substantial dossier; fewer or none is appropriate when evidence is insufficient. Never force a quota, produce decorative dashboards, or turn subjective confidence into invented percentages.

## Choose by analytical question

- **Ranked horizontal bars or dot plots:** customer/supplier concentration, revenue by segment, exposure by category. Sort meaningfully and start magnitude bars at zero. Use direct labels and show units.
- **Dumbbell or slope charts:** compare two periods or two source estimates. Match definitions, periods and units first. A disagreement between sources is not a time trend; label it as a source comparison.
- **Waterfall or reconciliation bridge:** reported to adjusted profitability, cash or cost estimates. Use only documented component amounts. Show a visible unreconciled residual when the bridge does not balance; never invent components to close it.
- **Time series and small multiples:** changes across comparable reporting periods or segments. Preserve chronological spacing, highlight material events and show missing periods as gaps. Avoid dual axes and avoid interpolating missing values as observations.
- **Heatmaps:** a genuine matrix of criterion coverage, documented risk ratings or evidence disagreements. Use a labeled categorical legend for qualitative assessments. Mark unknown cells explicitly; do not fabricate numerical scores or thresholds.
- **Scatter plots:** relationships supported by enough observations with comparable definitions. State sample size, axis units and selection limits. A correlation is not causation. Do not fit a trend to a handful of unrepresentative points.
- **Range or interval plots:** source-supported scenario bounds or statistical intervals. Label what the range means. Do not call a scenario range a confidence interval or infer precision from narrative uncertainty.
- **Pareto/concentration views:** ranked drivers plus a cumulative share only when the total denominator is known and consistent. A simple sorted bar chart is preferable when a second scale obscures the message.

Avoid 3D, gauges, radar charts, decorative gradients, pictograms that distort area, crowded pies, unsupported risk quadrants and unlabeled truncated axes. Use a table when exact lookup is the reader's task.

## Professional report style

Use a white background, generous margins, dark slate text and a restrained purple/teal palette consistent with Deep Proof. Reserve amber/red for a defined concern, not decoration. Encode distinctions with labels or shapes as well as color. Keep line widths and typography consistent across all figures. Prefer vector SVG with a viewBox around 1200 × 650–850; chart labels should remain at least 9–10 pt at A4 print width (roughly 18–22 SVG units). Titles should communicate the comparison; captions explain the implication and limitations without exaggeration.

Use light, sparse gridlines. Directly label important observations; abbreviate long labels sensibly and explain them. Leave space for legends, source notes and number labels. Use consistent rounding, currency, period definitions and denominators. Avoid split or cropped legends and ensure no labels overlap. One chart should be readable without relying on color or surrounding prose alone.

## Reproducibility and citations

For every `charts/name.svg` or `.png`, create `charts/name.csv` with the plotted data and an `evidence` column. Every data row must reference valid report footnote labels, separating multiple labels with semicolons. Example:

```csv
label,value,unit,evidence
Management,12,EUR million,e1
Accounts,10,EUR million,e2
```

Keep useful generation code alongside the figure. Label derived values as calculations and explain their formula and source inputs in the report. Qualitative plots must distinguish observed facts from analyst judgment. Use only self-contained static SVG (no scripts, external images/resources, interactive elements or foreignObject) or PNG. Embed each chart with `![Readable description](charts/name.svg)` and an adjacent interpretive caption with evidence footnotes. Reference only files that exist. Run the supplied validator after chart changes.
