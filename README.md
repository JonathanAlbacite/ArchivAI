# Archivist Legacy — API Documentation & Unity Integration Guide

## Getting Started (cloning this repo on a new machine)

This repo holds two independent Node projects, each with its own `package.json` and `.env`:
- `server/` — Express + Prisma + MySQL
- `client/` — React + Vite

### 0. Git LFS (first time on a machine, or first time cloning)

This repo tracks its large binary files - the Unity WebGL build's `.wasm`/`.data` files, and the character customization `.glb` models under `server/uploads/character-sets/` - with [Git LFS](https://git-lfs.com) instead of storing them directly in git, since git itself handles large binary files poorly and most git hosts reject or warn on files much past 50-100MB. The rules for which files this applies to are already in `.gitattributes` - nothing to configure.

Install Git LFS once per machine, then run this once per machine too (it's safe to run again if unsure whether it's already been done):
```
git lfs install
```

If Git LFS wasn't installed yet when you cloned the repo, the `.glb`/`.wasm`/`.data` files you have locally are just small pointer stubs, not the real files. Fix that with:
```
git lfs pull
```

### 1. Install dependencies

```
cd server && npm install
cd ../client && npm install
```

### 2. Create the two `.env` files

Neither is committed to git (see each project's `.gitignore`), so both need to be created by hand.

`server/.env`:
```
DATABASE_URL="mysql://<user>:<password>@localhost:3306/archivist_ai"
JWT_SECRET="<any random string>"
AI_PROVIDER=groq
GROQ_API_KEY=<your own key>
GEMINI_API_KEY=<your own key>
```
`AI_PROVIDER` picks which AI backend the teacher chat assistant and clue-generation feature use (`groq` or `gemini`) — only the matching key below it is required.

`client/.env`:
```
VITE_API_URL=http://localhost:3000
```

### 3. Create the database schema

```
cd server
npx prisma migrate deploy
```
This only creates the tables — no data yet.

### 4. Start the server

```
npm run dev
```

The server seeds itself automatically on every startup, so this one command is also the setup step — no separate seed command is needed on a fresh clone. On first boot it creates:
- the admin login (`fergusjerome@archivist.admin` / `password`)
- the published vault question-sets (from `prisma/vaultTemplatesSeed.json`)
- the character customization catalog — Base, Pirate, Woman, and anything else added since (from `prisma/characterSetsSeed.json`; their `.glb` model files live under `server/uploads/character-sets/` and are committed to git alongside that JSON, so nothing needs to be re-uploaded)

All three are safe to re-run — they update existing rows rather than duplicating them, so restarting the server repeatedly never creates duplicates. To re-run them by hand without restarting the server (for example after hand-editing one of the seed JSON files), run `npm run seed` from `server/`.

### 5. Start the client

```
cd client
npm run dev
```

### What does NOT come back automatically

Ordinary runtime data — rooms, campaigns, clues, and any individual student's saved character loadout — is real gameplay data, not admin-authored catalog data, so it is deliberately never seeded. A fresh database starts with none of it, same as any brand-new deployment would. Only the admin login, vault templates, and character sets are treated as setup data, since those are what an admin configures once through the Admin dashboard and expects to carry over to any machine running this code.

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (React) | https://archivist-legacy.vercel.app |
| Backend API (Express) | https://archivist-legacy-production.up.railway.app |
| Database | Railway MySQL (managed, no direct access needed) |

---

## Overview

The website handles everything from login to campaign creation. The Unity WebGL game is embedded inside the website and communicates with the same backend API using HTTP requests.

**Flow:**
1. Student logs in on the website → gets a JWT token
2. Student selects a campaign → website passes the token and campaign ID to Unity
3. Unity fetches campaign data from the API at game start
4. Unity sends results back to the API when the game ends
5. Teacher views progress on the website dashboard

---

## Authentication

All protected API endpoints require a `Bearer` token in the request header.

```
Authorization: Bearer <token>
```

The token is obtained from the login endpoint and stored in `localStorage` on the website. It is passed to Unity via `SendMessage` (see Unity Integration section below).

---

## API Endpoints

### Auth

#### Register
```
POST /api/auth/register
```
Request body:
```json
{
  "name": "Juan Dela Cruz",
  "email": "juan@email.com",
  "password": "password123",
  "role": "STUDENT"
}
```
Response:
```json
{
  "message": "Account created",
  "userId": 1
}
```
Roles: `STUDENT` or `TEACHER`

---

#### Login
```
POST /api/auth/login
```
Request body:
```json
{
  "email": "juan@email.com",
  "password": "password123"
}
```
Response:
```json
{
  "token": "eyJhbGci...",
  "role": "STUDENT",
  "name": "Juan Dela Cruz"
}
```
Save this `token` — it is required for all protected requests.

---

### Rooms

#### Get all rooms (student: enrolled rooms only)
```
GET /api/rooms
Authorization: Bearer <token>
```
Response:
```json
[
  {
    "id": 1,
    "name": "Science Class 7A",
    "description": "Grade 7 Science",
    "roomCode": "ETLB0OEE",
    "teacherId": 1,
    "createdAt": "2026-06-29T07:02:56.865Z"
  }
]
```

---

#### Join a room (student only)
```
POST /api/rooms/join
Authorization: Bearer <token>
```
Request body:
```json
{
  "roomCode": "ETLB0OEE"
}
```
Response:
```json
{
  "message": "Joined room successfully",
  "room": { ... }
}
```

---

### Campaigns

#### Get all campaigns in a room (student)
```
GET /api/rooms/:roomId/campaigns
Authorization: Bearer <token>
```
Response:
```json
[
  {
    "id": 1,
    "title": "The Lost Artifact",
    "description": "Solve the mystery of the missing artifact",
    "scene": "LABORATORY",
    "isPublished": true
  }
]
```
Scenes: `LABORATORY`, `TOMB`, `LIBRARY`

---

#### Get single campaign details
```
GET /api/campaigns/:id
Authorization: Bearer <token>
```
Response:
```json
{
  "id": 1,
  "title": "The Lost Artifact",
  "description": "...",
  "scene": "LABORATORY",
  "storyPath": "/uploads/story.pdf",
  "isPublished": true,
  "clues": [
    {
      "id": 1,
      "orderNumber": 1,
      "question": "What element has the symbol Au?"
    }
  ]
}
```
Note: Answers/passwords are NOT included in this response. Only questions are visible to students.

---

## Unity-Facing Endpoints

These are the two most important endpoints for Unity integration.

---

### Load Campaign (call this when the game starts)
```
GET /api/campaigns/:id/load
Authorization: Bearer <token>
```
Response:
```json
{
  "campaignId": 1,
  "title": "The Lost Artifact",
  "scene": "LABORATORY",
  "clues": [
    {
      "id": 1,
      "orderNumber": 1,
      "question": "What element has the symbol Au?"
    },
    {
      "id": 2,
      "orderNumber": 2,
      "question": "What is the boiling point of water in Celsius?"
    }
  ]
}
```
**Note:** Answers are never sent to Unity. Unity only receives the questions. The student types the answer inside the game and it gets validated here or locally — coordinate with the web team on how answer checking will work.

---

### Send Results (call this when the game ends)
```
POST /api/campaigns/:id/results
Authorization: Bearer <token>
```
Request body:
```json
{
  "studentId": 2,
  "totalTime": 320,
  "rank": "A",
  "attempts": [
    { "clueId": 1, "attempts": 2, "isSolved": true },
    { "clueId": 2, "attempts": 5, "isSolved": true }
  ]
}
```
- `totalTime` — total seconds the student took to finish
- `rank` — computed by Unity based on time and attempts (A, B, C, D)
- `attempts` — array of per-clue attempt data

Response:
```json
{
  "message": "Results saved successfully"
}
```

---

## Unity Integration Guide

### Step 1 — Receive token and campaign ID from the website

The website passes the JWT token and campaign ID to Unity using JavaScript `SendMessage` when the student clicks "Start Campaign". In your Unity `GameManager` script, add these methods to receive them:

```csharp
public string apiUrl = "https://archivist-legacy-production.up.railway.app";
private string token;
private string campaignId;

public void SetToken(string receivedToken)
{
    token = receivedToken;
    PlayerPrefs.SetString("token", token);
}

public void SetCampaignId(string id)
{
    campaignId = id;
}
```

---

### Step 2 — Load campaign data at game start

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

void Start()
{
    token = PlayerPrefs.GetString("token");
    StartCoroutine(LoadCampaign());
}

IEnumerator LoadCampaign()
{
    UnityWebRequest request = UnityWebRequest.Get($"{apiUrl}/api/campaigns/{campaignId}/load");
    request.SetRequestHeader("Authorization", "Bearer " + token);

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        string json = request.downloadHandler.text;
        Debug.Log("Campaign loaded: " + json);
        // Parse JSON and set up your puzzle questions/locks here
        // Recommended: use Newtonsoft.Json (Json.NET for Unity) for parsing
    }
    else
    {
        Debug.LogError("Failed: " + request.error);
    }
}
```

---

### Step 3 — Send results when the game ends

```csharp
[System.Serializable]
public class AttemptData
{
    public int clueId;
    public int attempts;
    public bool isSolved;
}

[System.Serializable]
public class ResultData
{
    public int studentId;
    public int totalTime;
    public string rank;
    public AttemptData[] attempts;
}

IEnumerator SendResults()
{
    ResultData result = new ResultData
    {
        studentId = int.Parse(PlayerPrefs.GetString("studentId")),
        totalTime = 320,
        rank = "A",
        attempts = new AttemptData[]
        {
            new AttemptData { clueId = 1, attempts = 2, isSolved = true },
            new AttemptData { clueId = 2, attempts = 5, isSolved = true }
        }
    };

    string json = JsonUtility.ToJson(result);

    UnityWebRequest request = new UnityWebRequest($"{apiUrl}/api/campaigns/{campaignId}/results", "POST");
    byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
    request.uploadHandler = new UploadHandlerRaw(body);
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Content-Type", "application/json");
    request.SetRequestHeader("Authorization", "Bearer " + token);

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        Debug.Log("Results sent!");
    }
    else
    {
        Debug.LogError("Failed to send results: " + request.error);
    }
}
```

---

### Step 4 — WebGL specific reminders

- All network calls MUST use coroutines (`IEnumerator` + `yield return`) — blocking calls will freeze the browser tab
- No local file system access in WebGL — use `PlayerPrefs` for local data or send everything to the API
- Test your WebGL build in Chrome regularly during development — don't wait until the end
- Avoid threads (`System.Threading`) — not supported in WebGL
- Use `Newtonsoft.Json` (Json.NET) instead of `JsonUtility` for complex nested JSON parsing — `JsonUtility` has limitations with arrays and nested objects

---

## Data Models Reference

```
User        id, name, email, password, role (TEACHER/STUDENT)
Room        id, name, description, roomCode, teacherId
RoomStudent roomId, studentId, joinedAt
Campaign    id, roomId, title, description, scene, storyPath, isPublished
Clue        id, campaignId, orderNumber, question, answer
CampaignSession  id, campaignId, studentId, startedAt, completedAt, totalTime, rank
SessionAttempt   id, sessionId, clueId, attempts, isSolved
```

---

## Important Notes

- Answers/passwords for clues are **never exposed** to the frontend or Unity — they are stored server-side only
- The JWT token expires after **7 days** — the student must log in again after expiry
- The game scene (`LABORATORY`, `TOMB`, `LIBRARY`) determines which Unity scene to load
- Campaign must be **published** (`isPublished: true`) before students can see or play it
- All endpoints return errors in this format: `{ "message": "Error description here" }`
