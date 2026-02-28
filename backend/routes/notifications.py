"""Email notifications management routes using Resend"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import os
import asyncio
import logging
import resend
from dotenv import load_dotenv

from database import db, get_current_user

# Load environment variables
load_dotenv()

router = APIRouter(tags=["notifications"])
logger = logging.getLogger(__name__)

# Initialize Resend
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Pydantic models
class NotificationSettings(BaseModel):
    order_status_enabled: bool = True
    promotions_enabled: bool = True
    order_confirmation_enabled: bool = True
    client_notifications_enabled: bool = True

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    html_content: str

class BulkEmailRequest(BaseModel):
    subject: str
    html_content: str
    recipient_type: str = "all"  # all, subscribed

class TestEmailRequest(BaseModel):
    email: EmailStr


# Helper function to send email
async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send email using Resend API"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return {"status": "skipped", "reason": "API key not configured"}
    
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        # Run sync SDK in thread to keep FastAPI non-blocking
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {email.get('id')}")
        return {
            "status": "success",
            "email_id": email.get("id")
        }
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }


# Email templates
def get_order_confirmation_template(order_data: dict) -> str:
    """Generate order confirmation email HTML"""
    items_html = ""
    for item in order_data.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.get('name', '')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{item.get('price', 0):,.0f} ₽</td>
        </tr>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #fff; padding: 30px; border: 1px solid #eee; }}
            .order-info {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }}
            .total {{ font-size: 24px; font-weight: bold; color: #f97316; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ background: #f97316; color: white; padding: 12px; text-align: left; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">AVOPT.STORE</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Заказ подтверждён</p>
            </div>
            <div class="content">
                <h2>Спасибо за заказ!</h2>
                <p>Здравствуйте, {order_data.get('full_name', 'уважаемый клиент')}!</p>
                <p>Ваш заказ <strong>#{order_data.get('id', '')[:8]}</strong> успешно оформлен и принят в обработку.</p>
                
                <div class="order-info">
                    <h3 style="margin-top: 0;">Детали заказа:</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th style="text-align: center;">Кол-во</th>
                                <th style="text-align: right;">Цена</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                    <p style="text-align: right; margin-top: 15px;">
                        <span class="total">Итого: {order_data.get('total', 0):,.0f} ₽</span>
                    </p>
                </div>
                
                <div class="order-info">
                    <h3 style="margin-top: 0;">Доставка:</h3>
                    <p><strong>Адрес:</strong> {order_data.get('address', '')}</p>
                    <p><strong>Телефон:</strong> {order_data.get('phone', '')}</p>
                    {f"<p><strong>Комментарий:</strong> {order_data.get('comment')}</p>" if order_data.get('comment') else ""}
                </div>
                
                <p>Мы свяжемся с вами для подтверждения заказа в ближайшее время.</p>
            </div>
            <div class="footer">
                <p>С уважением, команда AVOPT.STORE</p>
                <p>Это автоматическое письмо, пожалуйста, не отвечайте на него.</p>
            </div>
        </div>
    </body>
    </html>
    """


def get_order_status_template(order_data: dict, new_status: str) -> str:
    """Generate order status update email HTML"""
    status_labels = {
        "pending": ("Ожидает обработки", "#fbbf24"),
        "processing": ("В обработке", "#3b82f6"),
        "shipped": ("Отправлен", "#8b5cf6"),
        "delivered": ("Доставлен", "#22c55e"),
        "cancelled": ("Отменён", "#ef4444")
    }
    
    status_text, status_color = status_labels.get(new_status, ("Обновлён", "#666"))
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #fff; padding: 30px; border: 1px solid #eee; }}
            .status-badge {{ display: inline-block; background: {status_color}; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; }}
            .order-info {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">AVOPT.STORE</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Обновление статуса заказа</p>
            </div>
            <div class="content">
                <h2>Статус заказа обновлён</h2>
                <p>Здравствуйте, {order_data.get('full_name', 'уважаемый клиент')}!</p>
                <p>Статус вашего заказа <strong>#{order_data.get('id', '')[:8]}</strong> изменён:</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <span class="status-badge">{status_text}</span>
                </p>
                
                <div class="order-info">
                    <p><strong>Номер заказа:</strong> #{order_data.get('id', '')[:8]}</p>
                    <p><strong>Сумма:</strong> {order_data.get('total', 0):,.0f} ₽</p>
                    <p><strong>Адрес доставки:</strong> {order_data.get('address', '')}</p>
                </div>
                
                {"<p>Ваш заказ успешно доставлен! Спасибо за покупку.</p>" if new_status == "delivered" else ""}
                {"<p>Ваш заказ отправлен и скоро будет доставлен по указанному адресу.</p>" if new_status == "shipped" else ""}
                {"<p>К сожалению, ваш заказ был отменён. Если у вас есть вопросы, свяжитесь с нами.</p>" if new_status == "cancelled" else ""}
            </div>
            <div class="footer">
                <p>С уважением, команда AVOPT.STORE</p>
                <p>Это автоматическое письмо, пожалуйста, не отвечайте на него.</p>
            </div>
        </div>
    </body>
    </html>
    """


def get_promo_template(subject: str, content: str) -> str:
    """Generate promotional email HTML"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #fff; padding: 30px; border: 1px solid #eee; }}
            .cta-button {{ display: inline-block; background: #f97316; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">AVOPT.STORE</h1>
                <h2 style="margin: 15px 0 0 0; font-weight: normal; opacity: 0.95;">{subject}</h2>
            </div>
            <div class="content">
                {content}
                <p style="text-align: center;">
                    <a href="https://avopt.store" class="cta-button">Перейти в магазин</a>
                </p>
            </div>
            <div class="footer">
                <p>С уважением, команда AVOPT.STORE</p>
                <p style="margin-top: 15px; font-size: 11px;">
                    Вы получили это письмо, потому что подписаны на рассылку AVOPT.STORE.<br>
                    Если вы не хотите получать такие письма, напишите нам.
                </p>
            </div>
        </div>
    </body>
    </html>
    """


# API endpoints
@router.get("/admin/notification-settings")
async def get_notification_settings(user=Depends(get_current_user)):
    """Get current notification settings"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
    
    if not settings:
        return {
            "order_status_enabled": True,
            "promotions_enabled": True,
            "order_confirmation_enabled": True,
            "client_notifications_enabled": True,
            "resend_configured": bool(RESEND_API_KEY)
        }
    
    return {
        "order_status_enabled": settings.get("order_status_enabled", True),
        "promotions_enabled": settings.get("promotions_enabled", True),
        "order_confirmation_enabled": settings.get("order_confirmation_enabled", True),
        "client_notifications_enabled": settings.get("client_notifications_enabled", True),
        "resend_configured": bool(RESEND_API_KEY)
    }


@router.put("/admin/notification-settings")
async def update_notification_settings(data: NotificationSettings, user=Depends(get_current_user)):
    """Update notification settings"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"type": "notification_settings"},
        {
            "$set": {
                "type": "notification_settings",
                "order_status_enabled": data.order_status_enabled,
                "promotions_enabled": data.promotions_enabled,
                "order_confirmation_enabled": data.order_confirmation_enabled,
                "client_notifications_enabled": data.client_notifications_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Настройки уведомлений сохранены"}


@router.get("/client-notifications-enabled")
async def get_client_notifications_status():
    """Public endpoint: check if client notifications are enabled"""
    settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
    return {"enabled": settings.get("client_notifications_enabled", True) if settings else True}


@router.post("/admin/email/test")
async def send_test_email(data: TestEmailRequest, user=Depends(get_current_user)):
    """Send a test email to verify configuration"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=400, detail="Resend API не настроен. Добавьте RESEND_API_KEY в настройки.")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 8px;">
            <h2 style="color: #f97316; margin-top: 0;">Тестовое письмо</h2>
            <p>Это тестовое письмо от AVOPT.STORE.</p>
            <p>Если вы видите это сообщение, значит email-уведомления настроены правильно!</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Отправлено: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC
            </p>
        </div>
    </body>
    </html>
    """
    
    result = await send_email(data.email, "Тестовое письмо от AVOPT.STORE", html_content)
    
    if result.get("status") == "success":
        return {"message": f"Тестовое письмо отправлено на {data.email}"}
    else:
        error_msg = result.get('error', 'Неизвестная ошибка')
        # Handle common Resend errors
        if "only send testing emails" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Resend в тестовом режиме. Для отправки на другие адреса подтвердите домен на resend.com/domains")
        raise HTTPException(status_code=500, detail=f"Ошибка отправки: {error_msg}")


@router.post("/admin/email/send-bulk")
async def send_bulk_email(data: BulkEmailRequest, user=Depends(get_current_user)):
    """Send promotional email to users"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=400, detail="Resend API не настроен")
    
    # Check if promotions are enabled
    settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
    if settings and not settings.get("promotions_enabled", True):
        raise HTTPException(status_code=400, detail="Промо-рассылки отключены в настройках")
    
    # Get users with emails
    query = {"email": {"$exists": True, "$ne": ""}}
    users_cursor = db.users.find(query, {"_id": 0, "email": 1, "name": 1})
    users_list = await users_cursor.to_list(length=10000)
    
    if not users_list:
        raise HTTPException(status_code=400, detail="Нет пользователей для рассылки")
    
    # Generate email content
    html_content = get_promo_template(data.subject, data.html_content)
    
    # Send emails
    sent_count = 0
    error_count = 0
    
    for u in users_list:
        result = await send_email(u["email"], data.subject, html_content)
        if result.get("status") == "success":
            sent_count += 1
        else:
            error_count += 1
    
    # Log the bulk email
    await db.email_logs.insert_one({
        "type": "bulk_promo",
        "subject": data.subject,
        "sent_count": sent_count,
        "error_count": error_count,
        "sent_by": user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Отправлено: {sent_count}, Ошибок: {error_count}",
        "sent_count": sent_count,
        "error_count": error_count
    }


# Helper function to send order confirmation (called from orders.py)
async def send_order_confirmation_email(order_data: dict, user_email: str):
    """Send order confirmation email"""
    settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
    
    if settings and not settings.get("order_confirmation_enabled", True):
        return {"status": "skipped", "reason": "Order confirmation emails disabled"}
    
    html_content = get_order_confirmation_template(order_data)
    return await send_email(user_email, f"Заказ #{order_data.get('id', '')[:8]} подтверждён - AVOPT.STORE", html_content)


# Helper function to send order status update (called from orders.py)
async def send_order_status_email(order_data: dict, user_email: str, new_status: str):
    """Send order status update email"""
    settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
    
    if settings and not settings.get("order_status_enabled", True):
        return {"status": "skipped", "reason": "Order status emails disabled"}
    
    status_labels = {
        "pending": "Ожидает обработки",
        "processing": "В обработке",
        "shipped": "Отправлен",
        "delivered": "Доставлен",
        "cancelled": "Отменён"
    }
    
    status_text = status_labels.get(new_status, new_status)
    html_content = get_order_status_template(order_data, new_status)
    return await send_email(user_email, f"Заказ #{order_data.get('id', '')[:8]} - {status_text}", html_content)
