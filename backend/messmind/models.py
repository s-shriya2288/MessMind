"""
Machine learning: food demand prediction as a supervised regression problem.

Target   : consumed_kg  (quantity of food actually required for a meal)
Features : expected attendance, meal type, weekday, weekend, event/holiday flags,
           day index (trend), previous-meal consumption, 7-meal rolling mean,
           historical per-capita demand of the dish, historical dish rating.
Models   : Linear Regression (baseline) · Random Forest · XGBoost
           (falls back to scikit-learn Gradient Boosting if XGBoost can't load)
Split    : chronological — first 80% train, last 20% test (no shuffling, no leakage)
Metrics  : MAE, RMSE, R², plus TimeSeriesSplit cross-validation on the training set
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

try:  # XGBoost needs the OpenMP runtime (brew install libomp on macOS)
    from xgboost import XGBRegressor
    HAS_XGB = True
except Exception:  # pragma: no cover
    HAS_XGB = False

from .data_generator import DISHES, WEEKLY_MENU
from .preprocessing import add_features

FEATURES = [
    "attendance", "meal_is_dinner", "weekday", "is_weekend", "event_flag", "holiday_flag",
    "day_index", "prev_meal_consumption", "rolling7_consumption",
    "dish_per_capita", "dish_avg_rating",
]
FEATURE_LABELS = {
    "attendance": "Expected attendance", "meal_is_dinner": "Meal type", "weekday": "Weekday",
    "is_weekend": "Weekend", "event_flag": "Special event", "holiday_flag": "Holiday",
    "day_index": "Day index (trend)", "prev_meal_consumption": "Previous meal consumption",
    "rolling7_consumption": "7-meal rolling mean", "dish_per_capita": "Dish per-capita demand",
    "dish_avg_rating": "Dish avg rating",
}
TARGET = "consumed_kg"


def _metrics(y, p) -> dict:
    return {"mae": round(float(mean_absolute_error(y, p)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(y, p))), 3),
            "r2": round(float(r2_score(y, p)), 3)}


class DemandModel:
    def __init__(self, clean_df: pd.DataFrame, mess: str = "Hostel A"):
        self.mess = mess
        self.history = clean_df[clean_df["mess"] == mess].copy()
        self.fit()

    # ------------------------------------------------------------------ encoding
    def _encode(self, f: pd.DataFrame) -> pd.DataFrame:
        f = f.copy()
        f["dish_per_capita"] = f["dish"].map(self.dish_pc).fillna(self.global_pc)
        f["dish_avg_rating"] = f["dish"].map(self.dish_rating).fillna(self.global_rating)
        return f

    # ------------------------------------------------------------------ training
    def fit(self):
        feats = add_features(self.history)
        feats = feats.sort_values(["date", "meal_type"]).reset_index(drop=True)
        cut = int(len(feats) * 0.8)
        train, test = feats.iloc[:cut].copy(), feats.iloc[cut:].copy()
        self.split_date = str(test["date"].min().date())

        # target-style encodings learned ONLY from training rows (prevents leakage)
        self.dish_pc = (train["consumed_kg"] / train["attendance"]).groupby(train["dish"]).mean()
        self.global_pc = float((train["consumed_kg"] / train["attendance"]).mean())
        self.dish_rating = train.groupby("dish")["rating"].mean()
        self.global_rating = float(train["rating"].mean())
        train, test = self._encode(train), self._encode(test)
        Xtr, ytr, Xte, yte = train[FEATURES], train[TARGET], test[FEATURES], test[TARGET]

        third_name = "XGBoost Regressor" if HAS_XGB else "Gradient Boosting (XGBoost fallback)"
        third = (XGBRegressor(n_estimators=400, max_depth=3, learning_rate=0.04, subsample=0.9,
                              colsample_bytree=0.9, random_state=42)
                 if HAS_XGB else
                 GradientBoostingRegressor(n_estimators=400, max_depth=3, learning_rate=0.04,
                                           subsample=0.9, random_state=42))
        candidates = {
            "Linear Regression": make_pipeline(StandardScaler(), LinearRegression()),
            "Random Forest Regressor": RandomForestRegressor(n_estimators=300, min_samples_leaf=2,
                                                             random_state=42, n_jobs=-1),
            third_name: third,
        }
        tscv = TimeSeriesSplit(n_splits=5)
        self.results, self.models, preds = [], {}, {}
        for name, m in candidates.items():
            cv = -cross_val_score(m, Xtr, ytr, cv=tscv, scoring="neg_mean_absolute_error")
            m.fit(Xtr, ytr)
            p = m.predict(Xte)
            preds[name] = p
            self.models[name] = m
            self.results.append({"model": name, **_metrics(yte, p),
                                 "train": _metrics(ytr, m.predict(Xtr)),
                                 "cv_mae_mean": round(float(cv.mean()), 3),
                                 "cv_mae_std": round(float(cv.std()), 3)})

        # human baseline: what the kitchen actually prepared vs what was eaten
        self.kitchen_baseline = _metrics(yte, test["prepared_kg"])
        naive = _metrics(yte, test["prev_meal_consumption"])
        self.baselines = [
            {"model": "Kitchen's usual preparation", **self.kitchen_baseline},
            {"model": "Naive: previous meal", **naive},
        ]

        # the PDF's chosen model is the Random Forest
        self.best_name = "Random Forest Regressor"
        self.best = self.models[self.best_name]
        rf = self.best
        tree_preds = np.stack([t.predict(Xte.values) for t in rf.estimators_])
        p_lo, p_hi = np.percentile(tree_preds, [10, 90], axis=0)
        p_rec = np.percentile(tree_preds, 75, axis=0)

        self.test_frame = pd.DataFrame({
            "date": test["date"].dt.strftime("%Y-%m-%d"), "meal_type": test["meal_type"],
            "dish": test["dish"], "attendance": test["attendance"],
            "actual": yte.round(2), "prepared": test["prepared_kg"].round(2),
            "predicted": preds[self.best_name].round(2),
            "linear": preds["Linear Regression"].round(2),
            "boosting": preds[third_name].round(2),
            "lower": p_lo.round(2), "upper": p_hi.round(2),
            "recommended": np.maximum(p_rec, preds[self.best_name]).round(2),
        })
        self.test_frame["residual"] = (self.test_frame["actual"] - self.test_frame["predicted"]).round(2)
        self.test_frame["overproduction"] = (self.test_frame["prepared"] -
                                             self.test_frame["recommended"]).round(2)
        self.coverage = float(((self.test_frame["actual"] >= self.test_frame["lower"]) &
                               (self.test_frame["actual"] <= self.test_frame["upper"])).mean())

        imp = pd.Series(rf.feature_importances_, index=FEATURES).sort_values(ascending=False)
        self.importance = [{"feature": FEATURE_LABELS[k], "importance": round(float(v), 4)}
                           for k, v in imp.items()]
        lin = self.models["Linear Regression"][-1]
        self.coefficients = [{"feature": FEATURE_LABELS[k], "coef": round(float(c), 3)}
                             for k, c in zip(FEATURES, lin.coef_)]
        self.n_train, self.n_test = len(train), len(test)
        self.features_full = feats

    # ------------------------------------------------------------------ inference
    def _expected_attendance(self, weekday: int, meal: str) -> int:
        h = self.features_full
        recent = h[(h["weekday"] == weekday) & (h["meal_type"] == meal) & (h["holiday_flag"] == 0)]
        return int(recent.tail(4)["attendance"].mean())

    def _predict_row(self, row: dict) -> dict:
        X = self._encode(pd.DataFrame([row]))[FEATURES]
        trees = np.array([t.predict(X.values)[0] for t in self.best.estimators_])
        pred = float(self.best.predict(X)[0])
        rec = max(float(np.percentile(trees, 75)), pred)
        return {"predicted_kg": round(pred, 2), "lower_kg": round(float(np.percentile(trees, 10)), 2),
                "upper_kg": round(float(np.percentile(trees, 90)), 2),
                "recommended_prep_kg": round(rec, 2)}

    def usual_preparation(self, meal: str, dish: str) -> float:
        h = self.history
        same = h[(h["meal_type"] == meal) & (h["dish"] == dish)]
        src = same if len(same) else h[h["meal_type"] == meal]
        return round(float(src.tail(8)["prepared_kg"].mean()), 2)

    def predict(self, *, date_str: str, meal_type: str, dish: str | None = None,
                attendance: int | None = None, event_flag: int = 0, holiday_flag: int = 0) -> dict:
        d = pd.Timestamp(date_str)
        wd = d.dayofweek
        dish = dish or WEEKLY_MENU[meal_type][wd]
        h = self.features_full[self.features_full["meal_type"] == meal_type]
        attendance = attendance or self._expected_attendance(wd, meal_type)
        row = {
            "dish": dish, "attendance": attendance, "meal_is_dinner": int(meal_type == "Dinner"),
            "weekday": wd, "is_weekend": int(wd >= 5), "event_flag": int(event_flag),
            "holiday_flag": int(holiday_flag),
            "day_index": int((d - self.features_full["date"].min()).days),
            "prev_meal_consumption": float(h["consumed_kg"].iloc[-1]),
            "rolling7_consumption": float(h["consumed_kg"].tail(7).mean()),
        }
        out = self._predict_row(row)
        usual = self.usual_preparation(meal_type, dish)
        cost = DISHES.get(dish, (None, None, None, 70))[3]
        out.update({"date": d.strftime("%Y-%m-%d"), "weekday": d.day_name(), "meal_type": meal_type,
                    "dish": dish, "attendance": attendance, "usual_prep_kg": usual,
                    "potential_saving_kg": round(max(usual - out["recommended_prep_kg"], 0), 2),
                    "potential_saving_inr": round(max(usual - out["recommended_prep_kg"], 0) * cost)})
        return out

    def forecast(self, days: int = 7) -> list[dict]:
        last = self.features_full["date"].max().date()
        h = {m: list(self.features_full[self.features_full["meal_type"] == m]["consumed_kg"])
             for m in ("Lunch", "Dinner")}
        out = []
        for i in range(1, days + 1):
            d = pd.Timestamp(last + timedelta(days=i))
            for meal in ("Lunch", "Dinner"):
                dish = WEEKLY_MENU[meal][d.dayofweek]
                att = self._expected_attendance(d.dayofweek, meal)
                row = {"dish": dish, "attendance": att, "meal_is_dinner": int(meal == "Dinner"),
                       "weekday": d.dayofweek, "is_weekend": int(d.dayofweek >= 5),
                       "event_flag": 0, "holiday_flag": 0,
                       "day_index": int((d - self.features_full["date"].min()).days),
                       "prev_meal_consumption": h[meal][-1],
                       "rolling7_consumption": float(np.mean(h[meal][-7:]))}
                p = self._predict_row(row)
                h[meal].append(p["predicted_kg"])  # recursive multi-step forecast
                usual = self.usual_preparation(meal, dish)
                out.append({"date": d.strftime("%Y-%m-%d"), "day": d.strftime("%a %d %b"),
                            "meal_type": meal, "dish": dish, "attendance": att, **p,
                            "usual_prep_kg": usual,
                            "potential_saving_kg": round(max(usual - p["recommended_prep_kg"], 0), 2)})
        return out

    def summary(self) -> dict:
        return {"mess": self.mess, "n_records": int(len(self.history)), "n_train": self.n_train,
                "n_test": self.n_test, "split_date": self.split_date, "target": TARGET,
                "features": [FEATURE_LABELS[f] for f in FEATURES], "best_model": self.best_name,
                "has_xgboost": HAS_XGB, "interval_coverage": round(self.coverage, 3),
                "results": self.results, "baselines": self.baselines,
                "importance": self.importance, "coefficients": self.coefficients}


def today_str() -> str:
    return date.today().isoformat()
