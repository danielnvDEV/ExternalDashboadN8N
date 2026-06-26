import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

const EMPTY_DATA: unknown[] = [];

export function useCursorPagination<T>(
  path: string,
  params: Record<string, unknown> = {},
  options: { enabled?: boolean; queryKey?: unknown[] } = {},
) {
  const [cursorStack, setCursorStack] = React.useState<(string | null)[]>([null]);
  const cursor = cursorStack[cursorStack.length - 1] ?? null;
  const page = cursorStack.length - 1;

  const query = useQuery<PaginatedResponse<T>>({
    queryKey: ['n8n-cursor', path, params, cursor, ...(options.queryKey ?? [])],
    queryFn: async () => {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
      }
      if (cursor) usp.set('cursor', cursor);
      const r = await fetch(`/api/n8n/${path.replace(/^\//, '')}?${usp.toString()}`, {
        cache: 'no-store',
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        const e = new Error(err.message ?? `Request failed: ${r.status}`) as Error & { status: number; hint?: string };
        e.status = r.status;
        e.hint = err.hint;
        throw e;
      }
      return r.json();
    },
    enabled: options.enabled !== false,
  });

  const next = () => {
    if (query.data?.nextCursor) {
      setCursorStack((s) => [...s, query.data!.nextCursor]);
    }
  };
  const prev = () => {
    if (cursorStack.length > 1) {
      setCursorStack((s) => s.slice(0, -1));
    }
  };
  const first = () => setCursorStack([null]);
  const reset = () => setCursorStack([null]);

  const pageData: T[] = (query.data?.data ?? (EMPTY_DATA as T[]));
  return {
    ...query,
    data: pageData,
    nextCursor: query.data?.nextCursor ?? null,
    page,
    next,
    prev,
    first,
    canPrev: cursorStack.length > 1,
    canNext: !!query.data?.nextCursor,
    reset,
  };
}

export function CursorPagination({
  page,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onFirst,
  isLoading,
}: {
  page: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="mr-2">Page {page + 1}</span>
      <Button variant="outline" size="icon" onClick={onFirst} disabled={!canPrev || isLoading} aria-label="First page">
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onPrev} disabled={!canPrev || isLoading} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onNext} disabled={!canNext || isLoading} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={() => {}} disabled aria-label="Last page" className="opacity-50">
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
