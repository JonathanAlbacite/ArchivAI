# Archivist Legacy — API Documentation & Unity Integration Guide

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
