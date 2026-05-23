'use client';

import { AlertTriangle } from 'lucide-react';
import { Dialog } from './dialog';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  loading = false,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="sm">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-full bg-st-danger/10 p-2">
            <AlertTriangle size={16} className="text-st-danger" />
          </span>
          <p className="text-sm text-st-sec font-sans leading-relaxed">{description}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
