import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { cn } from '@/lib/utils';

interface SideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A panel that slides in from the right, built on Radix Dialog so focus,
 * Escape and screen-reader semantics are handled for us.
 */
export function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: SideDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l bg-surface shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-subtle px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded p-1 text-tertiary hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** A small centred dialog, used for "add a component". */
export function Modal({ open, onOpenChange, title, description, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-5">{children}</div>
          <Dialog.Close
            aria-label="Close"
            className="absolute top-4 right-4 rounded p-1 text-tertiary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
