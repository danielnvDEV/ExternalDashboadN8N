'use client';

import * as React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { Capability } from '@/lib/capability';

interface CapabilityGateProps {
  capability: Capability | null;
  /** Resource name from /discover (e.g. "workflow", "user", "dataTable"). */
  resource?: string;
  /** Required scope (e.g. "workflow:list"). */
  scope?: string;
  /** Method+path combination to check (e.g. { method: "POST", path: "/audit" }). */
  endpoint?: { method: string; path: string };
  /** Children to render when the capability is available. */
  children: React.ReactNode;
  /** Optional custom fallback. If not provided, shows a generic "not available" message. */
  fallback?: React.ReactNode;
  /** When false, capability check is skipped (e.g. for ssr bootstrap). */
  enabled?: boolean;
}

export function CapabilityGate({
  capability,
  resource,
  scope,
  endpoint,
  children,
  fallback,
  enabled = true,
}: CapabilityGateProps) {
  if (!enabled) return <>{children}</>;
  // If capability wasn't fetched yet (loading or error), render optimistically.
  if (!capability) return <>{children}</>;

  const passes =
    (!resource || capability.resources.has(resource)) &&
    (!scope || capability.scopes.has(scope)) &&
    (!endpoint || capability.endpoints.has(`${endpoint.method.toUpperCase()} ${endpoint.path}`));

  if (passes) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Not available</CardTitle>
        </div>
        <CardDescription>
          {resource && (
            <>This section requires the <code className="font-mono text-xs">{resource}</code> resource</>
          )}
          {scope && (
            <>This action requires the <code className="font-mono text-xs">{scope}</code> scope</>
          )}
          {' '}which is not available with the current API key. This typically means your n8n edition does not include this feature (e.g. Enterprise-only).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function CapabilityBanner({ capability }: { capability: Capability | null }) {
  if (!capability) return null;
  if (capability.resources.size === 0 && capability.scopes.size === 0) return null;
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      <AlertCircle className="h-3 w-3" />
      {capability.scopes.size > 0
        ? `API key has ${capability.scopes.size} scope${capability.scopes.size === 1 ? '' : 's'}`
        : 'Unrestricted access (non-Enterprise key)'}
    </div>
  );
}

export function NotAvailable({ feature }: { feature: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{feature} not available</CardTitle>
        </div>
        <CardDescription>
          This feature is not exposed by the connected n8n instance. It may require an Enterprise license, a specific plan, or the n8n Packages beta flag.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function PageError({ error }: { error: unknown }) {
  const message = (error as { message?: string })?.message ?? String(error);
  const status = (error as { status?: number })?.status;
  const hint = (error as { hint?: string })?.hint;
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <CardTitle className="text-base">Request failed{status ? ` (${status})` : ''}</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs whitespace-pre-wrap break-words">
          {message}
        </CardDescription>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <strong>Hint:</strong> {hint}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href="/settings">Open settings</a>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
