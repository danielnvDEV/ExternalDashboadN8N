/**
 * TypeScript types for the n8n public REST API v1.1.1.
 * Source: https://github.com/n8n-io/n8n/blob/master/packages/cli/src/public-api/v1/openapi.yml
 *
 * These mirror the public API shape exactly. All fields marked `?` are
 * server-assigned or optional in the spec.
 */

export type ExecutionStatus =
  | 'canceled'
  | 'crashed'
  | 'error'
  | 'new'
  | 'running'
  | 'success'
  | 'unknown'
  | 'waiting';

export type ExecutionQueueStatus = 'queued' | 'running' | 'waiting';

export type DataTableColumnType = 'string' | 'number' | 'date' | 'boolean';

export type DataTableReturnType = 'count' | 'id' | 'all';

export interface ApiError {
  code?: number;
  message?: string;
  description?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export interface FoldersResponse<T> {
  count: number;
  data: T[];
}

/* ─── Workflows ──────────────────────────────────────────────────────────── */

export interface WorkflowSettings {
  executionOrder?: 'v0' | 'v1';
  callerPolicy?: 'workflowsFromSameOwner' | 'workflowsFromAList' | 'any';
  callerIds?: string;
  timezone?: string;
  executionTimeout?: number;
  saveExecutionProgress?: boolean;
  saveManualExecutions?: boolean;
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
  saveWorkflowExecutionData?: boolean;
  executionHistory?: boolean;
  redactionPolicy?: 'none' | 'all' | 'all-but-targets';
  availableInMCP?: boolean;
  errorWorkflow?: string;
  timeSavedPerExecution?: number;
  customTelemetryTags?: Array<{ key: string; value: string }>;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: [number, number];
  parameters?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  webhookId?: string;
  disabled?: boolean;
  notesInFlow?: boolean;
  notes?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
  [k: string]: unknown;
}

export interface WorkflowConnections {
  [sourceNode: string]: {
    [outputName: string]: Array<
      Array<{ node: string; type: string; index: number } | null>
    >;
  };
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  settings?: WorkflowSettings;
  staticData?: Record<string, unknown> | null;
  tags?: Array<{ id: string; name: string }>;
  triggerCount?: number;
  versionId?: string;
  activeVersion?: { id: string; name?: string; createdAt?: string } | null;
  description?: string | null;
  pinData?: Record<string, unknown>;
  meta?: Record<string, unknown> | null;
  /**
   * The public n8n REST API v1 does NOT include project membership on the
   * Workflow response (only inside `shared[].projectId`). Always undefined
   * from API responses. Use `/api/v1/projects/{id}/folders` for folder data.
   * @deprecated Will always be undefined when populated from the public API.
   */
  projectId?: string;
  /**
   * The public n8n REST API v1 does NOT expose the workflow's parent folder.
   * Folders are returned by `/api/v1/projects/{projectId}/folders` but those
   * endpoints do not list their contained workflows.
   * @deprecated Will always be undefined when populated from the public API.
   */
  parentFolderId?: string | null;
}

/**
 * Fields that the INTERNAL REST API (`/rest/workflows`, `/rest/folders/.../workflows`)
 * returns in addition to the public ones. Populated server-side via the
 * `internal-client.ts` proxy, never from the public proxy.
 *
 * NOTE on `parentFolder` vs `parentFolderId`: in n8n 1.x and 2.x the internal
 * `/rest/workflows` endpoint serializes the parent folder as a relation object
 * (`parentFolder: { id, name, parentFolderId }`). Older or stripped responses
 * may surface only the raw `parentFolderId` string. Use `resolveWorkflowFolderId`
 * to handle both shapes.
 */
export interface WorkflowInternalExtras {
  /** Raw column value. Missing/null on newer n8n responses — prefer `parentFolder`. */
  parentFolderId?: string | null;
  /** Newer n8n versions nest the parent folder here. */
  parentFolder?: { id: string; name?: string; parentFolderId?: string | null } | null;
  homeProject: { id: string; name: string; type?: string } | null;
  shared?: Array<{ projectId: string; projectName?: string; role?: string }>;
}

/** Normalize the workflow→folder link regardless of which field n8n exposed. */
export function resolveWorkflowFolderId(
  wf: Pick<WorkflowInternalExtras, 'parentFolderId' | 'parentFolder'> & { id: string },
): string | null {
  return wf.parentFolder?.id ?? wf.parentFolderId ?? null;
}

export type WorkflowInternal = Workflow & Partial<WorkflowInternalExtras>;

export interface WorkflowCreatePayload {
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  settings?: WorkflowSettings;
  projectId?: string;
  description?: string;
}

export interface WorkflowUpdatePayload {
  name?: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnections;
  settings?: WorkflowSettings;
  description?: string;
  versionId?: string;
}

export interface WorkflowTransferPayload {
  destinationProjectId: string;
}

export interface WorkflowActivatePayload {
  versionId?: string;
  name?: string;
  description?: string;
}

/* ─── Executions ─────────────────────────────────────────────────────────── */

export interface Execution {
  id: string;
  data?: unknown;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'internal' | 'evaluation' | 'cli';
  retryOf?: string | null;
  retrySuccessId?: string | null;
  status: ExecutionStatus;
  startedAt: string;
  stoppedAt?: string | null;
  workflowId: string;
  workflowName?: string;
  waitTill?: string | null;
  customData?: Record<string, unknown>;
}

export interface ExecutionListFilter {
  limit?: number;
  cursor?: string;
  includeData?: boolean;
  redactExecutionData?: boolean;
  status?: ExecutionStatus;
  workflowId?: string;
  projectId?: string;
}

export interface BulkStopPayload {
  status: ExecutionQueueStatus[];
  workflowId?: string;
  startedAfter?: string;
  startedBefore?: string;
}

export interface BulkStopResult {
  stopped: number;
}

/* ─── Credentials ────────────────────────────────────────────────────────── */

export interface Credential {
  id: string;
  name: string;
  type: string;
  isResolvable?: boolean;
  isGlobal?: boolean;
  sharedWithProjects?: Array<{ id: string; name: string }>;
  homeProject?: { id: string; name: string };
  scopes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CredentialCreatePayload {
  name: string;
  type: string;
  data: Record<string, unknown>;
  projectId?: string;
}

export interface CredentialUpdatePayload {
  name?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface CredentialTransferPayload {
  destinationProjectId: string;
}

export interface CredentialSchema {
  additionalProperties?: boolean | { type: string };
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
}

/* ─── Tags ───────────────────────────────────────────────────────────────── */

export interface Tag {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagCreatePayload {
  name: string;
}

export interface TagUpdatePayload {
  name: string;
}

export type TagAssignment = Array<{ id: string }>;

/* ─── Users (Enterprise) ─────────────────────────────────────────────────── */

export type UserRole =
  | 'global:owner'
  | 'global:admin'
  | 'global:member'
  | 'project:editor'
  | 'project:viewer';

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isPending?: boolean;
  role?: UserRole;
}

export interface UserCreatePayload {
  email: string;
  role: UserRole;
}

export interface UserInviteResult {
  user: {
    id: string;
    email: string;
    inviteAcceptUrl: string;
    emailSent: boolean;
  };
  error?: string;
}

export interface UserChangeRolePayload {
  newRoleName: Exclude<UserRole, 'project:editor' | 'project:viewer'>;
}

/* ─── Variables (Enterprise) ─────────────────────────────────────────────── */

export type VariableState = 'empty';

export interface Variable {
  id: string;
  key: string;
  value: string;
  type?: string;
  projectId?: string;
  state?: VariableState;
}

export interface VariablePayload {
  key: string;
  value: string;
  projectId?: string;
}

/* ─── Projects (Enterprise) ──────────────────────────────────────────────── */

export interface Project {
  id: string;
  name: string;
  type?: 'personal' | 'team';
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectCreatePayload {
  name: string;
}

export interface ProjectMember {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
}

export interface ProjectMemberAddPayload {
  relations: Array<{ userId: string; role: Extract<UserRole, `project:${string}`> }>;
}

export interface ProjectMemberUpdatePayload {
  role: Extract<UserRole, `project:${string}`>;
}

/* ─── Folders (Enterprise) ───────────────────────────────────────────────── */

export interface Folder {
  id: string;
  name: string;
  parentFolderId?: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  workflowCount?: number;
  subFolderCount?: number;
  totalWorkflows?: number;
  totalSubFolders?: number;
  tags?: Array<{ id: string; name: string }>;
}

export interface FolderCreatePayload {
  name: string;
  parentFolderId?: string;
}

export interface FolderFilter {
  parentFolderId?: string;
  name?: string;
  tags?: string[];
  excludeFolderIdAndDescendants?: string;
}

/* ─── Data Tables ────────────────────────────────────────────────────────── */

export interface DataTable {
  id: string;
  name: string;
  columns: DataTableColumn[];
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  projectName?: string;
}

export interface DataTableColumn {
  id?: string;
  name: string;
  type: DataTableColumnType;
  index?: number;
}

export interface DataTableCreatePayload {
  name: string;
  columns: Array<{ name: string; type: DataTableColumnType }>;
  projectId?: string;
}

export interface DataTableRowFilterCondition {
  columnName: string;
  condition: string;
  value: unknown;
}

export interface DataTableRowFilter {
  type: 'and' | 'or';
  filters: DataTableRowFilterCondition[];
}

export interface DataTableRowUpdatePayload {
  filter: DataTableRowFilter;
  data: Record<string, unknown>;
  returnData?: boolean;
  dryRun?: boolean;
}

export interface DataTableRowUpsertPayload {
  filter: DataTableRowFilter;
  data: Record<string, unknown>;
  returnData?: boolean;
  dryRun?: boolean;
}

export interface DataTableSort {
  field: string;
  direction: 'asc' | 'desc';
}

/* ─── Community Packages ─────────────────────────────────────────────────── */

export interface CommunityPackage {
  packageName: string;
  installedVersion: string;
  installed?: boolean;
  failedLoading?: boolean;
  updateAvailable?: string;
  packageVersion?: {
    versionName: string;
    createdAt: string;
    numberOfDownloads: number;
    totalDownloads: number;
  };
}

export interface CommunityPackageInstallPayload {
  name: string;
  version?: string;
  verify?: boolean;
}

export interface CommunityPackageUpdatePayload {
  version?: string;
  verify?: boolean;
}

/* ─── n8n Packages (Beta) ────────────────────────────────────────────────── */

export type WorkflowConflictPolicy = 'new-version' | 'fail' | 'skip';
export type CredentialMatchingMode = 'id-only';
export type CredentialMissingMode = 'must-preexist' | 'create-stub';
export type WorkflowIdPolicy = 'new' | 'source';
export type WorkflowPublishingPolicy =
  | 'preserve-published-state'
  | 'match-source'
  | 'publish-all'
  | 'unpublish-all';

export interface N8nPackageImportResult {
  workflows?: Array<{
    id?: string;
    name?: string;
    status: 'created' | 'updated' | 'skipped' | 'failed';
    reason?: string;
  }>;
  credentials?: Array<{
    id?: string;
    name?: string;
    type?: string;
    status: 'matched' | 'stub' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

/* ─── Source Control (Enterprise) ────────────────────────────────────────── */

export type SourceControlAutoPublish = 'none' | 'all' | 'published';

export interface SourceControlPullPayload {
  force?: boolean;
  autoPublish: SourceControlAutoPublish;
}

export interface SourceControlFile {
  file: string;
  id: string;
  type: 'workflow' | 'credential' | 'variables' | 'tags' | 'folders';
  status?: 'created' | 'modified' | 'deleted' | 'renamed' | 'conflicted';
  location?: string;
  conflict?: boolean;
  directory?: string;
}

/* ─── Audit (Enterprise) ─────────────────────────────────────────────────── */

export type AuditCategory = 'credentials' | 'database' | 'nodes' | 'filesystem' | 'instance';

export interface AuditOptions {
  daysAbandonedWorkflow?: number;
  categories: AuditCategory[];
}

export interface AuditSection<T = Record<string, unknown>> {
  sectionId: string;
  findings: T[];
  recSections?: string[];
}

export interface AuditReport {
  [sectionKey: string]: unknown;
}

/* ─── Insights (Enterprise) ──────────────────────────────────────────────── */

export interface InsightMetric {
  value: number;
  deviation?: number | null;
  unit?: string;
}

export interface InsightsSummary {
  total: InsightMetric;
  failed: InsightMetric;
  failureRate: InsightMetric;
  timeSaved: InsightMetric;
  averageRunTime: InsightMetric;
  period?: { start: string; end: string };
  byWorkflow?: Record<string, InsightMetric>;
}

/* ─── Discover ───────────────────────────────────────────────────────────── */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface DiscoverEndpoint {
  method: HttpMethod;
  path: string;
  operationId?: string;
  requestSchema?: Record<string, unknown>;
}

export interface DiscoverResource {
  operations: string[];
  endpoints: DiscoverEndpoint[];
}

export interface DiscoverResponse {
  data: {
    scopes: string[];
    resources: Record<string, DiscoverResource>;
    filters: Record<string, unknown>;
    specUrl?: string;
  };
}
