# 🐇 Rabbit AI — Sales Insight Automator

A secure, containerized application that lets team members upload sales data files (.csv / .xlsx), generates an AI-powered executive summary using **Google Gemini**, and emails the report directly to the specified recipient.

---

## Architecture

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Frontend   │──POST──▶   Backend    │──API──▶   Gemini AI   │
│  React/Vite  │        │   FastAPI    │        └──────────────┘
└──────────────┘        │              │──SMTP──▶  Gmail / SMTP
                        └──────────────┘
```

| Layer      | Tech                        | Deployment |
|------------|-----------------------------|------------|
| Frontend   | React 18 + Vite 5           | Vercel     |
| Backend    | Python 3.11 + FastAPI       | Render     |
| AI Engine  | Google Gemini 2.0 Flash     | API        |
| Email      | Gmail SMTP (App Password)   | —          |

---

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose **or** Python 3.11+ and Node.js 20+
- A Google Gemini API key
- A Gmail address with an [App Password](https://support.google.com/accounts/answer/185833)

### With Docker Compose

```bash
# 1. Clone the repo
git clone <repo-url> && cd rabbit-ai

# 2. Create backend .env
cp backend/.env.example backend/.env
# → fill in GEMINI_API_KEY, EMAIL_ADDRESS, EMAIL_PASSWORD

# 3. Start everything
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000
- Swagger Docs → http://localhost:8000/docs

### Without Docker

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

- Frontend → http://localhost:5173
- Backend → http://localhost:8000/docs

---

## API Documentation

Interactive Swagger UI is available at `/docs` when the backend is running. ReDoc is at `/redoc`.

### Endpoints

| Method | Path                     | Description                        |
|--------|--------------------------|------------------------------------|
| GET    | `/health`                | Liveness probe                     |
| POST   | `/upload-and-summarize/` | Upload file + generate + email     |

---

## Security Features

- **Rate limiting** — 10 requests/minute per IP via `slowapi`
- **File validation** — type (`.csv`/`.xlsx` only) and size (10 MB max)
- **CORS** — restricted to configured origins
- **Input validation** — email validated via Pydantic `EmailStr`
- **Environment isolation** — secrets loaded from `.env`, never hard-coded

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) triggers on PRs to `main`:

1. **Backend** — installs deps, lints with `flake8`, validates imports
2. **Frontend** — installs deps, lints with `eslint`, builds production bundle
3. **Docker** — validates both Docker images build successfully

---

## Deployment

| Service  | Platform | Config File       |
|----------|----------|-------------------|
| Backend  | Render   | `render.yaml`     |
| Frontend | Vercel   | `frontend/vercel.json` |

### Render (Backend)
1. Connect your GitHub repo to Render
2. It auto-detects `render.yaml` and creates the service
3. Set the environment variables in the Render dashboard

### Vercel (Frontend)
1. Import the repo → set **Root Directory** to `frontend`
2. Set `VITE_API_URL` env var to your Render backend URL
3. Deploy

---

## Environment Variables

### Backend (`backend/.env`)
| Variable          | Description                              |
|-------------------|------------------------------------------|
| `GEMINI_API_KEY`  | Google Gemini API key                    |
| `EMAIL_ADDRESS`   | Gmail address for sending reports        |
| `EMAIL_PASSWORD`  | Gmail App Password                       |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs for CORS   |

### Frontend (`frontend/.env`)
| Variable        | Description          |
|-----------------|----------------------|
| `VITE_API_URL`  | Backend API base URL |

---

## Project Structure

```
rabbit-ai/
├── .github/workflows/ci.yml   # CI pipeline
├── backend/
│   ├── Dockerfile
│   ├── main.py                 # FastAPI application
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── index.css
├── docker-compose.yml
├── render.yaml
└── README.md
```
