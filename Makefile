run:
	uv run uvicorn app.main:app --reload

# Run 20 tickets three times to check label consistency (60 API calls).
con:
	uv run python -m scripts.consistency