# Macrolytics — Personal Calorie Tracker

**Typeface India — Software Engineer Project Assignment**
**Candidate:** Rajeev Lochan Perla (Roll No: S20230010198)

> **Walkthrough:** [Watch the Demo Video](https://youtu.be/UFidAfu34X0)
> *Please watch this video first to see the project working end-to-end.*

This project uses a distributed architecture with **AWS S3, SQS, Redis, BullMQ, and local Ollama instances**, so setting it up locally may take a few minutes (or longer if the internet is slow).

The detailed system architecture is available here:

**[Read the System Architecture Document](./document.pdf)**

It covers the core engineering decisions made for this assignment.

---

## Setup

### Prerequisites

Make sure the following are installed:

* **Docker** & **Docker Compose**
* **Node.js** (v18+)
* **Ollama**

Pull the required models:

```bash
ollama run llama3.1
ollama run llava
```

### Environment

Create a `.env` file inside `Backend` by copying `.env.example`.

> I have provided the AWS-related key values through Microsoft Form *Additional comments*. Just replace the following values with the ones I provided.

```env
AWS_REGION=<value I gave>
AWS_ACCESS_KEY_ID=<value I gave>
AWS_SECRET_ACCESS_KEY=<value I gave>
S3_BUCKET_NAME=<value I gave>
AWS_SQS_QUEUE_URL=<value I gave>
```

The remaining values can be kept unchanged when following the setup below.

### Database & Redis

From the project root:

```bash
docker-compose up -d
```

This starts **PostgreSQL** and **Redis**.

Then initialize the database:

```bash
docker cp Backend/init.sql calorie_tracker_db:/init.sql

docker exec -it calorie_tracker_db \
  psql -U postgres -d calorie_tracker -f /init.sql
```

### Dependencies

Install dependencies for both backend and client:

```bash
cd Backend && npm install
cd ../client && npm install
```

---

## Run

Start the backend API and SQS worker in separate terminals.

**Terminal 1 — Backend**

```bash
cd Backend/src
node server.js
```

**Terminal 2 — Worker**

```bash
cd Backend/src/workers
node nutrition.worker.js
```

**Terminal 3 — Frontend**

```bash
cd client
npm run dev
```

Open:

```text
http://localhost:5173
```

and the website will be running.

---

## Assignment Requirements 

* **Goal Setting:** Users can set and manage daily targets for calories, protein, carbs, fat, and weight.
* **Meal Entry:** Supports logging food items by meal type (Breakfast, Lunch, Dinner, Snacks) with fields for name, quantity, and macros.
* **Time-Range Listing & Pagination:** List APIs support pagination and allow filtering food entries by specific date ranges and meal types.
* **Nutrition Reports & Graphs:** Displays weekly calorie intake trends, macronutrient breakdowns.
* **AI-Powered Calorie Extraction:** Users can upload a photo of food to automatically extract and pre-fill nutritional information using AI image analysis.
* **Architecture & Persistence:** The frontend communicates exclusively with a separate backend API, and all user data, goals, and food entries are persisted in a database.
* **Bonus - Conversational Chat Interface:** An LLM-powered chat allows users to log meals, check goals, and get summaries through natural language.
* **Bonus - Multi-User Support:** The system supports multiple independent users who can sign up, log in, and maintain their own private data.

Thank you.

*Hope you don't misuse my AWS creds 🙂*
