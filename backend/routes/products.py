"""Products and Categories routes"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
import uuid

from database import db, get_current_user
from models import (
    ProductCreate, ProductUpdate, ProductResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse
)

router = APIRouter(tags=["products"])


# ==================== CATEGORIES ====================

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories


@router.post("/categories", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    category_id = str(uuid.uuid4())
    category = {
        "id": category_id,
        **data.model_dump()
    }
    await db.categories.insert_one(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.categories.update_one({"id": category_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return category


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.products.update_many({"category_id": category_id}, {"$set": {"category_id": None}})
    return {"message": "Category deleted"}


# ==================== PRODUCTS ====================

@router.get("/products/popular", response_model=List[ProductResponse])
async def get_popular_products(limit: int = 6):
    """Get popular products based on order count"""
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "order_count": {"$sum": "$items.quantity"}}},
        {"$sort": {"order_count": -1}},
        {"$limit": limit}
    ]
    popular_ids = await db.orders.aggregate(pipeline).to_list(limit)
    
    if popular_ids:
        product_ids = [p["_id"] for p in popular_ids]
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(limit)
        id_to_count = {p["_id"]: p["order_count"] for p in popular_ids}
        products.sort(key=lambda x: id_to_count.get(x["id"], 0), reverse=True)
    else:
        products = await db.products.find({}, {"_id": 0}).limit(limit).to_list(limit)
    
    return products


@router.get("/products", response_model=List[ProductResponse])
async def get_products(search: Optional[str] = None, category_id: Optional[str] = None, limit: int = 100, skip: int = 0):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"article": {"$regex": search, "$options": "i"}},
            {"cross_articles": {"$regex": search, "$options": "i"}}
        ]
    if category_id:
        query["category_id"] = category_id
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(min(limit, 100)).to_list(100)
    return products


@router.get("/products/search")
async def search_products_autocomplete(q: str, limit: int = 8):
    """Quick search for autocomplete dropdown - searches by name and article"""
    if not q or len(q) < 2:
        return {"products": []}
    
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"article": {"$regex": q, "$options": "i"}},
            {"cross_articles": {"$regex": q, "$options": "i"}}
        ]
    }
    
    products = await db.products.find(query, {"_id": 0}).limit(min(limit, 20)).to_list(20)
    return {"products": products}


@router.get("/products/search-with-alternatives")
async def search_products_with_alternatives(search: str, limit: int = 50):
    """Search products with exact matches first, then alternatives from cross_articles"""
    if not search:
        return {"exact": [], "alternatives": []}
    
    search_upper = search.upper().strip()
    
    exact_match = await db.products.find_one(
        {"article": {"$regex": f"^{search}$", "$options": "i"}},
        {"_id": 0}
    )
    
    alternatives = []
    if search_upper:
        alt_query = {
            "$and": [
                {"cross_articles": {"$regex": search, "$options": "i"}},
                {"article": {"$not": {"$regex": f"^{search}$", "$options": "i"}}}
            ]
        }
        alternatives = await db.products.find(alt_query, {"_id": 0}).limit(limit).to_list(limit)
    
    name_matches = []
    if not exact_match:
        name_query = {"name": {"$regex": search, "$options": "i"}}
        name_matches = await db.products.find(name_query, {"_id": 0}).limit(limit).to_list(limit)
    
    return {
        "exact": [exact_match] if exact_match else name_matches,
        "alternatives": alternatives
    }


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    product_id = str(uuid.uuid4())
    product = {
        "id": product_id,
        **data.model_dump()
    }
    await db.products.insert_one(product)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    return product


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}


@router.get("/products/{product_id}/related", response_model=List[ProductResponse])
async def get_related_products(product_id: str, limit: int = 4):
    """Get related products from same category"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    query = {"id": {"$ne": product_id}}
    
    if product.get("category_id"):
        query["category_id"] = product["category_id"]
    
    related = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    if len(related) < limit:
        additional_query = {"id": {"$nin": [product_id] + [r["id"] for r in related]}}
        additional = await db.products.find(additional_query, {"_id": 0}).limit(limit - len(related)).to_list(limit)
        related.extend(additional)
    
    return related



# ==================== PRODUCT IMPORT/EXPORT ====================

@router.post("/admin/products/import")
async def import_products(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import products from CSV file"""
    import csv
    import io
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    content = await file.read()
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('cp1251')
    
    reader = csv.DictReader(io.StringIO(text), delimiter=';')
    
    imported = 0
    errors = []
    
    for row in reader:
        try:
            article = row.get('Артикул', '').strip()
            if not article:
                continue
            
            existing = await db.products.find_one({"article": article})
            
            product_data = {
                "name": row.get('Наименование', '').strip(),
                "article": article,
                "manufacturer": row.get('Производитель', '').strip(),
                "price": float(row.get('Цена', '0').replace(',', '.').replace(' ', '') or '0'),
                "stock": int(float(row.get('Остаток', '0').replace(',', '.').replace(' ', '') or '0')),
                "description": row.get('Описание', '').strip(),
                "cross_articles": row.get('Кросс-артикулы', '').strip(),
                "delivery_days": int(row.get('Срок доставки', '3') or '3'),
            }
            
            if existing:
                await db.products.update_one({"article": article}, {"$set": product_data})
            else:
                product_data["id"] = str(uuid.uuid4())
                product_data["image_url"] = ""
                product_data["images"] = []
                product_data["category_id"] = None
                await db.products.insert_one(product_data)
            
            imported += 1
        except Exception as e:
            errors.append(f"Row error: {str(e)}")
    
    return {
        "success": True,
        "imported": imported,
        "errors": errors[:10]
    }


@router.get("/admin/products/export")
async def export_products(user=Depends(get_current_user)):
    """Export products to CSV"""
    import csv
    import io
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow(['Артикул', 'Наименование', 'Производитель', 'Цена', 'Остаток', 'Описание', 'Кросс-артикулы', 'Срок доставки', 'Категория'])
    
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in categories}
    
    for p in products:
        writer.writerow([
            p.get('article', ''),
            p.get('name', ''),
            p.get('manufacturer', ''),
            p.get('price', 0),
            p.get('stock', 0),
            p.get('description', ''),
            p.get('cross_articles', ''),
            p.get('delivery_days', 3),
            cat_map.get(p.get('category_id'), '')
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"}
    )
