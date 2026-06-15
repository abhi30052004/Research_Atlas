# Atlas

Atlas is an AI-powered Research & Knowledge Management Platform inspired by NotebookLM.

## Features

* Workspace Management
* Source Upload & Processing
* RAG Pipeline
* ChromaDB Vector Search
* LangChain + LangGraph Workflows
* AI Chat with Citations
* Artifact Studio
* TipTap Editor
* Research Reports
* Slide Generator
* Analytics Dashboard
* Smart Search
* Export System

## Tech Stack

### Frontend

* React
* TypeScript
* TailwindCSS
* TipTap
* Zustand

### Backend

* Node.js
* Express
* TypeScript

### Database

* MongoDB

### Vector Database

* ChromaDB

### AI

* LangChain
* LangGraph
* OpenAI
* Groq

### Authentication

* JWT
* Firebase Google Login

## Project Structure

atlas/
├── frontend/
├── backend/
├── README.md
└── .gitignore

## Development

### Frontend

cd frontend

npm install

npm run dev

### Backend

cd backend

npm install

npm run dev

## Environment Variables

See backend/.env.example
See frontend/.env.example

## Deployment

Supports:

* Docker
* Render
* Railway
* AWS
* Azure
* GCP

## License

Private Project

## Build Cmd:

* cd frontend
* npm install
* npm run dev

* cd backend
* python -m venv .venv
* .venv\Scripts\activate
* pip install --default-timeout=1000 -r requirements.txt
* pip install fastapi uvicorn
* uvicorn app.main:app --reload

