"""
Preprocessing + feature engineering (Pandas / NumPy).

Steps (mirrors the 'Clean' stage of the MessMind learning loop):
  1. Standardise categories   (" lunch ", "LUNCH" -> "Lunch")
  2. Standardise units        (grams -> kg)
  3. Remove duplicates        (double form submissions)
  4. Handle outliers          (IQR rule on attendance -> replace with group median)
  5. Impute missing values    (group medians / dish means)
  6. Recompute derived fields (leftover = prepared - consumed)
  7. Extract date/meal features + lag features for ML
"""
from __future__ import annotations

import numpy as np
import pandas as pd

REQUIRED_COLUMNS = ["date", "meal_type", "dish", "attendance", "prepared_kg", "consumed_kg"]


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = raw.copy()
    report: dict = {"rows_in": int(len(df)), "steps": []}

    def step(name, detail, affected):
        report["steps"].append({"step": name, "detail": detail, "rows_affected": int(affected)})

    missing_before = {c: int(df[c].isna().sum()) for c in df.columns if df[c].isna().any()}
    report["missing_before"] = missing_before

    # 1. categories
    if "mess" not in df.columns:
        df["mess"] = "Hostel A"
    before = df["meal_type"].astype(str)
    df["meal_type"] = before.str.strip().str.title()
    step("Standardise categories", "meal_type trimmed + title-cased", (before != df["meal_type"]).sum())

    # 2. units
    if "unit" not in df.columns:
        df["unit"] = "kg"
    grams = df["unit"].astype(str).str.lower().str.strip().isin(["g", "gm", "gram", "grams"])
    for c in ("prepared_kg", "consumed_kg", "leftover_kg"):
        if c in df.columns:
            df.loc[grams, c] = df.loc[grams, c] / 1000
    df.loc[grams, "unit"] = "kg"
    step("Standardise units", "grams converted to kilograms", grams.sum())

    # 3. duplicates
    n = len(df)
    df = df.drop_duplicates(subset=["mess", "date", "meal_type"], keep="first")
    step("Remove duplicates", "duplicate (mess, date, meal) entries dropped", n - len(df))

    df["date"] = pd.to_datetime(df["date"])
    df["weekday"] = df["date"].dt.dayofweek

    # 4. outliers (IQR) on attendance per mess+meal
    out_count = 0
    for (_, _), g in df.groupby(["mess", "meal_type"]):
        q1, q3 = g["attendance"].quantile([0.25, 0.75])
        iqr = q3 - q1
        hi = q3 + 3 * iqr          # upper fence only: low days are real (holidays)
        mask = g["attendance"].notna() & ((g["attendance"] > hi) | (g["attendance"] <= 0))
        df.loc[g.index[mask], "attendance"] = np.nan  # treat as missing, impute below
        out_count += int(mask.sum())
    step("Handle outliers", "attendance above Q3 + 3xIQR (typos) flagged and re-imputed", out_count)

    # 5. missing values
    miss_att = df["attendance"].isna().sum()
    df["attendance"] = df.groupby(["mess", "meal_type", "weekday"])["attendance"] \
        .transform(lambda s: s.fillna(s.median())).round()
    step("Impute attendance", "median of same mess / meal / weekday", miss_att)

    if "rating" not in df.columns:
        df["rating"] = np.nan
    miss_rat = df["rating"].isna().sum()
    df["rating"] = df.groupby("dish")["rating"].transform(lambda s: s.fillna(s.mean()))
    df["rating"] = df["rating"].fillna(df["rating"].mean() if df["rating"].notna().any() else 3.5)
    step("Impute rating", "mean rating of the same dish", miss_rat)

    miss_prep = df["prepared_kg"].isna().sum()
    if "leftover_kg" in df.columns:
        df["prepared_kg"] = df["prepared_kg"].fillna(df["consumed_kg"] + df["leftover_kg"])
    df["prepared_kg"] = df["prepared_kg"].fillna(df["consumed_kg"] * 1.1)
    step("Impute prepared_kg", "reconstructed as consumed + leftover", miss_prep)

    for c in ("event_flag", "holiday_flag"):
        if c not in df.columns:
            df[c] = 0
        df[c] = df[c].fillna(0).astype(int)

    # 6. derived
    df["leftover_kg"] = (df["prepared_kg"] - df["consumed_kg"]).clip(lower=0).round(2)
    df["waste_pct"] = (df["leftover_kg"] / df["prepared_kg"] * 100).round(2)
    step("Recompute leftovers", "leftover = prepared - consumed (clipped at 0)", len(df))

    df = df.sort_values(["mess", "date", "meal_type"]).reset_index(drop=True)
    report["rows_out"] = int(len(df))
    report["missing_after"] = {c: int(df[c].isna().sum()) for c in df.columns if df[c].isna().any()}
    return df, report


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Date/meal features + lag features used by the ML models."""
    f = df.copy().sort_values(["mess", "meal_type", "date"])
    f["date"] = pd.to_datetime(f["date"])
    f["weekday"] = f["date"].dt.dayofweek
    f["is_weekend"] = (f["weekday"] >= 5).astype(int)
    f["month"] = f["date"].dt.month
    f["meal_is_dinner"] = (f["meal_type"] == "Dinner").astype(int)
    first = f.groupby("mess")["date"].transform("min")
    f["day_index"] = (f["date"] - first).dt.days
    g = f.groupby(["mess", "meal_type"])["consumed_kg"]
    f["prev_meal_consumption"] = g.shift(1)
    f["rolling7_consumption"] = g.transform(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    f["per_capita_prev"] = (f["prev_meal_consumption"] /
                            f.groupby(["mess", "meal_type"])["attendance"].shift(1))
    for c in ("prev_meal_consumption", "rolling7_consumption", "per_capita_prev"):
        f[c] = f[c].fillna(f.groupby(["mess", "meal_type"])[c].transform("median"))
    return f.sort_values(["mess", "date", "meal_type"]).reset_index(drop=True)
