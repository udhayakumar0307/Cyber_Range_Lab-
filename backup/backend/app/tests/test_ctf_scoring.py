"""
Unit tests for the CTF scoring engine and flag utilities.

Coverage
--------
  ctf_flag.py
    - generate_salt         : uniqueness, length
    - hash_flag             : deterministic, salt-sensitive
    - verify_flag           : correct match, wrong flag, wrong salt, whitespace strip

  ctf_scoring.py  (pure math — no DB)
    - compute_static_points : basic, zero penalty, max penalty cap
    - compute_dynamic_value : n=1 (== ceiling), n=2, n=10, floor clamping
    - apply_hint_penalty    : basic, min-1 floor

  ctf_scoring.py  (DB-backed via in-memory SQLite)
    - get_hint_penalty_pct  : no hints, one hint, multiple hints, cap at 99
    - score_correct_submission
        * static, no hints
        * static, with hints
        * dynamic, first blood (n=1, points locked at ceiling)
        * dynamic, second solver (n=2, decayed)
        * dynamic, tenth solver (floor clamping)
    - recalculate_dynamic_scores
        * retroactively reduces non-first-blood solvers
        * never touches first-blood submission
        * updates ctf_participation.total_points
    - recompute_participation_total
        * sums deduplicated correct submissions
        * ignores incorrect submissions
"""

from __future__ import annotations

import math
import os
import sys
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

# Ensure the backend root is on sys.path
sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)

# ---------------------------------------------------------------------------
# Pure-logic imports (no DB, no FastAPI)
# ---------------------------------------------------------------------------
from app.services.ctf_flag import generate_salt, hash_flag, verify_flag
from app.services.ctf_scoring import (
    apply_hint_penalty,
    compute_dynamic_value,
    compute_static_points,
)


# ===========================================================================
# ctf_flag tests
# ===========================================================================

class TestGenerateSalt(unittest.TestCase):
    def test_returns_string(self):
        self.assertIsInstance(generate_salt(), str)

    def test_default_length_is_64_hex_chars(self):
        # secrets.token_hex(32) → 64 hex chars
        self.assertEqual(len(generate_salt()), 64)

    def test_custom_length(self):
        self.assertEqual(len(generate_salt(16)), 32)

    def test_unique_on_each_call(self):
        salts = {generate_salt() for _ in range(50)}
        self.assertEqual(len(salts), 50, "Salts must be unique")


class TestHashFlag(unittest.TestCase):
    def test_deterministic(self):
        salt = "abc"
        self.assertEqual(hash_flag("CTF{test}", salt), hash_flag("CTF{test}", salt))

    def test_different_flags_differ(self):
        salt = "abc"
        self.assertNotEqual(hash_flag("CTF{right}", salt), hash_flag("CTF{wrong}", salt))

    def test_different_salts_differ(self):
        flag = "CTF{flag}"
        self.assertNotEqual(hash_flag(flag, "salt1"), hash_flag(flag, "salt2"))

    def test_returns_64_char_hex(self):
        h = hash_flag("CTF{x}", "s")
        self.assertEqual(len(h), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in h))


class TestVerifyFlag(unittest.TestCase):
    def setUp(self):
        self.salt = generate_salt()
        self.flag = "CTF{super_secret_flag}"
        self.stored = hash_flag(self.flag, self.salt)

    def test_correct_flag_returns_true(self):
        self.assertTrue(verify_flag(self.flag, self.salt, self.stored))

    def test_wrong_flag_returns_false(self):
        self.assertFalse(verify_flag("CTF{wrong}", self.salt, self.stored))

    def test_wrong_salt_returns_false(self):
        self.assertFalse(verify_flag(self.flag, "wrongsalt", self.stored))

    def test_strips_whitespace(self):
        self.assertTrue(verify_flag(f"  {self.flag}  ", self.salt, self.stored))

    def test_case_sensitive(self):
        self.assertFalse(verify_flag(self.flag.upper(), self.salt, self.stored))


# ===========================================================================
# Pure math tests (no DB)
# ===========================================================================

class TestComputeStaticPoints(unittest.TestCase):
    def test_no_penalty(self):
        self.assertEqual(compute_static_points(500, 0.0), 500)

    def test_twenty_percent_penalty(self):
        # 500 * (1 - 0.20) = 400
        self.assertEqual(compute_static_points(500, 20.0), 400)

    def test_fifty_percent_penalty(self):
        self.assertEqual(compute_static_points(100, 50.0), 50)

    def test_minimum_is_one(self):
        # 100% penalty would give 0 — must floor at 1
        self.assertEqual(compute_static_points(10, 99.0), 1)

    def test_fractional_result_floors(self):
        # 100 * (1 - 0.33) = 67.0 → floor → 67
        self.assertEqual(compute_static_points(100, 33.0), 67)

    def test_one_point_challenge_no_penalty(self):
        self.assertEqual(compute_static_points(1, 0.0), 1)

    def test_one_point_challenge_with_penalty_still_one(self):
        self.assertEqual(compute_static_points(1, 50.0), 1)


class TestComputeDynamicValue(unittest.TestCase):
    """
    Formula: max(floor, ceil(ceiling - k * ln(n)))
    With ceiling=500, floor=50, k=100:
      n=1  → ceil(500 - 100*0)    = 500
      n=2  → ceil(500 - 100*0.693) = ceil(430.7) = 431
      n=10 → ceil(500 - 100*2.303) = ceil(269.7) = 270
    """

    def setUp(self):
        self.ceiling = 500
        self.floor = 50
        self.k = 100.0

    def test_n1_equals_ceiling(self):
        # ln(1) == 0, so value == ceiling
        self.assertEqual(
            compute_dynamic_value(self.ceiling, self.floor, self.k, 1),
            self.ceiling,
        )

    def test_n2_decays(self):
        val = compute_dynamic_value(self.ceiling, self.floor, self.k, 2)
        self.assertLess(val, self.ceiling)
        expected = max(self.floor, math.ceil(self.ceiling - self.k * math.log(2)))
        self.assertEqual(val, expected)

    def test_n10_decays_more(self):
        val = compute_dynamic_value(self.ceiling, self.floor, self.k, 10)
        val2 = compute_dynamic_value(self.ceiling, self.floor, self.k, 2)
        self.assertLess(val, val2)

    def test_floor_clamping(self):
        # With large n, value should clamp at floor
        val = compute_dynamic_value(self.ceiling, self.floor, self.k, 10_000)
        self.assertEqual(val, self.floor)

    def test_n0_returns_ceiling(self):
        # Guard: n <= 0 treated as if n=1 (no decay)
        self.assertEqual(
            compute_dynamic_value(self.ceiling, self.floor, self.k, 0),
            self.ceiling,
        )

    def test_monotonically_decreasing(self):
        vals = [
            compute_dynamic_value(self.ceiling, self.floor, self.k, n)
            for n in range(1, 20)
        ]
        for i in range(len(vals) - 1):
            self.assertGreaterEqual(
                vals[i], vals[i + 1],
                f"Value should be non-increasing but {vals[i]} < {vals[i+1]} at i={i}",
            )

    def test_never_below_floor(self):
        for n in [1, 2, 5, 10, 50, 500, 10_000]:
            val = compute_dynamic_value(self.ceiling, self.floor, self.k, n)
            self.assertGreaterEqual(val, self.floor, f"Value below floor at n={n}")

    def test_never_above_ceiling(self):
        for n in [1, 2, 5, 10]:
            val = compute_dynamic_value(self.ceiling, self.floor, self.k, n)
            self.assertLessEqual(val, self.ceiling, f"Value above ceiling at n={n}")


class TestApplyHintPenalty(unittest.TestCase):
    def test_zero_penalty(self):
        self.assertEqual(apply_hint_penalty(500, 0.0), 500)

    def test_twenty_percent(self):
        self.assertEqual(apply_hint_penalty(500, 20.0), 400)

    def test_minimum_one(self):
        self.assertEqual(apply_hint_penalty(1, 99.0), 1)

    def test_floors_result(self):
        # 300 * (1-0.33) = 300 * 0.67 = 200.99... → floor → 200
        self.assertEqual(apply_hint_penalty(300, 33.0), 200)


# ===========================================================================
# DB-backed tests using in-memory SQLite
# ===========================================================================

import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.ctf import (
    CTF,
    CTFChallenge,
    CTFHint,
    CTFHintUnlock,
    CTFParticipation,
    CTFSubmission,
)


_DB_COUNTER = 0

_CTF_DDL = """
CREATE TABLE IF NOT EXISTS ctf (
    id INTEGER PRIMARY KEY, title VARCHAR(200) NOT NULL,
    description TEXT, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    is_frozen BOOLEAN NOT NULL DEFAULT 0, is_public BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS ctf_challenge (
    id INTEGER PRIMARY KEY, ctf_id INTEGER NOT NULL REFERENCES ctf(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL, description TEXT, category VARCHAR(100),
    connection_string VARCHAR(500), challenge_url VARCHAR(500),
    scoring_mode VARCHAR(20) NOT NULL DEFAULT 'static',
    static_points INTEGER, dynamic_ceiling INTEGER, dynamic_floor INTEGER, decay_constant FLOAT,
    flag_hash VARCHAR(255), flag_salt VARCHAR(64),
    is_hidden BOOLEAN NOT NULL DEFAULT 0, url_active BOOLEAN NOT NULL DEFAULT 1,
    solve_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS ctf_challenge_file (
    id INTEGER PRIMARY KEY, challenge_id INTEGER NOT NULL REFERENCES ctf_challenge(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL, storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100), file_size_bytes INTEGER NOT NULL DEFAULT 0, uploaded_at DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS ctf_hint (
    id INTEGER PRIMARY KEY, challenge_id INTEGER NOT NULL REFERENCES ctf_challenge(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, cost_percent FLOAT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ctf_hint_unlock (
    id INTEGER PRIMARY KEY, hint_id INTEGER NOT NULL REFERENCES ctf_hint(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL, unlocked_at DATETIME NOT NULL,
    UNIQUE(hint_id, participant_id)
);
CREATE TABLE IF NOT EXISTS ctf_submission (
    id INTEGER PRIMARY KEY, challenge_id INTEGER NOT NULL REFERENCES ctf_challenge(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL, submitted_flag_hash VARCHAR(255) NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT 0, is_first_blood BOOLEAN NOT NULL DEFAULT 0,
    submitted_at DATETIME NOT NULL, points_credited INTEGER NOT NULL DEFAULT 0,
    hint_penalty_percent FLOAT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ctf_participation (
    id INTEGER PRIMARY KEY, ctf_id INTEGER NOT NULL REFERENCES ctf(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL, total_points INTEGER NOT NULL DEFAULT 0,
    solve_count INTEGER NOT NULL DEFAULT 0, last_submission_at DATETIME, joined_at DATETIME NOT NULL,
    UNIQUE(ctf_id, participant_id)
);
"""

def _make_session():
    global _DB_COUNTER
    _DB_COUNTER += 1
    db_path = f"/tmp/ctf_test_{_DB_COUNTER}.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False}
    )
    # Use raw DDL to avoid duplicate global Index object conflicts
    with engine.connect() as conn:
        for stmt in _CTF_DDL.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(sa.text(stmt))
        conn.commit()
    Session = sessionmaker(bind=engine)
    session = Session()
    session._test_db_path = db_path
    session._test_engine = engine
    return session


def _ctf(db) -> CTF:
    ctf = CTF(
        title="Test CTF",
        start_time=datetime(2030, 1, 1),
        end_time=datetime(2030, 1, 2),
        status="active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ctf)
    db.flush()
    return ctf


def _static_challenge(db, ctf_id: int, pts: int = 500) -> CTFChallenge:
    salt = generate_salt()
    ch = CTFChallenge(
        ctf_id=ctf_id,
        title="Static Chal",
        scoring_mode="static",
        static_points=pts,
        flag_hash=hash_flag("CTF{flag}", salt),
        flag_salt=salt,
        solve_count=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ch)
    db.flush()
    return ch


def _dynamic_challenge(
    db, ctf_id: int, ceiling=500, floor=50, k=100.0
) -> CTFChallenge:
    salt = generate_salt()
    ch = CTFChallenge(
        ctf_id=ctf_id,
        title="Dynamic Chal",
        scoring_mode="dynamic",
        dynamic_ceiling=ceiling,
        dynamic_floor=floor,
        decay_constant=k,
        flag_hash=hash_flag("CTF{flag}", salt),
        flag_salt=salt,
        solve_count=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ch)
    db.flush()
    return ch


def _hint(db, challenge_id: int, cost: float, order: int = 0) -> CTFHint:
    h = CTFHint(
        challenge_id=challenge_id,
        order_index=order,
        text="hint text",
        cost_percent=cost,
    )
    db.add(h)
    db.flush()
    return h


def _unlock(db, hint_id: int, participant_id: int) -> CTFHintUnlock:
    u = CTFHintUnlock(
        hint_id=hint_id,
        participant_id=participant_id,
        unlocked_at=datetime.utcnow(),
    )
    db.add(u)
    db.flush()
    return u


def _participation(db, ctf_id: int, participant_id: int) -> CTFParticipation:
    p = CTFParticipation(
        ctf_id=ctf_id,
        participant_id=participant_id,
        total_points=0,
        solve_count=0,
        joined_at=datetime.utcnow(),
    )
    db.add(p)
    db.flush()
    return p


def _submission(
    db,
    challenge_id: int,
    participant_id: int,
    is_correct: bool,
    is_first_blood: bool,
    points: int,
) -> CTFSubmission:
    s = CTFSubmission(
        challenge_id=challenge_id,
        participant_id=participant_id,
        submitted_flag_hash="x",
        is_correct=is_correct,
        is_first_blood=is_first_blood,
        submitted_at=datetime.utcnow(),
        points_credited=points,
        hint_penalty_percent=0.0,
    )
    db.add(s)
    db.flush()
    return s


# ---------------------------------------------------------------------------
# get_hint_penalty_pct
# ---------------------------------------------------------------------------

class TestGetHintPenaltyPct(unittest.TestCase):
    def setUp(self):
        self.db = _make_session()
        self.ctf = _ctf(self.db)
        self.ch = _static_challenge(self.db, self.ctf.id)

    def tearDown(self):
        import os
        db_path = getattr(self.db, '_test_db_path', None)
        engine = getattr(self.db, '_test_engine', None)
        self.db.close()
        if engine:
            engine.dispose()
        if db_path and os.path.exists(db_path):
            os.remove(db_path)

    def test_no_hints_returns_zero(self):
        from app.services.ctf_scoring import get_hint_penalty_pct
        self.assertEqual(get_hint_penalty_pct(self.db, participant_id=1, challenge_id=self.ch.id), 0.0)

    def test_one_hint_unlocked(self):
        from app.services.ctf_scoring import get_hint_penalty_pct
        h = _hint(self.db, self.ch.id, cost=20.0)
        _unlock(self.db, h.id, participant_id=1)
        self.assertAlmostEqual(get_hint_penalty_pct(self.db, 1, self.ch.id), 20.0)

    def test_two_hints_cumulative(self):
        from app.services.ctf_scoring import get_hint_penalty_pct
        h1 = _hint(self.db, self.ch.id, cost=20.0, order=0)
        h2 = _hint(self.db, self.ch.id, cost=15.0, order=1)
        _unlock(self.db, h1.id, participant_id=2)
        _unlock(self.db, h2.id, participant_id=2)
        self.assertAlmostEqual(get_hint_penalty_pct(self.db, 2, self.ch.id), 35.0)

    def test_hint_unlocked_by_other_participant_not_counted(self):
        from app.services.ctf_scoring import get_hint_penalty_pct
        h = _hint(self.db, self.ch.id, cost=30.0)
        _unlock(self.db, h.id, participant_id=99)  # different participant
        self.assertEqual(get_hint_penalty_pct(self.db, 1, self.ch.id), 0.0)

    def test_penalty_capped_at_99(self):
        from app.services.ctf_scoring import get_hint_penalty_pct
        h1 = _hint(self.db, self.ch.id, cost=60.0, order=0)
        h2 = _hint(self.db, self.ch.id, cost=50.0, order=1)  # total 110 → cap 99
        _unlock(self.db, h1.id, participant_id=5)
        _unlock(self.db, h2.id, participant_id=5)
        self.assertEqual(get_hint_penalty_pct(self.db, 5, self.ch.id), 99.0)


# ---------------------------------------------------------------------------
# score_correct_submission
# ---------------------------------------------------------------------------

class TestScoreCorrectSubmission(unittest.TestCase):
    def setUp(self):
        self.db = _make_session()
        self.ctf = _ctf(self.db)

    def tearDown(self):
        import os
        db_path = getattr(self.db, '_test_db_path', None)
        engine = getattr(self.db, '_test_engine', None)
        self.db.close()
        if engine:
            engine.dispose()
        if db_path and os.path.exists(db_path):
            os.remove(db_path)

    def test_static_no_hints(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _static_challenge(self.db, self.ctf.id, pts=300)
        pts, fb = score_correct_submission(self.db, ch, participant_id=1)
        self.assertEqual(pts, 300)
        self.assertFalse(fb)

    def test_static_with_hint_penalty(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _static_challenge(self.db, self.ctf.id, pts=500)
        h = _hint(self.db, ch.id, cost=20.0)
        _unlock(self.db, h.id, participant_id=1)
        pts, fb = score_correct_submission(self.db, ch, participant_id=1)
        # 500 * 0.80 = 400
        self.assertEqual(pts, 400)
        self.assertFalse(fb)

    def test_dynamic_first_blood_gets_ceiling(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _dynamic_challenge(self.db, self.ctf.id, ceiling=500, floor=50, k=100.0)
        ch.solve_count = 0  # n = 0+1 = 1 → first blood
        pts, fb = score_correct_submission(self.db, ch, participant_id=1)
        self.assertEqual(pts, 500)
        self.assertTrue(fb)

    def test_dynamic_first_blood_with_hint_reduces_only_for_that_player(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _dynamic_challenge(self.db, self.ctf.id, ceiling=500, floor=50, k=100.0)
        h = _hint(self.db, ch.id, cost=20.0)
        _unlock(self.db, h.id, participant_id=1)
        ch.solve_count = 0
        pts, fb = score_correct_submission(self.db, ch, participant_id=1)
        # ceiling=500 with 20% penalty → 400
        self.assertEqual(pts, 400)
        self.assertTrue(fb)

    def test_dynamic_second_solver_gets_decayed_value(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _dynamic_challenge(self.db, self.ctf.id, ceiling=500, floor=50, k=100.0)
        ch.solve_count = 1  # first blood already exists, n = 1+1 = 2
        pts, fb = score_correct_submission(self.db, ch, participant_id=2)
        expected = max(50, math.ceil(500 - 100.0 * math.log(2)))
        self.assertEqual(pts, expected)
        self.assertFalse(fb)

    def test_dynamic_high_solve_count_clamps_to_floor(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _dynamic_challenge(self.db, self.ctf.id, ceiling=500, floor=50, k=100.0)
        ch.solve_count = 9999  # effectively at floor
        pts, fb = score_correct_submission(self.db, ch, participant_id=99)
        self.assertEqual(pts, 50)
        self.assertFalse(fb)

    def test_minimum_points_never_zero(self):
        from app.services.ctf_scoring import score_correct_submission
        ch = _static_challenge(self.db, self.ctf.id, pts=1)
        h = _hint(self.db, ch.id, cost=99.0)
        _unlock(self.db, h.id, participant_id=1)
        pts, _ = score_correct_submission(self.db, ch, participant_id=1)
        self.assertGreaterEqual(pts, 1)


# ---------------------------------------------------------------------------
# recalculate_dynamic_scores
# ---------------------------------------------------------------------------

class TestRecalculateDynamicScores(unittest.TestCase):
    def setUp(self):
        self.db = _make_session()
        self.ctf = _ctf(self.db)

    def tearDown(self):
        import os
        db_path = getattr(self.db, '_test_db_path', None)
        engine = getattr(self.db, '_test_engine', None)
        self.db.close()
        if engine:
            engine.dispose()
        if db_path and os.path.exists(db_path):
            os.remove(db_path)

    def _setup_two_solvers(self, ceiling=500, floor=50, k=100.0):
        """
        First solver (first blood, id=1) and second solver (id=2).
        Returns (challenge, p1, p2, sub1, sub2).
        """
        ch = _dynamic_challenge(self.db, self.ctf.id, ceiling=ceiling, floor=floor, k=k)
        ch.solve_count = 2  # two solves registered

        p1 = _participation(self.db, self.ctf.id, 1)
        p2 = _participation(self.db, self.ctf.id, 2)

        # First blood — locked at ceiling
        sub1 = _submission(self.db, ch.id, 1, True, True, ceiling)
        # Second solver — at decayed value for n=2
        n2_val = max(floor, math.ceil(ceiling - k * math.log(2)))
        sub2 = _submission(self.db, ch.id, 2, False, False, n2_val)
        sub2.is_correct = True

        p1.total_points = ceiling
        p2.total_points = n2_val
        self.db.flush()
        return ch, p1, p2, sub1, sub2, n2_val

    def test_first_blood_not_touched(self):
        from app.services.ctf_scoring import recalculate_dynamic_scores
        ch, p1, p2, sub1, sub2, _ = self._setup_two_solvers()
        original_first_blood_pts = sub1.points_credited

        # Simulate a third solve
        sub3 = _submission(self.db, ch.id, 3, True, False, 0)
        p3 = _participation(self.db, self.ctf.id, 3)
        ch.solve_count = 3

        recalculate_dynamic_scores(self.db, ch.id)

        # First-blood points must remain untouched
        self.db.refresh(sub1)
        self.assertEqual(sub1.points_credited, original_first_blood_pts)

    def test_second_solver_retroactively_reduced(self):
        from app.services.ctf_scoring import recalculate_dynamic_scores
        ch, p1, p2, sub1, sub2, n2_pts = self._setup_two_solvers()

        # Third solve happens → n=3 → lower value
        _submission(self.db, ch.id, 3, True, False, 0)
        _participation(self.db, self.ctf.id, 3)
        ch.solve_count = 3

        recalculate_dynamic_scores(self.db, ch.id)
        self.db.refresh(sub2)

        n3_val = max(50, math.ceil(500 - 100.0 * math.log(3)))
        self.assertEqual(sub2.points_credited, n3_val)
        # And it should be less than the original n=2 value
        self.assertLess(sub2.points_credited, n2_pts)

    def test_participation_totals_updated(self):
        from app.services.ctf_scoring import recalculate_dynamic_scores
        ch, p1, p2, sub1, sub2, _ = self._setup_two_solvers()
        _submission(self.db, ch.id, 3, True, False, 0)
        p3 = _participation(self.db, self.ctf.id, 3)
        ch.solve_count = 3

        recalculate_dynamic_scores(self.db, ch.id)

        self.db.refresh(p2)
        n3_val = max(50, math.ceil(500 - 100.0 * math.log(3)))
        self.assertEqual(p2.total_points, n3_val)

    def test_static_challenge_is_noop(self):
        from app.services.ctf_scoring import recalculate_dynamic_scores
        ch = _static_challenge(self.db, self.ctf.id, pts=200)
        sub = _submission(self.db, ch.id, 1, True, False, 200)
        recalculate_dynamic_scores(self.db, ch.id)
        self.db.refresh(sub)
        # Static challenges must not be touched
        self.assertEqual(sub.points_credited, 200)


# ---------------------------------------------------------------------------
# recompute_participation_total
# ---------------------------------------------------------------------------

class TestRecomputeParticipationTotal(unittest.TestCase):
    def setUp(self):
        self.db = _make_session()
        self.ctf = _ctf(self.db)
        self.participant_id = 42

    def tearDown(self):
        import os
        db_path = getattr(self.db, '_test_db_path', None)
        engine = getattr(self.db, '_test_engine', None)
        self.db.close()
        if engine:
            engine.dispose()
        if db_path and os.path.exists(db_path):
            os.remove(db_path)

    def test_sums_correct_submissions(self):
        from app.services.ctf_scoring import recompute_participation_total
        ch1 = _static_challenge(self.db, self.ctf.id, pts=100)
        ch2 = _static_challenge(self.db, self.ctf.id, pts=200)
        p = _participation(self.db, self.ctf.id, self.participant_id)

        _submission(self.db, ch1.id, self.participant_id, True, False, 100)
        _submission(self.db, ch2.id, self.participant_id, True, False, 200)

        recompute_participation_total(self.db, self.participant_id, self.ctf.id)
        self.db.refresh(p)
        self.assertEqual(p.total_points, 300)

    def test_ignores_incorrect_submissions(self):
        from app.services.ctf_scoring import recompute_participation_total
        ch = _static_challenge(self.db, self.ctf.id, pts=100)
        p = _participation(self.db, self.ctf.id, self.participant_id)

        _submission(self.db, ch.id, self.participant_id, False, False, 0)  # wrong

        recompute_participation_total(self.db, self.participant_id, self.ctf.id)
        self.db.refresh(p)
        self.assertEqual(p.total_points, 0)

    def test_deduplicates_per_challenge(self):
        """If somehow two correct submissions exist for the same challenge, count only the first."""
        from app.services.ctf_scoring import recompute_participation_total
        ch = _static_challenge(self.db, self.ctf.id, pts=100)
        p = _participation(self.db, self.ctf.id, self.participant_id)

        s1 = _submission(self.db, ch.id, self.participant_id, True, True, 100)
        s2 = _submission(self.db, ch.id, self.participant_id, True, False, 80)

        recompute_participation_total(self.db, self.participant_id, self.ctf.id)
        self.db.refresh(p)
        # Only the first (chronological) correct submission counted → 100
        self.assertEqual(p.total_points, 100)

    def test_zero_when_no_submissions(self):
        from app.services.ctf_scoring import recompute_participation_total
        p = _participation(self.db, self.ctf.id, self.participant_id)
        recompute_participation_total(self.db, self.participant_id, self.ctf.id)
        self.db.refresh(p)
        self.assertEqual(p.total_points, 0)


# ===========================================================================
# Full integration: end-to-end first-blood protection across 3 solvers
# ===========================================================================

class TestFirstBloodProtectionIntegration(unittest.TestCase):
    """
    Simulate three solvers on a dynamic challenge and verify the full invariant:
      - Solver 1 (first blood): points locked at ceiling, never changed.
      - Solver 2: points reduced from n=2 value to n=3 value after solver 3 appears.
      - Solver 3: receives n=3 value.
    """

    CEILING = 500
    FLOOR = 50
    K = 100.0

    def setUp(self):
        self.db = _make_session()
        self.ctf = _ctf(self.db)
        self.ch = _dynamic_challenge(
            self.db, self.ctf.id,
            ceiling=self.CEILING, floor=self.FLOOR, k=self.K,
        )
        for pid in [1, 2, 3]:
            _participation(self.db, self.ctf.id, pid)

    def tearDown(self):
        import os
        db_path = getattr(self.db, '_test_db_path', None)
        engine = getattr(self.db, '_test_engine', None)
        self.db.close()
        if engine:
            engine.dispose()
        if db_path and os.path.exists(db_path):
            os.remove(db_path)

    def _n_val(self, n: int) -> int:
        return max(self.FLOOR, math.ceil(self.CEILING - self.K * math.log(n)))

    def test_three_solver_sequence(self):
        from app.services.ctf_scoring import (
            recalculate_dynamic_scores,
            recompute_participation_total,
            score_correct_submission,
        )

        # ── Solver 1 (first blood) ───────────────────────────────────────
        self.ch.solve_count = 0
        pts1, fb1 = score_correct_submission(self.db, self.ch, participant_id=1)
        self.assertEqual(pts1, self.CEILING)
        self.assertTrue(fb1)
        self.ch.solve_count = 1

        sub1 = CTFSubmission(
            challenge_id=self.ch.id, participant_id=1,
            submitted_flag_hash="x", is_correct=True, is_first_blood=True,
            submitted_at=datetime.utcnow(), points_credited=pts1, hint_penalty_percent=0.0,
        )
        self.db.add(sub1)
        self.db.flush()
        recompute_participation_total(self.db, 1, self.ctf.id)

        # ── Solver 2 ─────────────────────────────────────────────────────
        self.ch.solve_count = 1
        pts2, fb2 = score_correct_submission(self.db, self.ch, participant_id=2)
        self.assertEqual(pts2, self._n_val(2))
        self.assertFalse(fb2)
        self.ch.solve_count = 2

        sub2 = CTFSubmission(
            challenge_id=self.ch.id, participant_id=2,
            submitted_flag_hash="x", is_correct=True, is_first_blood=False,
            submitted_at=datetime.utcnow(), points_credited=pts2, hint_penalty_percent=0.0,
        )
        self.db.add(sub2)
        self.db.flush()
        recompute_participation_total(self.db, 2, self.ctf.id)

        # ── Solver 3 triggers retroactive recalculation ──────────────────
        self.ch.solve_count = 2
        pts3, fb3 = score_correct_submission(self.db, self.ch, participant_id=3)
        self.ch.solve_count = 3

        sub3 = CTFSubmission(
            challenge_id=self.ch.id, participant_id=3,
            submitted_flag_hash="x", is_correct=True, is_first_blood=False,
            submitted_at=datetime.utcnow(), points_credited=pts3, hint_penalty_percent=0.0,
        )
        self.db.add(sub3)
        self.db.flush()

        recalculate_dynamic_scores(self.db, self.ch.id)

        # Assertions
        self.db.refresh(sub1)
        self.db.refresh(sub2)
        self.db.refresh(sub3)

        # First blood locked at ceiling
        self.assertEqual(sub1.points_credited, self.CEILING)

        # Solver 2 reduced from n=2 value to n=3 value
        self.assertEqual(sub2.points_credited, self._n_val(3))

        # Solver 3 received n=3 value
        self.assertEqual(sub3.points_credited, self._n_val(3))

        # All values in valid range
        for sub in [sub1, sub2, sub3]:
            self.assertGreaterEqual(sub.points_credited, self.FLOOR)
            self.assertLessEqual(sub.points_credited, self.CEILING)


if __name__ == "__main__":
    unittest.main()
