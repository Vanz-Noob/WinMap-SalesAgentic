"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = ""  # Set via DATABASE_URL in .env or docker-compose

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # BytePlus ModelArk
    ARK_API_KEY: str = ""
    ARK_BASE_URL: str = "https://ark.ap-southeast.bytepluses.com/api/v3"
    LLM_MODEL_PRO: str = "deepseek-v4-flash-ga-260731"
    LLM_MODEL_LITE: str = "deepseek-v4-flash-ga-260731"
    EMBEDDING_MODEL: str = "skylark-embedding-vision-250615"

    # JWT
    JWT_SECRET: str = ""  # Set via JWT_SECRET in .env or docker-compose
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # App
    APP_NAME: str = "WinMap"
    DEBUG: bool = True

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
