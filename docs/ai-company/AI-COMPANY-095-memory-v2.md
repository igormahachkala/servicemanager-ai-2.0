# AI-COMPANY-095 — Memory V2 Strategy

**Ticket:** AI-COMPANY-095  
**Роль:** Runtime Memory Engineer  
**Дата:** 2026-07-06  
**Ветка:** `ai-company-flow`  
**Проект:** `apps/ai-company`

---

## Резюме

Memory Evolution (071) уже превращает завершённый Runtime run в записи памяти, Knowledge и Experience.  
**095** фиксирует аудит V1 и план **Memory V2** — настоящая память цифрового сотрудника с явными слоями, provenance и связью с Knowledge **без изменения Runtime в этой фазе**.

| Слой V2 | RU | V1 аналог |
|---------|-----|-----------|
| `short_term` | Краткосрочная | `retention: session` |
| `working` | Рабочая | `retention: short`, active task/run |
| `long_term` | Долгосрочная | `retention: long`, employee identity |
| `corporate` | Корпоративная | `retention: permanent`, company scope |

| Опыт V2 | RU | V1 / Evolution |
|---------|-----|----------------|
| `error` | Ошибки | `LessonCategory.mistake`, risks, warnings |
| `successful_decision` | Успешные решения | `improvement`, `MemoryType.decision` |
| `reusable_knowledge` | Повторно используемые знания | `finding`, `knowledge`, report output |
| `general_experience` | Опыт сотрудника | `MemoryType.experience`, XP events |

---

## 1. Аудит: где создаётся Memory Evolution

### Точка входа (Runtime)

```
runtimeOrchestrator.ts
  run completes + report exists
    → onRuntimeCompletion(run, report)
      → applyMemoryEvolution(run, report)   // memoryEvolutionEngine.ts
```

**Условия:**

- `run.status === 'completed'`
- Idempotency: один `MemoryEvolutionRecord` на `runId`
- Lessons извлекаются **без LLM** — только Report + Runtime warnings + responseText

### Что создаётся за один evolution

| Артефакт | Функция | Storage key |
|----------|---------|-------------|
| Evolution log | `upsertEvolutionRecord` | `ai-company-memory-evolution` |
| Employee Memory | `createMemory()` × N | `ai-company-employee-memory` |
| Knowledge | `createKnowledgeItem()` | `ai-company-knowledge` |
| Experience XP | `addExperienceEvent()` | competency storage |
| Events | `emitEvent(memory.evolved)` | `ai-company-events` |

### Draft-пути (не Runtime write)

- `maxWorkerLoop/maxWorkerLoopDrafts.ts` — draft only, без записи до approval

---

## 2. Где хранится

| Store | Key | Тип |
|-------|-----|-----|
| Employee Memory | `ai-company-employee-memory` | `MemoryEntry[]` |
| Evolution log | `ai-company-memory-evolution` | `MemoryEvolutionRecord[]` |
| Knowledge | `ai-company-knowledge` | items + assignments |
| Competencies | competency storage | XP events |

Evolution record хранит связи: `memoryEntryIds`, `knowledgeItemIds`, `experienceEventId`.

---

## 3. Когда обновляется

| Триггер | Действие |
|---------|----------|
| Runtime completed | `applyMemoryEvolution` — основной real path |
| Пустая память сотрудника | `ensureSeedMemories` — onboarding seed |
| Runtime context | read `getMemoriesByEmployee` (после seed) |
| Retention purge | **не реализовано** (declarative only) |

UI sync: event `ai-company-memory-evolution-sync`.

---

## 4. Кто использует

**Runtime:** `buildRuntimeContext` — memory count + knowledge query; lightweight first run пропускает memory/knowledge.

**UI:** Employee Memory, Runtime Run, Task Result, Workspace summary, Knowledge filter `memory-evolution`, Timeline, Passport count.

**Events:** `memory.evolved`, `knowledge.updated` (origin `memory-evolution`).

---

## 5. Memory ↔ Knowledge

| Lesson | Memory type | Knowledge auto-publish |
|--------|-------------|------------------------|
| finding | report | yes (documentation) |
| mistake | experience | no |
| improvement | decision | no |
| knowledge | knowledge | yes (best_practice) |

**V1 проблема:** дублирование content; Knowledge сразу `published` без Owner gate.

**Принцип:** Memory = employee identity; Knowledge = workspace/company corpus.

---

## 6. Real vs mock

**Real:** evolution после real `run-*`, tags `lessons-learned`, `memory-evolution`.

**Mock/seed:** `memory-seed-*`, `ensureSeedMemories`, onboarding Knowledge — не runtime output.

**Псевдо-real:** эвристики (risks → mistake, длинный responseText → knowledge) без dedup.

---

## 7. План Memory V2

### Фазы

| Фаза | Scope | Runtime |
|------|-------|---------|
| **095** | Audit, types, doc | None |
| **096** | Owner approval для evolution → knowledge | None |
| **097** | Layer-aware MemorySelector для prompt | Opt-in |
| **098** | Dedup / consolidation | Post-run |
| **099** | V2 persistence + migration | Dual-write |

### Context budget (target)

- short_term 25%, working 35%, long_term 30%, corporate 10% — configurable token budget.

### Типы (095)

`apps/ai-company/src/domain/memory/memoryV2Types.ts` — `MemoryLayerV2`, `MemoryExperienceKindV2`, `MemoryEntryV2Draft`, mappers V1→V2. **Не импортируется orchestrator.**

---

## 8. Инварианты

- Memory принадлежит Employee, не LLM provider
- Multi-tenant через companyId (corporate layer)
- `onRuntimeCompletion` — единственный auto-write после run
- Runtime V1 не меняется в 095

---

## 9. Следующий шаг

**AI-COMPANY-096 — Memory Evolution Approval Gate:** Knowledge из evolution как draft; Owner approve перед publish.

---

## Связанные файлы

- `domain/memoryEvolution/memoryEvolutionEngine.ts`
- `domain/memory/memory.ts`
- `domain/memory/memoryV2Types.ts`
- `domain/runtime/runtimeOrchestrator.ts`
- `docs/ux/memory-evolution.md`
