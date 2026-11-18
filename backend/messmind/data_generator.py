"""
Synthetic data generator for MessMind.

Creates realistic (but hypothetical) hostel-mess records so the full data-science
workflow can be demonstrated before real hostel data is available:

    180 days x 2 meals/day = 360 meal records per mess (3 messes)

It also deliberately injects "dirty data" problems (missing values, duplicates,
mixed units, inconsistent categories, outliers) so the preprocessing step has
real work to do — exactly what happens with hand-entered kitchen logs.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

SEED = 42
N_DAYS = 180

MESSES = {
    # name: (capacity, kitchen efficiency -> how well they estimate prep)
    "Hostel A": (420, 1.00),
    "Hostel B": (320, 1.18),
    "Hostel C": (260, 0.85),
}

# dish -> (meal, popularity 0..1, per-capita kg, cost per kg in INR)
DISHES = {
    "Rajma Chawal":          ("Lunch", 0.86, 0.105, 70),
    "Veg Biryani":           ("Lunch", 0.92, 0.110, 95),
    "Chole Bhature":         ("Lunch", 0.88, 0.100, 80),
    "Kadhi Pakoda":          ("Lunch", 0.55, 0.085, 60),
    "Aloo Gobi & Rice":      ("Lunch", 0.60, 0.090, 55),
    "Paneer Butter Masala":  ("Lunch", 0.95, 0.098, 140),
    "Lauki Chana Dal":       ("Lunch", 0.40, 0.080, 50),
    "Dal Makhani & Roti":    ("Dinner", 0.85, 0.095, 75),
    "Egg Curry & Rice":      ("Dinner", 0.78, 0.100, 85),
    "Pav Bhaji":             ("Dinner", 0.90, 0.092, 65),
    "Khichdi":               ("Dinner", 0.42, 0.082, 45),
    "Matar Paneer & Roti":   ("Dinner", 0.83, 0.094, 120),
    "Mixed Veg & Roti":      ("Dinner", 0.50, 0.085, 55),
    "Veg Fried Rice":        ("Dinner", 0.74, 0.096, 70),
}

# fixed weekly menu (weekday 0 = Monday)
WEEKLY_MENU = {
    "Lunch":  ["Rajma Chawal", "Kadhi Pakoda", "Aloo Gobi & Rice", "Lauki Chana Dal",
               "Chole Bhature", "Veg Biryani", "Paneer Butter Masala"],
    "Dinner": ["Dal Makhani & Roti", "Mixed Veg & Roti", "Egg Curry & Rice", "Khichdi",
               "Veg Fried Rice", "Pav Bhaji", "Matar Paneer & Roti"],
}

WASTE_CATEGORIES = ["Over-preparation", "Plate waste", "Expiry / spoilage", "Prep & trimming loss"]

INVENTORY_ITEMS = [
    # item, unit, cost/unit, daily usage, shelf-life days
    ("Basmati Rice", "kg", 85, 22, 180),
    ("Wheat Flour (Atta)", "kg", 38, 18, 60),
    ("Toor / Chana Dal", "kg", 120, 7, 120),
    ("Rajma", "kg", 140, 2.5, 150),
    ("Paneer", "kg", 360, 4, 5),
    ("Milk", "L", 56, 30, 2),
    ("Curd", "kg", 70, 8, 4),
    ("Mixed Vegetables", "kg", 40, 25, 5),
    ("Potatoes", "kg", 25, 15, 25),
    ("Onions", "kg", 35, 12, 30),
    ("Tomatoes", "kg", 30, 10, 7),
    ("Eggs", "tray(30)", 180, 3, 14),
    ("Cooking Oil", "L", 150, 6, 240),
    ("Green Peas (frozen)", "kg", 110, 2, 90),
]

HOLIDAY_OFFSETS = [12, 13, 47, 48, 49, 50, 51, 98, 140, 141]   # semester breaks / festivals
EVENT_OFFSETS = [20, 61, 90, 121, 150, 170]                      # fests, sports days, guest nights
EXAM_RANGES = [(70, 84), (160, 175)]                             # exam weeks -> more students stay in


def _date_range(end: date) -> list[date]:
    start = end - timedelta(days=N_DAYS - 1)
    return [start + timedelta(days=i) for i in range(N_DAYS)]


def generate_meal_records(end: date | None = None, seed: int = SEED) -> pd.DataFrame:
    """Daily_Consumption table for all messes (clean ground truth)."""
    rng = np.random.default_rng(seed)
    end = end or (date.today() - timedelta(days=1))
    days = _date_range(end)
    rows = []
    for mess, (capacity, efficiency) in MESSES.items():
        prev_consumed = {"Lunch": None, "Dinner": None}
        for i, d in enumerate(days):
            wd = d.weekday()
            holiday = i in HOLIDAY_OFFSETS
            event = i in EVENT_OFFSETS
            exam = any(a <= i <= b for a, b in EXAM_RANGES)
            for meal in ("Lunch", "Dinner"):
                dish = WEEKLY_MENU[meal][wd]
                _, pop, per_cap, _ = DISHES[dish]
                # --- attendance -------------------------------------------------
                base = capacity * (0.80 if meal == "Lunch" else 0.88)
                if wd >= 5:
                    base *= 0.82 if meal == "Lunch" else 0.90   # students go out on weekends
                if holiday:
                    base *= 0.45
                if event:
                    base *= 1.18
                if exam:
                    base *= 1.08
                base *= 0.92 + 0.12 * pop                      # good dishes pull people in
                attendance = int(np.clip(rng.normal(base, capacity * 0.045), 40, capacity * 1.1))
                # --- consumption (true demand) -----------------------------------
                consumed = attendance * per_cap * (0.85 + 0.25 * pop) * rng.normal(1, 0.07)
                # --- preparation (human estimate: habit + last meal, biased upward) --
                usual = capacity * (0.8 if meal == "Lunch" else 0.88) * per_cap * 1.02
                anchor = prev_consumed[meal] if prev_consumed[meal] else usual
                prepared = (0.6 * usual + 0.4 * anchor) * efficiency * rng.normal(1.12, 0.06)
                if event:
                    prepared *= 1.12
                prepared = max(prepared, consumed * 0.92)
                consumed = min(consumed, prepared)               # can't eat more than was made
                leftover = prepared - consumed
                rating = float(np.clip(rng.normal(2.2 + 2.6 * pop, 0.45), 1, 5))
                rows.append({
                    "mess": mess,
                    "date": d.isoformat(),
                    "meal_type": meal,
                    "dish": dish,
                    "attendance": attendance,
                    "prepared_kg": round(prepared, 2),
                    "consumed_kg": round(consumed, 2),
                    "leftover_kg": round(leftover, 2),
                    "rating": round(rating, 1),
                    "event_flag": int(event),
                    "holiday_flag": int(holiday),
                    "unit": "kg",
                })
                prev_consumed[meal] = consumed
    return pd.DataFrame(rows)


def inject_dirty_data(df: pd.DataFrame, seed: int = SEED) -> pd.DataFrame:
    """Simulate messy hand-entered logs so preprocessing is meaningful."""
    rng = np.random.default_rng(seed + 1)
    dirty = df.copy()
    n = len(dirty)
    # 1) missing values
    for col, frac in (("attendance", 0.03), ("rating", 0.06), ("prepared_kg", 0.015)):
        idx = rng.choice(n, int(n * frac), replace=False)
        dirty.loc[idx, col] = np.nan
    # 2) some kitchens logged grams instead of kg
    idx = rng.choice(n, int(n * 0.04), replace=False)
    for c in ("prepared_kg", "consumed_kg", "leftover_kg"):
        dirty.loc[idx, c] = dirty.loc[idx, c] * 1000
    dirty.loc[idx, "unit"] = "g"
    # 3) inconsistent category spelling
    idx = rng.choice(n, int(n * 0.08), replace=False)
    dirty.loc[idx, "meal_type"] = dirty.loc[idx, "meal_type"].map(
        lambda m: rng.choice([m.lower(), m.upper(), f" {m} "]))
    # 4) typo outliers in attendance
    idx = rng.choice(n, 5, replace=False)
    dirty.loc[idx, "attendance"] = dirty.loc[idx, "attendance"] * 10
    # 5) duplicated rows (double submission)
    dup = dirty.sample(12, random_state=seed)
    dirty = pd.concat([dirty, dup], ignore_index=True)
    return dirty.sample(frac=1, random_state=seed).reset_index(drop=True)


def generate_waste_breakdown(meals: pd.DataFrame, seed: int = SEED) -> pd.DataFrame:
    """Food_Wastage table: split waste into the four categories MessMind tracks."""
    rng = np.random.default_rng(seed + 2)
    out = []
    for _, r in meals.iterrows():
        left = r["leftover_kg"]
        plate_share = rng.uniform(0.25, 0.40) * (1.3 - DISHES[r["dish"]][1])
        plate = r["consumed_kg"] * 0.06 * (1.4 - DISHES[r["dish"]][1]) + left * plate_share * 0.2
        over = left
        expiry = max(rng.normal(0.9, 0.5), 0) if r["meal_type"] == "Lunch" else max(rng.normal(0.6, 0.4), 0)
        trim = r["prepared_kg"] * rng.uniform(0.015, 0.03)
        for cat, kg in zip(WASTE_CATEGORIES, (over, plate, expiry, trim)):
            out.append({"mess": r["mess"], "date": r["date"], "meal_type": r["meal_type"],
                        "category": cat, "waste_kg": round(float(kg), 2)})
    return pd.DataFrame(out)


def generate_inventory(today: date | None = None, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed + 3)
    today = today or date.today()
    rows = []
    for item, unit, cost, usage, shelf in INVENTORY_ITEMS:
        n_batches = 2 if shelf > 10 else 1 + int(rng.integers(1, 3))
        for b in range(n_batches):
            received = today - timedelta(days=int(rng.integers(0, max(2, min(shelf, 20)))))
            expiry = received + timedelta(days=shelf)
            if expiry < today:
                expiry = today + timedelta(days=int(rng.integers(0, 3)))
            qty = round(float(usage * rng.uniform(1.0, 6.0 if shelf < 10 else 14.0)), 1)
            rows.append({"item": item, "batch": f"B{b + 1}", "quantity": qty, "unit": unit,
                         "cost_per_unit": cost, "daily_usage": usage,
                         "received_date": received.isoformat(), "expiry_date": expiry.isoformat()})
    return pd.DataFrame(rows)


def generate_feedback(meals: pd.DataFrame, seed: int = SEED) -> pd.DataFrame:
    """Food_Feedback table from anonymous student surveys (Google Forms style)."""
    rng = np.random.default_rng(seed + 4)
    comments = {
        "high": ["Loved it!", "Perfect taste", "Please serve more often", "Great portion"],
        "mid": ["Okay", "Could be spicier", "A bit oily", "Decent"],
        "low": ["Too bland", "Undercooked", "Too salty", "Please replace this dish", "Cold when served"],
    }
    rows = []
    sample = meals[meals["mess"] == "Hostel A"].sample(220, random_state=seed)
    for _, r in sample.iterrows():
        for _ in range(int(rng.integers(1, 4))):
            pop = DISHES[r["dish"]][1]
            rating = int(np.clip(round(rng.normal(1.8 + 3.0 * pop, 0.8)), 1, 5))
            bucket = "high" if rating >= 4 else "mid" if rating == 3 else "low"
            rows.append({"date": r["date"], "meal_type": r["meal_type"], "dish": r["dish"],
                         "student_id": f"S{int(rng.integers(1000, 1400))}", "rating": rating,
                         "comment": str(rng.choice(comments[bucket])),
                         "portion": str(rng.choice(["Too little", "Just right", "Too much"],
                                                   p=[0.15, 0.6, 0.25]))})
    return pd.DataFrame(rows)


def generate_votes(seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed + 5)
    rows = []
    for dish, (meal, pop, _, _) in DISHES.items():
        rows.append({"dish": dish, "meal_type": meal,
                     "upvotes": int(rng.poisson(40 + 120 * pop)),
                     "downvotes": int(rng.poisson(10 + 60 * (1 - pop)))})
    return pd.DataFrame(rows)


def dishes_frame() -> pd.DataFrame:
    return pd.DataFrame([{"dish": k, "meal_type": v[0], "popularity": v[1],
                          "per_capita_kg": v[2], "cost_per_kg": v[3]} for k, v in DISHES.items()])
