"""
Static analysis report with Matplotlib + Seaborn (the 'Data Science Workbench').
Generates PNG figures into backend/reports/ — also usable directly in a project report.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402

PALETTE = ["#2f7d5b", "#e0893a", "#4a74c9", "#c65b7c"]


def _save(fig, out: Path, name: str, title: str, caption: str, figs: list):
    fig.tight_layout()
    fig.savefig(out / f"{name}.png", dpi=130)
    plt.close(fig)
    figs.append({"file": f"{name}.png", "title": title, "caption": caption})


def generate(clean: pd.DataFrame, feats: pd.DataFrame, waste: pd.DataFrame, feedback: pd.DataFrame,
             test_frame: pd.DataFrame, importance: list[dict], out_dir: Path) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", palette=PALETTE)
    figs: list[dict] = []
    a = clean[clean["mess"] == "Hostel A"]

    # 1 correlation heatmap
    cols = ["attendance", "prepared_kg", "consumed_kg", "leftover_kg", "rating", "event_flag",
            "holiday_flag", "is_weekend", "prev_meal_consumption"]
    fa = feats[feats["mess"] == "Hostel A"]
    fig, ax = plt.subplots(figsize=(8, 6.5))
    sns.heatmap(fa[cols].corr(), annot=True, fmt=".2f", cmap="RdBu_r", center=0, ax=ax, cbar_kws={"shrink": .8})
    ax.set_title("Correlation heatmap (Hostel A)")
    _save(fig, out_dir, "correlation_heatmap", "Correlation heatmap",
          "Attendance is the strongest driver of consumption; holidays pull everything down.", figs)

    # 2 most / least wasted dishes
    d = a.groupby("dish")["waste_pct"].mean().sort_values()
    fig, ax = plt.subplots(figsize=(8, 5.5))
    sns.barplot(x=d.values, y=d.index, hue=d.index, palette="RdYlGn_r", legend=False, ax=ax)
    ax.set_xlabel("Average leftover as % of prepared")
    ax.set_ylabel("")
    ax.set_title("Most- and least-wasted dishes")
    _save(fig, out_dir, "dish_waste_bar", "Most / least wasted dishes",
          "Low-rated dishes such as Lauki Chana Dal and Khichdi waste the largest share.", figs)

    # 3 preference heatmap (dish x rating)
    pv = feedback.pivot_table(index="dish", columns="rating", values="student_id", aggfunc="count", fill_value=0)
    pv = pv.div(pv.sum(axis=1), axis=0) * 100
    fig, ax = plt.subplots(figsize=(7, 6))
    sns.heatmap(pv, annot=True, fmt=".0f", cmap="YlGn", ax=ax, cbar_kws={"label": "% of responses"})
    ax.set_title("Student preference heatmap (rating distribution per dish)")
    _save(fig, out_dir, "preference_heatmap", "Preference heatmap",
          "Share of survey responses at each star rating, per dish.", figs)

    # 4 waste-category pie
    w = waste.groupby("category")["waste_kg"].sum()
    fig, ax = plt.subplots(figsize=(6.5, 6.5))
    ax.pie(w.values, labels=w.index, autopct="%1.0f%%", colors=PALETTE, startangle=90,
           wedgeprops={"edgecolor": "white", "linewidth": 2})
    ax.set_title("Waste by category (all messes)")
    _save(fig, out_dir, "waste_category_pie", "Waste categories",
          "Over-preparation dominates — the part a demand forecast can address.", figs)

    # 5 daily trend
    t = a.groupby("date")[["prepared_kg", "consumed_kg", "leftover_kg"]].sum()
    fig, ax = plt.subplots(figsize=(10, 4.2))
    ax.plot(t.index, t["prepared_kg"].rolling(7).mean(), label="Prepared (7-day avg)")
    ax.plot(t.index, t["consumed_kg"].rolling(7).mean(), label="Consumed (7-day avg)")
    ax.fill_between(t.index, t["consumed_kg"].rolling(7).mean(), t["prepared_kg"].rolling(7).mean(),
                    alpha=.2, color=PALETTE[1], label="Leftover gap")
    ax.set_ylabel("kg / day")
    ax.legend()
    ax.set_title("Daily preparation vs consumption (Hostel A)")
    _save(fig, out_dir, "daily_trend", "Daily trend", "The shaded gap is avoidable over-preparation.", figs)

    # 6 attendance vs consumption
    fig, ax = plt.subplots(figsize=(7, 5))
    sns.regplot(data=a, x="attendance", y="consumed_kg", scatter_kws={"alpha": .45, "s": 18}, ax=ax,
                line_kws={"color": PALETTE[1]})
    ax.set_title(f"Attendance vs consumption (r = {a['attendance'].corr(a['consumed_kg']):.2f})")
    _save(fig, out_dir, "attendance_scatter", "Attendance–consumption correlation",
          "Strong linear relationship — attendance forecasting is the key input.", figs)

    # 7 meal-wise boxplot
    fig, ax = plt.subplots(figsize=(8, 4.6))
    order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    tmp = a.assign(day=a["date"].dt.day_name().str[:3])
    sns.boxplot(data=tmp, x="day", y="leftover_kg", hue="meal_type", order=order, ax=ax)
    ax.set_title("Leftover distribution by weekday and meal")
    _save(fig, out_dir, "weekday_boxplot", "Meal-wise comparison", "Weekends show the largest leftovers.", figs)

    # 8 actual vs predicted
    fig, ax = plt.subplots(figsize=(10, 4.2))
    x = range(len(test_frame))
    ax.plot(x, test_frame["actual"], label="Actual", lw=1.8)
    ax.plot(x, test_frame["predicted"], label="Predicted (Random Forest)", lw=1.8)
    ax.fill_between(x, test_frame["lower"], test_frame["upper"], alpha=.18, label="80% interval")
    ax.set_xlabel("Test meals (chronological)")
    ax.set_ylabel("kg")
    ax.legend()
    ax.set_title("Actual vs predicted demand on unseen test data")
    _save(fig, out_dir, "actual_vs_predicted", "Actual vs predicted",
          "Prediction follows demand without matching every fluctuation.", figs)

    # 9 feature importance
    imp = pd.DataFrame(importance).sort_values("importance")
    fig, ax = plt.subplots(figsize=(7, 4.8))
    ax.barh(imp["feature"], imp["importance"], color=PALETTE[0])
    ax.set_title("Random Forest feature importance")
    _save(fig, out_dir, "feature_importance", "Feature importance",
          "Which inputs the model relies on most.", figs)

    # 10 residuals
    fig, ax = plt.subplots(figsize=(7, 4.4))
    sns.histplot(test_frame["residual"], kde=True, ax=ax, color=PALETTE[2])
    ax.axvline(0, color="k", lw=1)
    ax.set_title("Residual distribution (actual − predicted)")
    _save(fig, out_dir, "residuals", "Residuals", "Centred near zero → no strong systematic bias.", figs)
    import json
    (out_dir / "figures.json").write_text(json.dumps(figs, indent=1, ensure_ascii=False))
    return figs
