# Candidate Form -> Business Central

A Node.js/Express web form that captures candidate applications and writes them to a
custom `Candidate` table in Dynamics 365 Business Central via an API page.

## Process flow

```
Browser form (public/index.html)
        |  POST /api/candidates  (JSON)
        v
Express  ->  validateCandidate  ->  candidateController  ->  models/candidate
        |
        |  OAuth2 client credentials (Entra ID)
        v
BC API page 50102 "Candidate API"
   .../api/novasoft/recruitment/v1.0/companies({id})/candidates
        |
        v
Table 50100 "Candidate"  (visible in the Candidates list page)
```

## 1. Business Central

Deploy the AL objects in [`bc/`](bc/) with an AL extension project:

| Object | File | Purpose |
| --- | --- | --- |
| Table 50100 `Candidate` | `bc/Tab50100.Candidate.al` | Stores the candidate record |
| Page 50100 `Candidate List` | `bc/Pag50100.CandidateList.al` | Searchable list in BC |
| Page 50101 `Candidate Card` | `bc/Pag50101.CandidateCard.al` | Detail view |
| Page 50102 `Candidate API` | `bc/Pag50102.CandidateAPI.al` | REST endpoint the app calls |

Fields: Candidate Name, Email, Phone No., Education, Experience, Skills,
Position Applied For, Interview Date (+ auto Entry No. and Application Date).

Then, for machine-to-machine access:

1. Register an app in Entra ID; add a client secret.
2. Grant it the `API.ReadWrite.All` application permission for Dynamics 365
   Business Central and give admin consent.
3. In BC, run **Microsoft Entra Applications**, add the client ID, set state
   **Enabled**, and assign the `D365 AUTOMATION` (or a suitable) permission set.
4. Get your company GUID from `.../api/v2.0/companies`.

## 2. Node.js app

```bash
npm install
cp .env.example .env    # fill in the BC values
npm start               # or: npx nodemon server.js
```

Open <http://localhost:3000> (or whatever `PORT` you set).

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | The candidate form |
| `GET` | `/health` | Status + whether BC is configured |
| `POST` | `/api/candidates` | Validate and create a candidate |
| `GET` | `/api/candidates` | Latest 100 candidates |

### Local mode

If `BC_TENANT_ID`, `BC_COMPANY_ID`, `BC_CLIENT_ID` or `BC_CLIENT_SECRET` is missing,
submissions are written to `data/candidates.json` instead so the form is testable
before BC access is in place. `/health` reports which mode is active.

## Layout

```
config/           env config + BC OAuth/axios client
contrallers/      request handlers
middleware/       validation + error handling
models/           candidate persistence (BC or local file)
routes/           /api routes
public/           form HTML, CSS, JS
bc/               AL objects for Business Central
```

## Authentication options

`BC_AUTH_MODE` selects how the app talks to Business Central.

| Mode | Needs client id/secret? | Works on | Set |
| --- | --- | --- | --- |
| `oauth` (default) | Yes - both | BC SaaS (online) | `BC_TENANT_ID`, `BC_COMPANY_ID`, `BC_CLIENT_ID`, `BC_CLIENT_SECRET` |
| `basic` | No | BC **on-premises** only | `BC_DEPLOYMENT=onprem`, `BC_BASE_URL` (incl. server instance), `BC_COMPANY_ID`, `BC_USERNAME`, `BC_WEB_SERVICE_KEY` |
| unset / incomplete | No | anywhere | nothing - writes to `data/candidates.json` |

For **BC SaaS there is no credential-free option**: Microsoft removed basic auth
(web service access keys) for online tenants, so every service-to-service call
carries an Entra ID token. Two variations reduce what you have to store:

- **Certificate instead of a secret** - the app registration still has a client id,
  but you upload a certificate and sign the token request with it, so no secret
  sits in `.env`.
- **Managed identity** - if the Node app is hosted in Azure (App Service,
  Container Apps, Functions), Azure issues the token and there is no secret at all.
  The managed identity is still registered in BC under *Microsoft Entra Applications*.

Either way a client id (or identity) has to exist in BC. If you can't create an app
registration yourself, that request goes to whoever holds Global Admin or
Application Administrator on the tenant.

## Postman

Import both files from [`postman/`](postman/):

- `candidate-form.postman_collection.json`
- `candidate-form.postman_environment.json` (select it as the active environment, then fill in the blanks)

**Node App** folder - hits this repo's Express endpoints. Nothing to configure beyond
`base_url` if the app is running.

**Business Central (direct)** folder - calls BC itself, numbered in run order:

1. *Get Access Token* - client-credentials flow; the test script stores `bc_access_token`.
2. *List Companies* - copy your company GUID into `bc_company_id` (and `BC_COMPANY_ID` in `.env`).
3-7. Create / list / get / update / delete against API page 50102. Create and list
   store `bc_candidate_id` and `bc_candidate_etag`, which the PATCH and DELETE reuse.

Notes:

- The record key in the URL is the **SystemId** GUID, not the Entry No.
- `PATCH` and `DELETE` need an `If-Match` ETag header; `*` bypasses the concurrency check.
- `entryNo` and `applicationDate` are read-only - BC assigns them on insert.
