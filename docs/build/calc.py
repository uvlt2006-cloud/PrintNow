# Единый расчёт экономики PrintNow. Суммы в сумах. Все тексты и слайды берут числа отсюда.
# Каждая итоговая сумма проверяется: если что-то не сходится, расчёт останавливается.
import json
import math

USD = 11935.37          # курс ЦБ РУз на 05.11.2026
W = 52 / 12             # недель в месяце
ORDERS = round(100 * W) # BG-3: 100 заказов в неделю на зрелой точке
CHECK = 15000           # допущение: средний чек
SUB = 400000            # подписка точки в месяц
FEE = 1000              # сбор с заказа
PROV = 0.02             # комиссия провайдера
SMS = 150               # одно SMS на заказ
TAX = 0.04              # налог с оборота
SOC = 0.12              # социальный налог работодателя
RAMP = (0.4, 0.7, 1.0)  # доля целевого объёма в 1, 2 и с 3-го месяца работы точки (BG-3: цель через 2 месяца)
ACQ = 1000000           # подключение одной точки: визит, обучение, QR-таблички, листовки
HOST, HOST_STEP, STORE, DOMAIN = 300000, 300000, 100000, 10000
MAINT = 2000000         # 0,1 ставки разработчика при 20 млн сум
ACC = 1000000           # бухгалтерия на аутсорсе
SUPPORT_STEP = round(0.25 * 11000000 * (1 + SOC))  # 0,25 ставки при средней зарплате 11 млн и соцналоге 12 %
SUPPORT_POINTS = 15     # одна доля 0,25 ставки (44 часа) на 15 точек, около 3 часов на точку в месяц


def support(n):
    return max(1, math.ceil(n / SUPPORT_POINTS)) * SUPPORT_STEP


def host(n):
    return HOST + (HOST_STEP if n > SUPPORT_POINTS else 0)


def fixed(n):
    return host(n) + STORE + DOMAIN + MAINT + ACC + support(n)


def unit_new(o):
    rev = SUB + o * FEE
    var = o * FEE * PROV + o * SMS
    tax = rev * TAX
    return dict(orders=o, turnover=o * CHECK, rev=rev, sub=SUB, fee=o * FEE, var=var, tax=tax, contrib=rev - var - tax, share=SUB / (o * CHECK) * 100)


def unit_old(o):
    rev = o * CHECK * 0.10
    var = rev * PROV + o * SMS
    tax = rev * TAX
    return dict(orders=o, rev=rev, var=var, tax=tax, contrib=rev - var - tax)


def breakeven(contrib):
    for n in range(1, 500):
        if n * contrib >= fixed(n):
            return n
    return None


def plan(ends):
    a, b, c = ends

    def pts(m):
        if m <= 12:
            return math.ceil(m * a / 12)
        if m <= 24:
            return a + math.ceil((m - 12) * (b - a) / 12)
        if m <= 36:
            return b + math.ceil((m - 24) * (c - b) / 12)
        return c

    return pts


def sim(base, capex, ends=(6, 14, 22), model="new", horizon=120):
    pts = plan(ends)
    ages = []
    cum = -capex
    rows = []
    for m in range(1, horizon + 1):
        n = pts(m)
        new = n - len(ages)
        ages = [a + 1 for a in ages] + [1] * new
        orders = sum(round(base * RAMP[min(a, 3) - 1]) for a in ages)
        if model == "new":
            sub = sum(SUB for a in ages if a > 1)
            fee = orders * FEE
            prov = fee * PROV
        else:
            sub = 0
            fee = orders * CHECK * 0.10
            prov = fee * PROV
        rev = sub + fee
        sms = orders * SMS
        tax = rev * TAX
        fx = fixed(n)
        acq = new * ACQ
        net = rev - prov - sms - tax - fx - acq
        cum += net
        rows.append(dict(m=m, n=n, new=new, orders=orders, sub=sub, fee=fee, rev=rev, prov=prov, sms=sms, tax=tax, fixed=fx, acq=acq, net=net, cum=cum))
    return rows


def summary(rows):
    pay = next((r["m"] for r in rows if r["cum"] >= 0), None)
    first = next((r["m"] for i, r in enumerate(rows) if r["net"] >= 0 and all(x["net"] >= 0 for x in rows[i:i + 6])), None)
    return dict(cum36=rows[35]["cum"], payback=pay, first_profit=first, rev36=sum(r["rev"] for r in rows[:36]), net_m36=rows[35]["net"], points36=rows[35]["n"])


def year(rows, y):
    part = rows[(y - 1) * 12:y * 12]
    out = {k: sum(r[k] for r in part) for k in ("new", "orders", "sub", "fee", "rev", "prov", "sms", "tax", "fixed", "acq", "net")}
    out["points"] = part[-1]["n"]
    out["cost"] = out["prov"] + out["sms"] + out["tax"] + out["fixed"] + out["acq"]
    out["cum"] = part[-1]["cum"]
    return out


# Разработка: спринт длится 2 недели, поэтому месяцев = спринты × 2 ÷ (52 ÷ 12)
SP = 58
spr_a = math.ceil(SP / 16) + 1
spr_b = math.ceil(SP / 12) + 1
mon_a = spr_a * 2 / W
mon_b = spr_b * 2 / W
dev_a = round(mon_a * 2 * 20000000)
dev_b = round(mon_b * 1 * 15000000)
qa_a, qa_b = round(dev_a * 0.1), round(dev_b * 0.1)
capex_a, capex_b = dev_a + qa_a, dev_b + qa_b

r = dict(USD=USD, W=W, orders=ORDERS, check=CHECK, sub=SUB, fee=FEE, spr_a=spr_a, spr_b=spr_b, mon_a=mon_a, mon_b=mon_b,
         dev_a=dev_a, dev_b=dev_b, qa_a=qa_a, qa_b=qa_b, capex_a=capex_a, capex_b=capex_b,
         support_step=SUPPORT_STEP, fixed1=fixed(1), fixed15=fixed(15), fixed22=fixed(22))
low, half = round(ORDERS * 0.7), round(ORDERS * 0.5)
r.update(low=low, half=half)
r["unit"] = {k: unit_new(o) for k, o in (("t", ORDERS), ("l", low), ("h", half))}
r["old"] = {k: unit_old(o) for k, o in (("t", ORDERS), ("l", low), ("h", half))}
r["be"] = {k: breakeven(v["contrib"]) for k, v in r["unit"].items()}
r["be_old"] = {k: breakeven(v["contrib"]) for k, v in r["old"].items()}
r["cross_month"] = SUB / (CHECK * 0.10)
r["cross_week"] = r["cross_month"] / W
# Для точки: сколько минут оператора на заказ должна экономить подписка
MED = 4166000
r["min_val"] = MED / (22 * 8 * 60)
r["wait_val"] = 18.4 * r["min_val"]
r["fee_share_wait"] = FEE / r["wait_val"] * 100
r["point_min_t"] = SUB / (ORDERS * r["min_val"])
r["point_min_l"] = SUB / (low * r["min_val"])
r["check_share"] = {str(c): SUB / (ORDERS * c) * 100 for c in (8000, 15000, 30000)}
r["hours"] = (5 * 10 + 7) * W
r["downtime"] = r["hours"] * 0.01
r["need_clients"] = 100 / 0.45

SCEN = dict(base=(ORDERS, (6, 14, 22)), low=(low, (6, 14, 22)), half=(half, (6, 14, 22)), slow=(ORDERS, (3, 7, 11)), slowlow=(low, (3, 7, 11)))
rows = {k: sim(o, capex_a, e) for k, (o, e) in SCEN.items()}
r["scen"] = {k: summary(v) for k, v in rows.items()}
old_rows = {k: sim(o, capex_a, e, "old") for k, (o, e) in SCEN.items()}
r["scen_old"] = {k: summary(v) for k, v in old_rows.items()}
base = rows["base"]
r["years"] = [year(base, y) for y in (1, 2, 3)]
tot = {k: sum(y[k] for y in r["years"]) for k in ("orders", "sub", "fee", "rev", "prov", "sms", "tax", "fixed", "acq", "cost", "net")}
r["total3"] = tot
assert abs(sum(x["rev"] for x in base[:36]) - tot["rev"]) < 1
assert abs(tot["rev"] - tot["cost"] - capex_a - base[35]["cum"]) < 1  # выручка − расходы − разработка = накопленный итог
assert abs(tot["sub"] + tot["fee"] - tot["rev"]) < 1

# Стоимость владения системой за 36 месяцев: только то, что зависит от выбора платформы
months = base[:36]
host_a = sum(host(x["n"]) for x in months)
store_a = STORE * 36
domain = DOMAIN * 36
maint_a = MAINT * 36
sms = tot["sms"]
tco_a = dict(dev=dev_a, qa=qa_a, host=host_a, store=store_a, domain=domain, maint=maint_a, sms=sms)
bubble_usd = 119 * 36 + 26 * 12 + 89 * 12
tco_b = dict(dev=dev_b, qa=qa_b, host=round(bubble_usd * USD), store=store_a, domain=domain, maint=1500000 * 36, sms=sms)
r["tco_a"], r["tco_b"] = tco_a, tco_b
r["tco_a_sum"], r["tco_b_sum"] = sum(tco_a.values()), sum(tco_b.values())
r["tco_b_exit"] = r["tco_b_sum"] + capex_a
r["tco_a_usd"], r["tco_b_usd"] = round(r["tco_a_sum"] / USD), round(r["tco_b_sum"] / USD)
# Мостик: стоимость владения + прочие расходы = все расходы за 3 года
support_total = sum(support(x["n"]) for x in months)
acc_total = ACC * 36
bridge = dict(tco=r["tco_a_sum"], support=support_total, acc=acc_total, acq=tot["acq"], prov=tot["prov"], tax=tot["tax"])
bridge["all"] = sum(bridge.values())
r["bridge"] = bridge
assert abs(bridge["all"] - (tot["cost"] + capex_a)) < 1, (bridge["all"], tot["cost"] + capex_a)
assert abs(tot["rev"] - bridge["all"] - base[35]["cum"]) < 1
print(json.dumps(r, ensure_ascii=False, indent=1))
