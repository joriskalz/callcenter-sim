# Coolify Docker Deployment

Use Coolify's Dockerfile build pack for this project. Do not use Nixpacks auto-detection: this is a TanStack Start full-stack app, not a static Vite SPA.

## Coolify Settings

- Build Pack: `Dockerfile`
- Dockerfile: `Dockerfile`
- Port: `3000`
- Health check path: `/health`

## Required Environment Variables

Set these in Coolify as runtime environment variables:

- `PUBLIC_BASE_URL=https://your-coolify-domain.example`
- `CALLBACK_PATH=/api/callbacks`
- `MONITOR_API_KEY=...`
- `WEBHOOK_SHARED_SECRET=...`
- `ACS_CONNECTION_STRING=...`
- `COGNITIVE_SERVICES_ENDPOINT=...`
- `DATAVERSE_URL=...`
- `DATAVERSE_TENANT_ID=...`
- `DATAVERSE_CLIENT_ID=...`
- `DATAVERSE_CLIENT_SECRET=...`
- `DATAVERSE_CONTACT_FIELD_PREFIX=new`

## Persist Scenario Edits

Browser scenario edits are saved by the server to `SCENARIOS_PATH`. The default path is inside the container image and will reset on redeploy.

For persistence, add a Coolify volume and set:

```text
SCENARIOS_PATH=/app/data/scenarios.json
```

Mount the volume to:

```text
/app/data
```

Seed `/app/data/scenarios.json` once from `config/scenarios.sample.json` if you want the current sample scenarios as the starting point.
