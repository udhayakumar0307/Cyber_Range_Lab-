from types import SimpleNamespace
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.services.sysadmin_grading.catalog_sync import (
    SysadminCatalogSyncError,
    sync_sysadmin_lab_modules,
)


class FakeSettings:
    marketplace_lab_id = "linux-sysadmin-lab"


class FakeRepository:
    def __init__(self, views):
        self._views = {
            view.lab_id: view
            for view in views
        }

    def available_lab_ids(self):
        return list(self._views)

    def student_view(self, lab_id):
        return self._views[lab_id]


def make_view(
    lab_id,
    title,
    *,
    module="tupe-chapter3",
    points=100,
    difficulty="intermediate",
    objectives=(),
):
    return SimpleNamespace(
        lab_id=lab_id,
        title=title,
        module=module,
        total_points=points,
        difficulty=difficulty,
        learning_objectives=tuple(objectives),
    )


class SysadminCatalogSyncTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        Lab.__table__.create(self.engine)
        LabModule.__table__.create(self.engine)

        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.db.add(
            Lab(
                id="linux-sysadmin-lab",
                name="Linux System Administration",
                category="Linux & System Administration",
                difficulty="Beginner",
                max_points=0,
                estimated_time=300,
                status="ACTIVE",
                description="Test Linux Sysadmin marketplace lab",
                price_inr=0,
                rating=0,
                review_count=0,
                registry_path="/tmp/linux-sysadmin-lab",
                price_per_hour=0,
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_creates_reporting_modules_from_question_bank(self):
        repository = FakeRepository(
            [
                make_view(
                    "TUPE-C03-001",
                    "Pipeline Report Builder",
                    objectives=("Build shell pipelines",),
                ),
                make_view(
                    "TUPE-C03-002",
                    "Filename Pattern Selector",
                    objectives=("Use filename expansion",),
                ),
                make_view(
                    "TUPE-C03-003",
                    "Quoting and Literal Data",
                    objectives=("Preserve literal shell data",),
                ),
            ]
        )

        result = sync_sysadmin_lab_modules(
            self.db,
            settings=FakeSettings(),
            repository=repository,
        )
        self.db.commit()

        rows = (
            self.db.query(LabModule)
            .filter(LabModule.lab_id == "linux-sysadmin-lab")
            .order_by(LabModule.display_order)
            .all()
        )

        self.assertEqual(result.module_count, 3)
        self.assertEqual(result.created, 3)
        self.assertEqual(result.updated, 0)
        self.assertEqual(result.total_points, 300)

        self.assertEqual(
            [row.id for row in rows],
            [
                "TUPE-C03-001",
                "TUPE-C03-002",
                "TUPE-C03-003",
            ],
        )
        self.assertEqual(
            [row.module_number for row in rows],
            [1, 2, 3],
        )
        self.assertEqual(
            [row.points for row in rows],
            [100, 100, 100],
        )

        lab = (
            self.db.query(Lab)
            .filter(Lab.id == "linux-sysadmin-lab")
            .one()
        )
        self.assertEqual(lab.max_points, 300)

    def test_second_sync_is_idempotent_and_updates_metadata(self):
        repository = FakeRepository(
            [
                make_view(
                    "TUPE-C03-001",
                    "Original Title",
                    points=100,
                )
            ]
        )

        first = sync_sysadmin_lab_modules(
            self.db,
            settings=FakeSettings(),
            repository=repository,
        )
        self.db.commit()

        self.assertEqual(first.created, 1)

        updated_repository = FakeRepository(
            [
                make_view(
                    "TUPE-C03-001",
                    "Updated Title",
                    points=125,
                    module="updated-track",
                )
            ]
        )

        second = sync_sysadmin_lab_modules(
            self.db,
            settings=FakeSettings(),
            repository=updated_repository,
        )
        self.db.commit()

        row = self.db.query(LabModule).one()

        self.assertEqual(second.created, 0)
        self.assertEqual(second.updated, 1)
        self.assertEqual(
            self.db.query(LabModule).count(),
            1,
        )
        self.assertEqual(row.title, "Updated Title")
        self.assertEqual(row.points, 125)
        self.assertEqual(row.track, "updated-track")

        lab = (
            self.db.query(Lab)
            .filter(Lab.id == "linux-sysadmin-lab")
            .one()
        )
        self.assertEqual(lab.max_points, 125)

    def test_refuses_cross_lab_module_id_collision(self):
        self.db.add(
            Lab(
                id="other-lab",
                name="Other Lab",
                category="Test",
                difficulty="Beginner",
                max_points=100,
                estimated_time=60,
                status="ACTIVE",
                description="Other lab",
                price_inr=0,
                rating=0,
                review_count=0,
                registry_path="/tmp/other",
                price_per_hour=0,
            )
        )
        self.db.flush()

        self.db.add(
            LabModule(
                id="TUPE-C03-001",
                lab_id="other-lab",
                module_number=1,
                title="Collision",
                description="Collision",
                points=100,
                display_order=1,
                track="test",
            )
        )
        self.db.commit()

        repository = FakeRepository(
            [
                make_view(
                    "TUPE-C03-001",
                    "Pipeline Report Builder",
                )
            ]
        )

        with self.assertRaises(SysadminCatalogSyncError):
            sync_sysadmin_lab_modules(
                self.db,
                settings=FakeSettings(),
                repository=repository,
            )

        self.db.rollback()

        row = (
            self.db.query(LabModule)
            .filter(LabModule.id == "TUPE-C03-001")
            .one()
        )
        self.assertEqual(row.lab_id, "other-lab")


if __name__ == "__main__":
    unittest.main()
