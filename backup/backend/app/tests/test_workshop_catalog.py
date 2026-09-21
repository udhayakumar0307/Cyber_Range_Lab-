import tempfile
import unittest
from pathlib import Path
from dataclasses import replace
from unittest.mock import patch
import yaml
from app.services.sysadmin_grading.question_bank import QuestionBankRepository, QuestionBankError
from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.workshop import settings_for_lab, WORKSHOP_ID
from app.tests.test_sysadmin_catalog_sync import SysadminCatalogSyncTests, FakeRepository, make_view
from app.services.sysadmin_grading.catalog_sync import sync_sysadmin_lab_modules

class WorkshopRepositoryTests(unittest.TestCase):
    def test_catalog_filters_and_schedule_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in ('WS-CORE-001','WS-ADV-001','RHSA-SHELL-001'):
                lab=root/'labs/module'/name
                lab.mkdir(parents=True)
                for f in ('lab.yaml','grader.py','setup.sh','question.md'):
                    (lab/f).write_text('test')
            (root/'workshop.course.yaml').write_text(yaml.safe_dump({'schedule':[{'id':'WS-CORE-001'},{'id':'WS-ADV-001'}]}))
            workshop=QuestionBankRepository(root, WORKSHOP_ID)
            self.assertEqual(workshop.available_lab_ids(), ['WS-CORE-001','WS-ADV-001'])
            with self.assertRaises(QuestionBankError): workshop.resolve_lab('RHSA-SHELL-001')
            linux=QuestionBankRepository(root,'linux-sysadmin-lab')
            self.assertEqual(linux.available_lab_ids(),['RHSA-SHELL-001'])
            with self.assertRaises(QuestionBankError): linux.resolve_lab('WS-CORE-001')
    def test_workshop_settings_do_not_mutate_linux_settings(self):
        base=SysadminGradingSettings(False,Path('/tmp'), 'python3', 120,65536,workspace_task_definition='linux')
        with patch.dict('os.environ', {'WORKSHOP_WORKSPACE_TASK_DEFINITION':'workshop'}):
            self.assertEqual(settings_for_lab(base,'WS-CORE-001').workspace_task_definition,'workshop')
            self.assertEqual(settings_for_lab(base,'WS-CORE-001').marketplace_lab_id,WORKSHOP_ID)
        self.assertEqual(base.marketplace_lab_id,'linux-sysadmin-lab')
        self.assertIs(settings_for_lab(base,'RHSA-SHELL-001'),base)

class WorkshopProjectionTests(unittest.TestCase):
    setUp = SysadminCatalogSyncTests.setUp
    tearDown = SysadminCatalogSyncTests.tearDown
    def test_workshop_preserves_schedule_and_separate_denominator(self):
        from app.models.lab import Lab
        from app.models.lab_module import LabModule
        self.db.add(Lab(id=WORKSHOP_ID,name='Workshop',category='Linux',difficulty='Mixed',registry_path='workshop'))
        self.db.flush()
        settings=type('Settings',(),{'marketplace_lab_id':WORKSHOP_ID})()
        repo=FakeRepository([make_view('WS-CORE-001','Shell'),make_view('WS-ADV-001','Challenge'),make_view('WS-CORE-006','Sudo')])
        result=sync_sysadmin_lab_modules(self.db, settings=settings,repository=repo)
        self.assertEqual(result.total_points,300)
        rows=self.db.query(LabModule).filter(LabModule.lab_id==WORKSHOP_ID).order_by(LabModule.display_order).all()
        self.assertEqual([r.id for r in rows],repo.available_lab_ids())
        self.assertEqual(self.db.get(Lab,'linux-sysadmin-lab').max_points,0)
        self.assertEqual(sync_sysadmin_lab_modules(self.db,settings=settings,repository=repo).created,0)
