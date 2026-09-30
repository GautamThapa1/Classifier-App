import json
from app.main import normalize
from app.llm import triage_batch

RUNS = 3
tickets = normalize(json.load(open("data/support_tickets.json")))
runs = [triage_batch(tickets) for _ in range(RUNS)]

# checks if the field are consistent across runs
def values(i, field):
    return [r[i]["triage"][field] if r[i]["triage"] else None for r in runs]

for field in ("urgency", "category", "sentiment", "confidence"):
    unstable = []
    for i, t in enumerate(tickets):
        vals = values(i, field)
        if len(set(vals)) > 1:
            unstable.append(f'#{t["id"]} {vals}')
    same = len(tickets) - len(unstable)
    print(f"{field}: {same}/{len(tickets)} identical across {RUNS} runs")
    for u in unstable:
        print("   ", u)