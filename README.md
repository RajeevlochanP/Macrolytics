# Macrolytics — Personal Calorie Tracker

**Typeface India — Software Engineer Project Assignment**
**Candidate:** Rajeev Lochan Perla (Roll No: S20230010198)

---

## Demo Video

Because this project utilizes a distributed architecture (AWS S3, SQS, Redis, BullMQ, and local Ollama instances), setting it up locally takes a few minutes (to hours if your internet is slow).

> **[Walkthrough Video Here](INSERT_YOUR_LOOM_LINK_HERE)**
> *Please watch this video first to see my project is completely working with no issues to the best of my knowledge.*

## System Architecture

This repository contains a detailed architectural breakdown of the system:

**[Read the System Architecture Document](./document.pdf)**

Please review this document to understand the core engineering decisions made for this assignment, including:

* **Decoupled Image Processing:** Using AWS SQS and direct-to-S3 uploads to prevent Node.js OOM crashes at scale.
* **Stateless Web Tier:** How conversational LLM memory is maintained securely via JWT/JOSE without server-side session memory bottlenecks.
* **Dual AI Architectures:** The use of LangGraph (Supervisor Pattern) for real-time chat routing and Reflexion (Critic Loop) for background schema validation.
* **O(1) Dashboard Reads:** Redis `hIncrByFloat` atomic caching strategies.

## Prerequisites

Before running this project, ensure you have the following installed:

* **Docker** & **Docker Compose**
* **Node.js** (v18+)
* **Ollama** (for local LLM inference)

Pull the required LLM models locally using Ollama:

```bash
ollama run llama3.1
ollama run llava
```

## Environment Variables

Create a `.env` file in the `Backend` directory.

The `.env` can be initialized by copying all contents of `.env.example`.

> I have provided you the AWS related key values through Microsoft Form *Additional comments*. Just change the following key's values with the one I gave you.

```env
AWS_REGION=<value I gave>

AWS_ACCESS_KEY_ID=<value I gave>

AWS_SECRET_ACCESS_KEY=<value I gave>

S3_BUCKET_NAME=<value I gave>

AWS_SQS_QUEUE_URL=<value I gave>
```

Remaining all keys can be kept unchanged if you exactly follow below instructions for fast setup.

## Installation & Running

### 1. Start Backing Services

From the root of the project:

```bash
docker-compose up -d
```

This spins up the database and cache:

* PostgreSQL
* Redis

### 2. Initialize Database Schema

Because Docker only provisions the raw Postgres instance, you must manually apply the schema and composite indexes.

Since the container name is explicitly defined in the compose file, copy and run the initialization script directly from your terminal:

```bash
docker cp Backend/init.sql calorie_tracker_db:/init.sql

docker exec -it calorie_tracker_db \
  psql -U postgres -d calorie_tracker -f /init.sql
```

### 3. Install Dependencies

Install npm packages in both the backend and client directories:

```bash
cd Backend && npm install
cd ../client && npm install
```

### 4. Run Backend & Worker

Run the API server and the SQS background worker in two separate terminals.

**Terminal 1 — API Server**

```bash
cd Backend
node src/server.js
```

**Terminal 2 — SQS Worker**

```bash
cd Backend
node src/workers/nutrition.worker.js
```

### 5. Run Frontend

In the `client` directory:

```bash
npm run dev
```

Then go to:

```text
http://localhost:5173
```

to visit the website running.

---

Thank you.
(Hope you dont misuse my aws creds 🙂) 