'use client';

import * as React from 'react';
import { safeJsonStringify } from '@/lib/format';
import { cn } from '@/lib/cn';

function highlight(value: string, key: string | null): React.ReactNode {
  if (typeof value !== 'string') return value;
  return value;
}

function renderValue(v: unknown, key: string | null = null): React.ReactNode {
  if (v === null) return <span className="null">null</span>;
  if (typeof v === 'string') {
    return <span className="string">&quot;{v}&quot;</span>;
  }
  if (typeof v === 'number') {
    return <span className="number">{v}</span>;
  }
  if (typeof v === 'boolean') {
    return <span className="boolean">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span>[]</span>;
    return (
      <>
        {'['}
        <div className="pl-4 border-l border-border/50 ml-1">
          {v.map((item, i) => (
            <div key={i}>
              <span className="text-muted-foreground mr-2">{i}:</span>
              {renderValue(item)}
              {i < v.length - 1 ? ',' : ''}
            </div>
          ))}
        </div>
        {']'}
      </>
    );
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <>
        {'{'}
        <div className="pl-4 border-l border-border/50 ml-1">
          {entries.map(([k, val], i) => (
            <div key={k}>
              <span className="key">&quot;{k}&quot;</span>
              <span className="text-muted-foreground">: </span>
              {renderValue(val, k)}
              {i < entries.length - 1 ? ',' : ''}
            </div>
          ))}
        </div>
        {'}'}
      </>
    );
  }
  return <span>{String(v)}</span>;
}

export function CodeViewer({
  data,
  className,
  maxHeight = '500px',
  showCopy = true,
}: {
  data: unknown;
  className?: string;
  maxHeight?: string;
  showCopy?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const text = React.useMemo(() => safeJsonStringify(data, 2), [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (typeof data === 'string') {
    return (
      <div className={cn('relative', className)}>
        {showCopy && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
        <pre
          className="json-viewer overflow-auto rounded-md border bg-muted/30 p-3 text-xs"
          style={{ maxHeight }}
        >
          {data}
        </pre>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 z-10 text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
      <pre
        className="json-viewer overflow-auto rounded-md border bg-muted/30 p-3 text-xs"
        style={{ maxHeight }}
      >
        {renderValue(data)}
      </pre>
    </div>
  );
}
