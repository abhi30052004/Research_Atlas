# Atlas AI Backend

Production-ready backend for Atlas AI Research & Knowledge Management Platform — a Google NotebookLM-inspired system for uploading documents, asking AI-powered questions, and generating structured research artifacts.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API Framework** | FastAPI 0.115 (async, Python 3.12) |
| **Database** | MongoDB 7 + Motor (async driver) |
| **Vector DB** | ChromaDB 0.5 |
| **AI / LLM** | OpenAI GPT-4o / GPT-4.1, Groq (Llama, Mixtral) |
| **Orchestration** | LangGraph (multi-node agent pipeline) |
| **Embeddings** | OpenAI text-embedding-3-large |
| **Task Queue** | Celery + Redis |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Real-time** | WebSockets + SSE streaming |
| **Deployment** | Render (API + Worker), Docker |

---

## Project Structure

```
backend/
├── app/
│   ├── api/v1/           # Route handlers (auth, workspaces, sources, chat, notes, artifacts, search, analytics, exports)
│   ├── core/             # Config, DB connection, Redis, security, JWT, deps
│   ├── models/           # Pydantic MongoDB models
│   ├── schemas/          # Request/response Pydantic schemas
│   ├── services/         # Business logic layer
│   ├── langgraph/        # Multi-node AI agent (state, nodes, graph)
│   ├── workers/          # Celery tasks (source processing pipeline)
│   ├── utils/            # File extractors, chunking, email
│   └── main.py           # FastAPI app entrypoint
├── tests/
│   ├── unit/             # Security, chunking, schema validation
│   ├── integration/      # RAG pipeline integration
│   └── api/              # Endpoint tests
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── render.yaml
└── .env.example
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys and connection strings
```

### 3. Start Dependencies with Docker

```bash
# Start MongoDB, Redis, ChromaDB only
docker-compose up -d mongodb redis chromadb
```

### 4. Run the API Server

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Run the Celery Worker

```bash
celery -A app.workers.celery_app worker --loglevel=info -Q sources
```

### 6. (Optional) Flower Dashboard

```bash
celery -A app.workers.celery_app flower --port=5555
```

---

## Docker (Full Stack)

```bash
# Copy and configure environment
cp .env.example .env

# Start everything
docker-compose up --build

# Services:
#   API:      http://localhost:8000
#   Flower:   http://localhost:5555
#   MongoDB:  localhost:27017
#   Redis:    localhost:6379
#   ChromaDB: localhost:8001
```

---

## API Overview

### Authentication (`/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account |
| POST | `/login` | Get access + refresh tokens |
| POST | `/refresh` | Rotate refresh token |
| POST | `/logout` | Revoke refresh token |
| POST | `/forgot-password` | Send reset email |
| POST | `/reset-password` | Set new password |
| GET | `/me` | Get current user |

### Workspaces (`/api/v1/workspaces`)

CRUD for named workspaces that group sources, chats, notes, and artifacts.

### Sources (`/api/v1/sources`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload?workspace_id=` | Upload file (PDF/DOCX/TXT/CSV/XLSX/PPTX) |
| POST | `/url` | Add website URL |
| GET | `?workspace_id=` | List sources |
| GET | `/{id}` | Get source + processing status |
| DELETE | `/{id}` | Delete source + remove vectors |

Supported file types: **PDF** (PyMuPDF), **DOCX** (python-docx), **TXT**, **CSV** (pandas), **XLSX** (openpyxl), **PPTX** (python-pptx), **URLs** (BeautifulSoup4)

### Chat (`/api/v1/chat`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `` | Create chat session |
| GET | `?workspace_id=` | List chats |
| GET | `/{id}` | Get chat with message history |
| POST | `/{id}/messages/stream` | Stream AI response (SSE) |
| POST | `/{id}/messages/regenerate` | Regenerate a response |
| DELETE | `/{id}` | Delete chat |
| WS | `/ws/{workspace_id}?token=` | WebSocket streaming |

### Notes (`/api/v1/notes`)

TipTap-compatible CRUD — stores `content_json`, `content_html`, and `content_text` fields.

### Artifacts (`/api/v1/artifacts`)

Generate 13 artifact types:
`summary`, `research_report`, `blog_outline`, `faq`, `sop`, `comparison_report`, `data_table`, `slide_deck`, `mind_map`, `flashcards`, `quiz`, `infographic_content`, `audio_overview_script`

### Exports (`/api/v1/exports`)

Export notes, artifacts, and chats as: **PDF**, **DOCX**, **PPTX**, **CSV**, **Markdown**

### Search (`/api/v1/search`)

Global text search across sources, notes, chats, and artifacts using MongoDB text indexes.

### Analytics (`/api/v1/analytics`)

```
GET /dashboard?days=30
```
Returns AI request counts, tokens consumed, source uploads, artifact generations, and daily activity.

---

## LangGraph Agent Pipeline

```
START
  → Query Analysis       (sanitize, init state)
  → Document Retrieval   (ChromaDB semantic search)
  → Context Ranking      (relevance-scored sort)
  → Answer Generation    (GPT-4o / Groq streaming)
  → Citation Generator   (source attribution)
  → Followup Generator   (3 follow-up questions)
END
```

Dynamic model selection: pass `"model": "gpt-4o"` | `"gpt-4.1"` | `"llama-3.3-70b-versatile"` | `"mixtral-8x7b-32768"` in any chat or artifact request.

---

## RAG Pipeline

1. **Upload** → file saved to `./uploads/{workspace_id}/`
2. **Extract** → text extraction by file type
3. **Chunk** → RecursiveCharacterTextSplitter (1000 tokens / 200 overlap)
4. **Embed** → OpenAI `text-embedding-3-large`
5. **Store** → ChromaDB collection `workspace_{workspace_id}`
6. **Retrieve** → semantic similarity search (top-K)
7. **Generate** → LLM response with citations

---

## Security

- JWT access tokens (30 min) + refresh tokens (7 days), auto-rotated
- bcrypt password hashing (cost factor 12)
- Rate limiting via Redis (100 req/min per IP)
- Prompt injection detection on all user inputs
- File type validation via `python-magic` (MIME sniffing, not just extension)
- File size limit (default 50MB)
- CORS configuration via environment variable
- XSS: all stored content is sanitized

---

## Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Run specific suite
pytest tests/unit/
pytest tests/api/
pytest tests/integration/
```

---

## Deployment on Render

1. Push code to GitHub
2. Create a **Web Service** on Render, connect repo
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all env vars from `.env.example` in Render dashboard
6. Create a **Background Worker** service with: `celery -A app.workers.celery_app worker --loglevel=info -Q sources`

Or use `render.yaml` for one-click Blueprint deployment.

---

## Environment Variables

See `.env.example` for the full list. Required for production:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing secret (generate with `openssl rand -hex 32`) |
| `MONGODB_URL` | MongoDB Atlas or self-hosted connection string |
| `REDIS_URL` | Redis Cloud or self-hosted URL |
| `OPENAI_API_KEY` | OpenAI API key |
| `GROQ_API_KEY` | Groq API key (optional, for Llama/Mixtral) |
| `CHROMA_HOST` | ChromaDB host |
