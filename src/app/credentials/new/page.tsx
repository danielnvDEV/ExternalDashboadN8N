'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Loader2, Save, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageError } from '@/components/capability-gate';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';
import type { CredentialSchema } from '@/lib/types';

export default function NewCredentialPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = React.useState('');
  const [name, setName] = React.useState('');
  const [data, setData] = React.useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // Discover available credential types via a probe (use a known type; actual list isn't exposed in API).
  // Workaround: ask the user to type the type name. We can offer common ones as suggestions.
  const COMMON_TYPES = [
    'notionApi', 'slackApi', 'githubApi', 'googleSheetsOAuth2Api', 'googleCalendarOAuth2Api',
    'openAiApi', 'anthropicApi', 'postgres', 'mysql', 'mongoDb', 'redis', 'smtp',
    'telegramApi', 'discordWebhookApi', 'airtableTokenApi', 'hubspotApi', 'salesforceOAuth2Api',
    'microsoftOutlookOAuth2Api', 'aws', 'gmailOAuth2', 'gitlabApi', 'jiraSoftwareCloudApi',
    'linearApi', 'trelloApi', 'asanaApi', 'dropboxApi', 'ftp', 'sshPassword', 'sshPrivateKey',
  ];

  const schemaQ = useQuery<CredentialSchema>({
    queryKey: ['n8n-credential-schema', type],
    queryFn: () => apiFetch(`credentials/schema/${encodeURIComponent(type)}`),
    enabled: !!type,
    retry: false,
  });

  React.useEffect(() => {
    setData({});
  }, [type]);

  const onSubmit = async () => {
    if (!type || !name) return;
    try {
      setSubmitting(true);
      const created = await apiFetch<{ id: string; name: string }>('credentials', {
        method: 'POST',
        body: { name, type, data },
      });
      toast({ title: 'Created', description: created.name, variant: 'success' });
      router.push(`/credentials/${created.id}`);
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => router.push('/credentials')} className="mb-2">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Button>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <KeyRound className="h-7 w-7" /> New credential
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose a credential type. The form is built from the JSON schema returned by{' '}
          <code className="text-xs">/credentials/schema/&#123;type&#125;</code>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cred-name">Name</Label>
              <Input
                id="cred-name"
                placeholder="My Notion API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cred-type">Type</Label>
              <Input
                id="cred-type"
                list="cred-type-list"
                placeholder="notionApi"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 font-mono"
              />
              <datalist id="cred-type-list">
                {COMMON_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
        </CardContent>
      </Card>

      {type && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Data
            </CardTitle>
            <CardDescription>
              {schemaQ.isLoading
                ? 'Loading schema…'
                : schemaQ.isError
                  ? `Could not load schema for "${type}". You can paste data as JSON below.`
                  : 'Fill the required fields below.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schemaQ.isLoading ? (
              <Skeleton className="h-32" />
            ) : schemaQ.data ? (
              <SchemaForm schema={schemaQ.data} value={data} onChange={setData} />
            ) : (
              <Textarea
                placeholder='{"apiKey": "..."}'
                value={JSON.stringify(data, null, 2)}
                onChange={(e) => {
                  try {
                    setData(JSON.parse(e.target.value));
                  } catch {
                    /* keep invalid state */
                  }
                }}
                className="font-mono text-xs h-48"
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={onSubmit} disabled={!name || !type || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Create
        </Button>
        <Button variant="outline" onClick={() => router.push('/credentials')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: CredentialSchema;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      {Object.entries(props).map(([key, propRaw]) => {
        const prop = propRaw as {
          type?: string;
          title?: string;
          description?: string;
          default?: unknown;
          enum?: unknown[];
          format?: string;
          typeOptions?: { password?: boolean; rows?: number };
        };
        const label = prop.title ?? key;
        const isPassword = prop.typeOptions?.password || prop.format === 'password' || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password') || key.toLowerCase().includes('token');
        const isLong = prop.type === 'string' && (prop.typeOptions?.rows ?? 0) > 1;

        return (
          <div key={key}>
            <Label htmlFor={`f-${key}`}>
              {label} {required.has(key) && <span className="text-destructive">*</span>}
            </Label>
            {prop.description && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{prop.description}</p>
            )}
            {prop.enum ? (
              <Select
                value={(value[key] as string) ?? ''}
                onValueChange={(v) => set(key, v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(prop.enum as string[]).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : isLong ? (
              <Textarea
                id={`f-${key}`}
                value={(value[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            ) : (
              <Input
                id={`f-${key}`}
                type={isPassword ? 'password' : 'text'}
                value={(value[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={prop.default !== undefined ? String(prop.default) : undefined}
                className="mt-1"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
