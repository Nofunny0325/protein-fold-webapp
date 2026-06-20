# RunPod Serverless Deployment

This deployment gives the public GitHub Pages frontend a real protein prediction backend without exposing the RunPod API key in the browser.

```text
GitHub Pages React UI
  -> Cloudflare Worker public proxy
  -> RunPod Serverless endpoint
  -> ColabFold GPU worker
```

## 1. Build and push the RunPod worker image

### Option A: GitHub Actions, no local Docker required

This is recommended if `docker` is not installed on your PC.

1. Open the GitHub repository.
2. Go to **Actions**.
3. Select **Publish RunPod Serverless Image**.
4. Click **Run workflow**.
5. Wait until it finishes.

The image will be:

```text
ghcr.io/nofunny0325/protein-fold-runpod:latest
```

If RunPod cannot pull it, open the image package in GitHub Packages and set its visibility to public.

### Option B: Local Docker

Build from the repository root:

```bash
docker build -f runpod/Dockerfile.serverless -t <dockerhub-user>/protein-fold-runpod:latest .
docker push <dockerhub-user>/protein-fold-runpod:latest
```

## 2. Create a RunPod Serverless endpoint

In RunPod:

- Product: Serverless
- Container image: `ghcr.io/nofunny0325/protein-fold-runpod:latest`
- GPU: start with RTX 4090 or A40 for short proteins
- Max workers: `1` while testing
- Idle timeout: low value to save money

Save the endpoint ID.

RunPod requests use `/run` for async jobs and `/status/{job_id}` for polling. The request body must wrap user input under `input`.

## 3. Deploy the Cloudflare Worker proxy

From `cloudflare-worker/`:

```bash
npm create cloudflare@latest
npx wrangler secret put RUNPOD_API_KEY
npx wrangler deploy
```

Set `RUNPOD_ENDPOINT_ID` in `wrangler.toml`.

The Worker exposes the same API shape used by the frontend:

```text
POST /predict
GET /status/{job_id}
GET /results/{job_id}/model.pdb
GET /results/{job_id}/metrics.json
```

## 4. Connect the frontend

Open the GitHub Pages site and paste the Cloudflare Worker URL:

```text
https://protein-fold-runpod-proxy.<your-subdomain>.workers.dev
```

Then submit a FASTA sequence.

## Notes

- Results from RunPod async jobs are retained for a limited time, so download PDB files soon after completion.
- Keep sequence length small while testing. ColabFold can take minutes and GPU cost is real.
- Do not put `RUNPOD_API_KEY` in the browser or GitHub Pages.
