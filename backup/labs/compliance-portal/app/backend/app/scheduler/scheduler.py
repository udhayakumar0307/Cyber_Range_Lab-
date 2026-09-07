from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.privacy_engine.engine import privacy_engine
import asyncio

class APSScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.started = False

    def start(self):
        if self.started:
            return
        print("Scheduler: Initializing APScheduler async background daemon...")
        self.scheduler.add_job(
            privacy_engine.run_analysis,
            "interval",
            minutes=5,
            id="sync_and_analysis_job",
            replace_existing=True
        )
        self.scheduler.start()
        self.started = True
        
        # Trigger initial run asynchronously
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(privacy_engine.run_analysis())
        else:
            loop.run_until_complete(privacy_engine.run_analysis())

    def stop(self):
        if self.started:
            self.scheduler.shutdown()
            self.started = False
            print("Scheduler: APScheduler background daemon stopped.")

aps_scheduler = APSScheduler()
