"""Verify the Admin Word invoice .docx matches the owner's 'Счет №24.docx' sample layout."""
import io
import os
import re
import pytest
import requests
from docx import Document

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def first_order_id(auth_headers):
    # Try admin orders listing endpoint
    for path in ["/api/admin/orders", "/api/orders"]:
        r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=30)
        if r.status_code == 200:
            data = r.json()
            orders = data if isinstance(data, list) else data.get("orders", [])
            if orders:
                return orders[0]["id"]
    pytest.skip("No orders available to test invoice export")


@pytest.fixture(scope="module")
def invoice_response(auth_headers, first_order_id):
    r = requests.get(f"{BASE_URL}/api/admin/orders/{first_order_id}/invoice", headers=auth_headers, timeout=60)
    assert r.status_code == 200, f"Invoice endpoint failed: {r.status_code} {r.text[:300]}"
    return r


@pytest.fixture(scope="module")
def docx_doc(invoice_response):
    return Document(io.BytesIO(invoice_response.content))


# --- Tests ---

def test_invoice_http_status_and_content_type(invoice_response):
    assert invoice_response.status_code == 200
    ct = invoice_response.headers.get("Content-Type", "")
    assert "officedocument.wordprocessingml.document" in ct, f"Unexpected Content-Type: {ct}"
    assert len(invoice_response.content) > 1000, "Docx file too small"


def test_invoice_has_exactly_two_tables(docx_doc):
    assert len(docx_doc.tables) == 2, f"Expected 2 tables (bank header + items), got {len(docx_doc.tables)}"


def test_bank_table_first_column_merge(docx_doc):
    """Bank table: row 0 col 0 and row 1 col 0 must be merged (same cell)."""
    bank = docx_doc.tables[0]
    c00 = bank.cell(0, 0)
    c10 = bank.cell(1, 0)
    # python-docx returns the same underlying tc element for merged cells
    assert c00._tc is c10._tc, "Bank table first column rows 0-1 are NOT merged"
    assert "Банк получателя" in c00.text, f"Merged cell missing 'Банк получателя': {c00.text!r}"


def test_bank_table_bik_and_account_rows(docx_doc):
    bank = docx_doc.tables[0]
    assert "БИК" in bank.cell(0, 1).text
    assert "Сч." in bank.cell(1, 1).text
    # Row 2 INN/KPP
    assert "ИНН" in bank.cell(2, 0).text and "КПП" in bank.cell(2, 0).text


def _paragraphs_text(doc):
    return [p.text for p in doc.paragraphs]


def test_title_contains_schet_na_oplatu(docx_doc):
    paras = _paragraphs_text(docx_doc)
    assert any(re.search(r"Счет на оплату\s*№", p) for p in paras), \
        f"Title 'Счет на оплату №' not found. Paragraphs: {paras[:10]}"


def test_supplier_line(docx_doc):
    paras = _paragraphs_text(docx_doc)
    assert any(p.startswith("Поставщик (Исполнитель):") for p in paras), \
        f"'Поставщик (Исполнитель):' line not found"


def test_buyer_line(docx_doc):
    paras = _paragraphs_text(docx_doc)
    assert any(p.startswith("Покупатель (Заказчик):") for p in paras), \
        f"'Покупатель (Заказчик):' line not found"


def test_mp_line_present(docx_doc):
    paras = _paragraphs_text(docx_doc)
    assert any(p.strip() == "М.П." for p in paras), "'М.П.' paragraph not found"


def test_vnimanie_footer_prefix(docx_doc):
    paras = _paragraphs_text(docx_doc)
    joined = "\n".join(paras)
    assert "Внимание!" in joined, "'Внимание!' prefix not found"
    assert "Оплата данного счета означает согласие с условиями отгрузки товара." in joined, \
        "Footer note text not found"
    # Must be on same paragraph (prefix)
    foot_paras = [p for p in paras if "Оплата данного счета" in p]
    assert foot_paras and foot_paras[0].startswith("Внимание!"), \
        f"'Внимание!' must prefix the footer note. Got: {foot_paras}"


def test_items_table_headers(docx_doc):
    items = docx_doc.tables[1]
    headers = [items.cell(0, i).text.strip() for i in range(len(items.columns))]
    expected = ["№", "Артикул", "Товары (работы, услуги)", "Кол-во", "Цена", "Сумма"]
    assert headers == expected, f"Items table headers mismatch: {headers}"


def test_items_table_has_data_rows(docx_doc):
    items = docx_doc.tables[1]
    assert len(items.rows) >= 2, "Items table has no data rows"


def test_amount_in_words_present(docx_doc):
    paras = _paragraphs_text(docx_doc)
    # Russian amount-in-words ends with 'рубль/рубля/рублей' + 'копейка/копейки/копеек'
    pattern = re.compile(r"(рубль|рубля|рублей)\s+\d{2}\s+(копейка|копейки|копеек)")
    assert any(pattern.search(p) for p in paras), \
        f"Amount-in-words line not found. Paragraphs: {paras[-10:]}"
