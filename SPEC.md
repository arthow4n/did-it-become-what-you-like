# Application Specification

**Status:** Draft v0.1  
**Last updated:** 2026-08-23

This living document specifies the product before implementation. Material scope or architecture changes should update this document first.

## 1. Product summary

A fast, private, installable expense tracker that works offline and keeps financial data on the user's device by default.

The first release is a single-user, local-first Progressive Web App (PWA). It requires no account, no connection after installation, and no runtime backend.

## 2. Goals

The MVP should let a user:

- record an expense in a few seconds;
- review and correct recorded expenses;
- understand spending by period and category;
- search and filter expense history;
- back up and restore data without an account;
- install and use the app offline.

## 3. MVP non-goals

The first release will not include:

- authentication, user accounts, cloud sync, or collaboration;
- bank/card integrations or automatic transaction ingestion;
- server-side storage or analytics;
- budgets, savings, investments, debt, or net-worth tracking;
- recurring-transaction automation;
- exchange-rate lookup or currency conversion;
- receipt storage or OCR;
- native mobile applications.

These may be considered later, but none should make the MVP require a backend.

## 4. Product principles

1. **Local-first:** The device copy is the primary source of truth.
2. **Offline-first:** Core workflows must not depend on connectivity.
3. **Static-first:** Prefer a fully static application.
4. **Private by default:** Do not transmit financial data or enable telemetry by default.
5. **Portable data:** Users can export and restore their records.
6. **Low-friction entry:** Adding an expense is the primary interaction.
7. **Progressive enhancement:** The browser experience remains usable without PWA installation.
8. **Accessible and responsive:** Core flows work with keyboards, screen readers, touch, and narrow screens.

## 5. Target usage

The MVP targets one person tracking day-to-day expenses in one browser profile or installed PWA. It is primarily phone-oriented, with occasional desktop review/export, frequent short sessions, and possible long periods offline.

The app must explain that browsers or operating systems can clear site data and that exported backups are the durable recovery mechanism.

## 6. Functional requirements

### 6.1 First run

On first launch, the app must:

- work without account creation;
- ask for a base currency, with a locale-aware suggested default;
- explain that records are stored locally;
- provide a short path to adding the first expense.

Changing base currency later changes display defaults only; it does not convert historical amounts.

### 6.2 Add an expense

A user can create an expense with:

- amount (required, positive, non-zero);
- currency (required, defaults to base currency);
- date (required, defaults to the current local date);
- category (required);
- merchant/payee (optional);
- note (optional).

Requirements:

- respect the currency's normal minor-unit precision;
- store amounts as integer minor units, never binary floating point;
- save offline;
- validate before committing and show actionable errors;
- visibly confirm success;
- preserve useful defaults for repeated entry without duplicating an earlier expense.

### 6.3 View, edit, and delete

The user can:

- browse expenses in reverse chronological order;
- see amount, currency, date, and category at a glance;
- open a record to view every field;
- edit every user-entered field;
- cancel an edit without mutating the record;
- delete after confirmation.

Records sharing a date need deterministic secondary ordering. A short-lived deletion undo is preferred, with exact behavior still open.

### 6.4 Categories

The app includes a small starter set and lets users:

- create and rename categories;
- choose an accessible preset color/icon;
- archive a category without invalidating historical expenses.

A referenced category must never be silently deleted or replaced. The starter category list remains an open product decision.

### 6.5 Search and filters

The user can search/filter by:

- merchant/payee or note text;
- category;
- date range;
- amount range.

Active filters must be visible and easy to clear.

### 6.6 Overview

The MVP provides:

- total spending for a selected period;
- spending grouped by category;
- a useful default period such as the current month;
- explicit empty states.

All calculations derive from stored records and use integer-safe arithmetic. If charts are used, the same information must remain available without interpreting a chart.

### 6.7 Backup and restore

The user can:

- export a complete, versioned JSON backup;
- validate and preview an import before mutation;
- choose replace or merge behavior;
- export expense records as CSV.

Import must be atomic: malformed or unsupported input cannot partially change the database. Duplicate behavior must be deterministic and explained. Backups include schema version and export timestamp. Restore requires no server.

### 6.8 Settings

Settings include:

- base currency;
- automatic or explicit display locale;
- system/light/dark theme;
- import and export;
- clear-all-data with strong confirmation;
- storage/privacy explanation;
- app and data-schema versions.

## 7. Information architecture

Four primary destinations:

1. **Overview** — period total and category breakdown.
2. **Expenses** — searchable/filterable history.
3. **Add expense** — optimized entry.
4. **Settings** — preferences, portability, and local-data controls.

Exact navigation remains open. Adding an expense must be reachable in one interaction from every primary destination.

## 8. Data model

Identifiers are generated locally and remain stable across export/import.

### 8.1 Expense

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID/string | Yes | Immutable local ID |
| `amountMinor` | integer | Yes | Positive, in minor currency units |
| `currency` | ISO 4217 code | Yes | No MVP conversion |
| `spentOn` | local date | Yes | `YYYY-MM-DD`, preventing timezone date drift |
| `categoryId` | ID | Yes | May reference an archived category |
| `merchant` | string | No | Trimmed plain text |
| `note` | string | No | Plain text |
| `createdAt` | timestamp | Yes | UTC ISO 8601 |
| `updatedAt` | timestamp | Yes | UTC ISO 8601 |
| `schemaVersion` | integer | Yes | Migration support |

### 8.2 Category

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID/string | Yes | Stable across rename/import |
| `name` | string | Yes | User-visible |
| `color` | preset token | Yes | Accessible in context |
| `icon` | preset token | Yes | Never the sole indicator |
| `archived` | boolean | Yes | Defaults to `false` |
| `createdAt` | timestamp | Yes | UTC ISO 8601 |
| `updatedAt` | timestamp | Yes | UTC ISO 8601 |

### 8.3 Settings

At minimum: base currency, locale preference, theme, onboarding state, and data-schema version.

## 9. Persistence and integrity

- IndexedDB is the primary persistence mechanism unless a documented browser limitation forces a change.
- `localStorage` must not be the primary expense database.
- Schema migrations are explicit, versioned, and tested against supported prior versions.
- Multi-record operations such as import use transactions.
- Unknown optional fields are preserved when safe or reported; they are not silently discarded.
- Failed writes show an error and are never reported as successful.
- The app should surface actionable browser-storage limitations where practical.
- The app remains responsive with at least 10,000 local expense records on a representative modern mobile device.

## 10. PWA and offline requirements

The application must:

- provide a valid manifest, installable icons, and appropriate theme metadata;
- use a service worker for the application shell;
- load its core UI offline after one successful load;
- add, view, edit, delete, summarize, import, and export offline;
- update deliberately so a new worker does not interrupt active entry;
- recover gracefully from an outdated cached shell;
- remain a usable responsive website when not installed.

Offline behavior must be tested, not inferred from a successful build.

## 11. Privacy and security

- No financial record leaves the device in the MVP.
- No third-party analytics, advertising, session replay, remote fonts, or runtime CDN dependencies.
- User text is untrusted and rendered safely.
- Use the most restrictive practical Content Security Policy and static-site controls.
- Exports are sensitive and explicitly described as unencrypted unless encryption is separately specified.
- Do not claim browser storage is an encrypted vault.
- Minimize dependency count and permissions.

Client-side backup encryption is outside MVP and requires a separate recovery and compatibility design.

## 12. Accessibility and localization

Target WCAG 2.2 AA for MVP flows, including:

- complete keyboard operation and visible focus;
- semantic labels and associated errors;
- sufficient contrast and no color-only meaning;
- mobile-appropriate touch targets;
- reduced-motion support;
- non-visual equivalents for summaries/charts;
- locale-aware currency, number, and date display.

## 13. Technical constraints

### 13.1 Deno 2 toolchain

- All project-owned development, formatting, linting, testing, building, and maintenance commands run through **Deno 2**.
- `deno task` is the canonical command interface.
- Development, testing, and deployment must not require Node.js, npm, pnpm, Yarn, or Bun.
- Dependencies/build tooling must be Deno 2 compatible and reproducibly pinned/locked.
- UI framework, build tool, and test libraries remain undecided until the product spec is firmer.

### 13.2 Static-first architecture

The default architecture is entirely browser-side:

```text
Browser/PWA
  ├── UI and application logic
  ├── IndexedDB
  ├── Service worker/cache
  └── Local JSON/CSV import and export
```

The MVP has no runtime backend.

A backend may be introduced only when all are documented and approved:

1. a confirmed requirement cannot be met safely/reliably in a static PWA;
2. the benefit justifies added privacy, security, operational, and cost burden;
3. static and device-local alternatives were evaluated;
4. authentication, data ownership, deletion, backup, and failure modes are specified;
5. this specification is revised first.

Sync, sharing, hosted backup, and integrations trigger this review; they do not automatically justify a backend.

### 13.3 Hosting

Primary hosting is **GitHub Pages**. The production build must:

- be fully static;
- work at the repository Pages base path, not only domain root;
- avoid server-only route handling;
- support direct loads/refreshes with Pages-compatible routing;
- deploy reproducibly with GitHub Actions and Deno 2;
- contain no secrets.

**Deno Deploy** may be added only after an approved backend requirement passes the architecture gate. It must not compensate for static-host configuration issues or be used merely for convenience.

## 14. Quality and verification

Before MVP release:

- unit tests cover amounts, dates, filters, summaries, import validation, duplicates, and migrations;
- integration tests cover IndexedDB and transactional import;
- end-to-end tests cover add/edit/delete, filtering, export/restore, refresh, offline restart, and updates;
- automated accessibility checks are supplemented by keyboard and screen-reader review;
- the real GitHub Pages subpath is tested;
- supported browsers/minimum versions are documented from compatibility testing;
- no known data-loss defects remain.

Initial performance budgets on a representative mid-range phone:

- cached shell interactive within 2 seconds under normal conditions;
- common actions acknowledge input within 100 ms;
- local expense save completes within 500 ms;
- filtering 10,000 records avoids long main-thread stalls.

These budgets may be refined after a UI prototype.

## 15. MVP acceptance criteria

MVP is complete when a user can:

1. open the hosted app and configure base currency;
2. install it where supported;
3. add, view, edit, and delete expenses;
4. close it, go offline, reopen it, and continue those workflows;
5. search/filter records;
6. view accurate period/category totals;
7. export complete JSON and CSV;
8. restore JSON into a clean browser profile without losing required fields;
9. complete core workflows by keyboard and on a narrow viewport;
10. run all documented checks and the production build using Deno 2 only.

## 16. Open decisions

Resolve before implementation:

- product name and visual identity;
- starter categories;
- whether accounts/wallets belong in MVP;
- whether non-base-currency expenses are allowed;
- week start, period presets, and calendar assumptions;
- deletion undo behavior;
- JSON merge and duplicate rules;
- CSV column contract and whether CSV import is supported;
- browser policy, especially iOS/Safari storage behavior;
- framework or no-framework approach;
- Pages-compatible client routing;
- whether charts are needed;
- migration support window;
- whether to include manual backup reminders.

## 17. Candidate post-MVP scope

Subject to separate specification:

- income and transfers;
- accounts/wallets;
- recurring templates;
- budgets and alerts;
- richer reports;
- receipt attachments;
- encrypted backups;
- opt-in device-to-device transfer;
- cloud sync/shared ledgers;
- bank integrations.

Any feature that transmits or centrally stores financial data requires a privacy and threat-model review first.
