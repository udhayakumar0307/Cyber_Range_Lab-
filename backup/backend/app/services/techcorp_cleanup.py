import logging
from datetime import datetime, timedelta
import docker
from app.database.manager import db_manager
from app.models.techcorp_session import TechCorpSession

logger = logging.getLogger(__name__)

async def cleanup_inactive_containers():
    """
    Cleans up any TechCorp containers that have been inactive for more than 5 minutes.
    """
    try:
        session = db_manager.get_session()
        cutoff_time = datetime.utcnow() - timedelta(minutes=5)
        
        # Query active sessions that have been inactive
        inactive_sessions = session.query(TechCorpSession).filter(
            TechCorpSession.is_active == True,
            TechCorpSession.last_active_at < cutoff_time
        ).all()
        
        if not inactive_sessions:
            return
            
        client = docker.from_env()
        for sess in inactive_sessions:
            logger.info(f"Stopping inactive container {sess.container_name} for user {sess.user_id}")
            try:
                container = client.containers.get(sess.container_name)
                container.stop()
            except docker.errors.NotFound:
                logger.warning(f"Container {sess.container_name} not found on host, marking inactive.")
            except Exception as e:
                logger.error(f"Error stopping container {sess.container_name}: {e}")
                
            sess.is_active = False
            session.add(sess)
            
        session.commit()
    except Exception as e:
        logger.error(f"Error running container cleanup task: {e}")
