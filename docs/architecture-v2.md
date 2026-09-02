# HOSHEX V2 Architecture

## Target structure

```
HOSHEX PLATFORM
|
|-- apps/
|   |-- web-app/
|   |   |-- landing
|   |   |-- questionnaire
|   |   |-- diagnosis-ui
|   |   `-- dashboard
|   |
|   `-- admin-panel/
|
|-- backend/
|   |-- api/
|   |   |-- auth
|   |   |-- diagnosis
|   |   |-- users
|   |   `-- tracking
|   |
|   |-- ai-engine/
|   |-- database/
|   `-- integrations/
|
|-- wordpress/
|   `-- hoshex-control-center/
|
|-- docs/
|   |-- architecture
|   |-- api
|   |-- product
|   `-- backup
|
`-- deployment/
    |-- vercel
    `-- environments
```

## Migration plan

Current MVP files will gradually move into this structure without breaking production.

Current:
- api/chat.js -> backend/api/diagnosis
- api/analytics.js -> backend/tracking
- assets/hoshex-flow.js -> apps/web-app/questionnaire
- assets/hoshex-result.js -> apps/web-app/diagnosis-ui

## Core flow

Business profile -> Diagnosis -> Priority 01 -> Today Action -> Measurement -> Next Step
