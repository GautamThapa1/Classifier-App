import re
from typing import Literal

from pydantic import BaseModel, computed_field, field_validator

# Reply guardrail: phrases the prompt bans but models still slip in.
BANNED_REPLY = re.compile(
    r"\bI['’]m marking\b|\bescalat\w*|\bimmediately\b|\bshortly\b|\bright away\b|\bas soon as\b"
    r"|\b(?:I|we)(?:['’]ve|['’]ll| have| will)\b"
    r"|\bplease (?:ensure|consider|check|try|make sure|restart|reinstall|update|change)\b",
    re.I,
)

# Schema for llm, gets used in llm.py
class Triage(BaseModel):
    reasoning: str           # third person, key facts only, no rubric names
    uncertainty: str         # what can't be verified from the message, or "None"
    urgency: Literal["Critical", "High", "Medium", "Low"]
    category: Literal["Billing", "Technical", "Account", "Feedback", "Feature Request", "How-To", "Other"]
    sentiment: Literal["Angry", "Frustrated", "Anxious", "Neutral", "Happy"]
    confidence: Literal["High", "Medium", "Low"]
    suggested_reply: str

    @field_validator("suggested_reply") # guardrail to search in BANNED_REPLY
    @classmethod
    def reply_follows_rules(cls, v: str) -> str:
        m = BANNED_REPLY.search(v)
        if m:
            raise ValueError(
                f"Reply contains forbidden wording '{m.group(0)}'. Do not claim actions, promise timelines, "
                "or give the customer advice."
            )
        return v

    # future work
    @computed_field  # decided by the code not llm, and add it to above list but by the code
    @property # makes it behave like an attribute: i.e: triage.needs_human_review
    def needs_human_review(self) -> bool:
        return (
            self.urgency == "Critical"
            or self.confidence == "Low"
            or (self.urgency == "High" and self.category in ("Billing", "Account"))
        )

# Format before saving, gets used in llm.py
class Ticket(BaseModel):
    id: int | str
    message: str
    triage: Triage | None = None
    error: str | None = None