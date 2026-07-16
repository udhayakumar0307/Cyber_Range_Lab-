import logging
from uuid import uuid4, UUID
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.pg import get_pg
from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import SysAdminOnly, AnyAuthenticatedUser
from backend.schemas.auth import CurrentUser

log = logging.getLogger("cms")
router = APIRouter(tags=["CMS & Catalog"])


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class SectionPayload(BaseModel):
    title: str
    sort_order: int = 0
    config: Dict[str, Any] = {}


class PageCreateUpdateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    is_published: bool = False
    sections: List[SectionPayload] = []


# ── Public Catalog & CMS Endpoints ───────────────────────────────────────────

@router.get("/catalog/labs")
async def get_catalog_labs(
    pg: AsyncSession = Depends(get_pg),
):
    """Returns the public catalog of active labs with joined pricing details."""
    result = await pg.execute(
        text("""
            SELECT 
                ci.id,
                ci.title,
                ci.description,
                ci.difficulty,
                ci.duration_minutes,
                ci.metadata,
                cp.amount_minor,
                cp.currency,
                cp.is_active AS price_active
            FROM content_items ci
            LEFT JOIN content_prices cp ON cp.content_id = ci.id
            WHERE ci.type = 'lab' AND ci.is_active = true
            ORDER BY ci.created_at DESC
        """)
    )
    rows = result.fetchall()

    labs = []
    for r in rows:
        meta = r.metadata or {}
        slug = meta.get("slug")
        lab_type = meta.get("lab_type")
        feature_chips = meta.get("feature_chips") or []
        
        is_purchasable = r.price_active if r.price_active is not None else False
        price = None
        if r.amount_minor is not None:
            price = {
                "amount_minor": r.amount_minor,
                "currency": r.currency
            }

        labs.append({
            "id": str(r.id),
            "slug": slug,
            "title": r.title,
            "description": r.description,
            "difficulty": r.difficulty,
            "duration_minutes": r.duration_minutes,
            "lab_type": lab_type,
            "feature_chips": feature_chips,
            "is_purchasable": is_purchasable,
            "price": price
        })

    return labs


@router.get("/catalog/pages/{slug}")
async def get_public_page(
    slug: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
):
    """Returns details of a published content page along with its sections."""
    # 1. Fetch page
    page_res = await pg.execute(
        text("""
            SELECT id, slug, title, content, is_published 
            FROM content_pages 
            WHERE slug = :slug AND is_published = true
        """),
        {"slug": slug}
    )
    page = page_res.fetchone()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # 2. Fetch sections
    sec_res = await pg.execute(
        text("""
            SELECT id, title, sort_order, config 
            FROM content_sections 
            WHERE page_id = :page_id 
            ORDER BY sort_order ASC
        """),
        {"page_id": page.id}
    )
    sections = [
        {
            "section_key": str(r.id),
            "section_type": "markdown", # Default type
            "position": r.sort_order,
            "payload": r.config or {}
        }
        for r in sec_res.fetchall()
    ]

    return {
        "slug": page.slug,
        "title": page.title,
        "description": page.content,
        "seo_title": page.title,
        "seo_description": page.content,
        "sections": sections
    }


# ── Administrative Content CRUD Endpoints ───────────────────────────────────

@router.get("/admin/content/activity")
async def get_content_activity(
    limit: int = Query(50, ge=1, le=500),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns recent CMS revisions/audit logs."""
    # Queries the revisions table
    result = await pg.execute(
        text("""
            SELECT r.id AS revision_id, r.page_id, r.created_at, u.email AS created_by, p.title AS page_title
            FROM content_page_revisions r
            JOIN content_pages p ON r.page_id = p.id
            LEFT JOIN users u ON r.created_by = u.id
            ORDER BY r.created_at DESC
            LIMIT :limit
        """),
        {"limit": limit}
    )
    rows = result.fetchall()
    
    return {
        "count": len(rows),
        "rows": [
            {
                "revision_id": str(r.revision_id),
                "created_by": r.created_by,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "metadata": {
                    "page_id": str(r.page_id),
                    "page_title": r.page_title
                }
            }
            for r in rows
        ]
    }


@router.post("/admin/content/pages")
async def create_content_page(
    payload: PageCreateUpdateRequest,
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Creates a new CMS content page and its sections."""
    page_id = uuid4()
    slug = payload.title.lower().replace(" ", "-").replace("/", "-")
    
    # 1. Insert page record
    await pg.execute(
        text("""
            INSERT INTO content_pages (id, slug, title, content, is_published)
            VALUES (:id, :slug, :title, :content, :is_pub)
        """),
        {
            "id": page_id,
            "slug": slug,
            "title": payload.title,
            "content": payload.description,
            "is_pub": payload.is_published
        }
    )

    # 2. Insert sections
    import json
    for sec in payload.sections:
        sec_id = uuid4()
        await pg.execute(
            text("""
                INSERT INTO content_sections (id, page_id, title, sort_order, config)
                VALUES (:id, :page_id, :title, :sort, :config)
            """),
            {
                "id": sec_id,
                "page_id": page_id,
                "title": sec.title,
                "sort": sec.sort_order,
                "config": json.dumps(sec.config)
            }
        )

    # 3. Write revision log
    await pg.execute(
        text("""
            INSERT INTO content_page_revisions (id, page_id, content, created_by)
            VALUES (gen_random_uuid(), :page_id, :content, :admin_id)
        """),
        {
            "page_id": page_id,
            "content": f"Created page '{payload.title}'",
            "admin_id": admin.id
        }
    )

    await pg.commit()
    log.info("CMS Page created: id=%s slug=%s by sys_admin=%s", page_id, slug, admin.id)
    return {"id": str(page_id), "slug": slug, "success": True}


@router.put("/admin/content/pages/{page_id}")
async def update_content_page(
    payload: PageCreateUpdateRequest,
    page_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Updates an existing CMS content page."""
    # 1. Verify existence
    check_res = await pg.execute(
        text("SELECT id FROM content_pages WHERE id = :id"),
        {"id": page_id}
    )
    if not check_res.fetchone():
        raise HTTPException(status_code=404, detail="Page not found")

    # 2. Update page details
    await pg.execute(
        text("""
            UPDATE content_pages 
            SET title = :title, content = :content, is_published = :is_pub, updated_at = now()
            WHERE id = :id
        """),
        {
            "title": payload.title,
            "content": payload.description,
            "is_pub": payload.is_published,
            "id": page_id
        }
    )

    # 3. Clean and recreate sections
    await pg.execute(
        text("DELETE FROM content_sections WHERE page_id = :page_id"),
        {"page_id": page_id}
    )

    import json
    for sec in payload.sections:
        await pg.execute(
            text("""
                INSERT INTO content_sections (id, page_id, title, sort_order, config)
                VALUES (gen_random_uuid(), :page_id, :title, :sort, :config)
            """),
            {
                "page_id": page_id,
                "title": sec.title,
                "sort": sec.sort_order,
                "config": json.dumps(sec.config)
            }
        )

    # 4. Write revision log
    await pg.execute(
        text("""
            INSERT INTO content_page_revisions (id, page_id, content, created_by)
            VALUES (gen_random_uuid(), :page_id, :content, :admin_id)
        """),
        {
            "page_id": page_id,
            "content": f"Updated page content/sections",
            "admin_id": admin.id
        }
    )

    await pg.commit()
    log.info("CMS Page updated: id=%s by sys_admin=%s", page_id, admin.id)
    return {"id": str(page_id), "success": True}


@router.delete("/admin/content/pages/{page_id}")
async def delete_content_page(
    page_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Deletes a CMS page."""
    result = await pg.execute(
        text("DELETE FROM content_pages WHERE id = :id RETURNING id"),
        {"id": page_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Page not found")

    await pg.commit()
    log.info("CMS Page deleted: id=%s by sys_admin=%s", page_id, admin.id)
    return {"success": True, "message": "Content page deleted successfully"}
