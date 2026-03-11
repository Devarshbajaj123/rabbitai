from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import EmailStr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn
import os
import pandas as pd
import io
import google.generativeai as genai
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Rabbit AI — Sales Insight Automator",
    description=(
        "Upload sales data files (.csv / .xlsx), generate AI-powered executive "
        "summaries via Google Gemini, and deliver them straight to an inbox."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS — allow configured origins
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    """Liveness probe — returns 200 when the service is up."""
    return {"status": "healthy"}


@app.post("/upload-and-summarize/", tags=["Sales Insight"])
@limiter.limit("10/minute")
async def upload_and_summarize(
    request: Request,
    file: UploadFile = File(..., description="A .csv or .xlsx sales data file (max 10 MB)"),
    recipient_email: EmailStr = Form(..., description="Email address to receive the summary"),
):
    """
    Upload a sales data file, generate an AI narrative summary, and email it.

    - **file** — `.csv` or `.xlsx` containing sales data (≤ 10 MB)
    - **recipient_email** — where the finished report is sent
    """

    # --- env vars -----------------------------------------------------------
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

    if not all([GEMINI_API_KEY, EMAIL_ADDRESS, EMAIL_PASSWORD]):
        raise HTTPException(
            status_code=500,
            detail="Server not configured. Missing environment variables.",
        )

    # --- validate file type --------------------------------------------------
    if not file.filename or not file.filename.lower().endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .csv and .xlsx files are accepted.",
        )

    # --- read & enforce size limit -------------------------------------------
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    # --- parse data ----------------------------------------------------------
    try:
        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_content))
        else:
            df = pd.read_excel(io.BytesIO(file_content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file contains no data.")

    # Truncate large datasets so we don't blow the LLM context window
    preview = df.head(150).to_markdown() if len(df) > 150 else df.to_markdown()
    row_note = f"\n\n(Showing first 150 of {len(df)} rows)" if len(df) > 150 else ""

    # --- generate AI summary -------------------------------------------------
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = (
            "You are a senior business analyst at a Fortune-500 company. "
            "Analyze the following sales data and produce a professional executive "
            "summary suitable for C-suite leadership. Include:\n"
            "1. High-level overview\n"
            "2. Key trends and patterns\n"
            "3. Top performers / products\n"
            "4. Areas of concern\n"
            "5. Actionable recommendations\n\n"
            "Use clear section headings and bullet points where appropriate.\n\n"
            f"Data ({len(df)} total rows):\n{preview}{row_note}"
        )
        response = model.generate_content(prompt)
        ai_summary = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI summary generation failed: {e}")

    # --- send email ----------------------------------------------------------
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = EMAIL_ADDRESS
        msg["To"] = recipient_email
        msg["Subject"] = "Sales Insight Report — AI-Generated Summary"

        msg.attach(MIMEText(ai_summary, "plain"))

        html_summary = ai_summary.replace("\n", "<br>")
        html_body = (
            "<html><body>"
            "<div style='font-family:Arial,sans-serif;max-width:700px;margin:auto;padding:20px;'>"
            "<h2 style='color:#6C3CE1;'>Sales Insight Report</h2>"
            "<p style='color:#888;font-size:13px;'>Generated by Rabbit AI</p><hr>"
            f"<div style='line-height:1.7;color:#333;'>{html_summary}</div>"
            "<hr><p style='font-size:11px;color:#aaa;'>"
            "This report was auto-generated from uploaded sales data.</p>"
            "</div></body></html>"
        )
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            smtp.send_message(msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")

    return JSONResponse(
        status_code=200,
        content={
            "message": "Summary generated and emailed successfully.",
            "summary": ai_summary,
            "recipient": recipient_email,
        },
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)