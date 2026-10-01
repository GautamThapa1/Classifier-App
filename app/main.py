import json
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .llm import MODEL, triage_batch
from .prompts import SYSTEM_PROMPT

BASE = Path(__file__).parent
DATA = BASE.parent / "data" / "support_tickets.json"
RUNS = BASE.parent / "runs"
HIST = BASE.parent / "history"

app = FastAPI()
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
templates = Jinja2Templates(directory=BASE / "templates")

# gets called by @app.post("/api/triage")
def normalize(raw) -> list[dict]:
    items = raw.get("tickets") if isinstance(raw, dict) else raw
    if not isinstance(items, list) or not items:
        raise HTTPException(400, "Expected a non-empty JSON list of tickets.")
    out = []
    for i, t in enumerate(items[:50], 1):
        if not isinstance(t, dict):
            raise HTTPException(400, f"Ticket #{i} is not an object.")
        msg = next((str(t[k]).strip() for k in ("message", "text", "customer_message", "body") if t.get(k)), "")
        if not msg: # if empty raise exception
            raise HTTPException(400, f"Ticket #{i} has no message text.")
        out.append({"id": t.get("id", i), "message": msg[:2000]})
    return out

# gets called by @app.post("/api/triage")
def build_stats(tickets: list[dict]) -> dict:
    done = [t for t in tickets if t["triage"]]
    count = lambda k: dict(Counter(t["triage"][k] for t in done))
    return {
        "total": len(tickets),
        "failed": len(tickets) - len(done),
        "urgency": count("urgency"), # being called here
        "category": count("category"),
        "sentiment": count("sentiment"),
        "low_confidence": sum(t["triage"]["confidence"] == "Low" for t in done),
    }

def run_files():
    return sorted(RUNS.glob("v*.json"), key=lambda p: int(p.stem[1:])) # stem removes the suffix 

# gets called by @app.post("/api/triage")
def save_run(result: dict) -> dict:
    RUNS.mkdir(exist_ok=True)
    HIST.mkdir(exist_ok=True)
    files = run_files() # go inside the RUNS, and sort them 
    n = int(files[-1].stem[1:]) + 1 if files else 1
    result["version"], result["model"] = f"v{n}", MODEL
    (RUNS / f"v{n}.json").write_text(json.dumps(result, indent=2))
    (HIST / f"v{n}_prompt.txt").write_text(SYSTEM_PROMPT)
    return result

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.get("/api/results")
def results():
    files = run_files()
    if files:
        return json.loads(files[-1].read_text())
    return {"tickets": [], "stats": None}

@app.post("/api/triage")
def triage(payload: Any = Body(default=None)):
    raw = json.loads(DATA.read_text()) if payload is None or payload == {} else payload
    tickets = triage_batch(normalize(raw))
    result = {"tickets": tickets, "stats": build_stats(tickets)}
    return save_run(result)