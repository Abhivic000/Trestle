import { useState, type FormEvent } from 'react';
import { componentKinds, type ComponentKind } from '@trestle/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/side-drawer';
import { componentKindStyles } from '@/canvas/component-kinds';
import type { NewComponentInput } from '@/canvas/design-edits';

interface AddComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (component: NewComponentInput) => void;
}

export function AddComponentDialog({ open, onOpenChange, onAdd }: AddComponentDialogProps) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ComponentKind>('service');
  const [technology, setTechnology] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (label.trim().length < 2) {
      setError('Give the component a name.');
      return;
    }
    onAdd({ label: label.trim(), kind, technology: technology.trim() || undefined });
    setLabel('');
    setTechnology('');
    setKind('service');
    setError(null);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a component"
      description="It will be marked as added by you, with no AI reasoning attached."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="component-label">Name</Label>
          <Input
            id="component-label"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            placeholder="e.g. Recommendation Service"
            className="h-10"
            autoFocus
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Kind</Label>
          <div className="flex flex-wrap gap-1.5">
            {componentKinds.map((option) => {
              const { icon: Icon, label: kindLabel } = componentKindStyles[option];
              const selected = option === kind;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setKind(option);
                  }}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'border-brand bg-brand-subtle text-foreground'
                      : 'bg-elevated text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {kindLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="component-technology">Technology (optional)</Label>
          <Input
            id="component-technology"
            value={technology}
            onChange={(event) => {
              setTechnology(event.target.value);
            }}
            placeholder="e.g. Redis"
            className="h-10"
          />
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" className="font-semibold">
            Add component
          </Button>
        </div>
      </form>
    </Modal>
  );
}
