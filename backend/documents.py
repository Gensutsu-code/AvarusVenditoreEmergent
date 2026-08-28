"""Document generation for invoices and receipts"""
import io
from datetime import datetime, timezone
from docx import Document
from docx.shared import Inches, Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
import os

# Register a font that supports Cyrillic
FONT_DIR = os.path.dirname(__file__)

def _format_price(price):
    return f"{price:,.2f}".replace(",", " ").replace(".", ",")

def _status_label(status):
    labels = {
        'retail': 'Розница', 'wholesale': 'Опт', 'partner': 'Партнёр',
        'new': 'Новый', 'processing': 'В обработке', 'shipped': 'Отправлен',
        'delivered': 'Доставлен', 'cancelled': 'Отменён'
    }
    return labels.get(status, status)

# ==================== WORD GENERATION ====================

def generate_invoice_docx(order, user=None):
    """Generate товарная накладная (invoice) as DOCX"""
    doc = Document()
    
    style = doc.styles['Normal']
    style.font.size = Pt(10)
    style.font.name = 'Arial'
    
    # Header
    h = doc.add_heading('ТОВАРНАЯ НАКЛАДНАЯ', level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f'№ {order.get("order_number", order["id"][:8].upper())}').bold = True
    p.add_run(f' от {_parse_date(order.get("created_at", ""))}')
    
    doc.add_paragraph('')
    
    # Seller info
    doc.add_paragraph('Поставщик: AVOPT.STORE')
    
    # Buyer info
    buyer_name = order.get('full_name', user.get('name', '') if user else '')
    buyer_phone = order.get('phone', user.get('phone', '') if user else '')
    buyer_email = user.get('email', '') if user else ''
    
    doc.add_paragraph(f'Покупатель: {buyer_name}')
    if buyer_phone:
        doc.add_paragraph(f'Телефон: {buyer_phone}')
    if buyer_email:
        doc.add_paragraph(f'Email: {buyer_email}')
    if order.get('address'):
        doc.add_paragraph(f'Адрес доставки: {order["address"]}')
    
    doc.add_paragraph('')
    
    # Items table
    items = order.get('items', [])
    table = doc.add_table(rows=1, cols=6)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    headers = ['№', 'Наименование', 'Артикул', 'Кол-во', 'Цена, ₽', 'Сумма, ₽']
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = header
        for paragraph in cell.paragraphs:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(9)
    
    total = 0
    for idx, item in enumerate(items, 1):
        row = table.add_row()
        price = item.get('price', 0)
        qty = item.get('quantity', 1)
        item_total = price * qty
        total += item_total
        
        row.cells[0].text = str(idx)
        row.cells[1].text = item.get('product_name', item.get('name', ''))
        row.cells[2].text = item.get('article', '')
        row.cells[3].text = str(qty)
        row.cells[4].text = _format_price(price)
        row.cells[5].text = _format_price(item_total)
        
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in paragraph.runs:
                    run.font.size = Pt(9)
    
    # Discount info
    discount_percent = order.get('discount_percent', 0)
    order_discount = order.get('order_discount_percent', 0)
    
    doc.add_paragraph('')
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run(f'Сумма без скидки: {_format_price(total)} ₽')
    
    if discount_percent > 0:
        p2 = doc.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p2.add_run(f'Скидка клиента: {discount_percent}%')
    
    if order_discount > 0:
        p3 = doc.add_paragraph()
        p3.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p3.add_run(f'Скидка на заказ: {order_discount}%')
    
    final_total = order.get('total', total)
    p4 = doc.add_paragraph()
    p4.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p4.add_run(f'ИТОГО К ОПЛАТЕ: {_format_price(final_total)} ₽')
    run.bold = True
    run.font.size = Pt(14)
    
    # Status
    doc.add_paragraph('')
    doc.add_paragraph(f'Статус заказа: {_status_label(order.get("status", "new"))}')
    
    # Signatures
    doc.add_paragraph('')
    doc.add_paragraph('')
    table2 = doc.add_table(rows=1, cols=2)
    table2.rows[0].cells[0].text = 'Поставщик: _______________'
    table2.rows[0].cells[1].text = 'Покупатель: _______________'
    
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf

def generate_receipt_docx(order, user=None):
    """Generate чек (receipt) as DOCX"""
    doc = Document()
    
    style = doc.styles['Normal']
    style.font.size = Pt(10)
    
    h = doc.add_heading('ЧЕК', level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f'№ {order.get("order_number", order["id"][:8].upper())}').bold = True
    p.add_run(f' от {_parse_date(order.get("created_at", ""))}')
    
    doc.add_paragraph('AVOPT.STORE — Запчасти для грузовиков')
    doc.add_paragraph('─' * 50)
    
    items = order.get('items', [])
    for item in items:
        price = item.get('price', 0)
        qty = item.get('quantity', 1)
        name = item.get('product_name', item.get('name', ''))
        doc.add_paragraph(f'{name} x{qty} — {_format_price(price * qty)} ₽')
    
    doc.add_paragraph('─' * 50)
    
    final_total = order.get('total', 0)
    discount_percent = order.get('discount_percent', 0)
    
    if discount_percent > 0:
        doc.add_paragraph(f'Скидка: {discount_percent}%')
    
    p = doc.add_paragraph()
    run = p.add_run(f'ИТОГО: {_format_price(final_total)} ₽')
    run.bold = True
    run.font.size = Pt(14)
    
    payment_method = order.get('payment_method', '')
    if payment_method:
        labels = {'card': 'Картой', 'crypto': 'Криптовалюта', 'cash': 'Наличные'}
        doc.add_paragraph(f'Способ оплаты: {labels.get(payment_method, payment_method)}')
    
    doc.add_paragraph('')
    doc.add_paragraph('Спасибо за покупку!')
    
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf

# ==================== PDF GENERATION ====================

def _draw_text(c, x, y, text, size=10, bold=False):
    """Helper to draw text on PDF canvas"""
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size)
    c.drawString(x, y, text)
    return y

def _draw_right_text(c, x, y, text, size=10, bold=False):
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size)
    c.drawRightString(x, y, text)
    return y

def generate_invoice_pdf(order, user=None):
    """Generate товарная накладная as PDF"""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    
    y = height - 40*mm
    
    # Header
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(width/2, y, 'TOVARNAYA NAKLADNAYA')
    y -= 8*mm
    
    order_num = order.get('order_number', order['id'][:8].upper())
    date_str = _parse_date(order.get('created_at', ''))
    c.setFont('Helvetica', 11)
    c.drawCentredString(width/2, y, f'No {order_num} ot {date_str}')
    y -= 12*mm
    
    # Seller
    _draw_text(c, 20*mm, y, f'Postavshchik: AVOPT.STORE', 10)
    y -= 6*mm
    
    # Buyer
    buyer_name = order.get('full_name', user.get('name', '') if user else '')
    _draw_text(c, 20*mm, y, f'Pokupatel: {buyer_name}', 10)
    y -= 6*mm
    
    phone = order.get('phone', user.get('phone', '') if user else '')
    if phone:
        _draw_text(c, 20*mm, y, f'Telefon: {phone}', 10)
        y -= 6*mm
    
    address = order.get('address', '')
    if address:
        _draw_text(c, 20*mm, y, f'Adres: {address}', 10)
        y -= 6*mm
    
    y -= 5*mm
    
    # Table header
    col_x = [20*mm, 30*mm, 110*mm, 135*mm, 155*mm, 178*mm]
    headers = ['#', 'Nazvanie', 'Artikul', 'Kol-vo', 'Tsena', 'Summa']
    
    c.setFont('Helvetica-Bold', 9)
    c.line(18*mm, y+3*mm, 195*mm, y+3*mm)
    for i, header in enumerate(headers):
        c.drawString(col_x[i], y, header)
    y -= 2*mm
    c.line(18*mm, y, 195*mm, y)
    y -= 5*mm
    
    # Items
    total = 0
    c.setFont('Helvetica', 9)
    for idx, item in enumerate(order.get('items', []), 1):
        price = item.get('price', 0)
        qty = item.get('quantity', 1)
        item_total = price * qty
        total += item_total
        
        name = item.get('product_name', item.get('name', ''))
        if len(name) > 40:
            name = name[:37] + '...'
        
        c.drawString(col_x[0], y, str(idx))
        c.drawString(col_x[1], y, name)
        c.drawString(col_x[2], y, item.get('article', ''))
        c.drawString(col_x[3], y, str(qty))
        c.drawRightString(col_x[4]+15*mm, y, _format_price(price))
        c.drawRightString(col_x[5]+15*mm, y, _format_price(item_total))
        y -= 5*mm
    
    c.line(18*mm, y+2*mm, 195*mm, y+2*mm)
    y -= 8*mm
    
    # Totals
    _draw_right_text(c, 193*mm, y, f'Summa: {_format_price(total)} RUB', 10)
    y -= 6*mm
    
    discount = order.get('discount_percent', 0)
    if discount > 0:
        _draw_right_text(c, 193*mm, y, f'Skidka: {discount}%', 10)
        y -= 6*mm
    
    final_total = order.get('total', total)
    _draw_right_text(c, 193*mm, y, f'ITOGO: {_format_price(final_total)} RUB', 14, bold=True)
    
    c.save()
    buf.seek(0)
    return buf

def generate_receipt_pdf(order, user=None):
    """Generate chek (receipt) as PDF"""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(80*mm, 200*mm))
    width = 80*mm
    
    y = 190*mm
    
    c.setFont('Helvetica-Bold', 12)
    c.drawCentredString(width/2, y, 'CHEK')
    y -= 5*mm
    
    c.setFont('Helvetica', 8)
    c.drawCentredString(width/2, y, 'AVOPT.STORE')
    y -= 4*mm
    
    order_num = order.get('order_number', order['id'][:8].upper())
    c.drawCentredString(width/2, y, f'No {order_num}')
    y -= 4*mm
    c.drawCentredString(width/2, y, _parse_date(order.get('created_at', '')))
    y -= 5*mm
    
    c.line(5*mm, y, 75*mm, y)
    y -= 5*mm
    
    for item in order.get('items', []):
        price = item.get('price', 0)
        qty = item.get('quantity', 1)
        name = item.get('product_name', item.get('name', ''))
        if len(name) > 25:
            name = name[:22] + '...'
        
        c.setFont('Helvetica', 7)
        c.drawString(5*mm, y, f'{name}')
        y -= 3.5*mm
        c.drawString(5*mm, y, f'  x{qty}')
        c.drawRightString(75*mm, y, f'{_format_price(price * qty)} RUB')
        y -= 5*mm
    
    c.line(5*mm, y, 75*mm, y)
    y -= 5*mm
    
    final_total = order.get('total', 0)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(5*mm, y, 'ITOGO:')
    c.drawRightString(75*mm, y, f'{_format_price(final_total)} RUB')
    
    c.save()
    buf.seek(0)
    return buf

def _parse_date(date_str):
    """Parse ISO date string to Russian formatted date"""
    try:
        if isinstance(date_str, str) and date_str:
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.strftime('%d.%m.%Y %H:%M')
    except Exception:
        pass
    return datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')
