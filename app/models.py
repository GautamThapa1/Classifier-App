from typing import Literal
from pydantic import BaseModel

class Triage(BaseModel):
    reasoning: str          # key facts + which urgency rubric line applies
    uncertainty: str         # what can't be verified from the message, or "None"
    urgency: Literal["Critical", "High", "Medium", "Low"]
    category: Literal["Billing", "Technical", "Account", "Feedback", "Feature Request", "How-To", "Other"]
    sentiment: Literal["Angry", "Frustrated", "Anxious", "Neutral", "Happy"]
    confidence: Literal["High", "Medium", "Low"]
    suggested_reply: str
    
class Ticket(BaseModel):
    id: int | str
    message: str
    triage: Triage | None = None
    error: str | None = None