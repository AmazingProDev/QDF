# Network Action Effectiveness Analyzer

Professional client-side TRD / IEA qualification tool for telecom BEFORE / AFTER consolidation workbooks. Uploaded workbooks stay in the browser memory only; no database, server storage, or external API is used.

## Local installation

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. For a production check, use `npm run build` then `npm start`.

## Vercel

Import this repository in Vercel and deploy. No environment variables or server-side setup are required. The application uses only browser-side ExcelJS for reading and generating workbooks.

## Methodology

TRD is the proportion of the initial KPI gap eliminated after the action. IEA combines measurable TRD throughput and PRB using configurable weights (60/40 by default). AFTER qualification remains distinct from the calculated action-effectiveness status.
