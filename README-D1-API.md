# D1 API Routes for report-card-cloudflare

## Overview

This directory contains Cloudflare Pages Functions that provide server-side API routes connected to the `report-card-d1` D1 database, `report-card-assets` R2 bucket, and `CONFIG_CACHE` KV namespace.

## Bindings

| Binding | Type | Name | Purpose |
|---------|------|------|--------|
| `DB` | D1 | `report-card-d1` (`5384ec04-0241-4fcf-8d04-cd205491ac70`) | Relational data: schools, students, student_grades, users |
| `ASSETS` | R2 | `report-card-assets` | Binary assets: logos, watermarks, student photos |
| `CONFIG_CACHE` | KV | `CONFIG_CACHE` | Fast read caching for school config (branding, layouts, grade scales) |

## API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check D1 connectivity |

### On-Demand Report Card Assembly
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync-school/:schoolId` | Assemble report cards on demand by querying relational tables (schools, students, student_grades). Checks KV cache first for instant config reads. |

### Bulk Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/load?school_id=xxx` | Load all data for a school in one request |
| POST | `/api/sync` | Save entire app state (upsert all tables in one batch). Updates KV cache automatically. |

### Schools
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schools` | List all schools |
| POST | `/api/schools` | Create a school (populates KV cache) |
| GET | `/api/schools/:id` | Get a school |
| PUT | `/api/schools/:id` | Update a school (updates KV cache) |
| DELETE | `/api/schools/:id` | Delete a school (invalidates KV cache) |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students?school_id=xxx` | List students (filter by school) |
| POST | `/api/students` | Create a student |
| GET | `/api/students/:id` | Get a student |
| PUT | `/api/students/:id` | Update a student |
| DELETE | `/api/students/:id` | Delete a student |

### Student Grades
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student-grades?student_id=xxx` | List grades (filter by student or school) |
| POST | `/api/student-grades` | Create a grade record |
| GET | `/api/student-grades/:id` | Get a grade record |
| PUT | `/api/student-grades/:id` | Update a grade record |
| DELETE | `/api/student-grades/:id` | Delete a grade record |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users?school_id=xxx` | List users (filter by school) |
| POST | `/api/users` | Create a user |
| GET | `/api/users/:id` | Get a user |
| PUT | `/api/users/:id` | Update a user |
| DELETE | `/api/users/:id` | Delete a user |

### R2 Asset Upload & Serving
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload images (logos, watermarks, photos) to R2. Accepts base64 or multipart. Returns clean URL. |
| GET | `/api/assets/:type/:file` | Serve binary assets directly from R2 with `Cache-Control: public, max-age=31536000`. |

## Architecture

### On-Demand Report Card Assembly
Report cards are assembled on demand by `GET /api/sync-school/:schoolId`, which queries the relational tables (`schools`, `students`, `student_grades`) directly. The `school_sync_data` table has been eliminated — no more read/write dependency on it.

### Centralized School Branding & Layouts
- `schools.branding_json` — Logo URL, watermark URL, colors, helpline, grade scales (stored centrally, never duplicated per student)
- `schools.layouts_json` — Class group layout configurations
- `schools.report_structures_json` — Backwards-compatible layout structures
- `schools.grade_scales_json` — Grade scale definitions

### R2 Asset Bucket (report-card-assets)
- Uploads accept base64 or multipart images and store them in R2
- Clean URLs (`/api/assets/logos/...`, `/api/assets/photos/...`) are returned for D1 storage
- Assets are served with long-lived cache headers (`max-age=31536000`)

### KV Namespace Fast Read Caching (CONFIG_CACHE)
- `GET /api/sync-school/:schoolId` checks KV cache (`school_config_${schoolId}`) first
- Cache is populated on cache miss from D1
- Cache is automatically updated on `POST /api/schools`, `PUT /api/schools/:id`, and `POST /api/sync`
- Cache is invalidated on `DELETE /api/schools/:id`

## Database Migration

After deploying the updated code, run the migration to add `layouts_json` and drop `school_sync_data`:

```bash
npx wrangler d1 execute report-card-d1 --remote --file=migrations/0001_add_layouts_and_drop_sync_data.sql
npx wrangler d1 execute report-card-d1 --local --file=migrations/0001_add_layouts_and_drop_sync_data.sql
```

## Setup: R2 Bucket and KV Namespace

Before deploying, create the R2 bucket and KV namespace:

```bash
# Create R2 bucket
npx wrangler r2 bucket create report-card-assets

# Create KV namespace
npx wrangler kv namespace create CONFIG_CACHE
# Replace REPLACE_WITH_KV_NAMESPACE_ID in wrangler.toml with the returned ID
```

## Local Development

```bash
# Install wrangler
npm install -g wrangler

# Run locally with all bindings
npx wrangler pages dev dist \
  --d1 DB=5384ec04-0241-4fcf-8d04-cd205491ac70 \
  --r2 ASSETS=report-card-assets \
  --kv CONFIG_CACHE
```

## Deployment

Push to the `main` branch on GitHub. Cloudflare Pages will automatically build and deploy. The `functions/` directory is automatically detected by Pages.

## Notes

- All JSON columns (`branding_json`, `layouts_json`, `marks_data_json`, `extra_details_json`, etc.) are stored as TEXT in D1. Use `JSON.stringify()` when writing and `JSON.parse()` when reading on the frontend.
- All primary keys are TEXT (UUIDs). New IDs are auto-generated using `crypto.randomUUID()` if not provided.
- CORS is enabled via `functions/_middleware.js` — adjust the origin for production.
- The `/api/sync` endpoint uses D1 batch operations for atomic upserts across all tables.
- `school_sync_data` has been removed. Report cards are assembled on demand from relational tables.
