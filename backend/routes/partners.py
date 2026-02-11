"""Partner brands routes"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
import uuid
import logging

from database import db, get_current_user
from models import PartnerBrand
from cloudinary_service import upload_to_cloudinary

router = APIRouter(tags=["partners"])
logger = logging.getLogger(__name__)


@router.get("/partners")
async def get_partners():
    """Get all partner brands for homepage"""
    partners = await db.partners.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return partners


@router.post("/admin/partners")
async def create_partner(partner: PartnerBrand, user=Depends(get_current_user)):
    """Create a new partner brand (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    partner_id = str(uuid.uuid4())
    partner_data = {
        "id": partner_id,
        "name": partner.name,
        "description": partner.description,
        "image_url": partner.image_url,
        "link": partner.link,
        "order": partner.order,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.partners.insert_one(partner_data)
    
    return {k: v for k, v in partner_data.items() if k != "_id"}


@router.put("/admin/partners/{partner_id}")
async def update_partner(partner_id: str, partner: PartnerBrand, user=Depends(get_current_user)):
    """Update a partner brand (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.partners.update_one(
        {"id": partner_id},
        {"$set": {
            "name": partner.name,
            "description": partner.description,
            "image_url": partner.image_url,
            "link": partner.link,
            "order": partner.order,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    updated = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return updated


@router.delete("/admin/partners/{partner_id}")
async def delete_partner(partner_id: str, user=Depends(get_current_user)):
    """Delete a partner brand (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.partners.delete_one({"id": partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    return {"message": "Partner deleted"}


@router.post("/admin/partners/upload-image")
async def upload_partner_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload partner logo image to Cloudinary"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    content = await file.read()
    
    try:
        result = await upload_to_cloudinary(content, file.filename, folder="partners")
        return {
            "url": result['url'],
            "public_id": result['public_id'],
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"Failed to upload partner image: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки изображения: {str(e)}")


@router.post("/admin/partners/seed")
async def seed_default_partners(user=Depends(get_current_user)):
    """Seed default partner brands if none exist (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    count = await db.partners.count_documents({})
    if count > 0:
        return {"message": "Partners already exist", "count": count}
    
    default_partners = [
        {"name": "FAG", "description": "Подшипники", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/se4069qi_Screenshot%20%281%29.png"},
        {"name": "HENGST", "description": "Фильтры", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/k3fl5886_Screenshot%20%282%29.png"},
        {"name": "MANN+HUMMEL", "description": "Фильтрация", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/8hwi685y_Screenshot%20%283%29.png"},
        {"name": "PACCAR", "description": "Комплектующие", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/lxmklmq6_Screenshot%20%284%29.png"},
        {"name": "SAF", "description": "Оси и подвеска", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/54osguxt_Screenshot%20%285%29.png"},
        {"name": "BPW", "description": "Ходовая часть", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/qjidmkpu_Screenshot%20%285%29.png"},
    ]
    
    for i, p in enumerate(default_partners):
        await db.partners.insert_one({
            "id": str(uuid.uuid4()),
            "name": p["name"],
            "description": p["description"],
            "image_url": p["image_url"],
            "link": "",
            "order": i,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Default partners created", "count": len(default_partners)}
