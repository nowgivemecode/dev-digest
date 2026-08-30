# Відео-скрипт: ДЗ L06 — Eval Pipeline (~3–5 хв)

## Підготовка ДО запису (не показувати на камеру)

1. `./scripts/dev.sh` — запустити весь стек
2. Відкрити DevDigest у браузері → переконатись що є хоча б 1 агент
3. Відкрити будь-який PR у якому вже є знайдення (findings) з accept/dismiss — якщо немає, спочатку запустити review і зробити accept/dismiss для 2–3 findings

---

## ЧАСТИНА 1 — "Turn into eval case" кнопка (1 хв)

**Де:** будь-який PR → вкладка Findings

1. Відкрити PR з вже запущеним review
2. Знайти finding з вердиктом **accepted** (зелена позначка) або **dismissed**
3. Показати що у картці є нова кнопка **🧪 Turn into eval case**
4. Натиснути кнопку → з'явиться toast "Eval case created"
5. Зробити те саме ще для 2–3 findings (accepted + dismissed)
   - accepted → тип `must_find`
   - dismissed → тип `must_not_flag`

---

## ЧАСТИНА 2 — AgentEditor → вкладка Evals (1 хв)

**Де:** Agents → твій агент → вкладка **Evals**

1. Відкрити AgentEditor → натиснути вкладку **Evals**
2. Показати секцію **EVAL METRICS** — поки всі нулі або прочерки (ще не запускали)
3. Показати список eval cases (ті що щойно створили)
4. Натиснути **Run all evals** → агент запускає reviewer-core для кожного кейса
5. Почекати завершення → метрики оновляться: **RECALL / PRECISION / CITATION ACCURACY**
6. Натиснути **View full dashboard →** → переходимо до Part 3

---

## ЧАСТИНА 3 — Eval Dashboard (1 хв)

**Де:** sidebar → **Eval Dashboard** (`/evals`)

1. Показати сторінку Eval Dashboard — заголовок, секція **AGENTS**
2. Клікнути на картку агента → переходимо до `/evals/[agentId]`
3. На сторінці агента:
   - Показати метрики з дельтами (RECALL, PRECISION, CITATION ACCURACY)
   - Показати таблицю **RECENT RUNS**

---

## ЧАСТИНА 4 — Зміна системного промпту → два runs → порівняння (1–2 хв)

**Де:** Agents → AgentEditor → вкладка Config

1. Відкрити агента → вкладка **Config**
2. У полі **System prompt** додати рядок в кінець:
   ```
   Flag unused imports as suggestions.
   ```
3. Натиснути **Save agent**
4. Перейти на вкладку **Evals** → **Run all evals** (другий запуск)
5. Після завершення — метрики оновляться (інші від першого запуску)
6. Перейти до Eval Dashboard → клік по агенту → `/evals/[agentId]`
7. У таблиці **RECENT RUNS** відмітити чекбокси двох запусків
8. Натиснути кнопку **Compare** → показати модал з дельтами та diff системного промпту
9. Закрити модал

---

## Порядок: 1 → 2 → 3 → 4. Не поспішай на Part 4 — це головна фіча.

## Що показує що ДЗ виконане

| Критерій | Де видно |
|---|---|
| "Turn into eval case" кнопка | PR → Findings → FindingCard |
| Eval cases зберігаються | AgentEditor → Evals tab → список |
| Run all evals викликає reviewer-core | Evals tab → Run all evals → метрики з'являються |
| Scoring — чистий TypeScript, 0 LLM | (в коді: `scoring.ts` — чисті функції) |
| RECALL / PRECISION / CITATION | Evals tab + `/evals/[agentId]` |
| Два runs → видна різниця | Compare modal |
| Eval Dashboard | sidebar → Eval Dashboard |
