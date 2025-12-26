# Threads Auto-Post Codebase Guide

## Architecture Overview

This is a **Turbo monorepo** with separate backend worker and API server processes:

- **apps/backend**: Express API + BullMQ worker (separate processes)
- **apps/frontend**: React + Vite + Shadcn UI
- **Infrastructure**: MongoDB (posts), Redis (job queue), Docker Compose

### Critical Separation: API Server vs Worker

The backend runs **two separate processes**:

- `npm run dev`: API server ([src/index.ts](../../apps/backend/src/index.ts)) - handles HTTP requests
- `npm run worker`: Job worker ([src/worker.ts](../../apps/backend/src/worker.ts)) - consumes BullMQ jobs

**Never** call `threadsAdapter.publishPost()` from API routes. Publishing happens exclusively in the worker to maintain rate-limiting and retry logic.

## Post Publishing Flow

1. **Frontend** → calls API to schedule post
2. **API** ([PostService.ts](../../apps/backend/src/services/PostService.ts)) → creates BullMQ job via [postQueue.ts](../../apps/backend/src/queue/postQueue.ts)
3. **Worker** ([worker.ts](../../apps/backend/src/worker.ts)) → consumes job, calls `ThreadsAdapter.publishPost()`
4. **ThreadsAdapter** ([ThreadsAdapter.ts](../../apps/backend/src/adapters/ThreadsAdapter.ts)) → orchestrates Threads API calls:
   - Creates media containers for images/videos
   - Waits for container status `FINISHED`
   - Calls `threads_publish` endpoint
   - Optionally posts a comment (reply to published post)

## Adapter Pattern Implementation

[BasePlatformAdapter.ts](../../apps/backend/src/adapters/BasePlatformAdapter.ts) defines the contract. `ThreadsAdapter` implements it. When adding Facebook/TikTok:

1. Create new adapter extending `BasePlatformAdapter`
2. Implement `publishPost()`, `validateMedia()`, `getName()`
3. Update [PostService.ts](../../apps/backend/src/services/PostService.ts) to route by platform field

**Do not** modify core queue or scheduling logic when adding platforms.

## Scheduler Service Pattern

[SchedulerService.ts](../../apps/backend/src/services/SchedulerService.ts) runs every 60 seconds (not cron):

- Finds posts with `status: SCHEDULED` and `scheduledAt <= now`
- Creates immediate BullMQ jobs for due posts
- Supports recurring patterns: `ONCE`, `WEEKLY`, `MONTHLY`, `DATE_RANGE`

Timezone is hardcoded to `Asia/Ho_Chi_Minh` throughout. Do not change without updating all date handling.

## Excel Import Contract

Sheet: **"Danh Sách Bài Post"** (exact name, Vietnamese)

Headers (normalized to lowercase, single spaces):

- `nội dung bài post` → `content` (required)
- `loại bài viết` → `postType` (TEXT/IMAGE/CAROUSEL/VIDEO)
- `link ảnh 1` through `link ảnh 10` → `imageUrls[]`
- `link video` → `videoUrl`
- `comment` → `comment` (reply posted after main post)

See [ExcelService.ts](../../apps/backend/src/services/ExcelService.ts) for full mapping. Headers must match exactly after normalization.

## Environment Configuration

[dotenv.config.ts](../../apps/backend/src/config/dotenv.config.ts) **must** load before any imports that reference `process.env`. See [index.ts](../../apps/backend/src/index.ts) lines 1-5 for correct order.

Required vars (see [env.ts](../../apps/backend/src/config/env.ts)):

- `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`: API credentials
- `MONGODB_URI`: Connection string
- `REDIS_HOST`, `REDIS_PORT`: Queue backend

## MongoDB Model Conventions

[Post.ts](../../apps/backend/src/models/Post.ts) uses:

- Enums for `PostStatus`, `PostType`, `SchedulePattern` (uppercase values)
- `scheduledAt: Date` for one-time schedules
- `scheduleConfig: ScheduleConfig` for recurring patterns
- `publishingProgress` object tracks worker execution state

When querying, use enum values directly: `Post.find({ status: PostStatus.DRAFT })`.

## Frontend Data Fetching

Hooks pattern ([hooks/](../../apps/frontend/src/hooks/)):

- `usePostList`: Pagination, filtering, bulk operations
- `usePost`: Single post CRUD
- `useScheduler`: Schedule UI logic
- `useThreadsPublish`: Manual publish triggers

All API calls go through [lib/api.ts](../../apps/frontend/src/lib/api.ts). Never hardcode backend URLs in components.

## Development Workflow

**Start all services:**

```bash
npm run dev              # Both frontend + backend API (Turbo parallel)
npm run dev:worker       # Separate terminal - starts BullMQ worker
```

**Docker (Podman preferred):**

```bash
docker-compose up -d mongodb redis    # Infrastructure only
docker-compose up                     # Full stack
```

The worker **must** run for scheduled posts to publish. API alone won't process jobs.

## Rate Limiting & Retries

Worker config ([worker.ts](../../apps/backend/src/worker.ts)):

- Concurrency: 5 jobs parallel
- Rate limit: 10 requests/minute
- Retries: 3 attempts with exponential backoff (2s base)

Do not increase rate limits without checking Threads API quotas.

## Documentation Policy

- **Skip auto-generated documentation** unless explicitly requested in the chat
- Only create documents when the user specifically asks for documentation, guides, or summaries
- Focus on code implementation first

## Code Modification Policy

- **Ask before making major changes** to existing code
- Describe what changes will be made and wait for confirmation if:
  - Refactoring core business logic
  - Changing data flow or architecture
  - Modifying API contracts
  - Altering database schema
- Small bug fixes and minor improvements can be applied directly without asking

## Code Organization Principles

- **Modular First**: Separate concerns into focused modules
  - One responsibility per function/component
  - Reusable utilities in separate files
  - Clear interfaces between modules
- **Business Logic First**: Organize code around business requirements
  - Domain logic before infrastructure
  - Business entities as primary design focus
  - Technical patterns serve business needs, not vice versa
- **Scalability**: Design for growth
  - Easy to extend without modifying existing code
  - Clear dependency paths
  - Testable in isolation

## Code Style

- Follow existing patterns in the codebase
- Use TypeScript strict mode
- Prefer composition over inheritance
- Keep functions/components small and focused
- Use meaningful names that reflect business intent
