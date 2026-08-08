import os
import json
import asyncio
import logging
import subprocess
from pathlib import Path
from app.database.session import SessionLocal
from app.models.lab import Lab
from app.models.study_session import StudySession

logger = logging.getLogger("DockerManager")

async def run_docker_container_sync():
    logger.info("[+] Docker image and container manager daemon started.")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    registry_dir = os.path.join(current_dir, "registry", "labs")
    os.makedirs(registry_dir, exist_ok=True)

    while True:
        try:
            # 1. Query registered labs
            db = SessionLocal()
            labs = db.query(Lab).all()
            db.close()

            # 2. Use Docker SDK
            try:
                import sys, importlib.util
                docker_sdk = None
                for path in sys.path:
                    if "site-packages" in path:
                        pkg_file = os.path.join(path, "docker", "__init__.py")
                        if os.path.exists(pkg_file):
                            spec = importlib.util.spec_from_file_location("docker_pypi", pkg_file)
                            docker_sdk = importlib.util.module_from_spec(spec)
                            spec.loader.exec_module(docker_sdk)
                            break
                if not docker_sdk or not hasattr(docker_sdk, "from_env"):
                    raise ImportError("Docker SDK not installed or unavailable")
                client = docker_sdk.from_env()
                
                # Check images
                for lab in labs:
                    image_name = lab.docker_image or f"cyberrange-{lab.id}:latest"
                    try:
                        client.images.get(image_name)
                    except docker.errors.ImageNotFound:
                        logger.warning(f"[!] Docker image {image_name} for lab {lab.id} is missing on EC2. Pulling fallback...")
                        # Run a background pull task for production grade
                        client.images.pull("alpine", tag="latest")
                
                # Prune orphan running containers
                running_containers = client.containers.list(filters={"status": "running"})
                db = SessionLocal()
                active_session_ids = [
                    f"cyberrange-session-{s.id}" 
                    for s in db.query(StudySession).filter(StudySession.logout_time.is_(None)).all()
                ]
                db.close()

                for container in running_containers:
                    c_name = container.name
                    if c_name.startswith("cyberrange-session-") and c_name not in active_session_ids:
                        logger.warning(f"[!] Orphan container detected: {c_name}. Stopping and removing to free EC2 resources...")
                        container.stop(timeout=5)
                        container.remove(force=True)
            
            except ImportError:
                # SDK fallback to command line tools
                docker_available = False
                try:
                    subprocess.run(["docker", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                    docker_available = True
                except (FileNotFoundError, subprocess.SubprocessError):
                    logger.warning("Docker CLI and SDK not detected. Mocking Docker container sync.")

                for lab in labs:
                    image_name = lab.docker_image or f"cyberrange-{lab.id}:latest"
                    if docker_available:
                        check_img = subprocess.run(
                            ["docker", "image", "inspect", image_name],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                        if check_img.returncode != 0:
                            logger.warning(f"[!] Docker image {image_name} is missing. Pulling alpine fallback...")
                            subprocess.Popen(["docker", "pull", "alpine:latest"])
                    else:
                        logger.debug(f"[Mock Sync] Verified config for lab: {lab.id} -> image: {image_name}")

                # Clean up Orphan Containers via subprocess CLI
                if docker_available:
                    result = subprocess.run(
                        ["docker", "ps", "--format", "{{.Names}}"],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    if result.returncode == 0:
                        running_containers = result.stdout.strip().split("\n")
                        db = SessionLocal()
                        active_session_ids = [
                            f"cyberrange-session-{s.id}" 
                            for s in db.query(StudySession).filter(StudySession.logout_time.is_(None)).all()
                        ]
                        db.close()
                        
                        for container_name in running_containers:
                            if container_name.startswith("cyberrange-session-") and container_name not in active_session_ids:
                                logger.warning(f"[!] Orphan container detected: {container_name}. Stopping...")
                                subprocess.Popen(["docker", "stop", container_name])
                                subprocess.Popen(["docker", "rm", "-f", container_name])

        except Exception as e:
            logger.error(f"Error checking Docker daemon on EC2: {e}")

        await asyncio.sleep(45) # Syncs Docker container state every 45 seconds
