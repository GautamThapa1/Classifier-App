import os, time
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from openai import OpenAI, RateLimitError
from .models import Triage, Ticket
from .prompts import SYSTEM_PROMPT, user_prompt

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=30)
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
progress = {"done": 0, "total": 0}

def triage_one(message: str, retries: int = 2):
    last = None
    for attempt in range(retries + 1):
        try:
            r = client.chat.completions.parse(
                model=MODEL,
                temperature=0,
                response_format=Triage,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt(message)},
                ],
            )
            msg = r.choices[0].message
            if msg.refusal:
                return None, f"Model refused: {msg.refusal[:150]}"
            return msg.parsed, None
        except RateLimitError as e:
            if "insufficient_quota" in str(e):
                return None, "OpenAI quota exhausted. Check billing/credits."
            last = "Rate limited"
            time.sleep(3 * (attempt + 1))
        except Exception as e:
            last = str(e)[:200]
            time.sleep(1)
    return None, last

def _run(t: dict) -> dict:
    triage, err = triage_one(t["message"])
    progress["done"] += 1
    return Ticket(id=t["id"], message=t["message"], triage=triage, error=err).model_dump()

def triage_batch(tickets: list[dict]) -> list[dict]:
    progress.update(done=0, total=len(tickets))
    with ThreadPoolExecutor(max_workers=4) as ex:
        return list(ex.map(_run, tickets))