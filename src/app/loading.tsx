import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  );
}
