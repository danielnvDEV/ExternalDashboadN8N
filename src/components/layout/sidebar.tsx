'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Archive,
  Boxes,
  Database,
  FileBox,
  Folder,
  FolderCog,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Package,
  Plug,
  Settings,
  Tag,
  Users,
  Variable,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Separator } from '@/components/ui/separator';
import { isEnterpriseEnabled, isInternalApiEnabled } from '@/lib/feature-flags';
import type { Capability } from '@/lib/capability';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  capability?: { resource?: string; scope?: string };
  /** Skip the /discover capability check for this item (used by Folders when
   *  the internal REST API is the source of truth). */
  bypassCapability?: boolean;
  match?: (path: string) => boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNav(cap: Capability | null): NavGroup[] {
  const has = (pred: { resource?: string; scope?: string }) => {
    if (!cap) return true;
    if (pred.resource && !cap.resources.has(pred.resource)) return false;
    if (pred.scope && !cap.scopes.has(pred.scope)) return false;
    return true;
  };
  const foldersAvailable = isEnterpriseEnabled() || isInternalApiEnabled();
  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'Insights', href: '/enterprise/insights', icon: Gauge, capability: { resource: 'insights' } },
        { label: 'Audit', href: '/enterprise/audit', icon: AlertTriangle, capability: { resource: 'securityAudit' } },
      ],
    },
    {
      label: 'Workflows',
      items: [
        { label: 'Workflows', href: '/workflows', icon: Workflow, capability: { resource: 'workflow' } },
        { label: 'Executions', href: '/executions', icon: Activity, capability: { resource: 'execution' } },
        { label: 'Tags', href: '/tags', icon: Tag, capability: { resource: 'tag' } },
      ],
    },
    {
      label: 'Data',
      items: [
        { label: 'Credentials', href: '/credentials', icon: KeyRound, capability: { resource: 'credential' } },
        { label: 'Data Tables', href: '/data-tables', icon: Database, capability: { resource: 'dataTable' } },
        { label: 'Variables', href: '/enterprise/variables', icon: Variable, capability: { resource: 'variable' } },
      ],
    },
    {
      label: 'Organization',
      items: [
        { label: 'Projects', href: '/enterprise/projects', icon: FolderCog, capability: { resource: 'project' } },
        {
          label: 'Folders',
          href: '/enterprise/folders',
          icon: Folder,
          capability: { resource: 'folder' },
          // When the internal REST API is enabled we surface folder data even
          // for non-Enterprise keys, where the public /discover omits the
          // folder resource.
          bypassCapability: isInternalApiEnabled() && !isEnterpriseEnabled(),
        },
        { label: 'Users', href: '/enterprise/users', icon: Users, capability: { resource: 'user' } },
      ],
    },
    {
      label: 'Packages',
      items: [
        { label: 'Community', href: '/community-packages', icon: Plug, capability: { resource: 'communityPackage' } },
        { label: 'n8n Packages', href: '/packages', icon: Package, badge: 'Beta' },
        { label: 'Source Control', href: '/enterprise/source-control', icon: Boxes, capability: { resource: 'sourceControl' } },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Settings', href: '/settings', icon: Settings },
        { label: 'Backup', href: '/backup', icon: Archive },
      ],
    },
  ];
  return groups.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => foldersAvailable || !i.href.endsWith('/folders'))
      .filter((i) => i.bypassCapability || has(i.capability ?? {}))
      .filter((i) => isEnterpriseEnabled() || !i.href.startsWith('/enterprise')),
  }));
}

export function Sidebar({ capability }: { capability: Capability | null }) {
  const pathname = usePathname();
  const groups = React.useMemo(() => buildNav(capability), [capability]);

  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-card/50">
      <div className="flex h-16 items-center gap-2 px-4 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          n8
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">n8n Dashboard</span>
          <span className="text-[10px] text-muted-foreground">REST API v1.1.1</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((group, idx) => (
          <div key={group.label} className={cn('px-3', idx > 0 && 'mt-4')}>
            <h3 className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.match
                  ? item.match(pathname)
                  : pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            {idx < groups.length - 1 && <Separator className="my-3" />}
          </div>
        ))}
      </nav>
      <div className="border-t p-3 text-[10px] text-muted-foreground">
        <ListChecks className="inline h-3 w-3 mr-1" /> Single-tenant mode
      </div>
    </aside>
  );
}
