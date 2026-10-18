# CollegeAI Pro — Full Stack

This package combines the supplied CollegeAI Pro 3D frontend with a Node.js/Express backend and SQLite database.

## Features
- Existing 3D dashboard, study tools, 75 MCQs, notes and planner UI
- User registration/login with JWT authentication
- SQLite persistent database
- Cloud-independent notes and quiz-score storage
- Study-plan generation API
- Chat API with a built-in fallback academic engine
- Optional OpenAI-powered chat when `OPENAI_API_KEY` is configured
- CORS + Helmet + password hashing
- Responsive frontend

## Run locally
1. Install Node.js 22+.
2. Open this folder in VS Code.
3. Run:
   `npm install`
4. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
5. Optional: add `OPENAI_API_KEY` for real AI responses.
6. Start:
   `npm start`
7. Open `http://localhost:5000`

The database file `collegeai.db` is created automatically on first start.

## API
- GET `/api/health`
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/me`
- GET/POST/PUT/DELETE `/api/notes`
- POST `/api/quiz/score`
- GET `/api/quiz/history`
- GET `/api/stats`
- POST `/api/planner`
- GET `/api/planner/history`
- POST `/api/chat`

## Important
Do not commit `.env` or your API key to GitHub.
