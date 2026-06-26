'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = React.useMemo(() => {
    if (pathname === '/') return [];
    return pathname.split('/').filter(Boolean);
  }, [pathname]);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center text-xs text-muted-foreground mb-2" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-foreground flex items-center gap-1">
        <Home className="h-3 w-3" /> Home
      </Link>
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = decodeURIComponent(seg)
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3 w-3 mx-1" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className={cn('text-2xl font-semibold tracking-tight')}>{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
