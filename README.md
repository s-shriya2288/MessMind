# MESSMIND — Predict. Prevent. Preserve.

AI-powered food-waste prediction and intelligent mess management for hostel messes,
universities, hotels and institutional cafeterias.

**Stack:** Pandas · NumPy · scikit-learn · XGBoost · Matplotlib · Seaborn · FastAPI · SQLite/PostgreSQL · OpenPyXL · React · Tailwind · Recharts

## Run it

```bash
./run.sh
```
Then open http://localhost:8000. The first run creates the Python venv, installs packages and builds the frontend.

Manual / dev mode (hot reload):
```bash
cd backend && .venv/bin/uvicorn main:app --reload --port 8000     # API + built app
cd frontend && npm run dev                                         # http://localhost:5173 (proxies /api)
```
Open the analysis notebook: `cd backend && .venv/bin/jupyter notebook MessMind_Analysis.ipynb`

> **XGBoost on macOS** needs OpenMP: `brew install libomp`. Without it the app automatically
> uses scikit-learn's Gradient Boosting as the boosting model.

## What's inside

| Learning-loop stage | Where | Data-science concepts |
|---|---|---|
| **Collect** | `messmind/data_generator.py` | 5 tables (Daily_Consumption, Food_Wastage, Inventory, Food_Feedback, Dish_Votes); synthetic 180 days × 2 meals × 3 messes; injected dirty data |
| **Clean** | `messmind/preprocessing.py` | Category standardisation, unit conversion (g→kg), de-duplication, IQR outlier detection, group-median / dish-mean imputation |
| **Explore** | `messmind/analytics.py`, `messmind/plots.py` | describe() + skew, most/least-wasted dishes, daily/weekly trends, meal-wise and weekday comparison, histograms, attendance–consumption correlation + linear fit, correlation heatmap, preference heatmap, waste-category pie, portion feedback |
| **Feature engineering** | `preprocessing.add_features` | Weekday, weekend, meal type, day index (trend), lag feature (previous-meal consumption), 7-meal rolling mean, train-only target encoding (dish per-capita demand, dish rating) |
| **Predict** | `messmind/models.py` | Supervised regression; Linear Regression · Random Forest · XGBoost; recursive 7-day forecast; prediction intervals from the forest's trees |
| **Evaluate** | `models.py` | Chronological 80/20 split, MAE / RMSE / R², 5-fold TimeSeriesSplit CV, train-vs-test overfitting check, baselines (kitchen's usual prep, naive previous meal), residuals, feature importance, standardised coefficients |
| **Recommend / Measure** | `analytics.recommendations`, `analytics.sustainability` | Preparation quantity (P75 of tree predictions), FEFO inventory and expiry risk, menu and portion changes, procurement; simulated food/cost saved |

### Web app (delivery layer)
- **Overview** — problem, learning loop, KPIs, roadmap
- **Data Science Lab** — every pipeline stage with interactive charts + Matplotlib/Seaborn report gallery
- **Mess Manager** — forecast & preparation guidance, what-if predictor, leftover monitoring, FEFO inventory, daily entry form, CSV/Excel upload (automatic re-cleaning + retraining), recommendations with human approval
- **Student** — rate meals, portion feedback, vote on dishes, sustainability progress
- **Administrator** — compare messes, weekly waste trends, waste categories, illustrative financial metrics, downloadable `.xlsx` sustainability report, reset demo data

### Database
SQLite file `backend/messmind.db` by default. To use PostgreSQL:
```bash
pip install psycopg
DATABASE_URL=postgresql+psycopg://user:pass@localhost/messmind .venv/bin/uvicorn main:app
```

## Important limitation
All metrics are computed on **synthetic data only** and are not evidence of accuracy in a real hostel.
Validate with actual mess records (attendance, preparation, consumption, leftovers) before deployment —
then retrain and retest. Human approval remains required before operational changes.
