from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    name: str = Field(default="query", max_length=96)
    sequence: str = Field(min_length=10)
    mode: str = Field(default="monomer", pattern="^(monomer|complex)$")


class PredictResponse(BaseModel):
    job_id: str
    status_url: str


class JobStatus(BaseModel):
    job_id: str
    state: str
    stage: str
    progress: int
    message: str | None = None
    pdb_url: str | None = None
    metrics_url: str | None = None

