"""Invoice (Счёт) Word export — generated from the user's .docx template (1:1)."""
import io
import copy
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from urllib.parse import quote

from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from pymongo import ReturnDocument

from database import db, get_current_user
from num2words import num2words

router = APIRouter(tags=["invoices"])

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "invoice_template.docx")

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

PM_TYPE_LABEL = {"card": "Оплата картой", "crypto": "Оплата криптовалютой",
                 "cash": "Наличная оплата", "balance": "Оплата с баланса",
                 "mixed": "Смешанная оплата", "deferral": "Оплата в отсрочку"}


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
    """2 decimals, space thousands (totals block) — e.g. 40 050,00."""
    return f"{v:,.2f}".replace(",", "\u00a0").replace(".", ",")


def fmt_int(v):
    """No decimals, space thousands (items table) — e.g. 18 300."""
    return f"{int(round(v)):,}".replace(",", "\u00a0")


def _set_para_text(para, text, bold=None):
    """Replace a paragraph's text while keeping the first run's formatting."""
    runs = para.runs
    if runs:
        runs[0].text = text
        if bold is not None:
            runs[0].bold = bold
        for r in runs[1:]:
            r.text = ""
    else:
        r = para.add_run(text)
        if bold is not None:
            r.bold = bold


def _set_cell_text(cell, text, bold=None, align=None):
    """Replace a table cell's text keeping the first run's font; supports merged cells."""
    para = cell.paragraphs[0]
    if align is not None:
        para.alignment = align
    _set_para_text(para, text, bold=bold)
    for extra in cell.paragraphs[1:]:
        extra._p.getparent().remove(extra._p)


async def _next_invoice_no(order):
    if order.get("invoice_no"):
        return order["invoice_no"]
    doc = await db.counters.find_one_and_update(
        {"_id": "invoice_no"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    no = 1000 + (doc.get("seq", 1) if doc else 1)
    await db.orders.update_one({"id": order["id"]}, {"$set": {"invoice_no": no}})
    return no


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
    pm = order.get("payment_method", "cash")

    # ---- Money model ----
    # Prices are shown already discounted (final charged unit price). No separate
    # discount line — only Итого and the final "Всего к оплате".
    rows = []
    subtotal = 0.0
    for it in items:
        qty = it.get("quantity", 0) or 0
        unit = it.get("price", 0) or 0
        line_sum = unit * qty
        subtotal += line_sum
        rows.append((it.get("article", ""), it.get("name", ""), qty, unit, line_sum))
    subtotal = round(subtotal, 2)
    total = order.get("total", subtotal)

    # Date / number
    created = order.get("created_at", "")
    try:
        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        date_str = f"{dt.day} {RU_MONTHS[dt.month]} {dt.year} г."
    except Exception:
        date_str = ""
    inv_no = await _next_invoice_no(order)

    # ---- Fill the template ----
    doc = Document(TEMPLATE_PATH)

    # Bank details table (table 0)
    bank = doc.tables[0]
    _set_cell_text(bank.cell(0, 0), f"Банк получателя {s['bank_name']}")
    _set_cell_text(bank.cell(0, 3), s["bik"])
    _set_cell_text(bank.cell(1, 3), s["corr_account"])
    _set_cell_text(bank.cell(2, 0), f"ИНН {s['inn']}")
    _set_cell_text(bank.cell(2, 1), f"КПП {s['kpp']}")
    _set_cell_text(bank.cell(2, 2), "Сч. №")  # fix template typo "Ст. №"
    _set_cell_text(bank.cell(2, 3), s["account"])
    _set_cell_text(bank.cell(3, 0), s["seller_name"])
    _set_cell_text(bank.cell(3, 3), s["account"])

    # Payment / buyer table (table 1)
    pay = doc.tables[1]
    _set_cell_text(pay.cell(0, 0), PM_TYPE_LABEL.get(pm, "Оплата"))
    buyer_parts = [order.get("full_name", "") or ""]
    if order.get("address"):
        buyer_parts.append(f"Адрес: {order.get('address')}")
    if order.get("phone"):
        buyer_parts.append(f"Тел.: {order.get('phone')}")
    _set_cell_text(pay.cell(1, 1), "  /  ".join([p for p in buyer_parts if p]))

    # Items table (table 2): keep header, clone its data-row formatting per item
    tbl = doc.tables[2]
    tbl_elem = tbl._tbl
    data_rows = tbl.rows[1:]
    template_tr = copy.deepcopy(data_rows[0]._tr) if data_rows else None
    for r in list(data_rows):
        tbl_elem.remove(r._tr)
    for idx, (article, name, qty, price, line_sum) in enumerate(rows, 1):
        if template_tr is not None:
            new_tr = copy.deepcopy(template_tr)
            tbl_elem.append(new_tr)
        else:
            tbl.add_row()
        cells = tbl.rows[-1].cells
        _set_cell_text(cells[0], str(idx), align=WD_ALIGN_PARAGRAPH.CENTER)
        _set_cell_text(cells[1], str(article), align=WD_ALIGN_PARAGRAPH.CENTER)
        _set_cell_text(cells[2], str(name), align=WD_ALIGN_PARAGRAPH.LEFT)
        _set_cell_text(cells[3], str(qty), align=WD_ALIGN_PARAGRAPH.CENTER)
        _set_cell_text(cells[4], fmt_int(price), align=WD_ALIGN_PARAGRAPH.CENTER)
        _set_cell_text(cells[5], fmt_int(line_sum), align=WD_ALIGN_PARAGRAPH.CENTER)

    # Title + totals (totals rendered as a clean right-aligned borderless table)
    totals_anchor = None
    for p in doc.paragraphs:
        t = p.text.strip()
        if t.startswith("Счет №"):
            _set_para_text(p, f"Счет № {inv_no} от {date_str}", bold=True)
        elif t.startswith("Итого:"):
            totals_anchor = p
            _set_para_text(p, "")
        elif t.startswith("Скидка") or t.startswith("Наценка"):
            _set_para_text(p, "")  # no discount line — prices already discounted
        elif t.startswith("Всего к оплате:"):
            _set_para_text(p, "")
        elif t.startswith("Всего наименований"):
            _set_para_text(p, f"Всего наименований {len(items)}, на сумму {fmt_money(total)} RUB", bold=True)
        elif t.startswith(("Оплата данного", "Внимание")):
            _set_para_text(p, s["footer_note"])

    if totals_anchor is not None:
        tt = doc.add_table(rows=1, cols=2)
        tt.alignment = WD_TABLE_ALIGNMENT.RIGHT
        tt.autofit = False
        tt.columns[0].width = Cm(5.5)
        tt.columns[1].width = Cm(4.0)
        lc, vc = tt.rows[0].cells
        lc.width = Cm(5.5)
        vc.width = Cm(4.0)
        _set_cell_text(lc, "Всего к оплате:", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT)
        _set_cell_text(vc, fmt_money(total), bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT)
        for c in (lc, vc):
            for r in c.paragraphs[0].runs:
                r.font.size = Pt(11)
        # move the table to sit right before the (now empty) "Итого" paragraph
        totals_anchor._p.addprevious(tt._tbl)

    # Amount in words — paragraph immediately after "Всего наименований"
    paras = doc.paragraphs
    for i, p in enumerate(paras):
        if p.text.strip().startswith("Всего наименований"):
            for q in paras[i + 1:]:
                if q.text.strip():
                    _set_para_text(q, rub_in_words(total))
                    break
            break

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
