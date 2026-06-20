# Protein Fold Webapp

Async protein structure prediction prototype using FastAPI, Celery, Redis, ColabFold/AlphaFold-compatible engine adapters, React, and 3Dmol.js.

## Architecture

```mermaid
flowchart LR
  U["Browser React UI"] -->|POST /predict| API["FastAPI API"]
  API -->|enqueue task| R["Redis broker/result backend"]
  R --> W["Celery GPU worker"]
  W -->|colabfold_batch or AlphaFold3 docker| E["Prediction engine"]
  E -->|PDB/CIF + metrics| S["shared results volume"]
  U -->|poll /status/{job_id}| API
  U -->|GET /results/{job_id}/model.pdb| API
  U --> V["3Dmol.js viewer"]
```

## Directory

```text
protein-fold-webapp/
  docker-compose.yml
  backend/
    requirements.txt
    app/
      main.py
      config.py
      celery_app.py
      schemas/predict.py
      services/sequence.py
      services/result_store.py
      services/engines.py
      workers/tasks.py
  frontend/
    package.json
    index.html
    src/
      main.jsx
      App.jsx
      lib/api.js
      components/SequenceForm.jsx
      components/JobStatus.jsx
      components/ProteinViewer.jsx
      components/ConfidencePanel.jsx
```

## Run

```bash
docker compose up --build
```

Frontend: http://localhost:5173
Backend: http://localhost:8000/docs

For real ColabFold inference, install `colabfold_batch` in the worker image or mount a LocalColabFold environment and set `PREDICT_ENGINE=colabfold`. For AlphaFold 3, mount model parameters and databases, then set `PREDICT_ENGINE=alphafold3`.

## Real Prediction Mode

GitHub Pages is static hosting. It cannot run AlphaFold, ColabFold, CUDA, FastAPI, Redis, or a long-running GPU job. The public site only hosts the React UI. For real structure prediction, run the GPU backend and paste its URL into the "Real prediction backend URL" field on the site.

Recommended low-cost deployment:

```text
GitHub Pages UI -> Cloudflare Worker proxy -> RunPod Serverless GPU worker
```

See [RUNPOD_DEPLOY.md](RUNPOD_DEPLOY.md).

### GPU backend with ColabFold

Requirements:

- NVIDIA GPU
- NVIDIA driver
- Docker with NVIDIA Container Toolkit

Run:

```powershell
docker compose -f docker-compose.gpu.yml up --build
```

Backend:

```text
http://localhost:8000
```

Then open the GitHub Pages site and enter:

```text
http://localhost:8000
```

For a remote GPU server, expose the backend through HTTPS and enter that HTTPS URL in the frontend. Browser security may block a public HTTPS page from calling a non-local HTTP GPU server.

The backend runs:

```text
colabfold_batch input.fasta /results/<job_id>/colabfold --num-recycle 3 --amber --templates
```

Outputs are served through:

```text
/results/{job_id}/model.pdb
/results/{job_id}/metrics.json
```

## Local No-Docker Run

```powershell
$PY="C:\Users\82108\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$NODE="C:\Users\82108\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

& $PY -m pip install -r backend\requirements-local.txt
cd frontend
& "C:\Users\82108\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" install
& $NODE node_modules\vite\bin\vite.js build
cd ..

& $PY -B -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
& $PY -B -m http.server 5173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:5173.
