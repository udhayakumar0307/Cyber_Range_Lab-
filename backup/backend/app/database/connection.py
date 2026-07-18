import logging
from sqlalchemy import create_engine

logger = logging.getLogger(__name__)

def create_db_engine(url: str):
    """
    Creates and returns a SQLAlchemy engine configured for the database dialect.
    """
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        
    logger.info(f"Creating SQL engine for dialect: {url.split('://')[0]}")
    return create_engine(url, connect_args=connect_args)
