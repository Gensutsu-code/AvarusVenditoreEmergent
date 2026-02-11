"""Document generation routes - Invoice and Receipt"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from database import db, get_current_user
from documents import generate_invoice_docx, generate_receipt_docx, generate_invoice_pdf, generate_receipt_pdf

router = APIRouter(tags=["documents"])


@router.get("/admin/orders/{order_id}/invoice/{format}")
async def download_invoice(order_id: str, format: str, user=Depends(get_current_user)):
    """Download invoice (товарная накладная) as DOCX or PDF"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="Format must be 'docx' or 'pdf'")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_user = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0})
    
    if format == "docx":
        buf = generate_invoice_docx(order, order_user)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                headers={"Content-Disposition": f'attachment; filename="invoice_{order_id[:8]}.docx"'})
    else:
        buf = generate_invoice_pdf(order, order_user)
        return StreamingResponse(buf, media_type="application/pdf",
                                headers={"Content-Disposition": f'attachment; filename="invoice_{order_id[:8]}.pdf"'})


@router.get("/admin/orders/{order_id}/receipt/{format}")
async def download_receipt(order_id: str, format: str, user=Depends(get_current_user)):
    """Download receipt (чек) as DOCX or PDF"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="Format must be 'docx' or 'pdf'")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_user = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0})
    
    if format == "docx":
        buf = generate_receipt_docx(order, order_user)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                headers={"Content-Disposition": f'attachment; filename="receipt_{order_id[:8]}.docx"'})
    else:
        buf = generate_receipt_pdf(order, order_user)
        return StreamingResponse(buf, media_type="application/pdf",
                                headers={"Content-Disposition": f'attachment; filename="receipt_{order_id[:8]}.pdf"'})
