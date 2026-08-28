"""Backend regression tests for bonus prize system:
- out_of_stock prize blocks redemption
- options validation + options_cost deduction
- bulk index-prices (all + per program)
- reject with reason=out_of_stock returns points, marks OOS, notifies client
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
CLIENT = {"email": "user@demo.com", "password": "demo123"}
PROGRAM_ID = "cd173bac-1752-405a-b0fd-d2c75a529af6"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def client_headers():
    return {"Authorization": f"Bearer {_login(CLIENT)}"}


@pytest.fixture(scope="module")
def program(admin_headers):
    r = requests.get(f"{API}/admin/bonus/programs", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    programs = data.get("programs") if isinstance(data, dict) else data
    p = next((x for x in programs if x.get("id") == PROGRAM_ID), None)
    assert p, "target program not found"
    return p


def test_program_has_prizes_and_options(program):
    prizes = program.get("prizes") or []
    assert len(prizes) >= 2
    assert any((p.get("options") or []) for p in prizes), "expected a prize with options"


def test_client_bonus_page_data(client_headers):
    r = requests.get(f"{API}/bonus/programs", headers=client_headers, timeout=15)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/bonus/my-points", headers=client_headers, timeout=15)
    assert r2.status_code == 200


def _get_program_via_admin(admin_headers):
    r = requests.get(f"{API}/admin/bonus/programs", headers=admin_headers, timeout=15)
    data = r.json()
    programs = data.get("programs") if isinstance(data, dict) else data
    return next(x for x in programs if x.get("id") == PROGRAM_ID)


def _redeem(client_headers, prize_id, body=None):
    payload = {"program_id": PROGRAM_ID, "prize_id": prize_id, **(body or {})}
    return requests.post(f"{API}/bonus/redeem-prize", json=payload, headers=client_headers, timeout=15)


def _current_points(client_headers):
    r = requests.get(f"{API}/bonus/programs", headers=client_headers, timeout=15).json()
    programs = r if isinstance(r, list) else r.get("programs", [])
    for p in programs:
        if p.get("id") == PROGRAM_ID:
            prog = p.get("progress") or {}
            return prog.get("current_amount", 0) or 0
    return 0


def test_redeem_out_of_stock_blocked(client_headers, admin_headers):
    p = _get_program_via_admin(admin_headers)
    oos_prize = next((x for x in p["prizes"] if x.get("out_of_stock")), None)
    assert oos_prize, "no out_of_stock prize in seed"
    r = _redeem(client_headers, oos_prize["id"])
    assert r.status_code == 400, r.text
    assert "закончился" in r.text.lower()


def test_redeem_missing_option_validation(client_headers, admin_headers):
    p = _get_program_via_admin(admin_headers)
    opt_prize = next((x for x in p["prizes"] if (x.get("options") or []) and not x.get("out_of_stock")), None)
    assert opt_prize
    r = _redeem(client_headers, opt_prize["id"], {"selected_options": []})
    assert r.status_code == 400, r.text
    assert "выберите" in r.text.lower() or "параметр" in r.text.lower()


def test_redeem_with_options_deducts_correct_points(client_headers, admin_headers):
    p = _get_program_via_admin(admin_headers)
    opt_prize = next((x for x in p["prizes"] if (x.get("options") or []) and not x.get("out_of_stock")), None)
    assert opt_prize
    # Pick first choice per group
    selected = []
    expected_extra = 0
    for grp in opt_prize["options"]:
        # pick highest-points choice to make deduction verifiable
        ch = max(grp["choices"], key=lambda c: int(c.get("points", 0) or 0))
        selected.append({"group_id": grp["id"], "choice_id": ch["id"]})
        expected_extra += int(ch.get("points", 0) or 0)
    base_cost = int(opt_prize.get("points_cost", 0) or 0)
    expected_cost = base_cost + expected_extra

    prog0_pts = _current_points(client_headers)
    if prog0_pts < expected_cost:
        pytest.skip(f"insufficient points {prog0_pts} < {expected_cost}")

    r = _redeem(client_headers, opt_prize["id"], {"selected_options": selected})
    assert r.status_code == 200, r.text

    prog1_pts = _current_points(client_headers)
    assert prog0_pts - prog1_pts == expected_cost, f"expected deduction {expected_cost}, got {prog0_pts - prog1_pts}"


def test_index_prices_all_programs(admin_headers):
    p_before = _get_program_via_admin(admin_headers)
    prizes_before = {pr["id"]: pr.get("points_cost", 0) for pr in p_before["prizes"]}

    # +10%
    r = requests.post(
        f"{API}/admin/bonus/index-prices",
        json={"percent": 10},
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text

    p_after = _get_program_via_admin(admin_headers)
    for pr in p_after["prizes"]:
        exp = round(prizes_before[pr["id"]] * 1.1)
        assert pr["points_cost"] == exp, f"prize {pr['id']} expected {exp}, got {pr['points_cost']}"

    # revert with -1/1.1 -> approximately, use factor 1/1.1 via percent (1/1.1 -1)*100
    revert_pct = (1 / 1.1 - 1) * 100  # ~ -9.0909
    r2 = requests.post(
        f"{API}/admin/bonus/index-prices",
        json={"percent": revert_pct, "program_id": PROGRAM_ID},
        headers=admin_headers,
        timeout=15,
    )
    assert r2.status_code == 200


def test_index_prices_single_program(admin_headers):
    p_before = _get_program_via_admin(admin_headers)
    before = {pr["id"]: pr.get("points_cost", 0) for pr in p_before["prizes"]}

    r = requests.post(
        f"{API}/admin/bonus/index-prices",
        json={"percent": 20, "program_id": PROGRAM_ID},
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    p_after = _get_program_via_admin(admin_headers)
    for pr in p_after["prizes"]:
        exp = round(before[pr["id"]] * 1.2)
        assert pr["points_cost"] == exp

    # revert
    revert_pct = (1 / 1.2 - 1) * 100
    requests.post(
        f"{API}/admin/bonus/index-prices",
        json={"percent": revert_pct, "program_id": PROGRAM_ID},
        headers=admin_headers,
        timeout=15,
    )


def test_reject_out_of_stock_flow(admin_headers, client_headers):
    # Ensure we have a fresh prize with plenty of points; use prize with options set to zero, or just first non-oos prize
    p = _get_program_via_admin(admin_headers)
    # pick a non-oos prize without options for simplicity; if none, use options prize
    target = next((x for x in p["prizes"] if not x.get("out_of_stock") and not (x.get("options") or [])), None)
    if not target:
        target = next((x for x in p["prizes"] if not x.get("out_of_stock")), None)
    assert target, "no available prize"

    # If target has options, need to select
    body = {}
    if target.get("options"):
        sel = []
        for g in target["options"]:
            ch = min(g["choices"], key=lambda c: int(c.get("points", 0) or 0))
            sel.append({"group_id": g["id"], "choice_id": ch["id"]})
        body = {"selected_options": sel}

    before_pts = _current_points(client_headers)

    r = _redeem(client_headers, target["id"], body)
    if r.status_code != 200:
        pytest.skip(f"cannot redeem to create pending: {r.status_code} {r.text}")

    # find pending redemption
    lst = requests.get(f"{API}/admin/bonus/prize-redemptions", headers=admin_headers, timeout=15).json()
    redemptions = lst.get("redemptions", []) if isinstance(lst, dict) else lst
    pending = next((x for x in redemptions if x.get("status") == "pending" and x.get("prize_id") == target["id"]), None)
    assert pending, "pending redemption not found"

    # Reject with out_of_stock
    r2 = requests.put(
        f"{API}/admin/bonus/prize-redemptions/{pending['id']}/status",
        params={"status": "rejected", "reason": "out_of_stock"},
        headers=admin_headers,
        timeout=15,
    )
    assert r2.status_code == 200, r2.text

    # Verify prize now OOS
    p_after = _get_program_via_admin(admin_headers)
    updated = next(x for x in p_after["prizes"] if x["id"] == target["id"])
    assert updated.get("out_of_stock") is True

    # Verify points returned
    after_pts = _current_points(client_headers)
    assert after_pts == before_pts, f"points not restored: {before_pts} -> {after_pts}"

    # Verify notification created
    notif = requests.get(f"{API}/my-notifications", headers=client_headers, timeout=15).json()
    notifs = notif.get("notifications", []) if isinstance(notif, dict) else notif
    assert any(n.get("title") == "Приз закончился" for n in notifs), f"notification 'Приз закончился' missing; got titles={[n.get('title') for n in notifs[:10]]}"

    # Restore stock (admin update the program to un-mark oos)
    for pr in p_after["prizes"]:
        if pr["id"] == target["id"]:
            pr["out_of_stock"] = False
    requests.put(
        f"{API}/admin/bonus/programs/{PROGRAM_ID}",
        json={"prizes": p_after["prizes"]},
        headers=admin_headers,
        timeout=15,
    )
