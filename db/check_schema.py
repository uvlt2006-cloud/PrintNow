"""Проверка schema.sql на тестовых данных: корректные записи проходят, ошибочные отклоняются.

Запуск: python3 check_schema.py
PostgreSQL здесь не нужен: типы приводятся к диалекту встроенного SQLite, проверки и индексы те же.
"""
import pathlib
import re
import sqlite3

sql = (pathlib.Path(__file__).parent / "schema.sql").read_text(encoding="utf8")
sql = re.sub(r"BIGSERIAL PRIMARY KEY", "INTEGER PRIMARY KEY", sql)
# Запрет пересечения периодов подписки есть только в PostgreSQL, поэтому здесь не проверяется.
sql = re.sub(r"CREATE EXTENSION[^;]*;", "", sql)
sql = re.sub(r"ALTER TABLE subscription[^;]*;", "", sql)
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
db.executescript(sql)

db.executescript("""
INSERT INTO point (name, address) VALUES ('Точка у университета', 'Ташкент');
INSERT INTO app_user (phone, password_hash, role) VALUES ('+998900000001', 'hash', 'client');
INSERT INTO app_user (phone, password_hash, role, point_id) VALUES ('+998900000002', 'hash', 'operator', 1);
INSERT INTO app_user (phone, password_hash, role, point_id) VALUES ('+998900000003', 'hash', 'admin', 1);
INSERT INTO subscription (point_id, period_start, period_end, amount, status) VALUES (1, '2026-11-01', '2026-12-01', 0, 'trial');
INSERT INTO price_item (point_id, service_code, price, changed_by) VALUES (1, 'A4_BW', 500, 3);
INSERT INTO print_order (client_id, point_id, status, print_amount, service_fee, total_amount, pickup_code)
  VALUES (1, 1, 'accepted', 20000, 1000, 21000, '4417');
INSERT INTO order_item (order_id, page_count, paper_format, color_mode, copies, binding, unit_price, binding_price, line_total)
  VALUES (1, 24, 'A4', 'bw', 1, 'spring', 500, 8000, 20000);
INSERT INTO order_file (order_item_id, file_name, file_type, size_bytes) VALUES (1, 'Курсовая.pdf', 'pdf', 2400000);
INSERT INTO payment (order_id, provider, provider_txn, amount, status) VALUES (1, 'payme', 'T1', 21000, 'succeeded');
INSERT INTO notification (order_id, channel) VALUES (1, 'telegram');
""")

# Цена заказа не меняется после смены прайса: это и есть причина хранить её в позиции.
db.execute("UPDATE price_item SET valid_to = '2030-01-01' WHERE price_item_id = 1")
db.execute("INSERT INTO price_item (point_id, service_code, price, changed_by) VALUES (1, 'A4_BW', 700, 3)")
assert db.execute("SELECT unit_price FROM order_item WHERE order_item_id = 1").fetchone()[0] == 500
assert db.execute("SELECT total_amount FROM print_order WHERE order_id = 1").fetchone()[0] == 21000

# Переплёт считается на каждую копию: (500 × 2 + 8000) × 3 = 27000.
db.execute("INSERT INTO order_item (order_id, page_count, paper_format, color_mode, copies, binding, unit_price, binding_price, line_total) VALUES (1, 2, 'A4', 'bw', 3, 'spring', 500, 8000, 27000)")

MUST_FAIL = {
    "две действующие цены на одну услугу":
        "INSERT INTO price_item (point_id, service_code, price, changed_by) VALUES (1, 'A4_BW', 900, 3)",
    "принятый заказ без кода получения":
        "INSERT INTO print_order (client_id, point_id, status, print_amount, service_fee, total_amount) VALUES (1, 1, 'accepted', 0, 0, 0)",
    "подписка 0 сум не в бесплатном месяце":
        "INSERT INTO subscription (point_id, period_start, period_end, amount, status) VALUES (1, '2027-01-01', '2027-02-01', 0, 'paid')",
    "платная сумма у бесплатного месяца":
        "INSERT INTO subscription (point_id, period_start, period_end, amount, status) VALUES (1, '2027-02-01', '2027-03-01', 400000, 'trial')",
    "итог заказа не равен расчёту":
        "INSERT INTO print_order (client_id, point_id, print_amount, service_fee, total_amount) VALUES (1, 1, 100, 10, 999)",
    "неизвестный статус заказа":
        "INSERT INTO print_order (client_id, point_id, status, print_amount, service_fee, total_amount) VALUES (1, 1, 'в пути', 0, 0, 0)",
    "итог позиции не равен расчёту":
        "INSERT INTO order_item (order_id, page_count, paper_format, color_mode, copies, binding, unit_price, line_total) VALUES (1, 2, 'A4', 'bw', 1, 'none', 500, 1)",
    "файл больше 20 МБ (FR-01)":
        "INSERT INTO order_file (order_item_id, file_name, file_type, size_bytes) VALUES (1, 'x.pdf', 'pdf', 20971521)",
    "формат файла вне FR-01":
        "INSERT INTO order_file (order_item_id, file_name, file_type, size_bytes) VALUES (1, 'x.exe', 'exe', 10)",
    "второй успешный платёж за заказ":
        "INSERT INTO payment (order_id, provider, provider_txn, amount, status) VALUES (1, 'click', 'T2', 21000, 'succeeded')",
    "повтор активного кода на той же точке":
        "INSERT INTO print_order (client_id, point_id, status, print_amount, service_fee, total_amount, pickup_code) VALUES (1, 1, 'ready', 0, 0, 0, '4417')",
    "оценка до выдачи заказа":
        "UPDATE print_order SET rating = 5 WHERE order_id = 1",
    "оператор без точки":
        "INSERT INTO app_user (phone, password_hash, role) VALUES ('+998900000004', 'hash', 'operator')",
    "заказ несуществующего клиента":
        "INSERT INTO print_order (client_id, point_id, print_amount, service_fee, total_amount) VALUES (99, 1, 0, 0, 0)",
}
failed = 0
for name, stmt in MUST_FAIL.items():
    try:
        db.execute(stmt)
    except sqlite3.IntegrityError:
        print(f"ok    отклонено: {name}")
    else:
        failed += 1
        print(f"ОШИБКА пропущено: {name}")

tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
print(f"таблиц: {len(tables)}; проверок отклонения: {len(MUST_FAIL)}; провалов: {failed}")
raise SystemExit(1 if failed else 0)
