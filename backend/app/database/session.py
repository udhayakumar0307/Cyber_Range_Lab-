from app.database.manager import db_manager

def get_db():
    """
    Dependency yields database session, ensuring it's closed after request lifecycle.
    """
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()
