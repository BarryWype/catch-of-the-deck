# Timestral in Slay the Fish

*Français : [timestral.fr.md](timestral.fr.md)*

How we use Timestral, Mistral's time-series forecaster, on the bot's simulated runs: what it is, how to run it, what it gives back, and how to read the results.

## 1. What Timestral is

Timestral is a pretrained, **zero-shot** forecaster for time series. You give it the past of a series, and it returns a forecast of the next steps without being trained on your data.

- **Probabilistic output.** It returns 21 quantiles per future step, from the 1st to the 99th percentile, not just one number. That gives a band of plausible values, not just a best guess.
- **Several variates at once.** One series can carry several values per step. Ours carries two: Grit share and coins. They are forecast together.
- **Covariates.** It accepts extra signals:
  - *past covariates*: known only up to now, like the Grit lost in the last fight;
  - *known covariates*: also known for the future, like "the next node is the boss".
- **Four sizes:** 5M, 28M, 123M and 209M parameters. All run on a laptop CPU in under a second for our data.
- Code: <https://github.com/mistralai/timestral> (Apache 2.0). Weights: Hugging Face `mistralai/Timestral-*` (modified MIT license).

## 2. How we use it

The question: **from how a run went so far, can we predict how it will go next?** And does a pretrained model do better than a simple lookup in past simulations?

### The pipeline

```
scripts/simulate.ts --trace  ──►  simulation/<name>-trace.csv  ──►  scripts/forecast/experiment.py
   (bot plays seeded runs)          (one row per map node)            (forecasts, scores, charts)
                                                                              │
                                 simulation/forecast/: report.md, results.json, *.png  ◄─┘
```

The logic is in the repo: the `--trace` flag, the experiment script in `scripts/forecast/` with its `requirements.txt`, and this guide. The results are not: the traces, the virtual environment, the model weights and the experiment's outputs all live in `simulation/`, which is git-ignored, so they exist only on the machine that ran them. Every command below runs from the repo root.

1. **The simulator writes the trace.** With `--trace`, `npm run simulate` writes one row per map node once it is resolved: after the fight, shop, event or treasure is fully handled.
2. **The experiment builds the series.** For each run it takes:
   - the steps up to a **checkpoint**: the context;
   - the steps after it: the horizon to forecast.
3. **Four forecasters** each predict the horizon (section 4).
4. **They are scored** against what actually happened. A planted change tests whether the forecasts can flag where a build changed (section 6).

### Trace columns (`<name>-trace.csv`)

| group | columns | meaning |
|---|---|---|
| ids | `schema_version` (= 1), `seed`, `start_build`, `companions`, `step`, `level`, `column`, `node_kind`, `store_kind`, `enemies` | which run, which node. `step` counts from 0 across the run. `column` runs 1–16 per level: mini-boss at 8, boss at 16. `enemies` lists the creature ids for fights, separated by spaces. |
| targets | `alive`, `grit`, `max_grit`, `coins`, `deck_size`, `bucket_n`, `bucket_value` | the run's state once the node is resolved. `bucket_value` is the sum of sell prices. |
| past only | `fights_started`, `fights_won`, `grit_lost_last`, `turns_last`, `escapes_cum`, `caught_cum`, `equipment_n`, `waiting_n` | history so far: counts, and the last fight's Grit lost and turns. |

A run's rows **stop where it ends**: death, boss escape or win. The trace consumes no randomness, so the runs and fights CSVs are byte-identical with or without `--trace`.

### What we forecast

- **Targets** (V = 2):
  - `grit_frac` = `grit / max_grit`, from 0 (dead) to 1 (full);
  - `coins`.
- **Checkpoints:**
  - `kid-mb`: after the kid mini-boss (column 8). Forecast kid columns 9–16, so H = 8. This is the primary checkpoint: most runs are still alive there.
  - `adult`: after the kid boss (column 16). Forecast adult columns 1–16, so H = 16. Few runs get there (30 of 100 in our data).
- **Runs used:** alive at the checkpoint, and the run goes on.
- **Ground truth after a run ends:**
  - after a death, `grit_frac = 0` and coins carried forward. These steps are scored;
  - after a boss escape, the last values are carried forward. These steps are **not** scored.

## 3. How to run it

### One-time setup

```bash
uv venv simulation/.venv --python 3.12
```

```bash
uv pip install --python simulation/.venv/bin/python -r scripts/forecast/requirements.txt
```

The model weights download on first use into `simulation/.hf-cache` (about 1.4 GB for all four sizes).

### Generate the data

The experiment reads three traces:

- `tf-ref`: the reference set;
- `tf-a`: held-out runs on the same build;
- `tf-b`: the same seeds on a changed build.

```bash
npm run simulate -- --runs 300 --seed 1 --trace --out tf-ref
```

```bash
npm run simulate -- --runs 100 --seed 1001 --trace --out tf-a
```

For `tf-b`, make the content change you want to detect, run the command below, then undo the change.

```bash
npm run simulate -- --runs 100 --seed 1001 --trace --out tf-b
```

### Run the experiment

```bash
simulation/.venv/bin/python scripts/forecast/experiment.py
```

It takes a few seconds. You can also open `scripts/forecast/experiment.py` in VS Code: its `# %%` markers make it a notebook, so you can run it cell by cell and inspect the arrays.

### Things to change in `scripts/forecast/experiment.py`

- `PLANTED`: the creature id the planted test looks for in `enemies`.
- `CHECKPOINTS`: the context and horizon (level, column) of each checkpoint.
- The model sizes, in `run()`.

### Using Timestral directly

```python
from timestral import TimestralForecaster

f = TimestralForecaster.from_pretrained("mistralai/Timestral-5M", cache_dir="simulation/.hf-cache")
fc = f.forecast(
    context,                    # (B, V, T): runs × variates × past steps; NaN = missing
    prediction_length=H,
    past_covariates=P,          # optional, (B, C_past, T)
    known_covariates=K,         # optional, (B, C_known, T + H)
)
fc.quantiles        # tensor (B, V, H, 21)
fc.quantile_levels  # (0.01, 0.05, 0.1, 0.15, …, 0.9, 0.95, 0.99)
fc.median           # (B, V, H)
fc.quantile(0.9)    # (B, V, H) at one level
```

- Known-covariate rows that hold only 0 and 1 are treated as indicators.
- `clip_nonnegative=True` is the default: series that were never negative are kept at 0 or above.
- Timestral knows nothing else about the data. It doesn't know Grit is capped at max Grit, or that a run stops at death.

## 4. What it provides: the four forecasters

Each forecaster gives, per run, variate and horizon step, the same 21 quantile levels.

| name | what it is | inputs |
|---|---|---|
| **L**, lookup | the baseline, no model | Reference runs whose Grit share at the checkpoint is in the same quartile. Their realized values at each future step give the quantiles. |
| **T1**, Timestral | targets only | the run's Grit share and coins up to the checkpoint. Run at all four sizes (`T1`, `T1-28M`, `T1-123M`, `T1-209M`). |
| **T2**, Timestral + covariates | 5M | T1, plus past covariates `grit_lost_last`, `fights_won` and `deck_size`, and known covariates `is_miniboss_col`, `is_boss_col` and `level_index` (all knowable from the map layout). |
| **T3**, oracle (leaky) | 5M | T2, plus whether each future node is a fight or a shop, read from the realized trace. Not a fair forecaster: it shows how much knowing the future map would help. |

## 5. How to read the outputs

### Output files (`simulation/forecast/`)

| file | content |
|---|---|
| `report.md` | verdict, metric tables, planted-effect table, choices and caveats |
| `results.json` | every number in the report: run counts, metrics per forecaster, coverage per step, planted shortlists with seeds |
| `fan-<checkpoint>.png` | fan charts of Grit share, L next to T2 |
| `coverage-<checkpoint>.png` | band coverage per horizon step |
| `out-of-band-<checkpoint>.png` | out-of-band score histograms, A vs B |
| `run.log` | the console output of the last run |

### Quantiles and bands

The forecast for one step is 21 values. The 0.5 quantile is the **median**: half the runs should land below it. Pairs of quantiles make **bands**:

- **10–90 band** (the 0.1 and 0.9 quantiles): 80% of real outcomes should fall inside;
- **5–95 band**: 90% should fall inside.

A narrow band is a confident forecast; a wide band, an uncertain one. A forecast is only useful when its bands are **both narrow and honest**.

### Coverage: are the bands honest?

**Coverage** is the share of real outcomes that fell inside a band, over every scored step of every run.

- A **calibrated** 10–90 band covers about 80%, and a 5–95 band about 90%. We accept ±5 points.
- **Too high** (95% for an 80% band): the bands are too wide. The model is honest but vague.
- **Too low** (60% for an 80% band): the bands are too narrow. The model is overconfident, and its "unlikely" outcomes happen often.

In the report, `cov 80` and `cov 90` are for Grit share, and `cov 80 coins` is for coins. The coverage chart shows the same thing per horizon step; the grey zone is the ±5 point target. A curve that drifts with the step tells you the model is calibrated near the checkpoint but not further out, or the reverse.

### Pinball loss: overall accuracy

The **pinball loss** (quantile loss) scores all 21 quantiles at once. Each quantile is penalized when the outcome lands on its wrong side, weighted by its level. It rewards bands that are both narrow and in the right place.

- **Lower is better.** It is only comparable within the same variate: Grit share (0–1) and coins have different scales.
- Rule of thumb: when coverage is fine but pinball is worse, the bands are too wide. When both are bad, the bands are off.

### Death prediction and AUC

Each forecaster gives each run a probability of dying before the end of the horizon.

- **L:** the share of its neighbour runs that died.
- **Timestral:** a **rough proxy**, the share of its 21 quantile levels whose Grit share drops to 0.02 or below at some step. It isn't a real probability.

The **AUC** asks whether runs that died got higher scores than runs that survived. 0.5 is a coin flip; 1.0 separates them perfectly. It needs enough of both groups. At the `adult` checkpoint 29 of 30 runs die, so the AUC there means nothing.

### Fan chart

- The coloured band shows the 5–95 (light) and 10–90 (darker) ranges of the forecasts, and the line their median.
- The grey lines are 10 real runs. They stop when a run ends without dying; after a death they stay at 0.
- The fan is the **population view**: every run's quantiles are pooled, then re-quantiled per step. It shows what the forecaster expects for runs in general, not for one run.

Read it like this:

- Do most grey lines stay inside the band?
- Is the band much wider than the spread of the grey lines?
- Does it go where values are impossible? Timestral's band rising above 1.0 is the clearest sign that it doesn't know Grit is capped.

### The planted-effect test

This tests whether forecasts can **find where a build changed**. `tf-a` and `tf-b` use the same seeds; `tf-b` has one creature made stronger. Their contexts (up to the checkpoint) are identical, so each forecaster gives the same forecast for both. Only the real outcomes differ.

1. **Out-of-band score**, per run: the share of its scored steps whose Grit share falls outside the 5–95 band. 0 means everything was as expected; 1 means every step surprised the model.
2. **Null:** the scores on `tf-a`, the unchanged build. Even there, some runs are surprising.
3. **Shortlist:** `tf-b` runs whose score is above the 95th percentile of the `tf-a` scores. These are the "unusually surprising" runs.
4. **Hit:** a shortlisted run counts as a hit if the planted creature is in the fight at its first out-of-band step, or the step before.
5. **Precision:** the share of shortlisted runs that are hits.

How to read it:

- **Histograms:** if B's bars sit to the right of A's, the change made runs surprising. If the two overlap, nothing was detected. The dashed line is A's 95th percentile.
- **Shortlist size:** about 5% of B runs are expected by chance alone. Only more than that, with hits, points to the change.
- **Precision:** 0% with a tiny shortlist means nothing was found. Check `simulation/forecast/results.json` for which seeds were shortlisted and their first flagged step.
- **Power:** the test can only find a change that the runs meet often enough. Check how many B runs met the planted creature in the horizon (`planted_met` in `simulation/forecast/results.json`).

## 6. What we found (October 2026)

Full numbers are in `simulation/forecast/report.md`, on the machine that ran the experiment. In short:

- **The lookup beats Timestral on Grit.** Its pinball loss is 40–65% lower. Timestral's bands are too wide and go above 1.0, because it doesn't know the cap or how often runs die.
- **Timestral looks better calibrated at `kid-mb` only by being too wide** (86–92% coverage for an 80% target). On coins it is overconfident (43–68%).
- **Covariates add nothing measurable.** T2 and even the leaky T3 score like T1.
- **Model size doesn't help.** 5M to 209M give similar numbers, all in under a second of CPU.
- **No method found the planted creature.** The stronger Asian arowana was met by only 4 of 100 runs, and all 4 died in adult anyway. Detecting it would need far more runs, or a change runs meet often.

Ideas not tried yet:

- clip Timestral's Grit share to [0, 1];
- forecast the change in coins since the checkpoint rather than the coin total;
- use longer contexts by forecasting from later checkpoints in larger simulations.
