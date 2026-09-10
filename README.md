# JinieScreen Upload Pipeline (Scaffold)

This repo contains a modular Node.js backend for:

- issuing upload links,
- receiving uploads,
- processing videos (mens/womens transforms),
- generating JinieScreen bundles,
- uploading bundles to FTP.

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run start
npm run worker
```

## Seed screens

```bash
npm run seed:screens
```

## Pipeline test (CLI)

```bash
npm run pipeline:test -- --screen macys_cos_womens --file /path/to/source.mp4
```

## Upload Flow (current scaffold)

1. Create an `UploadLink` in MongoDB (via script or manual insert).
2. POST the file to `/api/upload/:token` with form field `file`.
3. Worker picks up `UploadJob` and runs:
   - video transform (mens/womens)
   - JinieScreen bundle generation
   - FTP upload

## Notes

- `scripts/create-jiniescreen-project.js` is imported by the backend and also usable as a CLI.
- The generated bundle's internal file structure (`autorun.brs`, `autoplugins.brs`, `current-sync.json`, `pool/`, etc.) is dictated by the current playback hardware's own sync protocol and must not be renamed — that's a hardware requirement, not branding, and will change if/when we move to different hardware.
- Screen-specific placement/rotation/scale is stored in the `Screen` document `transform` field.
- Default canvas size is set with `CANVAS_W`/`CANVAS_H`, but each `Screen` can override.
- Source videos are validated with `ffprobe` to match the Screen prerequisite resolution.
- Change streams are not wired yet; the worker polls for pending jobs.
