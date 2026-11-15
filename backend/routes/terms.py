"""Terms of Service routes - editable terms from admin panel"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone

from database import db, get_current_user

router = APIRouter(tags=["terms"])


class TermSection(BaseModel):
    id: str
    title: str
    content: str
    order: int


class TermsUpdate(BaseModel):
    sections: List[TermSection]


# Default terms sections
DEFAULT_TERMS = [
    {
        "id": "general",
        "title": "1. Общие положения",
        "content": """1.1. Настоящие Правила регулируют отношения между интернет-магазином AVOPT.STORE (далее — «Продавец») и физическими или юридическими лицами (далее — «Покупатель»), оформляющими заказы на сайте.

1.2. Оформляя заказ, Покупатель подтверждает своё согласие с настоящими Правилами и принимает на себя указанные в них права и обязанности.

1.3. Продавец оставляет за собой право вносить изменения в настоящие Правила без предварительного уведомления Покупателя.""",
        "order": 1
    },
    {
        "id": "ordering",
        "title": "2. Оформление заказа",
        "content": """2.1. Заказ оформляется путём добавления товаров в корзину и заполнения формы оформления заказа на сайте Продавца.

2.2. Покупатель обязуется предоставить достоверную информацию о себе: ФИО, контактный телефон, адрес доставки.

2.3. После оформления заказа Покупателю направляется подтверждение на указанные контактные данные. Заказ считается принятым после подтверждения менеджером.""",
        "order": 2
    },
    {
        "id": "payment",
        "title": "3. Цены и оплата",
        "content": """3.1. Цены на товары указаны в российских рублях и включают НДС (при наличии).

3.2. Продавец оставляет за собой право изменять цены на товары без предварительного уведомления. Цена заказа фиксируется в момент его оформления.

3.3. Оплата производится одним из способов: наличными при получении, банковской картой онлайн, криптовалютой.

3.4. При оплате определёнными способами может предоставляться скидка, указанная на странице оформления.""",
        "order": 3
    },
    {
        "id": "delivery",
        "title": "4. Доставка",
        "content": """4.1. Доставка осуществляется по адресу, указанному Покупателем при оформлении заказа.

4.2. Сроки доставки указываются ориентировочно и могут варьироваться в зависимости от наличия товара на складе и региона доставки.

4.3. Стоимость доставки рассчитывается индивидуально и сообщается Покупателю при подтверждении заказа.""",
        "order": 4
    },
    {
        "id": "returns",
        "title": "5. Возврат и обмен",
        "content": """5.1. Возврат товара надлежащего качества возможен в течение 14 дней с момента получения при сохранении товарного вида и потребительских свойств.

5.2. Возврат товара ненадлежащего качества осуществляется в соответствии с законодательством РФ о защите прав потребителей.

5.3. Для оформления возврата необходимо связаться с менеджером через чат поддержки на сайте.""",
        "order": 5
    },
    {
        "id": "warranty",
        "title": "6. Гарантии",
        "content": """6.1. На все товары распространяется гарантия производителя.

6.2. Гарантийные обязательства не распространяются на повреждения, возникшие вследствие неправильной эксплуатации, хранения или транспортировки товара Покупателем.""",
        "order": 6
    },
    {
        "id": "privacy",
        "title": "7. Конфиденциальность",
        "content": """7.1. Продавец обязуется не разглашать персональные данные Покупателя третьим лицам, за исключением случаев, предусмотренных законодательством РФ.

7.2. Персональные данные используются исключительно для обработки и доставки заказов, а также для информирования о статусе заказа.""",
        "order": 7
    },
    {
        "id": "contacts",
        "title": "8. Контактная информация",
        "content": "По всем вопросам обращайтесь через чат поддержки на сайте или по электронной почте, указанной в разделе «Контакты».",
        "order": 8
    }
]


@router.get("/terms")
async def get_terms():
    """Get terms of service for public display"""
    settings = await db.settings.find_one({"key": "terms_of_service"}, {"_id": 0})
    if settings and settings.get("value"):
        sections = settings["value"].get("sections", [])
        if sections:
            return {"sections": sorted(sections, key=lambda x: x.get("order", 0))}
    return {"sections": DEFAULT_TERMS}


@router.get("/admin/terms")
async def get_admin_terms(user=Depends(get_current_user)):
    """Get terms for admin editing"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "terms_of_service"}, {"_id": 0})
    if settings and settings.get("value"):
        sections = settings["value"].get("sections", [])
        if sections:
            return {"sections": sorted(sections, key=lambda x: x.get("order", 0))}
    return {"sections": DEFAULT_TERMS}


@router.put("/admin/terms")
async def update_terms(data: TermsUpdate, user=Depends(get_current_user)):
    """Update terms of service"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sections = [s.model_dump() for s in data.sections]
    
    await db.settings.update_one(
        {"key": "terms_of_service"},
        {"$set": {
            "key": "terms_of_service",
            "value": {
                "sections": sections,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Правила обновлены"}


@router.post("/admin/terms/reset")
async def reset_terms(user=Depends(get_current_user)):
    """Reset terms to default"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "terms_of_service"},
        {"$set": {
            "key": "terms_of_service",
            "value": {
                "sections": DEFAULT_TERMS,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Правила сброшены к значениям по умолчанию"}
