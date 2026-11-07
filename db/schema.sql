-- PrintNow, схема базы данных версии 1.0 (PostgreSQL).
-- Суммы хранятся в сумах целым числом (BIGINT), потому что US-03 требует цену целым числом.

CREATE TABLE point (
    point_id     BIGSERIAL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    address      VARCHAR(255) NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE app_user (
    user_id       BIGSERIAL PRIMARY KEY,
    phone         VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('client', 'operator', 'admin')),
    point_id      BIGINT REFERENCES point (point_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- клиент не привязан к точке, оператор и администратор привязаны
    CHECK ((role = 'client' AND point_id IS NULL) OR (role <> 'client' AND point_id IS NOT NULL))
);

-- Подписка точки: основной постоянный доход сервиса (раздел 1.3).
CREATE TABLE subscription (
    subscription_id BIGSERIAL PRIMARY KEY,
    point_id        BIGINT NOT NULL REFERENCES point (point_id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    amount          BIGINT NOT NULL CHECK (amount >= 0),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('trial', 'paid', 'overdue')),
    CHECK (period_end > period_start),
    CHECK ((status = 'trial') = (amount = 0)), -- 0 сум только в бесплатный первый месяц
    UNIQUE (point_id, period_start)
);
-- Периоды подписки одной точки не пересекаются (только PostgreSQL).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE subscription ADD CONSTRAINT no_subscription_overlap
    EXCLUDE USING gist (point_id WITH =, daterange(period_start, period_end) WITH &&);

-- Прайс точки. Старая цена не меняется, а закрывается датой valid_to.
CREATE TABLE price_item (
    price_item_id BIGSERIAL PRIMARY KEY,
    point_id      BIGINT NOT NULL REFERENCES point (point_id),
    service_code  VARCHAR(30) NOT NULL, -- например, A4_BW, A4_COLOR, BIND_SPRING
    price         BIGINT NOT NULL CHECK (price > 0),
    valid_from    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to      TIMESTAMPTZ,
    changed_by    BIGINT NOT NULL REFERENCES app_user (user_id),
    CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX idx_price_item_lookup ON price_item (point_id, service_code, valid_to);
-- У услуги точки только одна действующая цена.
CREATE UNIQUE INDEX uq_price_current ON price_item (point_id, service_code) WHERE valid_to IS NULL;

CREATE TABLE promo_code (
    promo_code_id BIGSERIAL PRIMARY KEY,
    code          VARCHAR(30) NOT NULL UNIQUE,
    discount_pct  SMALLINT NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
    valid_to      TIMESTAMPTZ
);

CREATE TABLE print_order (
    order_id       BIGSERIAL PRIMARY KEY,
    client_id      BIGINT NOT NULL REFERENCES app_user (user_id),
    point_id       BIGINT NOT NULL REFERENCES point (point_id),
    promo_code_id  BIGINT REFERENCES promo_code (promo_code_id),
    status         VARCHAR(20) NOT NULL DEFAULT 'created'
                   CHECK (status IN ('created', 'accepted', 'printing', 'ready', 'issued', 'cancelled')),
    print_amount   BIGINT NOT NULL CHECK (print_amount >= 0), -- сумма позиций
    discount       BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
    service_fee    BIGINT NOT NULL CHECK (service_fee >= 0),  -- сбор на момент заказа
    total_amount   BIGINT NOT NULL CHECK (total_amount >= 0), -- намеренно дублирует расчёт
    pickup_code    CHAR(4),
    ready_eta      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ready_at       TIMESTAMPTZ,
    issued_at      TIMESTAMPTZ,
    rating         SMALLINT CHECK (rating BETWEEN 1 AND 5),
    CHECK (total_amount = print_amount - discount + service_fee),
    CHECK (status IN ('created', 'cancelled') OR pickup_code IS NOT NULL), -- после оплаты код обязателен
    CHECK (rating IS NULL OR status = 'issued')
);
-- Код получения уникален среди заказов точки, которые ещё не выданы.
CREATE UNIQUE INDEX uq_active_pickup_code ON print_order (point_id, pickup_code)
    WHERE status IN ('accepted', 'printing', 'ready');
CREATE INDEX idx_order_queue ON print_order (point_id, status, created_at);
CREATE INDEX idx_order_client ON print_order (client_id, created_at);

-- Позиция заказа: цена и параметры копируются на момент заказа.
CREATE TABLE order_item (
    order_item_id  BIGSERIAL PRIMARY KEY,
    order_id       BIGINT NOT NULL REFERENCES print_order (order_id) ON DELETE CASCADE,
    page_count     INTEGER NOT NULL CHECK (page_count > 0),
    paper_format   VARCHAR(5) NOT NULL CHECK (paper_format IN ('A4', 'A3')),
    color_mode     VARCHAR(10) NOT NULL CHECK (color_mode IN ('bw', 'color')),
    copies         INTEGER NOT NULL CHECK (copies BETWEEN 1 AND 99),
    binding        VARCHAR(10) NOT NULL CHECK (binding IN ('none', 'spring', 'hard')),
    unit_price     BIGINT NOT NULL CHECK (unit_price > 0),
    binding_price  BIGINT NOT NULL DEFAULT 0 CHECK (binding_price >= 0), -- за один переплёт
    line_total     BIGINT NOT NULL CHECK (line_total >= 0),
    CHECK (line_total = (unit_price * page_count + binding_price) * copies)
);

-- Файл удаляется через 7 суток после выдачи (NFR-03), строка остаётся для отчётов.
CREATE TABLE order_file (
    order_file_id  BIGSERIAL PRIMARY KEY,
    order_item_id  BIGINT NOT NULL REFERENCES order_item (order_item_id) ON DELETE CASCADE,
    file_name      VARCHAR(255) NOT NULL,
    file_type      VARCHAR(5) NOT NULL CHECK (file_type IN ('pdf', 'docx', 'jpg')),
    size_bytes     BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520), -- FR-01: до 20 МБ
    storage_key    VARCHAR(255),
    deleted_at     TIMESTAMPTZ
);

-- Платёж. Данные карты здесь не хранятся (NFR-03): только идентификатор операции.
CREATE TABLE payment (
    payment_id     BIGSERIAL PRIMARY KEY,
    order_id       BIGINT NOT NULL REFERENCES print_order (order_id),
    provider       VARCHAR(20) NOT NULL CHECK (provider IN ('payme', 'click')),
    provider_txn   VARCHAR(64) UNIQUE,
    amount         BIGINT NOT NULL CHECK (amount > 0),
    status         VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at        TIMESTAMPTZ
);
-- У заказа может быть только один успешный платёж.
CREATE UNIQUE INDEX uq_payment_success ON payment (order_id) WHERE status = 'succeeded';

CREATE TABLE notification (
    notification_id BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES print_order (order_id),
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('telegram', 'sms')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered       BOOLEAN NOT NULL DEFAULT FALSE
);
