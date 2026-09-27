import type { ChangeOperation, ChangeProposal } from '@trestle/shared';
import { Check, Link2, MinusCircle, PencilLine, PlusCircle, Unlink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChangeReviewBarProps {
  proposal: ChangeProposal;
  selectedIds: string[];
  onToggle: (operationId: string) => void;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
  error?: string | null;
}

/** One line per proposed operation, each with its own tick box. */
function describeOperation(operation: ChangeOperation) {
  switch (operation.type) {
    case 'add_component':
      return {
        icon: PlusCircle,
        title: `Add ${operation.component.label}`,
        detail: operation.component.technology,
      };
    case 'modify_component':
      return { icon: PencilLine, title: `Change ${operation.componentId}`, detail: undefined };
    case 'remove_component':
      return { icon: MinusCircle, title: `Remove ${operation.componentId}`, detail: undefined };
    case 'add_connection':
      return {
        icon: Link2,
        title: `Connect ${operation.connection.from} → ${operation.connection.to}`,
        detail: operation.connection.label,
      };
    case 'remove_connection':
      return { icon: Unlink, title: `Disconnect ${operation.connectionId}`, detail: undefined };
  }
}

/**
 * The suggest-first review bar: nothing in the proposal is applied until the
 * user accepts it here, and they can accept some changes and reject others.
 */
export function ChangeReviewBar({
  proposal,
  selectedIds,
  onToggle,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
  error,
}: ChangeReviewBarProps) {
  const busy = isAccepting || isRejecting;

  return (
    <section
      aria-label="Proposed changes"
      className="max-h-72 shrink-0 overflow-y-auto border-t border-warning/30 bg-warning/6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-warning">Proposed: “{proposal.prompt}”</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{proposal.summary}</p>
          <p className="mt-1 text-[11px] text-tertiary">
            Nothing is saved until you accept. Tick the changes you want.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReject} disabled={busy}>
            <X data-icon="inline-start" />
            {isRejecting ? 'Discarding…' : 'Reject all'}
          </Button>
          <Button
            size="sm"
            className="font-semibold"
            onClick={onAccept}
            disabled={busy || selectedIds.length === 0}
          >
            <Check data-icon="inline-start" />
            {isAccepting
              ? 'Saving…'
              : `Accept ${String(selectedIds.length)} of ${String(proposal.operations.length)}`}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-danger sm:px-6">
          {error}
        </p>
      )}

      <ul className="border-t border-warning/20">
        {proposal.operations.map((operation) => {
          const { icon: Icon, title, detail } = describeOperation(operation);
          const checked = selectedIds.includes(operation.id);
          return (
            <li key={operation.id} className="border-b border-warning/10 last:border-b-0">
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-warning/5 sm:px-6">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onToggle(operation.id);
                  }}
                  disabled={busy}
                  className="mt-0.5 size-4 shrink-0 accent-[#6c5ce7]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Icon className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
                    {title}
                    {detail && (
                      <span className="font-mono text-[10px] text-tertiary">{detail}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {operation.explanation}
                  </span>
                  {operation.sources.length === 0 && (
                    <span className="mt-0.5 block text-[10px] text-warning/80">
                      Ungrounded: not traced to a source in the reference library.
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
