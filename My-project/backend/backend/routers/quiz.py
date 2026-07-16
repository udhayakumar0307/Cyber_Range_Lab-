import logging
import hashlib
from uuid import uuid4, UUID
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.pg import get_pg
from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import CourseAdminOrAbove, AnyAuthenticatedUser
from backend.schemas.auth import CurrentUser
from backend.config import ROLE_SYS_ADMIN, ROLE_COURSE_ADMIN

log = logging.getLogger("quiz")
router = APIRouter(prefix="/quiz", tags=["Quiz & CTF"])


async def _verify_course_assignment(
    pg: AsyncSession,
    course_admin_id: str,
    content_id: str,
) -> None:
    """Raises 403 if the course_admin is not assigned to this course."""
    result = await pg.execute(
        text("""
            SELECT 1 FROM course_admin_assignments
            WHERE user_id = :user_id AND content_id = :content_id
        """),
        {"user_id": course_admin_id, "content_id": content_id},
    )
    if not result.fetchone():
        raise HTTPException(
            status_code=403,
            detail="You are not assigned as course_admin for this course.",
        )


async def _resolve_content_id(pg: AsyncSession, lab_id: str) -> UUID:
    # 1. Check if lab_id is a valid UUID
    try:
        return UUID(lab_id)
    except ValueError:
        pass
    
    # 2. Check by metadata->>'slug'
    result = await pg.execute(
        text("SELECT id FROM content_items WHERE metadata->>'slug' = :slug"),
        {"slug": lab_id},
    )
    row = result.fetchone()
    if row:
        return row[0]
        
    # 3. Fallback: generate deterministic UUID using DNS namespace
    try:
        return uuid.uuid5(uuid.NAMESPACE_DNS, lab_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Invalid lab identifier '{lab_id}'.")


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class ChallengePushItem(BaseModel):
    id: Optional[UUID] = None
    title: str = Field(..., min_length=2, max_length=200)
    category: Optional[str] = None
    difficulty: Optional[str] = None
    points: int = Field(0, ge=0)
    flag: str = Field(..., min_length=1)
    scenario: Optional[str] = None
    instructions: Optional[str] = None
    hints: List[str] = []
    solutionText: Optional[str] = None
    challenge_url: Optional[str] = None


class ChallengePushRequest(BaseModel):
    content_id: UUID
    challenges: List[ChallengePushItem]


class ChallengeSubmitRequest(BaseModel):
    flag: str = Field(..., min_length=1)
    time_spent_seconds: Optional[int] = Field(None, ge=0)


class QuizProgressUpdateRequest(BaseModel):
    currentChallenge: Optional[str] = None
    completedChallenges: Optional[List[str]] = None
    wrongAttempts: Optional[dict] = None
    hintsUsed: Optional[dict] = None
    submittedAnswers: Optional[dict] = None
    totalTimeSpent: Optional[int] = None
    totalPoints: Optional[int] = None
    isCompleted: Optional[bool] = None


class QuizFlagSubmitRequest(BaseModel):
    challengeId: str
    flag: str
    timeSpent: Optional[int] = 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/admin/push")
async def push_challenges(
    payload: ChallengePushRequest,
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """
    CourseAdmin or SysAdmin only. 
    Synchronizes and publishes challenges for a given content_id (lab scenario).
    Uses secure hashing for flag values and parameterized SQL for all updates.
    """
    content_check = await pg.execute(
        text("SELECT 1 FROM content_items WHERE id = :cid"),
        {"cid": payload.content_id},
    )
    if not content_check.fetchone():
        raise HTTPException(
            status_code=404, 
            detail=f"Content item '{payload.content_id}' not found."
        )

    if _admin.role != ROLE_SYS_ADMIN:
        await _verify_course_assignment(pg, str(_admin.id), str(payload.content_id))

    upsert_stmt = text("""
        INSERT INTO challenges (
            id, content_id, title, category, difficulty, points, 
            flag_hash, scenario, instructions, hints, solution_text, challenge_url
        ) VALUES (
            :id, :content_id, :title, :category, :difficulty, :points, 
            :flag_hash, :scenario, :instructions, :hints, :solution_text, :challenge_url
        ) ON CONFLICT (id) DO UPDATE SET 
            content_id = EXCLUDED.content_id,
            title = EXCLUDED.title,
            category = EXCLUDED.category,
            difficulty = EXCLUDED.difficulty,
            points = EXCLUDED.points,
            flag_hash = EXCLUDED.flag_hash,
            scenario = EXCLUDED.scenario,
            instructions = EXCLUDED.instructions,
            hints = EXCLUDED.hints,
            solution_text = EXCLUDED.solution_text,
            challenge_url = EXCLUDED.challenge_url,
            created_at = now()
        RETURNING id;
    """)

    import json
    created_ids = []
    for item in payload.challenges:
        challenge_id = item.id or uuid4()
        flag_hash = hashlib.sha256(item.flag.strip().encode("utf-8")).hexdigest()
        hints_json = json.dumps(item.hints)

        result = await pg.execute(
            upsert_stmt,
            {
                "id": challenge_id,
                "content_id": payload.content_id,
                "title": item.title,
                "category": item.category,
                "difficulty": item.difficulty,
                "points": item.points,
                "flag_hash": flag_hash,
                "scenario": item.scenario,
                "instructions": item.instructions,
                "hints": hints_json,
                "solution_text": item.solutionText,
                "challenge_url": item.challenge_url,
            }
        )
        row = result.fetchone()
        if row:
            created_ids.append(row[0])

    await pg.commit()
    log.info("CTF Challenges synced: content_id=%s count=%d", payload.content_id, len(payload.challenges))
    return {
        "success": True,
        "message": "Challenges synchronized and published successfully",
        "challenge_ids": [str(cid) for cid in created_ids],
    }


@router.post("/challenges/{challenge_id}/submit")
async def submit_challenge_flag(
    payload: ChallengeSubmitRequest,
    challenge_id: UUID = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """
    Participant submission endpoint (Legacy).
    Safely verifies user-submitted flags against SHA-256 hashes in database.
    """
    challenge_result = await pg.execute(
        text("SELECT id, flag_hash, points FROM challenges WHERE id = :id"),
        {"id": challenge_id},
    )
    challenge = challenge_result.fetchone()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    submitted_hash = hashlib.sha256(payload.flag.strip().encode("utf-8")).hexdigest()
    correct = (submitted_hash == challenge.flag_hash)

    points_awarded = 0
    if correct:
        existing_correct = await pg.execute(
            text("""
                SELECT 1 FROM submissions 
                WHERE challenge_id = :cid AND user_id = :uid AND correct = true 
                LIMIT 1
            """),
            {"cid": challenge_id, "uid": current_user.id},
        )
        if not existing_correct.fetchone():
            points_awarded = challenge.points

    await pg.execute(
        text("""
            INSERT INTO submissions (
                id, challenge_id, user_id, correct, points_awarded, time_spent_seconds
            ) VALUES (
                gen_random_uuid(), :cid, :uid, :correct, :points_awarded, :time_spent
            )
        """),
        {
            "cid": challenge_id,
            "uid": current_user.id,
            "correct": correct,
            "points_awarded": points_awarded,
            "time_spent": payload.time_spent_seconds,
        }
    )
    await pg.commit()

    if correct:
        msg = "Correct flag!"
        log.info("CTF Correct submission: challenge_id=%s user_id=%s points=%d", challenge_id, current_user.id, points_awarded)
    else:
        msg = "Incorrect flag. Try again!"
        log.info("CTF Incorrect submission: challenge_id=%s user_id=%s", challenge_id, current_user.id)

    return {
        "success": True,
        "correct": correct,
        "points_awarded": points_awarded,
        "message": msg
    }


@router.get("/{content_id}/leaderboard")
async def get_leaderboard(
    content_id: UUID = Path(...),
    limit: int = Query(10, ge=1, le=100),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """
    Returns the leaderboard standings for a given content_id (Legacy).
    """
    result = await pg.execute(
        text("""
            SELECT 
                u.name,
                u.email,
                COALESCE(sub.completed_challenges, 0) AS completed_challenges,
                COALESCE(sub.total_points, 0) AS total_points,
                COALESCE(sub.total_time_spent, 0) AS total_time_spent
            FROM users u
            JOIN (
                SELECT 
                    s.user_id,
                    COUNT(DISTINCT CASE WHEN s.correct = true THEN s.challenge_id END) AS completed_challenges,
                    SUM(s.points_awarded) AS total_points,
                    SUM(CASE WHEN s.correct = true THEN COALESCE(s.time_spent_seconds, 0) ELSE 0 END) AS total_time_spent
                FROM submissions s
                JOIN challenges c ON s.challenge_id = c.id
                WHERE c.content_id = :content_id
                GROUP BY s.user_id
            ) sub ON sub.user_id = u.id
            WHERE u.role = 'participant'
              AND (sub.total_points > 0 OR sub.completed_challenges > 0)
            ORDER BY total_points DESC, total_time_spent ASC
            LIMIT :limit
        """),
        {"content_id": content_id, "limit": limit},
    )
    rows = result.fetchall()

    leaderboard_data = [
        {
            "name": r.name or r.email.split("@")[0],
            "email": r.email,
            "completedChallenges": int(r.completed_challenges),
            "totalPoints": int(r.total_points),
            "totalTimeSpent": int(r.total_time_spent)
        }
        for r in rows
    ]

    return {
        "success": True,
        "data": leaderboard_data
    }


# ── New Sync/Interactive Quiz Endpoints ─────────────────────────────────────

@router.get("/{lab_id}/data")
async def get_quiz_data(
    lab_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    content_id = await _resolve_content_id(pg, lab_id)
    
    result = await pg.execute(
        text("SELECT id, title, description, metadata FROM content_items WHERE id = :cid"),
        {"cid": content_id},
    )
    item = result.fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="Lab not found")
        
    metadata = item.metadata or {}
    challenges = metadata.get("challenges", [])
    
    formatted_challenges = []
    for c in challenges:
        formatted_challenges.append({
            "id": str(c.get("id")),
            "title": c.get("title", ""),
            "scenario": c.get("scenario", ""),
            "instructions": c.get("instructions", ""),
            "points": c.get("points", 0),
            "difficulty": c.get("difficulty", "Medium"),
            "estimatedTime": c.get("estimatedTime", 30),
            "category": c.get("category", "General"),
            "tags": c.get("tags", []),
            "hints": c.get("hints", [])
        })
        
    return {
        "success": True,
        "data": {
            "id": str(item.id),
            "labId": lab_id,
            "title": item.title,
            "description": item.description or "",
            "totalChallenges": len(formatted_challenges),
            "totalPoints": sum(c["points"] for c in formatted_challenges),
            "estimatedDuration": metadata.get("estimatedDuration", 3),
            "challenges": formatted_challenges
        }
    }


@router.get("/{lab_id}/progress")
async def get_quiz_progress(
    lab_id: str = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    # Resolve the content ID or slug
    content_id = await _resolve_content_id(pg, lab_id)
    
    # Try to find existing progress
    result = await pg.execute(
        text("SELECT * FROM quiz_progress WHERE user_id = :uid AND lab_id = :lab_id"),
        {"uid": current_user.id, "lab_id": lab_id},
    )
    row = result.fetchone()
    
    if not row:
        # Create a new progress row with default values
        await pg.execute(
            text("INSERT INTO quiz_progress (user_id, lab_id) VALUES (:uid, :lab_id) ON CONFLICT (user_id, lab_id) DO NOTHING"),
            {"uid": current_user.id, "lab_id": lab_id},
        )
        await pg.commit()
        
        # Query again
        result = await pg.execute(
            text("SELECT * FROM quiz_progress WHERE user_id = :uid AND lab_id = :lab_id"),
            {"uid": current_user.id, "lab_id": lab_id},
        )
        row = result.fetchone()
        
    return {
        "success": True,
        "data": {
            "currentChallenge": row.current_challenge or "",
            "completedChallenges": row.completed_challenges or [],
            "wrongAttempts": row.wrong_attempts or {},
            "hintsUsed": row.hints_used or {},
            "submittedAnswers": row.submitted_answers or {},
            "totalTimeSpent": row.total_time_spent or 0,
            "totalPoints": row.total_points or 0,
            "isCompleted": row.is_completed or False,
            "completionDate": row.completion_date.isoformat() if row.completion_date else None,
            "lastAccessed": row.last_accessed.isoformat() if row.last_accessed else None
        }
    }


@router.put("/{lab_id}/progress")
async def update_quiz_progress(
    payload: QuizProgressUpdateRequest,
    lab_id: str = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    import json
    
    # Get current progress
    result = await pg.execute(
        text("SELECT * FROM quiz_progress WHERE user_id = :uid AND lab_id = :lab_id"),
        {"uid": current_user.id, "lab_id": lab_id},
    )
    row = result.fetchone()
    
    if not row:
        completed_challenges = payload.completedChallenges or []
        wrong_attempts = payload.wrongAttempts or {}
        hints_used = payload.hintsUsed or {}
        submitted_answers = payload.submittedAnswers or {}
        
        await pg.execute(
            text("""
                INSERT INTO quiz_progress (
                    user_id, lab_id, current_challenge, completed_challenges,
                    wrong_attempts, hints_used, submitted_answers, 
                    total_time_spent, total_points, is_completed, completion_date
                ) VALUES (
                    :uid, :lab_id, :curr, :comp::jsonb, :wrong::jsonb, :hints::jsonb, :sub::jsonb,
                    :time, :points, :is_comp, :comp_date
                )
            """),
            {
                "uid": current_user.id,
                "lab_id": lab_id,
                "curr": payload.currentChallenge,
                "comp": json.dumps(completed_challenges),
                "wrong": json.dumps(wrong_attempts),
                "hints": json.dumps(hints_used),
                "sub": json.dumps(submitted_answers),
                "time": payload.totalTimeSpent or 0,
                "points": payload.totalPoints or 0,
                "is_comp": payload.isCompleted or False,
                "comp_date": None
            }
        )
    else:
        curr = payload.currentChallenge if payload.currentChallenge is not None else row.current_challenge
        
        comp = row.completed_challenges
        if payload.completedChallenges is not None:
            comp = payload.completedChallenges
            
        wrong = row.wrong_attempts
        if payload.wrongAttempts is not None:
            wrong = {**wrong, **payload.wrongAttempts}
            
        hints = row.hints_used
        if payload.hintsUsed is not None:
            hints = {**hints, **payload.hintsUsed}
            
        sub = row.submitted_answers
        if payload.submittedAnswers is not None:
            sub = {**sub, **payload.submittedAnswers}
            
        time_spent = payload.totalTimeSpent if payload.totalTimeSpent is not None else row.total_time_spent
        points = payload.totalPoints if payload.totalPoints is not None else row.total_points
        is_comp = payload.isCompleted if payload.isCompleted is not None else row.is_completed
        
        comp_date = row.completion_date
        if is_comp and not row.is_completed:
            from datetime import datetime, timezone
            comp_date = datetime.now(timezone.utc)
            
        await pg.execute(
            text("""
                UPDATE quiz_progress SET
                    current_challenge = :curr,
                    completed_challenges = :comp::jsonb,
                    wrong_attempts = :wrong::jsonb,
                    hints_used = :hints::jsonb,
                    submitted_answers = :sub::jsonb,
                    total_time_spent = :time,
                    total_points = :points,
                    is_completed = :is_comp,
                    completion_date = :comp_date,
                    last_accessed = now()
                WHERE user_id = :uid AND lab_id = :lab_id
            """),
            {
                "curr": curr,
                "comp": json.dumps(comp),
                "wrong": json.dumps(wrong),
                "hints": json.dumps(hints),
                "sub": json.dumps(sub),
                "time": time_spent,
                "points": points,
                "is_comp": is_comp,
                "comp_date": comp_date,
                "uid": current_user.id,
                "lab_id": lab_id
            }
        )
    
    await pg.commit()
    return {"success": True}


@router.post("/{lab_id}/submit-flag")
async def submit_flag(
    payload: QuizFlagSubmitRequest,
    lab_id: str = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    import json
    from datetime import datetime, timezone
    
    content_id = await _resolve_content_id(pg, lab_id)
    
    try:
        challenge_uuid = UUID(payload.challengeId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid challenge ID format.")
        
    challenge_result = await pg.execute(
        text("SELECT id, flag_hash, points FROM challenges WHERE id = :id AND content_id = :content_id"),
        {"id": challenge_uuid, "content_id": content_id},
    )
    challenge = challenge_result.fetchone()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found in this lab.")
        
    submitted_hash = hashlib.sha256(payload.flag.strip().encode("utf-8")).hexdigest()
    is_correct = (submitted_hash == challenge.flag_hash)
    
    progress_result = await pg.execute(
        text("SELECT * FROM quiz_progress WHERE user_id = :uid AND lab_id = :lab_id"),
        {"uid": current_user.id, "lab_id": lab_id},
    )
    progress_row = progress_result.fetchone()
    
    if not progress_row:
        await pg.execute(
            text("INSERT INTO quiz_progress (user_id, lab_id) VALUES (:uid, :lab_id) ON CONFLICT (user_id, lab_id) DO NOTHING"),
            {"uid": current_user.id, "lab_id": lab_id},
        )
        await pg.commit()
        progress_result = await pg.execute(
            text("SELECT * FROM quiz_progress WHERE user_id = :uid AND lab_id = :lab_id"),
            {"uid": current_user.id, "lab_id": lab_id},
        )
        progress_row = progress_result.fetchone()
        
    completed_challenges = list(progress_row.completed_challenges or [])
    wrong_attempts = dict(progress_row.wrong_attempts or {})
    submitted_answers = dict(progress_row.submitted_answers or {})
    total_points = progress_row.total_points
    
    challenge_id_str = str(challenge_uuid)
    submitted_answers[challenge_id_str] = payload.flag
    
    points_awarded = 0
    if is_correct:
        if challenge_id_str not in completed_challenges:
            completed_challenges.append(challenge_id_str)
            points_awarded = challenge.points
            total_points += points_awarded
    else:
        wrong_attempts[challenge_id_str] = wrong_attempts.get(challenge_id_str, 0) + 1
        
    await pg.execute(
        text("""
            INSERT INTO submissions (
                id, challenge_id, user_id, correct, points_awarded, time_spent_seconds
            ) VALUES (
                gen_random_uuid(), :cid, :uid, :correct, :points_awarded, :time_spent
            )
        """),
        {
            "cid": challenge_uuid,
            "uid": current_user.id,
            "correct": is_correct,
            "points_awarded": points_awarded,
            "time_spent": payload.timeSpent,
        }
    )
    
    content_result = await pg.execute(
        text("SELECT metadata FROM content_items WHERE id = :cid"),
        {"cid": content_id},
    )
    content_item = content_result.fetchone()
    lab_challenges = []
    if content_item and content_item.metadata:
        lab_challenges = content_item.metadata.get("challenges", [])
        
    all_challenge_ids = {str(c.get("id")) for c in lab_challenges}
    is_quiz_completed = len(all_challenge_ids) > 0 and all_challenge_ids.issubset(set(completed_challenges))
    
    next_challenge = None
    for c in lab_challenges:
        c_id_str = str(c.get("id"))
        if c_id_str not in completed_challenges:
            next_challenge = c_id_str
            break
            
    completion_date = progress_row.completion_date
    if is_quiz_completed and not progress_row.is_completed:
        completion_date = datetime.now(timezone.utc)
        
    await pg.execute(
        text("""
            UPDATE quiz_progress SET
                completed_challenges = :comp::jsonb,
                wrong_attempts = :wrong::jsonb,
                submitted_answers = :sub::jsonb,
                total_time_spent = total_time_spent + :time_spent,
                total_points = :total_points,
                is_completed = :is_completed,
                completion_date = :completion_date,
                last_accessed = now()
            WHERE user_id = :uid AND lab_id = :lab_id
        """),
        {
            "comp": json.dumps(completed_challenges),
            "wrong": json.dumps(wrong_attempts),
            "sub": json.dumps(submitted_answers),
            "time_spent": payload.timeSpent or 0,
            "total_points": total_points,
            "is_completed": is_quiz_completed,
            "completion_date": completion_date,
            "uid": current_user.id,
            "lab_id": lab_id
        }
    )
    
    await pg.commit()
    
    return {
        "success": True,
        "data": {
            "isCorrect": is_correct,
            "points": points_awarded,
            "totalPoints": total_points,
            "completedChallenges": completed_challenges,
            "isQuizCompleted": is_quiz_completed,
            "nextChallenge": next_challenge,
            "wrongAttempts": wrong_attempts.get(challenge_id_str, 0)
        }
    }


@router.get("/{lab_id}/leaderboard")
async def get_quiz_leaderboard(
    lab_id: str = Path(...),
    limit: int = Query(10, ge=1, le=100),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    content_id = await _resolve_content_id(pg, lab_id)
    
    result = await pg.execute(
        text("""
            SELECT 
                u.name,
                u.email,
                p.completed_challenges,
                p.total_points,
                p.total_time_spent,
                p.completion_date
            FROM quiz_progress p
            JOIN users u ON p.user_id = u.id
            WHERE (p.lab_id = :lab_id OR p.lab_id = :resolved_slug)
              AND u.role = 'participant'
              AND (
                p.total_points > 0 
                OR (
                  p.completed_challenges IS NOT NULL 
                  AND jsonb_typeof(p.completed_challenges) = 'array' 
                  AND jsonb_array_length(p.completed_challenges) > 0
                )
              )
            ORDER BY p.total_points DESC, p.total_time_spent ASC, p.completion_date ASC
            LIMIT :limit
        """),
        {"lab_id": lab_id, "resolved_slug": str(content_id), "limit": limit},
    )
    rows = result.fetchall()
    
    leaderboard_data = []
    for idx, r in enumerate(rows):
        import json
        comp_count = 0
        if isinstance(r.completed_challenges, list):
            comp_count = len(r.completed_challenges)
        elif isinstance(r.completed_challenges, str):
            try:
                comp_count = len(json.loads(r.completed_challenges))
            except Exception:
                pass
                
        leaderboard_data.append({
            "rank": idx + 1,
            "name": r.name or r.email.split('@')[0],
            "email": r.email,
            "totalPoints": r.total_points,
            "totalTimeSpent": r.total_time_spent,
            "completedChallenges": comp_count,
            "completionDate": r.completion_date.isoformat() if r.completion_date else ""
        })
        
    return {
        "success": True,
        "data": leaderboard_data
    }

