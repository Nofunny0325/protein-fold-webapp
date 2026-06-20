from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    results_dir: Path = Field(default=Path("./results"), alias="RESULTS_DIR")
    queue_mode: str = Field(default="local", alias="QUEUE_MODE")
    predict_engine: str = Field(default="mock", alias="PREDICT_ENGINE")
    colabfold_bin: str = Field(default="colabfold_batch", alias="COLABFOLD_BIN")
    alphafold3_image: str = Field(default="alphafold3", alias="ALPHAFOLD3_IMAGE")
    af3_model_dir: Path = Field(default=Path("/models"), alias="AF3_MODEL_DIR")
    af3_db_dir: Path = Field(default=Path("/databases"), alias="AF3_DB_DIR")
    max_sequence_length: int = Field(default=2500, alias="MAX_SEQUENCE_LENGTH")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.results_dir.mkdir(parents=True, exist_ok=True)
    return settings
