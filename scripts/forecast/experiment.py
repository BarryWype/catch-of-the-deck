# %% [markdown]
# # Timestral on Slay the Fish bot runs
# Forecast a run's Grit share and coins over the next map steps from its history, with
# Timestral (zero-shot) and a lookup baseline built from a reference simulation.
# Run as a script (`simulation/.venv/bin/python scripts/forecast/experiment.py`) or cell by
# cell in VS Code. Inputs: simulation/tf-{ref,a,b}-trace.csv (`npm run simulate -- --trace`);
# outputs go to simulation/forecast/ (git-ignored). Guide: docs/timestral.md.

# %%
import json
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from timestral import TimestralForecaster

SIM = Path(__file__).resolve().parents[2] / "simulation"
OUT = SIM / "forecast"
OUT.mkdir(parents=True, exist_ok=True)
CACHE = SIM / ".hf-cache"
PLANTED = "asianArowana"
LEVELS = ["kid", "adult", "elder"]
COLS = 16  # each level's nodes are columns 1..16: mini-boss 8, boss 16
QL = np.array([0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99])
I = {q: i for i, q in enumerate(np.round(QL, 2))}
COLORS = {"L": "#2a78d6", "T1": "#eb6834", "T2": "#1baf7a", "T3": "#eda100", "A": "#2a78d6", "B": "#eb6834"}

# Checkpoints: the last kid step (forecast all of adult) or the kid mini-boss (forecast the rest of kid).
CHECKPOINTS = {
    "adult": {"ctx": [("kid", c) for c in range(1, COLS + 1)], "hor": [("adult", c) for c in range(1, COLS + 1)]},
    "kid-mb": {"ctx": [("kid", c) for c in range(1, 9)], "hor": [("kid", c) for c in range(9, COLS + 1)]},
}


def load(name):
    df = pd.read_csv(SIM / f"{name}-trace.csv", keep_default_na=False)
    df["grit_frac"] = df.grit / df.max_grit
    df["level_index"] = df.level.map(LEVELS.index)
    return {seed: g.set_index(["level", "column"]) for seed, g in df.groupby("seed")}


# %% [markdown]
# ## Panels
# One panel per run alive at the checkpoint whose run goes on: context arrays over the context
# steps, and the realized horizon. After a death, Grit share 0 and coins carried (scored); after
# the run ends otherwise (boss escaped, stalled), last values carried and not scored.


# %%
def panel(runs, cp):
    ctx, hor = CHECKPOINTS[cp]["ctx"], CHECKPOINTS[cp]["hor"]
    out = []
    for seed, g in runs.items():
        if not all(k in g.index for k in ctx) or g.loc[ctx[-1], "alive"] != 1 or hor[0] not in g.index:
            continue
        c = g.loc[ctx]
        died = g.alive.min() == 0
        y, scored, enemies, fight, shop = [], [], [], [], []
        last = c.iloc[-1]
        dead_at = None
        for h, k in enumerate(hor):
            if k in g.index:
                last = g.loc[k]
                y.append([last.grit_frac, last.coins])
                scored.append(True)
                enemies.append(last.enemies.split())
                fight.append(float(last.node_kind in ("fight", "miniBoss", "boss")))
                shop.append(float(last.node_kind == "shop"))
                if last.alive == 0:
                    dead_at = h
            else:
                y.append([0.0 if died else last.grit_frac, last.coins])
                scored.append(died)
                enemies.append([])
                fight.append(0.0)
                shop.append(0.0)
        out.append(
            dict(
                seed=seed,
                ctx_y=c[["grit_frac", "coins"]].to_numpy(float).T,
                ctx_past=c[["grit_lost_last", "fights_won", "deck_size"]].to_numpy(float).T,
                ctx_fight=c.node_kind.isin(["fight", "miniBoss", "boss"]).to_numpy(float),
                ctx_shop=(c.node_kind == "shop").to_numpy(float),
                y=np.array(y).T,
                scored=np.array(scored),
                enemies=enemies,
                hor_fight=np.array(fight),
                hor_shop=np.array(shop),
                dies=dead_at is not None,
            )
        )
    return out


def known_layout(cp, n):
    cols = [c for _, c in CHECKPOINTS[cp]["ctx"] + CHECKPOINTS[cp]["hor"]]
    lvl = [LEVELS.index(l) for l, _ in CHECKPOINTS[cp]["ctx"] + CHECKPOINTS[cp]["hor"]]
    rows = np.array([[c == 8 for c in cols], [c == 16 for c in cols], lvl], dtype=np.float32)
    return np.broadcast_to(rows, (n, 3, len(cols))).copy()


# %% [markdown]
# ## Forecasters
# Each returns quantiles shaped (runs, 2 variates, H, 21).


# %%
def lookup(ref, test):
    """Neighbours: reference runs in the same checkpoint Grit-share quartile; their realized horizon values."""
    ref_g = np.array([r["ctx_y"][0, -1] for r in ref])
    edges = np.quantile(ref_g, [0.25, 0.5, 0.75])
    ref_b = np.digitize(ref_g, edges)
    ref_y = np.stack([r["y"] for r in ref])
    ref_dies = np.array([r["dies"] for r in ref])
    q, pdie = [], []
    for r in test:
        mask = ref_b == np.digitize(r["ctx_y"][0, -1], edges)
        q.append(np.moveaxis(np.quantile(ref_y[mask], QL, axis=0), 0, -1))
        pdie.append(ref_dies[mask].mean())
    return np.array(q), np.array(pdie)


_models = {}


def timestral(size, test, cp, covariates="none"):
    if size not in _models:
        _models[size] = TimestralForecaster.from_pretrained(f"mistralai/Timestral-{size}", cache_dir=CACHE)
    H = test[0]["y"].shape[1]
    kw = {}
    if covariates != "none":
        kw["past_covariates"] = np.stack([r["ctx_past"] for r in test]).astype(np.float32)
        known = known_layout(cp, len(test))
        if covariates == "oracle":
            fight = np.stack([np.concatenate([r["ctx_fight"], r["hor_fight"]]) for r in test])
            shop = np.stack([np.concatenate([r["ctx_shop"], r["hor_shop"]]) for r in test])
            known = np.concatenate([known, fight[:, None], shop[:, None]], axis=1).astype(np.float32)
        kw["known_covariates"] = known
    ctx = np.stack([r["ctx_y"] for r in test]).astype(np.float32)
    t0, c0 = time.perf_counter(), time.process_time()
    fc = _models[size].forecast(ctx, prediction_length=H, **kw)
    secs = (time.perf_counter() - t0, time.process_time() - c0)
    assert tuple(np.round(fc.quantile_levels, 2)) == tuple(np.round(QL, 2))
    return fc.quantiles.numpy(), secs


def p_death_proxy(q):
    """Rough proxy: share of quantile levels whose Grit share is <= 0.02 at some horizon step."""
    return (q[:, 0].min(axis=1) <= 0.02).mean(axis=1)


# %% [markdown]
# ## Metrics


# %%
def coverage(q, y, scored, lo, hi, v=0):
    inside = (y[:, v] >= q[:, v, :, I[lo]]) & (y[:, v] <= q[:, v, :, I[hi]])
    per_step = np.array([inside[scored[:, h], h].mean() if scored[:, h].any() else np.nan for h in range(y.shape[2])])
    return inside[scored].mean(), per_step


def pinball(q, y, scored, v):
    d = y[:, v, :, None] - q[:, v]
    loss = np.maximum(QL * d, (QL - 1) * d).mean(axis=-1)
    return loss[scored].mean()


def auc(score, label):
    pos, neg = score[label], score[~label]
    if not len(pos) or not len(neg):
        return np.nan
    return ((pos[:, None] > neg[None]).sum() + 0.5 * (pos[:, None] == neg[None]).sum()) / (len(pos) * len(neg))


def out_of_band(q, test):
    """Per run: share of scored steps whose Grit share falls outside 5–95, and the first such step."""
    y = np.stack([r["y"] for r in test])
    s = np.stack([r["scored"] for r in test])
    out = ((y[:, 0] < q[:, 0, :, I[0.05]]) | (y[:, 0] > q[:, 0, :, I[0.95]])) & s
    score = out.sum(1) / np.maximum(1, s.sum(1))
    first = np.array([np.argmax(o) if o.any() else -1 for o in out])
    return score, first


# %% [markdown]
# ## Run


# %%
def run(cp):
    ref, a, b = (panel(load(n), cp) for n in ("tf-ref", "tf-a", "tf-b"))
    assert [r["seed"] for r in a] == [r["seed"] for r in b]
    assert all(np.array_equal(x["ctx_y"], z["ctx_y"]) and np.array_equal(x["ctx_past"], z["ctx_past"]) for x, z in zip(a, b))
    print(f"[{cp}] runs alive at the checkpoint: ref {len(ref)}, A {len(a)}, B {len(b)}; B runs whose horizon differs from A: "
          f"{sum(not np.array_equal(x['y'], z['y']) for x, z in zip(a, b))}")
    y = np.stack([r["y"] for r in a])
    scored = np.stack([r["scored"] for r in a])
    dies = np.array([r["dies"] for r in a])

    fc, timing, pdie = {}, {}, {}
    t0, c0 = time.perf_counter(), time.process_time()
    fc["L"], pdie["L"] = lookup(ref, a)
    timing["L"] = (time.perf_counter() - t0, time.process_time() - c0)
    for size in ["5M", "28M", "123M", "209M"]:
        name = "T1" if size == "5M" else f"T1-{size}"
        fc[name], timing[name] = timestral(size, a, cp)
        print(f"  {name}: {timing[name][0]:.1f}s wall")
        if timing[name][0] > 300:
            print("  over 5 minutes: skipping larger sizes")
            break
    fc["T2"], timing["T2"] = timestral("5M", a, cp, "known")
    fc["T3 (oracle, leaky)"], timing["T3 (oracle, leaky)"] = timestral("5M", a, cp, "oracle")

    rows = []
    for name, q in fc.items():
        c80, s80 = coverage(q, y, scored, 0.1, 0.9)
        c90, s90 = coverage(q, y, scored, 0.05, 0.95)
        k80, _ = coverage(q, y, scored, 0.1, 0.9, v=1)
        p = pdie.get(name, p_death_proxy(q))
        rows.append(dict(forecaster=name, cov80=c80, cov90=c90, cov80_coins=k80, pinball_grit=pinball(q, y, scored, 0),
                         pinball_coins=pinball(q, y, scored, 1), auc_death=auc(p, dies), wall_s=timing[name][0], cpu_s=timing[name][1],
                         per_step80=s80.tolist(), per_step90=s90.tolist()))
    metrics = pd.DataFrame(rows)

    planted = []
    for name in ["L", "T1", "T2"]:
        q = fc[name]  # same contexts, so A's forecasts are B's
        sa, _ = out_of_band(q, a)
        sb, first = out_of_band(q, b)
        thr = np.quantile(sa, 0.95)
        short = np.where(sb > thr)[0]
        hits = []
        for i in short:
            h = first[i]
            near = b[i]["enemies"][h] + (b[i]["enemies"][h - 1] if h > 0 else [])
            hits.append(dict(seed=int(b[i]["seed"]), first_step=int(h + 1), planted_there=PLANTED in near, score=float(sb[i])))
        planted.append(dict(forecaster=name, threshold=float(thr), shortlist=len(short),
                            precision=(np.mean([h["planted_there"] for h in hits]) if hits else np.nan),
                            median_first_step=(np.median([h["first_step"] for h in hits]) if hits else np.nan),
                            hits=hits, scores_a=sa.tolist(), scores_b=sb.tolist()))
    met = {r["seed"] for r in b if any(PLANTED in e for e in r["enemies"])}
    return dict(cp=cp, n=dict(ref=len(ref), a=len(a), b=len(b)), deaths_a=int(dies.sum()), metrics=metrics, planted=planted,
                planted_met=sorted(int(s) for s in met), fc=fc, a=a, y=y, scored=scored)


results = {cp: run(cp) for cp in ["kid-mb", "adult"]}

# %% [markdown]
# ## Charts


# %%
def fan_chart(res):
    """Population fan: every run's 21 quantiles pooled, then re-quantiled; 10 realized runs on top."""
    fig, axes = plt.subplots(1, 2, figsize=(11, 4), sharey=True)
    y, scored = res["y"], res["scored"]
    H = y.shape[2]
    x = np.arange(1, H + 1)
    rng = np.random.default_rng(0)
    pick = rng.choice(len(y), size=min(10, len(y)), replace=False)
    for ax, name in zip(axes, ["L", "T2"]):
        pool = np.moveaxis(res["fc"][name][:, 0], 1, 0).reshape(H, -1)
        band = lambda p: np.quantile(pool, p, axis=1)
        ax.fill_between(x, band(0.05), band(0.95), color=COLORS[name], alpha=0.15, lw=0, label="5–95")
        ax.fill_between(x, band(0.1), band(0.9), color=COLORS[name], alpha=0.3, lw=0, label="10–90")
        ax.plot(x, band(0.5), color=COLORS[name], lw=2, label="median")
        for i in pick:
            ys = np.where(scored[i], y[i, 0], np.nan)
            ax.plot(x, ys, color="#52514e", lw=1, alpha=0.6, marker="o", ms=3)
        ax.set_title(f"{name}: Grit share forecast" + (" (lookup)" if name == "L" else " (Timestral 5M + covariates)"), fontsize=10)
        ax.set_xlabel(f"horizon step ({res['cp']} checkpoint)")
        ax.grid(alpha=0.2)
        ax.spines[["top", "right"]].set_visible(False)
    axes[0].set_ylabel("Grit / max Grit")
    axes[0].legend(frameon=False, fontsize=8, loc="upper right")
    fig.tight_layout()
    fig.savefig(OUT / f"fan-{res['cp']}.png", dpi=130)
    plt.close(fig)


def coverage_chart(res):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.8), sharey=True)
    m = res["metrics"]
    for ax, col, target in zip(axes, ["per_step80", "per_step90"], [0.8, 0.9]):
        for name in ["L", "T1", "T2", "T3 (oracle, leaky)"]:
            s = m.set_index("forecaster").loc[name, col]
            ax.plot(range(1, len(s) + 1), s, lw=2, marker="o", ms=4, color=COLORS[name.split()[0]], label=name)
        ax.axhspan(target - 0.05, target + 0.05, color="#52514e", alpha=0.1, lw=0)
        ax.axhline(target, color="#52514e", lw=1, ls="--")
        ax.set_title(f"{int(target * 100)}% band coverage per step (shaded: ±5 pts)", fontsize=10)
        ax.set_xlabel(f"horizon step ({res['cp']} checkpoint)")
        ax.grid(alpha=0.2)
        ax.spines[["top", "right"]].set_visible(False)
    axes[0].set_ylabel("share of runs inside")
    axes[0].legend(frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / f"coverage-{res['cp']}.png", dpi=130)
    plt.close(fig)


def oob_chart(res):
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.5), sharey=True)
    bins = np.linspace(0, 1, 11)
    for ax, p in zip(axes, res["planted"]):
        ax.hist([p["scores_a"], p["scores_b"]], bins=bins, color=[COLORS["A"], COLORS["B"]], label=["A (same build)", "B (planted)"], rwidth=0.9)
        ax.axvline(p["threshold"], color="#52514e", ls="--", lw=1)
        ax.set_title(f"{p['forecaster']}: out-of-band score (dashed: A's 95th pct)", fontsize=9)
        ax.set_xlabel("share of scored steps outside 5–95")
        ax.spines[["top", "right"]].set_visible(False)
    axes[0].set_ylabel("runs")
    axes[0].legend(frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / f"out-of-band-{res['cp']}.png", dpi=130)
    plt.close(fig)


for res in results.values():
    fan_chart(res)
    coverage_chart(res)
    oob_chart(res)

# %% [markdown]
# ## Save the numbers (report.md is written from these)

# %%
summary = {
    cp: dict(
        n=r["n"],
        deaths_a=r["deaths_a"],
        planted_met=r["planted_met"],
        metrics=r["metrics"].drop(columns=["per_step80", "per_step90"]).to_dict("records"),
        per_step=r["metrics"][["forecaster", "per_step80", "per_step90"]].to_dict("records"),
        planted=[{k: v for k, v in p.items() if not k.startswith("scores")} for p in r["planted"]],
    )
    for cp, r in results.items()
}
(OUT / "results.json").write_text(json.dumps(summary, indent=1, default=float))
for cp, r in results.items():
    print(f"\n== {cp} ==")
    print(r["metrics"].drop(columns=["per_step80", "per_step90"]).round(3).to_string(index=False))
    for p in r["planted"]:
        print(p["forecaster"], "shortlist", p["shortlist"], "precision", p["precision"], "median first", p["median_first_step"], p["hits"])
