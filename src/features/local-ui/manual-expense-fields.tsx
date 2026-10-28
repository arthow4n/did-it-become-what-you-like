import { useSelector } from "@xstate/react";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import type {
  ManualExpenseDraft,
  ManualExpenseValidationErrors,
} from "../../actors/manual-expense.ts";
import { CurrencyCodeSchema } from "../../domain/index.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import {
  CategoryPicker,
  Checkbox,
  CurrencyPicker,
  MerchantPicker,
  MoneyField,
  NativeDateField,
  NativeTimeField,
  ProjectPicker,
  TextField,
} from "../../design-system/index.ts";
import type { ManualExpenseActor } from "./manual-expense-screen.tsx";
import { CURRENCY_OPTIONS } from "./types.ts";

const CURRENCIES = CURRENCY_OPTIONS.map((code) => ({ id: code, label: code }));

// Each field observes only its own value. Editing one input must not render
// the other inputs, suggestion chips, selectors, or form layout.
export function ExpenseDraftField<K extends keyof ManualExpenseDraft>({
  actor,
  field,
  children,
}: {
  actor: ManualExpenseActor;
  field: K;
  children: (
    value: ManualExpenseDraft[K],
    onChange: (value: ManualExpenseDraft[K]) => void,
  ) => ReactNode;
}) {
  const value = useSelector(
    actor,
    (snapshot) => snapshot.context.draft?.[field],
  );
  const onChange = useCallback((value: ManualExpenseDraft[K]) => {
    const draft = actor.getSnapshot().context.draft;
    if (draft === null || draft[field] === value) return;
    actor.send({ type: "expense.change", draft: { ...draft, [field]: value } });
  }, [actor, field]);
  return actor.getSnapshot().context.draft === null
    ? null
    : children(value as ManualExpenseDraft[K], onChange);
}

export const ManualExpenseFields = memo(function ManualExpenseFields({
  actor,
  state,
  validation,
  isDisabled,
  recentCategoryIds,
  recentMerchants,
}: {
  actor: ManualExpenseActor;
  state: ProjectCategoryState;
  validation: ManualExpenseValidationErrors;
  isDisabled: boolean;
  recentCategoryIds: string[];
  recentMerchants: string[];
}) {
  const categoryId = useSelector(actor, (s) => s.context.draft?.categoryId);
  const projectId = useSelector(actor, (s) => s.context.draft?.projectId);
  const currency = useSelector(actor, (s) => s.context.draft?.currency);
  const categories = useMemo(
    () =>
      state.categories.filter((c) => !c.archived || c.id === categoryId)
        .map((c) => ({ id: c.id, label: c.name })),
    [state.categories, categoryId],
  );
  const projects = useMemo(
    () =>
      state.projects.filter((p) => !p.archived || p.id === projectId)
        .map((p) => ({ id: p.id, label: p.name })),
    [state.projects, projectId],
  );
  return (
    <>
      <div className="local-ui-form-row local-ui-form-row--amount-currency">
        <ExpenseDraftField actor={actor} field="amount">
          {(value, onChange) => (
            <MoneyField
              autoFocus
              label="Amount"
              isRequired
              value={value}
              onChange={onChange}
              currency={currency ?? ""}
              error={validation.amount}
              isDisabled={isDisabled}
            />
          )}
        </ExpenseDraftField>
        <ExpenseDraftField actor={actor} field="currency">
          {(value, onChange) => (
            <CurrencyPicker
              value={value}
              options={CURRENCIES}
              onValueChange={(next) => onChange(CurrencyCodeSchema.parse(next))}
              isDisabled={isDisabled}
            />
          )}
        </ExpenseDraftField>
      </div>
      <ExpenseDraftField actor={actor} field="merchant">
        {(value, onChange) => (
          <MerchantPicker
            value={value ?? ""}
            onValueChange={onChange}
            recentMerchants={recentMerchants}
            isDisabled={isDisabled}
          />
        )}
      </ExpenseDraftField>
      <ExpenseDraftField actor={actor} field="description">
        {(value, onChange) => (
          <TextField
            label="Description (optional)"
            value={value}
            onChange={onChange}
            error={validation.description}
            isDisabled={isDisabled}
          />
        )}
      </ExpenseDraftField>
      <ExpenseDraftField actor={actor} field="categoryId">
        {(value, onChange) => (
          <CategoryPicker
            label=""
            categories={categories}
            value={value}
            onValueChange={onChange}
            recentCategoryIds={recentCategoryIds}
            error={validation.categoryId}
            isDisabled={isDisabled}
          />
        )}
      </ExpenseDraftField>
      <div className="local-ui-form-row local-ui-form-row--date-time">
        <ExpenseDraftField actor={actor} field="date">
          {(value, onChange) => (
            <NativeDateField
              label="Date"
              required
              value={value}
              onChange={(event) => onChange(event.currentTarget.value)}
              error={validation.date}
              disabled={isDisabled}
            />
          )}
        </ExpenseDraftField>
        <ExpenseDraftField actor={actor} field="time">
          {(value, onChange) => (
            <NativeTimeField
              label="Time (optional)"
              value={value ?? ""}
              onChange={(event) =>
                onChange(event.currentTarget.value || undefined)}
              error={validation.time}
              disabled={isDisabled}
            />
          )}
        </ExpenseDraftField>
      </div>
      <ExpenseDraftField actor={actor} field="projectId">
        {(value, onChange) => (
          <ProjectPicker
            options={projects}
            value={value}
            onValueChange={onChange}
            isDisabled={isDisabled}
          />
        )}
      </ExpenseDraftField>
      <ExpenseDraftField actor={actor} field="direction">
        {(value, onChange) => (
          <Checkbox
            isSelected={value === "money-back"}
            onChange={(selected) => onChange(selected ? "money-back" : "spent")}
            isDisabled={isDisabled}
          >
            Money back
          </Checkbox>
        )}
      </ExpenseDraftField>
    </>
  );
});
