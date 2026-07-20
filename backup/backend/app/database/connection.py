import logging
from sqlalchemy import create_engine

logger = logging.getLogger(__name__)

def create_db_engine(url: str):
    """
    Creates and returns a SQLAlchemy engine configured for the database dialect with pool pre-ping and recycling.
    """
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        return create_engine(url, connect_args=connect_args)
    
    logger.info(f"Creating SQL engine for dialect: {url.split('://')[0]} with pool_pre_ping=True")
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args
    )
