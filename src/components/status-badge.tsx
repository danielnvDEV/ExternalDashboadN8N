import { cn } from '@/lib/cn';
import { Badge } from './ui/badge';
import type { ExecutionStatus } from '@/lib/types';

const VARIANTS: Record<ExecutionStatus, 'success' | 'destructive' | 'warning' | 'info' | 'muted' | 'secondary'> = {
  success: 'success',
  error: 'destructive',
  crashed: 'destructive',
  canceled: 'muted',
  waiting: 'info',
  running: 'info',
  new: 'secondary',
  unknown: 'muted',
};

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus | string }) {
  const variant = (VARIANTS[status as ExecutionStatus] ?? 'muted') as
    | 'success'
    | 'destructive'
    | 'warning'
    | 'info'
    | 'muted'
    | 'secondary';
  return (
    <Badge variant={variant} className={cn('uppercase font-mono text-[10px]')}>
      {status}
    </Badge>
  );
}
