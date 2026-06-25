"""Invoice (Счёт) Word export"""
import io
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from urllib.parse import quote

from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

from database import db, get_current_user
from num2words import num2words

router = APIRouter(tags=["invoices"])

INVOICE_DEFAULTS = {
    "bank_name": "ПАО «Банк Альфа» г. Санкт-Петербург",
    "bik": "044523459",
    "corr_account": "30101345600000000555",
    "inn": "7729666543",
    "kpp": "773086745",
    "account": "40709870100000084071",
    "seller_name": "Общество с ограниченной ответственностью «АВОпт»",
    "footer_note": "Оплата данного счета означает согласие с условиями отгрузки товара.",
}

RU_MONTHS = ["", "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
             "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"]


async def get_invoice_settings():
    s = await db.settings.find_one({"key": "invoice_settings"})
    if s:
        return {**INVOICE_DEFAULTS, **s.get("value", {})}
    return dict(INVOICE_DEFAULTS)


def _plural(n, one, few, many):
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return few
    return many


def rub_in_words(amount):
    rubles = int(amount)
    kopecks = int(round((amount - rubles) * 100))
    if kopecks == 100:
        rubles += 1
        kopecks = 0
    words = num2words(rubles, lang="ru")
    words = words[0].upper() + words[1:]
    r_word = _plural(rubles, "рубль", "рубля", "рублей")
    k_word = _plural(kopecks, "копейка", "копейки", "копеек")
    return f"{words} {r_word} {kopecks:02d} {k_word}"


def fmt_money(v):
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def _set_cell_text(cell, text, bold=False, size=9, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align is not None:
        p.alignment = align
    for i, line in enumerate(str(text).split("\n")):
        if i > 0:
            p = cell.add_paragraph()
            if align is not None:
                p.alignment = align
        run = p.add_run(line)
        run.bold = bold
        run.font.size = Pt(size)


@router.get("/invoice-settings")
async def get_invoice_settings_public(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await get_invoice_settings()


@router.put("/admin/invoice-settings")
async def update_invoice_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    value = {k: str(data.get(k, INVOICE_DEFAULTS[k]))[:512] for k in INVOICE_DEFAULTS}
    await db.settings.update_one(
        {"key": "invoice_settings"},
        {"$set": {"key": "invoice_settings", "value": value}},
        upsert=True,
    )
    return {"success": True, **value}


@router.get("/admin/orders/{order_id}/invoice")
async def export_order_invoice(order_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    s = await get_invoice_settings()
    items = order.get("items", [])

    # Money
    subtotal = sum((it.get("price", 0) or 0) * (it.get("quantity", 0) or 0) for it in items)
    discount_percent = order.get("order_discount_percent", 0) or 0
    total = order.get("total", subtotal)

    # Payment type label
    pm = order.get("payment_method", "cash")
    pm_label = {"card": "Оплата на карту", "crypto": "Оплата криптовалютой",
                "cash": "Наличная оплата", "balance": "Оплата с баланса"}.get(pm, "Оплата")

    # Date
    created = order.get("created_at", "")
    try:
        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        date_str = f"{dt.day} {RU_MONTHS[dt.month]} {dt.year} г."
    except Exception:
        date_str = ""

    inv_no = order_id[:8]

    # ---- Build document ----
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(1.2)
    section.bottom_margin = Cm(1.2)
    section.left_margin = Cm(1.5)
    section.right_margin = Cm(1.5)
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(10)

    # Bank / recipient details table (canonical "Счёт на оплату" header)
    bank = doc.add_table(rows=4, cols=3)
    bank.style = "Table Grid"
    bank.alignment = WD_TABLE_ALIGNMENT.CENTER
    bank.columns[0].width = Cm(10)
    bank.columns[1].width = Cm(2.5)
    bank.columns[2].width = Cm(6)
    # Rows 0-1 left cell merged → bank name
    bank_left = bank.cell(0, 0).merge(bank.cell(1, 0))
    _set_cell_text(bank_left, f"Банк получателя:\n{s['bank_name']}")
    _set_cell_text(bank.cell(0, 1), "БИК")
    _set_cell_text(bank.cell(0, 2), s["bik"])
    _set_cell_text(bank.cell(1, 1), "Сч. №")
    _set_cell_text(bank.cell(1, 2), s["corr_account"])
    _set_cell_text(bank.cell(2, 0), f"ИНН {s['inn']}    КПП {s['kpp']}")
    _set_cell_text(bank.cell(2, 1), "Сч. №")
    _set_cell_text(bank.cell(2, 2), s["account"])
    rcpt = bank.cell(3, 0).merge(bank.cell(3, 1)).merge(bank.cell(3, 2))
    _set_cell_text(rcpt, f"Получатель: {s['seller_name']}", bold=True)

    # Title
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(f"Счет на оплату № {inv_no} от {date_str}")
    r.bold = True
    r.font.size = Pt(14)

    # Supplier
    sp = doc.add_paragraph()
    sr = sp.add_run("Поставщик (Исполнитель): ")
    sr.bold = True
    sp.add_run(s["seller_name"])

    # Buyer
    bp = doc.add_paragraph()
    br = bp.add_run("Покупатель (Заказчик): ")
    br.bold = True
    bp.add_run(order.get("full_name", ""))
    if order.get("address"):
        doc.add_paragraph(f"Адрес: {order.get('address')}")
    if order.get("phone"):
        doc.add_paragraph(f"Номер тел. {order.get('phone')}")

    # Payment type
    pp = doc.add_paragraph()
    pp.paragraph_format.space_before = Pt(4)
    pp.add_run(f"{pm_label} RUB")

    # Items table
    headers = ["№", "Артикул", "Товары (работы, услуги)", "Кол-во", "Цена", "Сумма"]
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.style = "Table Grid"
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    widths = [Cm(1), Cm(2.8), Cm(8.5), Cm(1.8), Cm(2.2), Cm(2.4)]
    for i, w in enumerate(widths):
        tbl.columns[i].width = w
    hdr = tbl.rows[0].cells
    for i, h in enumerate(headers):
        _set_cell_text(hdr[i], h, bold=True, size=9,
                       align=WD_ALIGN_PARAGRAPH.CENTER)

    for idx, it in enumerate(items, 1):
        qty = it.get("quantity", 0) or 0
        price = it.get("price", 0) or 0
        line_sum = price * qty
        cells = tbl.add_row().cells
        _set_cell_text(cells[0], str(idx), align=WD_ALIGN_PARAGRAPH.CENTER)
        _set_cell_text(cells[1], it.get("article", ""))
        _set_cell_text(cells[2], it.get("name", ""))
        _set_cell_text(cells[3], str(qty), align=WD_ALIGN_PARAGRAPH.CENTER)
        _set_cell_text(cells[4], fmt_money(price), align=WD_ALIGN_PARAGRAPH.RIGHT)
        _set_cell_text(cells[5], fmt_money(line_sum), align=WD_ALIGN_PARAGRAPH.RIGHT)

    # Totals
    def total_line(label, value, bold=False):
        pp = doc.add_paragraph()
        pp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        rr = pp.add_run(f"{label} {value}")
        rr.bold = bold

    total_line("Итого:", fmt_money(subtotal))
    if discount_percent:
        disc_label = "Скидка при оплате наличными:" if pm == "cash" else "Скидка:"
        total_line(disc_label, f"{discount_percent}% ({fmt_money(subtotal - total)})")
    total_line("Всего к оплате:", fmt_money(total), bold=True)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.add_run(f"Всего наименований {len(items)}, на сумму {fmt_money(total)} RUB").bold = True
    doc.add_paragraph().add_run(rub_in_words(total)).bold = True

    # Signatures
    doc.add_paragraph()
    sig = doc.add_paragraph()
    sig.add_run("Исполнитель _____________________________        Получатель _____________________________")
    mp = doc.add_paragraph()
    mp.add_run("М.П.").font.size = Pt(9)

    # Footer note
    foot = doc.add_paragraph()
    foot.paragraph_format.space_before = Pt(10)
    fa = foot.add_run("Внимание! ")
    fa.bold = True
    fa.font.size = Pt(9)
    fr = foot.add_run(s["footer_note"])
    fr.italic = True
    fr.font.size = Pt(9)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    filename = f"Счет_{inv_no}.docx"
    headers_resp = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
    }
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers_resp,
    )
