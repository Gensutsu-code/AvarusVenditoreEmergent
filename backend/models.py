"""Pydantic models for the API"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# ==================== USER MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    address_comment: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: str = "user"
    address: Optional[str] = None
    address_comment: Optional[str] = None
    avatar_url: Optional[str] = None
    customer_status: str = "retail"
    individual_discount: float = 0

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    address_comment: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

# ==================== ADMIN USER MODELS ====================

class AdminUserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    address_comment: Optional[str] = None
    role: str = "user"

class AdminUserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    address_comment: Optional[str] = None
    role: Optional[str] = None
    customer_status: Optional[str] = None
    individual_discount: Optional[float] = None

class AdminUserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: str = "user"
    address: Optional[str] = None
    address_comment: Optional[str] = None
    customer_status: str = "retail"
    individual_discount: float = 0
    password_plain: Optional[str] = None
    created_at: Optional[str] = None
    total_orders: int = 0
    total_spent: float = 0

# ==================== PRODUCT MODELS ====================

class ProductCreate(BaseModel):
    name: str
    article: str
    manufacturer: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    cross_articles: Optional[str] = None
    stock: int = 0
    delivery_days: int = 3
    warehouse: Optional[str] = None
    is_original: Optional[bool] = False
    has_guarantee: Optional[bool] = False
    bonus_eligible: Optional[bool] = True
    purchase_price: Optional[float] = 0
    stock_sync_mode: Optional[str] = "inherit"
    manual_available: Optional[bool] = True
    # Discount/promo fields
    discount_active: Optional[bool] = False
    discount_type: Optional[str] = None  # "percent" | "amount"
    discount_value: Optional[float] = 0
    discount_label: Optional[str] = ""
    discount_description: Optional[str] = ""
    discount_until: Optional[str] = None  # ISO date string
    discount_tiers: Optional[List[Dict[str, Any]]] = None  # [{min_qty, type, value}]
    # "New" badge
    is_new: Optional[bool] = True  # auto-true on creation
    new_until: Optional[str] = None  # ISO date, defaults to created_at + 14d

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    article: Optional[str] = None
    manufacturer: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    cross_articles: Optional[str] = None
    stock: Optional[int] = None
    delivery_days: Optional[int] = None
    warehouse: Optional[str] = None
    is_original: Optional[bool] = None
    has_guarantee: Optional[bool] = None
    bonus_eligible: Optional[bool] = None
    purchase_price: Optional[float] = None
    stock_sync_mode: Optional[str] = None
    manual_available: Optional[bool] = None
    discount_active: Optional[bool] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_label: Optional[str] = None
    discount_description: Optional[str] = None
    discount_until: Optional[str] = None
    discount_tiers: Optional[List[Dict[str, Any]]] = None
    is_new: Optional[bool] = None
    new_until: Optional[str] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    article: str
    manufacturer: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    cross_articles: Optional[str] = None
    stock: int
    delivery_days: int = 3
    warehouse: Optional[str] = None
    is_original: Optional[bool] = False
    has_guarantee: Optional[bool] = False
    bonus_eligible: Optional[bool] = True
    purchase_price: Optional[float] = 0
    stock_sync_mode: Optional[str] = "inherit"
    manual_available: Optional[bool] = True
    in_stock: Optional[bool] = None
    discount_active: Optional[bool] = False
    discount_type: Optional[str] = None
    discount_value: Optional[float] = 0
    discount_label: Optional[str] = ""
    discount_description: Optional[str] = ""
    discount_until: Optional[str] = None
    discount_tiers: Optional[List[Dict[str, Any]]] = None
    is_new: Optional[bool] = False
    new_until: Optional[str] = None
    created_at: Optional[str] = None

# ==================== CATEGORY MODELS ====================

class CategoryCreate(BaseModel):
    name: str
    image_url: Optional[str] = None
    display_order: Optional[int] = 0
    display_size: Optional[str] = "M"  # "S" | "M" | "L"

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    display_size: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    image_url: Optional[str] = None
    display_order: Optional[int] = 0
    display_size: Optional[str] = "M"

class CategoryReorder(BaseModel):
    ordered_ids: List[str]
    columns_count: Optional[int] = None

# ==================== CART MODELS ====================

class CartItem(BaseModel):
    product_id: str
    quantity: int

class CartItemResponse(BaseModel):
    product_id: str
    name: str
    article: str
    manufacturer: Optional[str] = None
    price: float
    quantity: int
    quantity_fulfilled: Optional[int] = 0
    image_url: Optional[str] = None
    warehouse: Optional[str] = None
    delivery_days: Optional[int] = None

# ==================== ORDER MODELS ====================

class OrderCreate(BaseModel):
    full_name: str
    address: str
    phone: str
    comment: Optional[str] = None
    payment_method: Optional[str] = "cash"
    pay_with_balance: Optional[bool] = False

class OrderItemUpdate(BaseModel):
    product_id: str
    name: str
    article: Optional[str] = None
    manufacturer: Optional[str] = None
    price: float
    quantity: int
    image_url: Optional[str] = None

class OrderItemDiscount(BaseModel):
    product_id: str
    discount_percent: float = 0

class OrderUpdateAdmin(BaseModel):
    status: Optional[str] = None
    comment: Optional[str] = None
    created_at: Optional[str] = None
    items: Optional[List[dict]] = None
    order_discount_percent: Optional[float] = None

class AdminOrderUpdate(BaseModel):
    status: Optional[str] = None
    full_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    comment: Optional[str] = None
    created_at: Optional[str] = None
    items: Optional[List[dict]] = None
    order_discount_percent: Optional[float] = None

class OrderResponse(BaseModel):
    id: str
    user_id: str
    items: List[CartItemResponse]
    total: float
    original_total: Optional[float] = None
    order_discount_percent: float = 0
    status: str
    full_name: str
    address: str
    phone: str
    comment: Optional[str] = None
    created_at: str
    # Payment fields
    payment_method: Optional[str] = None
    paid: Optional[bool] = None
    # Change tracking fields
    has_changes: Optional[bool] = None
    awaiting_confirmation: Optional[bool] = None
    change_types: Optional[List[str]] = None
    changes_at: Optional[str] = None
    changes_expire_at: Optional[str] = None
    processing_started_at: Optional[str] = None
    delivery_fee: Optional[float] = None
    # Previous data for comparison
    previous_items: Optional[List[dict]] = None
    previous_total: Optional[float] = None
    # Additional payment tracking
    awaiting_additional_payment: Optional[bool] = None
    additional_payment_amount: Optional[float] = None
    # Deferral (отсрочка) fields
    is_deferral: Optional[bool] = None
    deferral_due_date: Optional[str] = None
    payment_status: Optional[str] = None
    ozon_certificate: Optional[float] = None
    ozon_certificate_issued: Optional[bool] = None

# ==================== FAVORITES ====================

class FavoriteItem(BaseModel):
    product_id: str

# ==================== SETTINGS MODELS ====================

class DiscountSettingsUpdate(BaseModel):
    retail_discount: float = 0
    wholesale_discount: float = 0
    partner_discount: float = 0
    wholesale_threshold: float = 50000
    partner_threshold: float = 200000

class PaymentMethodSettings(BaseModel):
    card_discount: float = 0
    crypto_discount: float = 0
    cash_discount: float = 0
    card_enabled: bool = True
    crypto_enabled: bool = True
    cash_enabled: bool = True

class TelegramSettings(BaseModel):
    enabled: bool = False
    bot_token: str = ""
    chat_id: str = ""

class PromoBannerUpdate(BaseModel):
    enabled: bool
    text: str
    link: Optional[str] = None
    bg_color: Optional[str] = "#f97316"
    height: Optional[int] = 40
    image: Optional[str] = None
    image_position: Optional[str] = "left"

# ==================== NEWS ====================

class NewsArticle(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = None

# ==================== REQUESTS ====================

class StatusUpgradeRequest(BaseModel):
    requested_status: str

class IndividualDiscountRequest(BaseModel):
    requested_discount: float
    reason: str

# ==================== CHAT MODELS ====================

class ChatMessage(BaseModel):
    text: str
    sender_type: str = "user"

class ChatMessageResponse(BaseModel):
    id: str
    chat_id: str
    user_id: str
    user_name: str
    text: str
    sender_type: str
    created_at: str
    read: bool = False

# ==================== PARTNER BRANDS ====================

class PartnerBrand(BaseModel):
    name: str
    description: str = ""
    image_url: str = ""
    link: str = ""
    order: int = 0

# ==================== PAYMENT MODELS ====================

class YuKassaPaymentCreate(BaseModel):
    order_id: str
    amount: float
    return_url: str

class CryptoPaymentCreate(BaseModel):
    order_id: str
    chain: str
    tx_hash: str
