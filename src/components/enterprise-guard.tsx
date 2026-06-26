'use client';

import * as React from 'react';
import { isEnterpriseEnabled } from '@/lib/feature-flags';

export function EnterpriseGuard({ children }: { children: React.ReactNode }) {
  if (!isEnterpriseEnabled()) return null;
  return <>{children}</>;
}