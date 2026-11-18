"""
MessMind API — FastAPI delivery layer for the data-science pipeline.

Run:  .venv/bin/uvicorn main:app --reload --port 8000
DB :  SQLite by default (messmind.db). Set DATABASE_URL=postgresql+psycopg://user:pw@host/db
      to use PostgreSQL instead (pip install psycopg).
"""
from __future__ import annotations

import io
import json
import os
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, inspect

from messmind import analytics as A
from messmind import data_generator as G
from messmind.models import DemandModel
from messmind.preprocessing import REQUIRED_COLUMNS, add_features, clean

try:  # plotting libs are optional (left out of the Vercel bundle to keep it small)
    from messmind import plots
except Exception:  # pragma: no cover
    plots = None

BASE = Path(__file__).parent
REPORTS = BASE / "reports"
FRONTEND_DIST = BASE.parent / "frontend" / "dist"
ON_VERCEL = bool(os.environ.get("VERCEL"))
# serverless filesystems are read-only except /tmp
DB_PATH = Path("/tmp/messmind.db") if ON_VERCEL else BASE / "messmind.db"
engine = create_engine(os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}"))

app = FastAPI(title="MessMind API", version="1.0",
              description="Predict. Prevent. Preserve. — AI-powered food-waste prediction.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ============================================================================ storage
def seed_database(force: bool = False):
    if not force and inspect(engine).has_table("raw_records"):
        return
    meals = G.generate_meal_records()
    G.inject_dirty_data(meals).to_sql("raw_records", engine, if_exists="replace", index=False)
    G.generate_waste_breakdown(meals).to_sql("food_wastage", engine, if_exists="replace", index=False)
    G.generate_inventory().to_sql("inventory", engine, if_exists="replace", index=False)
    G.generate_feedback(meals).to_sql("food_feedback", engine, if_exists="replace", index=False)
    G.generate_votes().to_sql("dish_votes", engine, if_exists="replace", index=False)


def table(name: str) -> pd.DataFrame:
    df = pd.read_sql_table(name, engine)
    df.columns = [str(c) for c in df.columns]  # SQLAlchemy returns quoted_name objects
    return df


class State:
    """Cleaned data + trained model, rebuilt whenever new data arrives."""

    ready = False

    def rebuild(self, make_plots: bool = True):
        self.raw = table("raw_records")
        self.clean, self.report = clean(self.raw)
        self.feats = add_features(self.clean)
        self.waste = table("food_wastage")
        self.feedback = table("food_feedback")
        self.votes = table("dish_votes")
        self.inventory = table("inventory")
        self.model = DemandModel(self.clean, mess="Hostel A")
        self.trained_at = datetime.now().isoformat(timespec="seconds")
        if make_plots and plots is not None and not ON_VERCEL:
            self.figures = plots.generate(self.clean, self.feats, self.waste, self.feedback,
                                          self.model.test_frame, self.model.importance, REPORTS)
        elif not getattr(self, "figures", None):
            manifest = REPORTS / "figures.json"
            self.figures = json.loads(manifest.read_text()) if manifest.exists() else []
        self.ready = True

    def mess_df(self, mess: str):
        d = self.clean[self.clean["mess"] == mess]
        if d.empty:
            raise HTTPException(404, f"Unknown mess '{mess}'")
        return d


S = State()


def ensure_ready():
    if not S.ready:
        seed_database()
        S.rebuild()


@app.middleware("http")
async def _lazy_init(request, call_next):
    # works for both a long-running server and serverless cold starts
    if request.url.path.startswith("/api"):
        ensure_ready()
    return await call_next(request)


if REPORTS.exists():
    app.mount("/reports", StaticFiles(directory=REPORTS), name="reports")


# ============================================================================ overview / DS lab
@app.get("/api/meta")
def meta():
    return {"messes": sorted(S.clean["mess"].unique()), "dishes": G.dishes_frame().to_dict("records"),
            "menu": G.WEEKLY_MENU, "trained_at": S.trained_at,
            "date_range": [S.clean["date"].min().strftime("%Y-%m-%d"),
                           S.clean["date"].max().strftime("%Y-%m-%d")]}


@app.get("/api/collect")
def collect():
    """Collect stage: raw tables, sizes and a sample of the messy input."""
    raw = S.raw
    sample = raw[raw["mess"] == "Hostel A"].head(12).astype(object).where(raw.notna(), None)
    return {
        "tables": [
            {"name": "Daily_Consumption (raw)", "rows": len(raw), "cols": list(raw.columns)},
            {"name": "Food_Wastage", "rows": len(S.waste), "cols": list(S.waste.columns)},
            {"name": "Inventory", "rows": len(S.inventory), "cols": list(S.inventory.columns)},
            {"name": "Food_Feedback", "rows": len(S.feedback), "cols": list(S.feedback.columns)},
            {"name": "Dish_Votes", "rows": len(S.votes), "cols": list(S.votes.columns)},
        ],
        "sample": sample.to_dict("records"),
        "missing": {c: int(v) for c, v in raw.isna().sum().items() if v},
    }


@app.get("/api/clean")
def clean_report():
    after = S.clean[S.clean["mess"] == "Hostel A"].head(12).copy()
    after["date"] = after["date"].dt.strftime("%Y-%m-%d")
    return {**S.report, "sample": after.round(2).to_dict("records")}


@app.get("/api/eda")
def eda(mess: str = "Hostel A"):
    d = S.mess_df(mess)
    return {
        "kpis": A.kpis(d),
        "describe": A.describe(d),
        "dish_waste": A.dish_waste(d),
        "daily": A.daily_trend(d),
        "weekly": A.weekly_trend(d),
        "weekday_meal": A.weekday_meal(d),
        "scatter": A.scatter_attendance(d),
        "hist_leftover": A.histogram(d["leftover_kg"]),
        "hist_consumed": A.histogram(d["consumed_kg"]),
        "correlation": A.correlation(S.feats[S.feats["mess"] == mess]),
        "preference": A.preference_heatmap(S.feedback),
        "waste_categories": A.waste_categories(S.waste[S.waste["mess"] == mess]),
        "portion": A.portion_feedback(S.feedback),
    }


@app.get("/api/model")
def model_info():
    return {**S.model.summary(), "test": S.model.test_frame.to_dict("records"),
            "trained_at": S.trained_at}


@app.get("/api/figures")
def figures():
    return S.figures


# ============================================================================ predictions
class PredictIn(BaseModel):
    date: str = Field(default_factory=lambda: date.today().isoformat())
    meal_type: str = "Lunch"
    dish: str | None = None
    attendance: int | None = None
    event_flag: int = 0
    holiday_flag: int = 0


@app.post("/api/predict")
def predict(p: PredictIn):
    if p.meal_type not in ("Lunch", "Dinner"):
        raise HTTPException(400, "meal_type must be Lunch or Dinner")
    return S.model.predict(date_str=p.date, meal_type=p.meal_type, dish=p.dish,
                           attendance=p.attendance, event_flag=p.event_flag, holiday_flag=p.holiday_flag)


@app.get("/api/forecast")
def forecast(days: int = 7):
    return S.model.forecast(min(max(days, 1), 14))


@app.get("/api/recommendations")
def recommendations():
    inv = A.inventory_status(S.inventory)
    return A.recommendations(S.model.forecast(7), inv, A.dish_waste(S.mess_df("Hostel A")),
                             S.feedback, S.votes)


# ============================================================================ manager
@app.get("/api/inventory")
def inventory():
    return A.inventory_status(S.inventory)


class InventoryIn(BaseModel):
    item: str
    quantity: float
    unit: str = "kg"
    cost_per_unit: float = 50
    daily_usage: float = 1
    expiry_date: str


@app.post("/api/inventory")
def add_inventory(i: InventoryIn):
    existing = S.inventory[S.inventory["item"] == i.item]
    row = {**i.model_dump(), "batch": f"B{len(existing) + 1}", "received_date": date.today().isoformat()}
    pd.DataFrame([row]).to_sql("inventory", engine, if_exists="append", index=False)
    S.inventory = table("inventory")
    return {"ok": True}


class RecordIn(BaseModel):
    date: str
    meal_type: str
    dish: str
    attendance: int
    prepared_kg: float
    consumed_kg: float
    leftover_kg: float | None = None
    rating: float | None = None
    event_flag: int = 0
    holiday_flag: int = 0
    mess: str = "Hostel A"


def _append_records(df: pd.DataFrame):
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise HTTPException(400, f"Missing required columns: {', '.join(missing)}")
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    for c, default in (("mess", "Hostel A"), ("unit", "kg"), ("event_flag", 0), ("holiday_flag", 0),
                       ("rating", None), ("leftover_kg", None)):
        if c not in df.columns:
            df[c] = default
    cols = list(table("raw_records").columns)
    df = df[[c for c in cols if c in df.columns]]
    df.to_sql("raw_records", engine, if_exists="append", index=False)
    S.rebuild(make_plots=False)


@app.post("/api/records")
def add_record(r: RecordIn):
    _append_records(pd.DataFrame([r.model_dump()]))
    return {"ok": True, "trained_at": S.trained_at, "records": int(len(S.model.history))}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    name = (file.filename or "").lower()
    try:
        df = pd.read_excel(io.BytesIO(content)) if name.endswith((".xlsx", ".xls")) \
            else pd.read_csv(io.BytesIO(content))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not read file: {e}")
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    before = len(S.model.history)
    _append_records(df)
    return {"ok": True, "rows_uploaded": len(df), "records_before": before,
            "records_after": int(len(S.model.history)), "trained_at": S.trained_at,
            "metrics": S.model.summary()["results"]}


@app.get("/api/template.csv")
def template():
    t = S.clean[S.clean["mess"] == "Hostel A"].tail(4)[
        ["date", "meal_type", "dish", "attendance", "prepared_kg", "consumed_kg", "leftover_kg", "rating",
         "event_flag", "holiday_flag"]].copy()
    t["date"] = t["date"].dt.strftime("%Y-%m-%d")
    return StreamingResponse(io.StringIO(t.to_csv(index=False)), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=messmind_template.csv"})


@app.get("/api/records/recent")
def recent(mess: str = "Hostel A", n: int = 14):
    d = S.mess_df(mess).tail(n).copy()
    d["date"] = d["date"].dt.strftime("%Y-%m-%d")
    return d.round(2).iloc[::-1].to_dict("records")


# ============================================================================ student
class FeedbackIn(BaseModel):
    dish: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""
    portion: str = "Just right"
    meal_type: str = "Lunch"
    student_id: str = "S-anon"


@app.post("/api/feedback")
def add_feedback(f: FeedbackIn):
    row = {**f.model_dump(), "date": date.today().isoformat()}
    pd.DataFrame([row]).to_sql("food_feedback", engine, if_exists="append", index=False)
    S.feedback = table("food_feedback")
    return {"ok": True, "total": len(S.feedback)}


@app.get("/api/feedback")
def list_feedback(n: int = 20):
    fb = S.feedback.sort_values("date", ascending=False).head(n)
    avg = S.feedback.groupby("dish")["rating"].agg(["mean", "count"]).round(2).reset_index()
    return {"recent": fb.to_dict("records"),
            "dish_ratings": avg.rename(columns={"mean": "rating"}).sort_values("rating", ascending=False)
            .to_dict("records")}


@app.get("/api/votes")
def votes():
    v = S.votes.copy()
    v["score"] = v["upvotes"] - v["downvotes"]
    return v.sort_values("score", ascending=False).to_dict("records")


class VoteIn(BaseModel):
    dish: str
    up: bool = True


@app.post("/api/votes")
def vote(v: VoteIn):
    col = "upvotes" if v.up else "downvotes"
    S.votes.loc[S.votes["dish"] == v.dish, col] += 1
    S.votes.to_sql("dish_votes", engine, if_exists="replace", index=False)
    return votes()


@app.get("/api/sustainability")
def sustainability():
    return A.sustainability(S.model.test_frame, S.mess_df("Hostel A"))


# ============================================================================ admin
@app.get("/api/admin/compare")
def admin_compare():
    out = A.compare_messes(S.clean)
    for m in out["messes"]:
        cats = A.waste_categories(S.waste[S.waste["mess"] == m["mess"]])
        m["categories"] = {c["category"]: c["kg"] for c in cats}
    return out


@app.get("/api/admin/report.xlsx")
def report_xlsx():
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        pd.DataFrame(A.compare_messes(S.clean)["messes"]).to_excel(xw, sheet_name="Mess KPIs", index=False)
        pd.DataFrame(A.dish_waste(S.mess_df("Hostel A"))).to_excel(xw, sheet_name="Dish waste (A)", index=False)
        pd.DataFrame(S.model.summary()["results"]).drop(columns=["train"]).to_excel(
            xw, sheet_name="Model metrics", index=False)
        pd.DataFrame(S.model.forecast(7)).to_excel(xw, sheet_name="7-day forecast", index=False)
        pd.DataFrame(A.inventory_status(S.inventory)).to_excel(xw, sheet_name="Inventory FEFO", index=False)
        pd.DataFrame([A.sustainability(S.model.test_frame, S.clean)]).drop(columns=["cumulative"]) \
            .to_excel(xw, sheet_name="Sustainability", index=False)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=messmind_sustainability_report.xlsx"})


@app.post("/api/admin/reset")
def reset():
    seed_database(force=True)
    S.rebuild()
    return {"ok": True}


# ============================================================================ serve built frontend
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
