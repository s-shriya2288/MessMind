"""
Exploratory data analysis, inventory intelligence and recommendations.
Every function returns plain JSON-ready structures for the React dashboards.
"""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from .data_generator import DISHES


def _r(x, n=2):
    return None if pd.isna(x) else round(float(x), n)


def _cost(dish: str) -> float:
    return DISHES.get(dish, (None, None, None, 70))[3]


# ----------------------------------------------------------------------------- EDA
def kpis(df: pd.DataFrame) -> dict:
    prepared, leftover = df["prepared_kg"].sum(), df["leftover_kg"].sum()
    cost = (df["leftover_kg"] * df["dish"].map(_cost)).sum()
    days = df["date"].nunique()
    return {"meals": int(len(df)), "days": int(days), "prepared_kg": _r(prepared, 0),
            "consumed_kg": _r(df["consumed_kg"].sum(), 0), "leftover_kg": _r(leftover, 0),
            "waste_pct": _r(leftover / prepared * 100, 1), "waste_cost_inr": _r(cost, 0),
            "avg_attendance": _r(df["attendance"].mean(), 0), "avg_rating": _r(df["rating"].mean(), 2),
            "leftover_per_day_kg": _r(leftover / max(days, 1), 1)}


def describe(df: pd.DataFrame) -> list[dict]:
    cols = ["attendance", "prepared_kg", "consumed_kg", "leftover_kg", "waste_pct", "rating"]
    d = df[cols].describe().T.round(2)
    d["skew"] = df[cols].skew().round(2)
    return [{"column": c, **{k: _r(v) for k, v in row.items()}} for c, row in d.iterrows()]


def dish_waste(df: pd.DataFrame) -> list[dict]:
    g = df.groupby(["dish", "meal_type"]).agg(
        leftover_kg=("leftover_kg", "mean"), waste_pct=("waste_pct", "mean"),
        rating=("rating", "mean"), servings=("dish", "size"), total_leftover=("leftover_kg", "sum"),
    ).reset_index()
    g["waste_cost_inr"] = g["total_leftover"] * g["dish"].map(_cost)
    g = g.sort_values("waste_pct", ascending=False)
    return [{k: (_r(v) if isinstance(v, (float, np.floating)) else v) for k, v in r.items()}
            for r in g.to_dict("records")]


def daily_trend(df: pd.DataFrame) -> list[dict]:
    d = df.groupby("date").agg(prepared=("prepared_kg", "sum"), consumed=("consumed_kg", "sum"),
                               leftover=("leftover_kg", "sum"), attendance=("attendance", "sum"))
    d["leftover_7d"] = d["leftover"].rolling(7, min_periods=1).mean()
    d = d.reset_index()
    d["date"] = d["date"].dt.strftime("%Y-%m-%d")
    return [{k: (_r(v, 1) if k != "date" else v) for k, v in r.items()} for r in d.to_dict("records")]


def weekly_trend(df: pd.DataFrame) -> list[dict]:
    w = df.set_index("date").resample("W-MON", label="left", closed="left").agg(
        {"prepared_kg": "sum", "consumed_kg": "sum", "leftover_kg": "sum"}).reset_index()
    w["waste_pct"] = w["leftover_kg"] / w["prepared_kg"] * 100
    w["week"] = w["date"].dt.strftime("%d %b")
    return [{"week": r["week"], "prepared": _r(r["prepared_kg"], 0), "consumed": _r(r["consumed_kg"], 0),
             "leftover": _r(r["leftover_kg"], 1), "waste_pct": _r(r["waste_pct"], 1)}
            for r in w.to_dict("records") if r["prepared_kg"] > 0]


def weekday_meal(df: pd.DataFrame) -> list[dict]:
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    g = df.groupby(["weekday", "meal_type"]).agg(attendance=("attendance", "mean"),
                                                 consumed=("consumed_kg", "mean"),
                                                 leftover=("leftover_kg", "mean")).reset_index()
    out = []
    for wd in range(7):
        row = {"day": names[wd]}
        for _, r in g[g["weekday"] == wd].iterrows():
            m = r["meal_type"].lower()
            row[f"{m}_attendance"] = _r(r["attendance"], 0)
            row[f"{m}_consumed"] = _r(r["consumed"], 1)
            row[f"{m}_leftover"] = _r(r["leftover"], 1)
        out.append(row)
    return out


def preference_heatmap(feedback: pd.DataFrame) -> dict:
    fb = feedback.copy()
    fb["weekday"] = pd.to_datetime(fb["date"]).dt.dayofweek
    pv = fb.pivot_table(index="dish", columns="rating", values="student_id", aggfunc="count", fill_value=0)
    pv = pv.div(pv.sum(axis=1), axis=0).mul(100).round(1)
    pv = pv.reindex(columns=[1, 2, 3, 4, 5], fill_value=0)
    pv = pv.loc[fb.groupby("dish")["rating"].mean().sort_values(ascending=False).index]
    return {"rows": list(pv.index), "cols": ["1★", "2★", "3★", "4★", "5★"],
            "values": pv.values.tolist()}


def correlation(df_feat: pd.DataFrame) -> dict:
    cols = ["attendance", "prepared_kg", "consumed_kg", "leftover_kg", "rating",
            "event_flag", "holiday_flag", "is_weekend", "meal_is_dinner", "prev_meal_consumption"]
    labels = ["Attendance", "Prepared", "Consumed", "Leftover", "Rating", "Event", "Holiday",
              "Weekend", "Dinner", "Prev. meal"]
    c = df_feat[cols].corr().round(2)
    return {"labels": labels, "values": c.values.tolist()}


def scatter_attendance(df: pd.DataFrame) -> dict:
    pts = [{"attendance": int(r.attendance), "consumed": _r(r.consumed_kg), "meal": r.meal_type}
           for r in df.itertuples()]
    slope, intercept = np.polyfit(df["attendance"], df["consumed_kg"], 1)
    r = df["attendance"].corr(df["consumed_kg"])
    xs = [float(df["attendance"].min()), float(df["attendance"].max())]
    return {"points": pts, "r": _r(r, 3), "slope": _r(slope, 4), "intercept": _r(intercept, 2),
            "line": [{"attendance": x, "fit": _r(slope * x + intercept)} for x in xs]}


def histogram(series: pd.Series, bins: int = 14) -> list[dict]:
    counts, edges = np.histogram(series.dropna(), bins=bins)
    return [{"bin": f"{edges[i]:.1f}", "count": int(c)} for i, c in enumerate(counts)]


def waste_categories(waste: pd.DataFrame) -> list[dict]:
    g = waste.groupby("category")["waste_kg"].sum().sort_values(ascending=False)
    total = g.sum()
    return [{"category": k, "kg": _r(v, 0), "pct": _r(v / total * 100, 1)} for k, v in g.items()]


def portion_feedback(feedback: pd.DataFrame) -> list[dict]:
    g = feedback.groupby(["dish", "portion"]).size().unstack(fill_value=0)
    g = g.div(g.sum(axis=1), axis=0).mul(100).round(1)
    out = []
    for dish, r in g.iterrows():
        out.append({"dish": dish, **{k: float(v) for k, v in r.items()}})
    return sorted(out, key=lambda x: -x.get("Too much", 0))


# ----------------------------------------------------------------------------- inventory
def inventory_status(inv: pd.DataFrame, today: date | None = None) -> list[dict]:
    today = pd.Timestamp(today or date.today())
    inv = inv.copy()
    inv["expiry"] = pd.to_datetime(inv["expiry_date"])
    inv["days_left"] = (inv["expiry"] - today).dt.days
    # FEFO: consume the earliest-expiring batch of each item first
    inv = inv.sort_values(["item", "expiry"])
    inv["usable_before_expiry"] = 0.0
    for item, g in inv.groupby("item"):
        used = 0.0
        for idx, r in g.iterrows():
            capacity = max(r["days_left"], 0) * r["daily_usage"] - used
            usable = float(np.clip(capacity, 0, r["quantity"]))
            inv.loc[idx, "usable_before_expiry"] = usable
            used += usable
    inv["at_risk_qty"] = (inv["quantity"] - inv["usable_before_expiry"]).clip(lower=0).round(1)
    inv["risk_score"] = (inv["at_risk_qty"] / inv["quantity"]).round(2)
    inv["value_at_risk"] = (inv["at_risk_qty"] * inv["cost_per_unit"]).round(0)
    inv["status"] = np.select(
        [inv["days_left"] <= 1, inv["risk_score"] > 0.3, inv["days_left"] <= 3],
        ["Use today", "At risk", "Use soon"], default="OK")
    inv["fefo_rank"] = inv.groupby("item")["expiry"].rank(method="first").astype(int)
    inv = inv.sort_values(["days_left", "risk_score"], ascending=[True, False])
    cols = ["item", "batch", "quantity", "unit", "cost_per_unit", "daily_usage", "received_date",
            "expiry_date", "days_left", "fefo_rank", "at_risk_qty", "risk_score", "value_at_risk", "status"]
    return [{k: (v.item() if hasattr(v, "item") else v) for k, v in r.items()}
            for r in inv[cols].to_dict("records")]


# ----------------------------------------------------------------------------- recommendations
INGREDIENT_DISHES = {
    "Paneer": ["Paneer Butter Masala", "Matar Paneer & Roti"],
    "Mixed Vegetables": ["Mixed Veg & Roti", "Pav Bhaji", "Veg Fried Rice"],
    "Curd": ["Kadhi Pakoda", "Veg Biryani (raita)"],
    "Milk": ["Kheer as dessert", "Masala chai at breakfast"],
    "Tomatoes": ["Pav Bhaji", "Rajma Chawal"],
    "Eggs": ["Egg Curry & Rice"],
}


def recommendations(forecast: list[dict], inv_status: list[dict], dish_stats: list[dict],
                    feedback: pd.DataFrame, votes: pd.DataFrame) -> list[dict]:
    recs = []
    # 1. preparation quantities
    for f in forecast[:4]:
        if f["potential_saving_kg"] >= 1:
            recs.append({"type": "Preparation", "priority": "High" if f["potential_saving_kg"] > 4 else "Medium",
                         "title": f"{f['day']} {f['meal_type']}: prepare ~{f['recommended_prep_kg']} kg of {f['dish']}",
                         "detail": f"Model predicts {f['predicted_kg']} kg demand (80% band {f['lower_kg']}–{f['upper_kg']} kg) "
                                   f"for ~{f['attendance']} students. Usual prep is {f['usual_prep_kg']} kg → "
                                   f"~{f['potential_saving_kg']} kg potential over-production avoided."})
    # 2. near-expiry usage (FEFO)
    for it in [i for i in inv_status if i["status"] in ("Use today", "At risk", "Use soon")][:4]:
        uses = INGREDIENT_DISHES.get(it["item"])
        recs.append({"type": "Inventory (FEFO)", "priority": "High" if it["status"] == "Use today" else "Medium",
                     "title": f"Use {it['item']} batch {it['batch']} first — expires in {max(it['days_left'], 0)} day(s)",
                     "detail": f"{it['quantity']} {it['unit']} on hand, {it['at_risk_qty']} {it['unit']} at risk "
                               f"(≈₹{int(it['value_at_risk'])})." + (f" Plan: {', '.join(uses)}." if uses else "")})
    # 3. menu improvements
    low = sorted(dish_stats, key=lambda d: d["rating"])[:2]
    for d in low:
        v = votes[votes["dish"] == d["dish"]]
        down = int(v["downvotes"].iloc[0]) if len(v) else 0
        recs.append({"type": "Menu", "priority": "Medium",
                     "title": f"Review or replace “{d['dish']}”",
                     "detail": f"Avg rating {d['rating']}/5, waste {d['waste_pct']}% of prepared quantity, "
                               f"{down} student down-votes. Try a recipe change or swap with a top-voted dish."})
    # 4. portion planning
    too_much = feedback[feedback["portion"] == "Too much"].groupby("dish").size() / feedback.groupby("dish").size()
    if len(too_much):
        dish, share = too_much.idxmax(), too_much.max()
        recs.append({"type": "Portion", "priority": "Low",
                     "title": f"Reduce default serving of {dish}",
                     "detail": f"{share * 100:.0f}% of student responses say the portion is ‘too much’ — "
                               "offer smaller first servings with free refills."})
    # 5. purchasing
    recs.append({"type": "Procurement", "priority": "Low",
                 "title": "Align next purchase order with the 7-day forecast",
                 "detail": f"Forecast total demand for the coming week is "
                           f"{sum(f['predicted_kg'] for f in forecast):.0f} kg of cooked food; "
                           "order perishables (vegetables, paneer, milk) in 2–3 day cycles rather than weekly."})
    return recs


# ----------------------------------------------------------------------------- admin
def compare_messes(df: pd.DataFrame) -> dict:
    rows = []
    for mess, g in df.groupby("mess"):
        k = kpis(g)
        rows.append({"mess": mess, **k})
    w = df.copy()
    w["week"] = w["date"].dt.to_period("W").dt.start_time
    t = w.groupby(["week", "mess"]).apply(
        lambda g: g["leftover_kg"].sum() / g["prepared_kg"].sum() * 100, include_groups=False
    ).unstack().round(1).reset_index()
    t["week"] = t["week"].dt.strftime("%d %b")
    trend = t.to_dict("records")
    return {"messes": rows, "trend": trend}


def sustainability(model_test: pd.DataFrame, df: pd.DataFrame) -> dict:
    """Estimated (simulated) impact if managers had followed the model's recommendation."""
    t = model_test.copy()
    saved = t["overproduction"].clip(lower=0).sum()
    shortfall = (t["actual"] - t["recommended"]).clip(lower=0)
    cost = (t["overproduction"].clip(lower=0) * t["dish"].map(_cost)).sum()
    t["cum_saved"] = t["overproduction"].clip(lower=0).cumsum()
    return {
        "period_meals": int(len(t)), "food_saved_kg": _r(saved, 0), "cost_saved_inr": _r(cost, 0),
        "meals_equivalent": int(saved / 0.4),  # ~400 g per plate
        "co2e_kg": _r(saved * 2.5, 0),        # ~2.5 kg CO2e per kg food waste (FAO order of magnitude)
        "shortfall_meals": int((shortfall > 1).sum()),
        "cumulative": [{"date": r["date"], "meal": r["meal_type"], "saved": _r(r["cum_saved"], 1)}
                       for r in t.to_dict("records")],
        "note": "Simulated on synthetic test data — not a verified real-world reduction.",
    }
