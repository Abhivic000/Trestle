import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Label + help text + error message around one form control. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help && !error && <p className="text-xs text-tertiary">{help}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A group of radio buttons rendered as selectable cards. */
export function ChoiceGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
              selected
                ? 'border-brand bg-brand-subtle text-foreground'
                : 'bg-elevated text-muted-foreground hover:text-foreground'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => {
                onChange(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

/** Add/remove list of short text entries (used for features). */
export function TagListInput({
  values,
  onChange,
  placeholder,
  inputId,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  inputId: string;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...values, value]);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault(); // don't submit the whole form
              add();
            }
          }}
          className="h-10"
        />
        <Button type="button" variant="outline" size="lg" className="h-10" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li
              key={`${value}-${index.toString()}`}
              className="flex items-center gap-1.5 rounded-md border bg-elevated py-1 pr-1 pl-2.5 text-sm"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => {
                  onChange(values.filter((_, i) => i !== index));
                }}
                className="rounded p-0.5 text-tertiary hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
