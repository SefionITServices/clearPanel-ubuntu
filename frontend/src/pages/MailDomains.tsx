import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DnsIcon from '@mui/icons-material/Dns';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PublishIcon from '@mui/icons-material/Publish';
import BarChartIcon from '@mui/icons-material/BarChart';
import QueueIcon from '@mui/icons-material/Queue';
import DescriptionIcon from '@mui/icons-material/Description';
import BackupIcon from '@mui/icons-material/Backup';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SearchIcon from '@mui/icons-material/Search';
import RestoreIcon from '@mui/icons-material/Restore';
import SpeedIcon from '@mui/icons-material/Speed';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { DashboardLayout } from '../layouts/dashboard/layout';
import { SmtpRelayPanel, QuotaWarningPanel } from '../components/MailGlobalPanels';
import { SieveFiltersPanel, CatchAllPanel, DmarcReportsPanel } from '../components/MailDomainPanels';
import {
  AutomationLog,
  DomainSettingsUpdate,
  MailAutomationHistoryRecord,
  MailDomain,
  MailDomainResult,
  MailboxSummary,
  MailAliasSummary,
  UpdateMailboxPayload,
  DnsRecord,
  MailStatusResponse,
  SecurityStatus,
  DnsPublishResult,
  MailMetricsResponse,
  MailQueueStatus,
  MailLogsResponse,
  DnsPropagationResult,
  BackupEntry,
  BackupResult,
  RateLimitEntry,
  mailAPI,
} from '../api/mail';

const SPAM_THRESHOLD_MIN = 0;
const SPAM_THRESHOLD_MAX = 20;
const SPAM_THRESHOLD_STEP = 0.1;
const GREYLIST_DELAY_MIN = 0;
const GREYLIST_DELAY_MAX = 3600;
const DEFAULT_GREYLISTING_ENABLED = true;
const DEFAULT_VIRUS_SCAN_ENABLED = true;

type NumericField = 'spamThreshold' | 'greylistingDelaySeconds';

type DraftState = Record<string, DomainSettingsUpdate>;
type FieldErrorState = Record<string, Partial<Record<NumericField, string>>>;
type SavingState = Record<string, boolean>;

type Feedback = { type: 'success' | 'error'; message: string } | null;

function getNumericDisplayValue(domain: MailDomain, draft: DomainSettingsUpdate | undefined, field: NumericField) {
  const draftValue = draft?.[field];
  if (draftValue === null) {
    return '';
  }
  if (typeof draftValue === 'number') {
    return draftValue;
  }
  const fallback = domain[field];
  return typeof fallback === 'number' ? fallback : '';
}

function getBooleanDisplayValue(domain: MailDomain, draft: DomainSettingsUpdate | undefined, field: 'greylistingEnabled' | 'virusScanEnabled') {
  const draftValue = draft?.[field];
  if (draftValue === null) {
    return field === 'greylistingEnabled' ? DEFAULT_GREYLISTING_ENABLED : DEFAULT_VIRUS_SCAN_ENABLED;
  }
  if (typeof draftValue === 'boolean') {
    return draftValue;
  }
  const fallback = domain[field];
  if (typeof fallback === 'boolean') {
    return fallback;
  }
  return true;
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleString();
}

function formatScopeLabel(scope: MailAutomationHistoryRecord['scope']): string {
  switch (scope) {
    case 'stack':
      return 'Stack';
    case 'domain':
      return 'Domain';
    case 'mailbox':
      return 'Mailbox';
    case 'alias':
      return 'Alias';
    case 'dkim':
      return 'DKIM';
    default:
      return scope;
  }
}

function validatePasswordStrength(password: string): string | null {
  const trimmed = password.trim();
  if (trimmed.length < 10) {
    return 'Password must be at least 10 characters long';
  }
  if (!/[A-Z]/.test(trimmed)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(trimmed)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/\d/.test(trimmed)) {
    return 'Password must include at least one number';
  }
  if (!/[^A-Za-z0-9]/.test(trimmed)) {
    return 'Password must include at least one symbol';
  }
  return null;
}

function generateStrongPassword(length: number = 14): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}';
  const all = upper + lower + digits + symbols;

  const pick = (source: string) => source[Math.floor(Math.random() * source.length)] ?? '';

  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const remainingLength = Math.max(length, required.length) - required.length;

  for (let index = 0; index < remainingLength; index += 1) {
    required.push(pick(all));
  }

  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = required[index];
    required[index] = required[swapIndex];
    required[swapIndex] = temp;
  }

  return required.join('');
}

export default function MailDomainsPage() {
  const [domains, setDomains] = useState<MailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>({});
  const [saving, setSaving] = useState<SavingState>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [domainLogs, setDomainLogs] = useState<Record<string, MailAutomationHistoryRecord[]>>({});
  const [logsLoading, setLogsLoading] = useState<Record<string, boolean>>({});
  const [logsExpanded, setLogsExpanded] = useState<Record<string, boolean>>({});
  const [logsErrors, setLogsErrors] = useState<Record<string, string | undefined>>({});
  const [mailboxForms, setMailboxForms] = useState<Record<string, { localPart: string; password: string; quotaMb: string }>>({});
  const [mailboxFormErrors, setMailboxFormErrors] = useState<Record<string, string | undefined>>({});
  const [mailboxBusy, setMailboxBusy] = useState<Record<string, boolean>>({});
  const [mailboxRowBusy, setMailboxRowBusy] = useState<Record<string, boolean>>({});
  const [aliasForms, setAliasForms] = useState<Record<string, { source: string; destination: string }>>({});
  const [aliasFormErrors, setAliasFormErrors] = useState<Record<string, string | undefined>>({});
  const [aliasBusy, setAliasBusy] = useState<Record<string, boolean>>({});
  const [aliasRowBusy, setAliasRowBusy] = useState<Record<string, boolean>>({});
  const [mailboxDialog, setMailboxDialog] = useState<{ domainId: string; mailboxId: string } | null>(null);
  const [mailboxEditForm, setMailboxEditForm] = useState<{ password: string; quotaMb: string; clearQuota: boolean }>({
    password: '',
    quotaMb: '',
    clearQuota: false,
  });
  const [mailboxEditError, setMailboxEditError] = useState<string | null>(null);
  const [mailboxEditBusy, setMailboxEditBusy] = useState(false);
  const [aliasDialog, setAliasDialog] = useState<{ domainId: string; aliasId: string } | null>(null);
  const [aliasEditForm, setAliasEditForm] = useState<{ destination: string }>({ destination: '' });
  const [aliasEditError, setAliasEditError] = useState<string | null>(null);
  const [aliasEditBusy, setAliasEditBusy] = useState(false);

  // DNS suggestions
  const [dnsExpanded, setDnsExpanded] = useState<Record<string, boolean>>({});
  const [dnsRecords, setDnsRecords] = useState<Record<string, DnsRecord[]>>({});
  const [dnsLoading, setDnsLoading] = useState<Record<string, boolean>>({});
  const [dnsErrors, setDnsErrors] = useState<Record<string, string | undefined>>({});

  // DKIM rotation
  const [dkimBusy, setDkimBusy] = useState<Record<string, boolean>>({});

  // Mail status
  const [mailStatus, setMailStatus] = useState<MailStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Security panel
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [tlsForm, setTlsForm] = useState({ hostname: '', email: '' });
  const [tlsBusy, setTlsBusy] = useState(false);
  const [postscreenBusy, setPostscreenBusy] = useState(false);
  const [dmarcForm, setDmarcForm] = useState({ domain: '', reportEmail: '' });
  const [dmarcBusy, setDmarcBusy] = useState(false);

  // DNS publish
  const [publishBusy, setPublishBusy] = useState<Record<string, boolean>>({});
  const [publishResults, setPublishResults] = useState<Record<string, DnsPublishResult>>({});

  // Mail metrics
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [metrics, setMetrics] = useState<MailMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Queue management
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [queueData, setQueueData] = useState<{ total?: number; sample?: string[]; message?: string; error?: string } | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);

  // Mail logs
  const [logsViewExpanded, setLogsViewExpanded] = useState(false);
  const [mailLogs, setMailLogs] = useState<string[]>([]);
  const [mailLogsLoading, setMailLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logLines, setLogLines] = useState(100);

  // DNS propagation
  const [propagationResults, setPropagationResults] = useState<Record<string, { results: { record: { type: string; name: string; expected: string }; actual: string[]; match: boolean }[]; allPropagated: boolean } | null>>({});
  const [propagationBusy, setPropagationBusy] = useState<Record<string, boolean>>({});

  // Backups
  const [backupsExpanded, setBackupsExpanded] = useState(false);
  const [backups, setBackups] = useState<{ file: string; domain: string; email: string; timestamp: string; sizeBytes: number }[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupBusy, setBackupBusy] = useState<Record<string, boolean>>({});
  const [restoreBusy, setRestoreBusy] = useState<Record<string, boolean>>({});

  // Rate limiting
  const [rateLimits, setRateLimits] = useState<Record<string, { email: string; limit: number; updatedAt?: string }[]>>({});
  const [rateLimitForm, setRateLimitForm] = useState<Record<string, { email: string; limit: string }>>({});
  const [rateLimitBusy, setRateLimitBusy] = useState<Record<string, boolean>>({});

  const hasAnyDomains = domains.length > 0;
  const defaultMailboxFormState = { localPart: '', password: '', quotaMb: '' } as const;
  const defaultAliasFormState = { source: '', destination: '' } as const;

  const findDomainById = (domainId: string) => domains.find((entry) => entry.id === domainId);

  const seedAutomationLogs = (
    domainId: string,
    domainName: string,
    scope: MailAutomationHistoryRecord['scope'],
    target: string,
    logs: AutomationLog[],
  ) => {
    if (!logs.length) {
      return;
    }
    const now = Date.now();
    const synthetic = logs.map((log, index) => ({
      id: `pending-${domainId}-${scope}-${now + index}`,
      domainId,
      domain: domainName,
      scope,
      target,
      task: log.task,
      success: log.success,
      message: log.message,
      detail: log.detail,
      executedAt: new Date(now + index).toISOString(),
    }));
    setDomainLogs((prev) => ({ ...prev, [domainId]: synthetic }));
  };

  const handleDomainResult = async (
    domainId: string,
    scope: MailAutomationHistoryRecord['scope'],
    target: string,
    result: MailDomainResult,
  ): Promise<MailDomain> => {
    seedAutomationLogs(domainId, result.domain.domain, scope, target, result.automationLogs || []);

    setDomains((prev) => prev.map((entry) => (entry.id === domainId ? result.domain : entry)));

    await fetchDomainLogs(domainId);
    setLogsExpanded((prev) => ({ ...prev, [domainId]: true }));

    return result.domain;
  };

  useEffect(() => {
    let cancelled = false;

    async function loadDomains() {
      setLoading(true);
      setFeedback(null);
      try {
        const items = await mailAPI.listDomains();
        if (cancelled) return;
        setDomains(items);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to load mail domains';
        setFeedback({ type: 'error', message });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDomains();
    return () => {
      cancelled = true;
    };
  }, []);

  const setFieldError = (domainId: string, field: NumericField, message?: string) => {
    setFieldErrors((prev) => {
      const current = { ...(prev[domainId] ?? {}) };
      if (message) {
        current[field] = message;
      } else {
        delete current[field];
      }

      if (Object.keys(current).length === 0) {
        const clone = { ...prev };
        delete clone[domainId];
        return clone;
      }

      return { ...prev, [domainId]: current };
    });
  };

  const updateDraftValue = (domain: MailDomain, field: keyof DomainSettingsUpdate, value: DomainSettingsUpdate[keyof DomainSettingsUpdate]) => {
    setDrafts((prev) => {
      const current = { ...(prev[domain.id] ?? {}) };
      const existingDomainValue = domain[field as keyof MailDomain] as unknown;
      const noChange = value === undefined || (value !== null && value === existingDomainValue);

      if (noChange) {
        delete current[field];
      } else {
        current[field] = value as never;
      }

      if (Object.keys(current).length === 0) {
        const clone = { ...prev };
        delete clone[domain.id];
        return clone;
      }

      return { ...prev, [domain.id]: current };
    });
  };

  const handleNumericChange = (domain: MailDomain, field: NumericField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;

    if (raw === '') {
      setFieldError(domain.id, field, undefined);
      updateDraftValue(domain, field, undefined);
      return;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      setFieldError(domain.id, field, 'Enter a valid number');
      return;
    }

    if (field === 'spamThreshold') {
      if (numeric < SPAM_THRESHOLD_MIN || numeric > SPAM_THRESHOLD_MAX) {
        setFieldError(domain.id, field, `Use ${SPAM_THRESHOLD_MIN}-${SPAM_THRESHOLD_MAX}`);
        return;
      }
      const normalised = Math.round(numeric * 10) / 10;
      setFieldError(domain.id, field, undefined);
      updateDraftValue(domain, field, normalised);
      return;
    }

    if (field === 'greylistingDelaySeconds') {
      if (numeric < GREYLIST_DELAY_MIN || numeric > GREYLIST_DELAY_MAX) {
        setFieldError(domain.id, field, `Use ${GREYLIST_DELAY_MIN}-${GREYLIST_DELAY_MAX}`);
        return;
      }
      const normalised = Math.round(numeric);
      setFieldError(domain.id, field, undefined);
      updateDraftValue(domain, field, normalised);
    }
  };

  const handleToggle = (domain: MailDomain, field: 'greylistingEnabled' | 'virusScanEnabled') => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updateDraftValue(domain, field, event.target.checked);
  };

  const handleResetDefaults = (domain: MailDomain) => {
    updateDraftValue(domain, 'spamThreshold', null);
    updateDraftValue(domain, 'greylistingDelaySeconds', null);
    updateDraftValue(domain, 'greylistingEnabled', null);
    updateDraftValue(domain, 'virusScanEnabled', null);
  };

  const handleDiscardChanges = (domainId: string) => {
    setDrafts((prev) => {
      if (!prev[domainId]) return prev;
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });
    setFieldErrors((prev) => {
      if (!prev[domainId]) return prev;
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });
  };

  const fetchDomainLogs = async (domainId: string, limit: number = 10) => {
    setLogsLoading((prev) => ({ ...prev, [domainId]: true }));
    setLogsErrors((prev) => {
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });

    try {
      const records = await mailAPI.getDomainLogs(domainId, limit);
      setDomainLogs((prev) => ({ ...prev, [domainId]: records }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load automation logs';
      setLogsErrors((prev) => ({ ...prev, [domainId]: message }));
    } finally {
      setLogsLoading((prev) => {
        const clone = { ...prev };
        delete clone[domainId];
        return clone;
      });
    }
  };

  const handleSave = async (domain: MailDomain) => {
    const draft = drafts[domain.id];
    if (!draft || Object.keys(draft).length === 0) {
      setFeedback({ type: 'error', message: `No pending changes for ${domain.domain}` });
      return;
    }

    if (fieldErrors[domain.id] && Object.keys(fieldErrors[domain.id]!).length > 0) {
      setFeedback({ type: 'error', message: `Resolve validation issues before saving ${domain.domain}` });
      return;
    }

    setSaving((prev) => ({ ...prev, [domain.id]: true }));
    setFeedback(null);
    try {
      const result = await mailAPI.updateDomainSettings(domain.id, draft);
      const updatedDomain = await handleDomainResult(domain.id, 'domain', result.domain.domain, result);
      handleDiscardChanges(domain.id);
      setFeedback({ type: 'success', message: `Updated mail policy for ${updatedDomain.domain}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save domain settings';
      setFeedback({ type: 'error', message });
    } finally {
      setSaving((prev) => {
        const clone = { ...prev };
        delete clone[domain.id];
        return clone;
      });
    }
  };

  const handleToggleLogs = async (domain: MailDomain) => {
    const next = !(logsExpanded[domain.id] ?? false);
    setLogsExpanded((prev) => ({ ...prev, [domain.id]: next }));

    if (next && !domainLogs[domain.id] && !logsLoading[domain.id]) {
      await fetchDomainLogs(domain.id);
    }
  };

  const closeMailboxDialog = (force: boolean = false) => {
    if (mailboxEditBusy && !force) {
      return;
    }
    setMailboxDialog(null);
    setMailboxEditForm({ password: '', quotaMb: '', clearQuota: false });
    setMailboxEditError(null);
  };

  const closeAliasDialog = (force: boolean = false) => {
    if (aliasEditBusy && !force) {
      return;
    }
    setAliasDialog(null);
    setAliasEditForm({ destination: '' });
    setAliasEditError(null);
  };

  const setMailboxFormValue = (
    domainId: string,
    field: keyof typeof defaultMailboxFormState,
    value: string,
  ) => {
    setMailboxForms((prev) => ({
      ...prev,
      [domainId]: { ...(prev[domainId] ?? { ...defaultMailboxFormState }), [field]: value },
    }));
  };

  const resetMailboxForm = (domainId: string) => {
    setMailboxForms((prev) => {
      if (!prev[domainId]) return prev;
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });
    setMailboxFormErrors((prev) => {
      if (!prev[domainId]) return prev;
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });
  };

  const setAliasFormValue = (
    domainId: string,
    field: keyof typeof defaultAliasFormState,
    value: string,
  ) => {
    setAliasForms((prev) => ({
      ...prev,
      [domainId]: { ...(prev[domainId] ?? { ...defaultAliasFormState }), [field]: value },
    }));
  };

  const resetAliasForm = (domainId: string) => {
    setAliasForms((prev) => {
      if (!prev[domainId]) return prev;
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });
    setAliasFormErrors((prev) => {
      if (!prev[domainId]) return prev;
      const clone = { ...prev };
      delete clone[domainId];
      return clone;
    });
  };

  const handleCreateMailbox = async (domain: MailDomain) => {
    const form = mailboxForms[domain.id] ?? { ...defaultMailboxFormState };
    const localPart = form.localPart.trim().toLowerCase();
    if (!localPart.length) {
      setMailboxFormErrors((prev) => ({ ...prev, [domain.id]: 'Enter a mailbox name' }));
      return;
    }

    let email = localPart;
    if (!email.includes('@')) {
      email = `${email}@${domain.domain}`;
    }

    const password = form.password.trim();
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setMailboxFormErrors((prev) => ({ ...prev, [domain.id]: passwordError }));
      return;
    }

    let quotaMb: number | undefined;
    const quotaRaw = form.quotaMb.trim();
    if (quotaRaw) {
      const parsed = Number.parseInt(quotaRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setMailboxFormErrors((prev) => ({ ...prev, [domain.id]: 'Quota must be a positive integer' }));
        return;
      }
      quotaMb = Math.floor(parsed);
    }

    setMailboxFormErrors((prev) => {
      if (!prev[domain.id]) return prev;
      const clone = { ...prev };
      delete clone[domain.id];
      return clone;
    });

    setMailboxBusy((prev) => ({ ...prev, [domain.id]: true }));
    try {
      const result = await mailAPI.addMailbox(domain.id, { email, password, quotaMb });
      await handleDomainResult(domain.id, 'mailbox', email, result);
      resetMailboxForm(domain.id);
      setFeedback({ type: 'success', message: `Created mailbox ${email}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create mailbox';
      setMailboxFormErrors((prev) => ({ ...prev, [domain.id]: message }));
    } finally {
      setMailboxBusy((prev) => {
        const clone = { ...prev };
        delete clone[domain.id];
        return clone;
      });
    }
  };

  const handleRemoveMailbox = async (domain: MailDomain, mailbox: MailboxSummary) => {
    if (!window.confirm(`Remove mailbox ${mailbox.email}?`)) {
      return;
    }

    setMailboxRowBusy((prev) => ({ ...prev, [mailbox.id]: true }));
    try {
      const result = await mailAPI.removeMailbox(domain.id, mailbox.id);
      await handleDomainResult(domain.id, 'mailbox', mailbox.email, result);
      setFeedback({ type: 'success', message: `Removed mailbox ${mailbox.email}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove mailbox';
      setFeedback({ type: 'error', message });
    } finally {
      setMailboxRowBusy((prev) => {
        const clone = { ...prev };
        delete clone[mailbox.id];
        return clone;
      });
    }
  };

  const openMailboxDialog = (domain: MailDomain, mailbox: MailboxSummary) => {
    setMailboxDialog({ domainId: domain.id, mailboxId: mailbox.id });
    setMailboxEditForm({
      password: '',
      quotaMb: mailbox.quotaMb !== undefined && mailbox.quotaMb !== null ? String(mailbox.quotaMb) : '',
      clearQuota: mailbox.quotaMb === undefined || mailbox.quotaMb === null,
    });
    setMailboxEditError(null);
  };

  const handleUpdateMailbox = async () => {
    if (!mailboxDialog) {
      return;
    }
    const domain = findDomainById(mailboxDialog.domainId);
    const mailbox = domain?.mailboxes.find((entry) => entry.id === mailboxDialog.mailboxId);
    if (!domain || !mailbox) {
      setMailboxDialog(null);
      return;
    }

    const payload: UpdateMailboxPayload = {};
    const trimmedPassword = mailboxEditForm.password.trim();
    if (trimmedPassword) {
      const passwordError = validatePasswordStrength(trimmedPassword);
      if (passwordError) {
        setMailboxEditError(passwordError);
        return;
      }
      payload.password = trimmedPassword;
    }

    if (mailboxEditForm.clearQuota) {
      payload.quotaMb = null;
    } else if (mailboxEditForm.quotaMb.trim()) {
      const parsed = Number.parseInt(mailboxEditForm.quotaMb.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setMailboxEditError('Quota must be a positive integer');
        return;
      }
      payload.quotaMb = Math.floor(parsed);
    }

    if (Object.keys(payload).length === 0) {
      setMailboxEditError('Update password and/or quota before saving');
      return;
    }

    setMailboxEditBusy(true);
    setMailboxEditError(null);
    try {
      const result = await mailAPI.updateMailbox(domain.id, mailbox.id, payload);
      await handleDomainResult(domain.id, 'mailbox', mailbox.email, result);
      setFeedback({ type: 'success', message: `Updated mailbox ${mailbox.email}` });
      closeMailboxDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update mailbox';
      setMailboxEditError(message);
    } finally {
      setMailboxEditBusy(false);
    }
  };

  const handleCreateAlias = async (domain: MailDomain) => {
    const form = aliasForms[domain.id] ?? { ...defaultAliasFormState };
    const sourceRaw = form.source.trim().toLowerCase();
    if (!sourceRaw.length) {
      setAliasFormErrors((prev) => ({ ...prev, [domain.id]: 'Enter an alias name' }));
      return;
    }

    let source = sourceRaw;
    if (!source.includes('@')) {
      source = `${source}@${domain.domain}`;
    }

    const destination = form.destination.trim().toLowerCase();
    if (!destination.includes('@')) {
      setAliasFormErrors((prev) => ({ ...prev, [domain.id]: 'Destination must be an email address' }));
      return;
    }

    setAliasFormErrors((prev) => {
      if (!prev[domain.id]) return prev;
      const clone = { ...prev };
      delete clone[domain.id];
      return clone;
    });

    setAliasBusy((prev) => ({ ...prev, [domain.id]: true }));
    try {
      const result = await mailAPI.addAlias(domain.id, { source, destination });
      await handleDomainResult(domain.id, 'alias', source, result);
      resetAliasForm(domain.id);
      setFeedback({ type: 'success', message: `Created alias ${source}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create alias';
      setAliasFormErrors((prev) => ({ ...prev, [domain.id]: message }));
    } finally {
      setAliasBusy((prev) => {
        const clone = { ...prev };
        delete clone[domain.id];
        return clone;
      });
    }
  };

  const handleRemoveAlias = async (domain: MailDomain, alias: MailAliasSummary) => {
    if (!window.confirm(`Remove alias ${alias.source}?`)) {
      return;
    }

    setAliasRowBusy((prev) => ({ ...prev, [alias.id]: true }));
    try {
      const result = await mailAPI.removeAlias(domain.id, alias.id);
      await handleDomainResult(domain.id, 'alias', alias.source, result);
      setFeedback({ type: 'success', message: `Removed alias ${alias.source}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove alias';
      setFeedback({ type: 'error', message });
    } finally {
      setAliasRowBusy((prev) => {
        const clone = { ...prev };
        delete clone[alias.id];
        return clone;
      });
    }
  };

  const openAliasDialog = (domain: MailDomain, alias: MailAliasSummary) => {
    setAliasDialog({ domainId: domain.id, aliasId: alias.id });
    setAliasEditForm({ destination: alias.destination });
    setAliasEditError(null);
  };

  const handleUpdateAlias = async () => {
    if (!aliasDialog) {
      return;
    }
    const domain = findDomainById(aliasDialog.domainId);
    const alias = domain?.aliases.find((entry) => entry.id === aliasDialog.aliasId);
    if (!domain || !alias) {
      setAliasDialog(null);
      return;
    }

    const destination = aliasEditForm.destination.trim().toLowerCase();
    if (!destination.includes('@')) {
      setAliasEditError('Destination must be an email address');
      return;
    }

    if (destination === alias.destination.toLowerCase()) {
      setAliasEditError('Destination unchanged');
      return;
    }

    setAliasEditBusy(true);
    setAliasEditError(null);
    try {
      const result = await mailAPI.updateAlias(domain.id, alias.id, { destination });
      await handleDomainResult(domain.id, 'alias', alias.source, result);
      setFeedback({ type: 'success', message: `Updated alias ${alias.source}` });
      closeAliasDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update alias';
      setAliasEditError(message);
    } finally {
      setAliasEditBusy(false);
    }
  };

  // --- DNS Suggestions ---
  const handleToggleDns = async (domain: MailDomain) => {
    const next = !(dnsExpanded[domain.id] ?? false);
    setDnsExpanded((prev) => ({ ...prev, [domain.id]: next }));

    if (next && !dnsRecords[domain.id] && !dnsLoading[domain.id]) {
      setDnsLoading((prev) => ({ ...prev, [domain.id]: true }));
      setDnsErrors((prev) => {
        const clone = { ...prev };
        delete clone[domain.id];
        return clone;
      });
      try {
        const response = await mailAPI.getDnsSuggestions(domain.id);
        setDnsRecords((prev) => ({ ...prev, [domain.id]: response.records }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load DNS suggestions';
        setDnsErrors((prev) => ({ ...prev, [domain.id]: message }));
      } finally {
        setDnsLoading((prev) => {
          const clone = { ...prev };
          delete clone[domain.id];
          return clone;
        });
      }
    }
  };

  // --- DKIM Rotation ---
  const handleRotateDkim = async (domain: MailDomain) => {
    if (!window.confirm(`Rotate DKIM key for "${domain.domain}"? The old key will be replaced.`)) {
      return;
    }

    setDkimBusy((prev) => ({ ...prev, [domain.id]: true }));
    try {
      const result = await mailAPI.rotateDkim(domain.id);
      await handleDomainResult(domain.id, 'dkim', domain.domain, result);
      setFeedback({ type: 'success', message: `Rotated DKIM key for ${domain.domain}` });
      // Refresh DNS suggestions if expanded
      if (dnsExpanded[domain.id]) {
        const response = await mailAPI.getDnsSuggestions(domain.id);
        setDnsRecords((prev) => ({ ...prev, [domain.id]: response.records }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rotate DKIM key';
      setFeedback({ type: 'error', message });
    } finally {
      setDkimBusy((prev) => {
        const clone = { ...prev };
        delete clone[domain.id];
        return clone;
      });
    }
  };

  // --- Load Mail Status ---
  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const status = await mailAPI.getStatus();
        if (!cancelled) setMailStatus(status);
      } catch {
        // Status is non-critical; silently ignore
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    loadStatus();
    return () => { cancelled = true; };
  }, []);

  // --- Load Security Status ---
  const loadSecurityStatus = async () => {
    setSecurityLoading(true);
    try {
      const status = await mailAPI.getSecurityStatus();
      setSecurityStatus(status);
    } catch {
      // Non-critical
    } finally {
      setSecurityLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    mailAPI.getSecurityStatus().then((s) => {
      if (!cancelled) {
        setSecurityStatus(s);
        setSecurityLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setSecurityLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // --- Security Handlers ---
  const handleSetupTls = async () => {
    if (!tlsForm.hostname || !tlsForm.email) {
      setFeedback({ type: 'error', message: 'Mail hostname and admin email are required' });
      return;
    }
    setTlsBusy(true);
    try {
      const result = await mailAPI.setupMailTls({ hostname: tlsForm.hostname, email: tlsForm.email });
      const allOk = result.automationLogs.every((l) => l.success);
      setFeedback({
        type: allOk ? 'success' : 'error',
        message: allOk ? `TLS configured for ${tlsForm.hostname}` : result.automationLogs.find((l) => !l.success)?.message || 'TLS setup failed',
      });
      await loadSecurityStatus();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'TLS setup failed' });
    } finally {
      setTlsBusy(false);
    }
  };

  const handleSetupPostscreen = async () => {
    setPostscreenBusy(true);
    try {
      const result = await mailAPI.setupPostscreen();
      const allOk = result.automationLogs.every((l) => l.success);
      setFeedback({
        type: allOk ? 'success' : 'error',
        message: allOk ? 'Postscreen & reputation guards enabled' : result.automationLogs.find((l) => !l.success)?.message || 'Postscreen setup failed',
      });
      await loadSecurityStatus();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Postscreen setup failed' });
    } finally {
      setPostscreenBusy(false);
    }
  };

  const handleSetupDmarc = async () => {
    if (!dmarcForm.domain) {
      setFeedback({ type: 'error', message: 'Domain is required for DMARC setup' });
      return;
    }
    setDmarcBusy(true);
    try {
      const result = await mailAPI.setupDmarc({ domain: dmarcForm.domain, reportEmail: dmarcForm.reportEmail || undefined });
      const allOk = result.automationLogs.every((l) => l.success);
      setFeedback({
        type: allOk ? 'success' : 'error',
        message: allOk ? `DMARC + ARC configured for ${dmarcForm.domain}` : result.automationLogs.find((l) => !l.success)?.message || 'DMARC setup failed',
      });
      await loadSecurityStatus();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'DMARC setup failed' });
    } finally {
      setDmarcBusy(false);
    }
  };

  // --- DNS Publish Handler ---
  const handlePublishDns = async (domainId: string, domainName: string) => {
    setPublishBusy((prev) => ({ ...prev, [domainId]: true }));
    try {
      const result = await mailAPI.publishDns(domainId);
      setPublishResults((prev) => ({ ...prev, [domainId]: result }));
      const created = result.published.filter((r) => r.status === 'created').length;
      const existing = result.published.filter((r) => r.status === 'exists').length;
      const errors = result.published.filter((r) => r.status === 'error').length;
      const msg = `DNS for ${domainName}: ${created} published, ${existing} unchanged${errors ? `, ${errors} errors` : ''}`;
      setFeedback({ type: errors ? 'error' : 'success', message: msg });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'DNS publish failed' });
    } finally {
      setPublishBusy((prev) => {
        const clone = { ...prev };
        delete clone[domainId];
        return clone;
      });
    }
  };

  // --- Load Metrics ---
  const handleLoadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const data = await mailAPI.getMailMetrics();
      setMetrics(data);
    } catch {
      // non-critical
    } finally {
      setMetricsLoading(false);
    }
  };

  // --- Queue Management ---
  const handleLoadQueue = async () => {
    setQueueLoading(true);
    try {
      const data = await mailAPI.getQueue();
      setQueueData(data);
    } catch {
      setQueueData({ error: 'Failed to load queue' });
    } finally {
      setQueueLoading(false);
    }
  };

  const handleFlushQueue = async () => {
    setQueueBusy(true);
    try {
      await mailAPI.flushQueue();
      setFeedback({ type: 'success', message: 'Queue flush requested' });
      await handleLoadQueue();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Queue flush failed' });
    } finally {
      setQueueBusy(false);
    }
  };

  const handlePurgeQueue = async () => {
    setQueueBusy(true);
    try {
      await mailAPI.deleteAllQueueMessages();
      setFeedback({ type: 'success', message: 'All queued messages deleted' });
      await handleLoadQueue();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Queue purge failed' });
    } finally {
      setQueueBusy(false);
    }
  };

  const handleRetryMessage = async (queueId: string) => {
    try {
      await mailAPI.retryQueueMessage(queueId);
      setFeedback({ type: 'success', message: `Requeued message ${queueId}` });
      await handleLoadQueue();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Retry failed' });
    }
  };

  const handleDeleteMessage = async (queueId: string) => {
    try {
      await mailAPI.deleteQueueMessage(queueId);
      setFeedback({ type: 'success', message: `Deleted message ${queueId}` });
      await handleLoadQueue();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Delete failed' });
    }
  };

  // --- Mail Logs ---
  const handleLoadMailLogs = async () => {
    setMailLogsLoading(true);
    try {
      const data = await mailAPI.getMailLogs(logLines, logSearch || undefined);
      setMailLogs(data.lines);
    } catch {
      setMailLogs([]);
    } finally {
      setMailLogsLoading(false);
    }
  };

  // --- DNS Propagation Check ---
  const handleCheckPropagation = async (domainId: string) => {
    setPropagationBusy((prev) => ({ ...prev, [domainId]: true }));
    try {
      const result = await mailAPI.checkDnsPropagation(domainId);
      setPropagationResults((prev) => ({
        ...prev,
        [domainId]: { results: result.results, allPropagated: result.allPropagated },
      }));
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'DNS propagation check failed' });
    } finally {
      setPropagationBusy((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  // --- Backups ---
  const handleLoadBackups = async () => {
    setBackupsLoading(true);
    try {
      const data = await mailAPI.listBackups();
      setBackups(data);
    } catch {
      setBackups([]);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleBackupMailbox = async (domainId: string, mailboxId: string, email: string) => {
    const key = `${domainId}-${mailboxId}`;
    setBackupBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await mailAPI.backupMailbox(domainId, mailboxId);
      const allOk = result.automationLogs.every((l) => l.success);
      setFeedback({
        type: allOk ? 'success' : 'error',
        message: allOk
          ? `Backed up ${email} (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`
          : result.automationLogs.find((l) => !l.success)?.message || 'Backup failed',
      });
      await handleLoadBackups();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Backup failed' });
    } finally {
      setBackupBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRestoreMailbox = async (domainId: string, mailboxId: string, backupFile: string) => {
    const key = `${domainId}-${mailboxId}`;
    setRestoreBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await mailAPI.restoreMailbox(domainId, mailboxId, backupFile);
      const allOk = result.automationLogs.every((l) => l.success);
      setFeedback({
        type: allOk ? 'success' : 'error',
        message: allOk ? 'Mailbox restored from backup' : result.automationLogs.find((l) => !l.success)?.message || 'Restore failed',
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Restore failed' });
    } finally {
      setRestoreBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  // --- Rate Limiting ---
  const [ssoBusy, setSsoBusy] = useState<Record<string, boolean>>({});

  const handleOpenWebmail = async (domainId: string, mailboxId: string) => {
    const key = `${domainId}-${mailboxId}`;
    setSsoBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const { url } = await mailAPI.getSsoUrl(domainId, mailboxId);
      // url is relative like /roundcube/?_sso_token=...
      // Open in a new tab; if Roundcube is on a different host, adjust origin
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Failed to launch webmail SSO' });
    } finally {
      setSsoBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  // --- Rate Limiting (continued) ---
  const handleLoadRateLimits = async (domainId: string) => {
    try {
      const data = await mailAPI.getRateLimits(domainId);
      setRateLimits((prev) => ({ ...prev, [domainId]: data }));
    } catch {
      // ignore
    }
  };

  const handleSetupRateLimit = async (domainId: string) => {
    const form = rateLimitForm[domainId];
    if (!form?.email || !form?.limit) {
      setFeedback({ type: 'error', message: 'Email and limit are required' });
      return;
    }
    setRateLimitBusy((prev) => ({ ...prev, [domainId]: true }));
    try {
      const result = await mailAPI.setupRateLimit(domainId, form.email, parseInt(form.limit, 10));
      const allOk = result.automationLogs.every((l) => l.success);
      setFeedback({
        type: allOk ? 'success' : 'error',
        message: allOk ? `Rate limit set: ${form.email} = ${form.limit}/hour` : result.automationLogs.find((l) => !l.success)?.message || 'Rate limit setup failed',
      });
      setRateLimitForm((prev) => ({ ...prev, [domainId]: { email: '', limit: '' } }));
      await handleLoadRateLimits(domainId);
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Rate limit setup failed' });
    } finally {
      setRateLimitBusy((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  const activeMailboxDomain = mailboxDialog ? findDomainById(mailboxDialog.domainId) : undefined;
  const activeMailbox =
    mailboxDialog && activeMailboxDomain
      ? activeMailboxDomain.mailboxes.find((entry) => entry.id === mailboxDialog.mailboxId)
      : undefined;
  const activeAliasDomain = aliasDialog ? findDomainById(aliasDialog.domainId) : undefined;
  const activeAlias =
    aliasDialog && activeAliasDomain
      ? activeAliasDomain.aliases.find((entry) => entry.id === aliasDialog.aliasId)
      : undefined;

  return (
    <DashboardLayout>
      <Box>
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MailOutlineIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Mail Domains
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage mailboxes, aliases, DNS records, and DKIM keys for your hosted domains
              </Typography>
            </Box>
          </Box>

          {/* Mail Service Status */}
          {!statusLoading && mailStatus && (
            <Paper sx={{ p: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mr: 1 }}>
                  Services:
                </Typography>
                {mailStatus.services.map((svc) => (
                  <Chip
                    key={svc.name}
                    size="small"
                    icon={svc.active ? <CheckCircleIcon /> : <CancelIcon />}
                    color={svc.active ? 'success' : 'error'}
                    label={svc.name}
                    variant="outlined"
                  />
                ))}
                {mailStatus.queueDepth !== undefined && (
                  <Chip size="small" variant="outlined" label={`Queue: ${mailStatus.queueDepth}`} />
                )}
              </Stack>
            </Paper>
          )}

          {/* Security Hardening Panel */}
          <Paper sx={{ p: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={2}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setSecurityExpanded((prev) => !prev)}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <SecurityIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Security &amp; TLS
                  </Typography>
                  {!securityLoading && securityStatus && (
                    <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                      <Chip
                        size="small"
                        icon={securityStatus.tls.configured ? <CheckCircleIcon /> : <CancelIcon />}
                        color={securityStatus.tls.configured ? 'success' : 'default'}
                        label="TLS"
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={securityStatus.postscreen.enabled ? <CheckCircleIcon /> : <CancelIcon />}
                        color={securityStatus.postscreen.enabled ? 'success' : 'default'}
                        label="Postscreen"
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={securityStatus.dmarc.domains.length > 0 ? <CheckCircleIcon /> : <CancelIcon />}
                        color={securityStatus.dmarc.domains.length > 0 ? 'success' : 'default'}
                        label="DMARC"
                        variant="outlined"
                      />
                    </Stack>
                  )}
                </Stack>
                <IconButton size="small">
                  {securityExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              <Collapse in={securityExpanded}>
                <Stack spacing={3} sx={{ pt: 1 }}>
                  {/* TLS Setup */}
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LockIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight={600}>Mail TLS Certificate</Typography>
                        {securityStatus?.tls.configured && (
                          <Chip size="small" color="success" label={`Active: ${securityStatus.tls.hostname}`} />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Obtain a Let&apos;s Encrypt certificate for your mail hostname and configure Postfix + Dovecot TLS.
                      </Typography>
                      {!securityStatus?.tls.configured && (
                        <Stack direction="row" spacing={1.5} alignItems="flex-end">
                          <TextField
                            label="Mail hostname"
                            size="small"
                            value={tlsForm.hostname}
                            onChange={(e) => setTlsForm((prev) => ({ ...prev, hostname: e.target.value }))}
                            placeholder="mail.example.com"
                            sx={{ minWidth: 240 }}
                          />
                          <TextField
                            label="Admin email"
                            size="small"
                            value={tlsForm.email}
                            onChange={(e) => setTlsForm((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="admin@example.com"
                            sx={{ minWidth: 240 }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            disabled={tlsBusy}
                            onClick={() => void handleSetupTls()}
                          >
                            {tlsBusy ? 'Setting up…' : 'Setup TLS'}
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>

                  {/* Postscreen */}
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ShieldIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight={600}>Postscreen &amp; Reputation Guards</Typography>
                        {securityStatus?.postscreen.enabled && (
                          <Chip size="small" color="success" label="Enabled" />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Enable DNSBL checks, protocol tests, SRS and rate limiting to block spam senders before they reach your SMTP daemon.
                      </Typography>
                      {!securityStatus?.postscreen.enabled && (
                        <Box>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={postscreenBusy}
                            onClick={() => void handleSetupPostscreen()}
                          >
                            {postscreenBusy ? 'Configuring…' : 'Enable Postscreen'}
                          </Button>
                        </Box>
                      )}
                    </Stack>
                  </Paper>

                  {/* DMARC */}
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <VerifiedUserIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight={600}>DMARC &amp; ARC</Typography>
                        {securityStatus && securityStatus.dmarc.domains.length > 0 && (
                          <Chip size="small" color="success" label={`${securityStatus.dmarc.domains.length} domain(s)`} />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Configure DMARC enforcement and aggregate reporting via Rspamd. ARC signing is also enabled for forwarded mail.
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="flex-end">
                        <TextField
                          label="Domain"
                          size="small"
                          value={dmarcForm.domain}
                          onChange={(e) => setDmarcForm((prev) => ({ ...prev, domain: e.target.value }))}
                          placeholder="example.com"
                          sx={{ minWidth: 200 }}
                        />
                        <TextField
                          label="Report email (optional)"
                          size="small"
                          value={dmarcForm.reportEmail}
                          onChange={(e) => setDmarcForm((prev) => ({ ...prev, reportEmail: e.target.value }))}
                          placeholder="dmarc@example.com"
                          sx={{ minWidth: 240 }}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          disabled={dmarcBusy}
                          onClick={() => void handleSetupDmarc()}
                        >
                          {dmarcBusy ? 'Configuring…' : 'Setup DMARC'}
                        </Button>
                      </Stack>
                      {securityStatus && securityStatus.dmarc.domains.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Configured for: {securityStatus.dmarc.domains.join(', ')}
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
              </Collapse>
            </Stack>
          </Paper>

          {/* SMTP Relay Panel */}
          <SmtpRelayPanel onFeedback={(type, message) => setFeedback({ type, message })} />

          {/* Quota Warnings Panel */}
          <QuotaWarningPanel onFeedback={(type, message) => setFeedback({ type, message })} />

          {/* Mail Metrics Panel */}
          <Paper sx={{ p: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={2}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => {
                  const next = !metricsExpanded;
                  setMetricsExpanded(next);
                  if (next && !metrics) void handleLoadMetrics();
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <BarChartIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Mail Metrics
                  </Typography>
                </Stack>
                <IconButton size="small">
                  {metricsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              <Collapse in={metricsExpanded}>
                {metricsLoading && (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}
                {!metricsLoading && metrics && (
                  <Stack spacing={2} sx={{ pt: 1 }}>
                    {/* Rspamd Stats */}
                    {metrics.rspamd && (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Rspamd Statistics
                        </Typography>
                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={`Scanned: ${metrics.rspamd.scanned ?? 0}`} />
                          <Chip size="small" color="success" label={`Ham: ${metrics.rspamd.hamCount ?? 0}`} />
                          <Chip size="small" color="warning" label={`Spam: ${metrics.rspamd.spamCount ?? 0}`} />
                          <Chip size="small" color="error" label={`Rejected: ${metrics.rspamd.rejectCount ?? 0}`} />
                          <Chip size="small" label={`Greylisted: ${metrics.rspamd.greylistedCount ?? 0}`} />
                        </Stack>
                      </Paper>
                    )}

                    {/* Delivery Stats */}
                    {metrics.delivery && (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Delivery (last 24h from logs)
                        </Typography>
                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                          <Chip size="small" color="primary" label={`Sent: ${metrics.delivery.sent}`} />
                          <Chip size="small" color="success" label={`Received: ${metrics.delivery.received}`} />
                          <Chip size="small" color="warning" label={`Bounced: ${metrics.delivery.bounced}`} />
                          <Chip size="small" label={`Deferred: ${metrics.delivery.deferred}`} />
                          <Chip size="small" color="error" label={`Rejected: ${metrics.delivery.rejected}`} />
                        </Stack>
                      </Paper>
                    )}

                    {/* Dovecot Connections */}
                    {metrics.dovecotConnections !== undefined && (
                      <Chip size="small" variant="outlined" label={`Active IMAP connections: ${metrics.dovecotConnections}`} />
                    )}

                    {/* Disk Usage */}
                    {metrics.diskUsage && metrics.diskUsage.length > 0 && (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Mailbox Disk Usage
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Domain</TableCell>
                                <TableCell>Mailbox</TableCell>
                                <TableCell align="right">Size</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.diskUsage.flatMap((du) =>
                                du.mailboxes.map((mb) => (
                                  <TableRow key={mb.email}>
                                    <TableCell>{du.domain}</TableCell>
                                    <TableCell>{mb.email}</TableCell>
                                    <TableCell align="right">
                                      {mb.bytes < 1024 * 1024
                                        ? `${(mb.bytes / 1024).toFixed(1)} KB`
                                        : `${(mb.bytes / (1024 * 1024)).toFixed(1)} MB`}
                                    </TableCell>
                                  </TableRow>
                                )),
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    )}

                    {!metrics.rspamd && !metrics.delivery && !metrics.diskUsage && (
                      <Typography variant="body2" color="text.secondary">
                        No metrics available. Mail services may not be running in production mode.
                      </Typography>
                    )}

                    <Box>
                      <Button size="small" variant="text" onClick={() => void handleLoadMetrics()} disabled={metricsLoading}>
                        Refresh metrics
                      </Button>
                    </Box>
                  </Stack>
                )}
              </Collapse>
            </Stack>
          </Paper>

          {/* ---- Queue Management Panel ---- */}
          <Paper sx={{ p: 2.5, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={2}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                onClick={() => {
                  const next = !queueExpanded;
                  setQueueExpanded(next);
                  if (next && !queueData) void handleLoadQueue();
                }}
              >
                <QueueIcon color="primary" />
                <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                  Mail Queue
                </Typography>
                {queueExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={queueExpanded}>
                {queueLoading && <CircularProgress size={20} />}
                {!queueLoading && queueData && (
                  <Stack spacing={1.5}>
                    <Typography variant="body2">
                      {queueData.error
                        ? `Error: ${queueData.error}`
                        : queueData.total === 0
                          ? 'Mail queue is empty'
                          : `${queueData.total} message(s) in queue`}
                    </Typography>

                    {queueData.sample && queueData.sample.length > 0 && (
                      <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflow: 'auto' }}>
                        {queueData.sample.map((line, idx) => {
                          const queueIdMatch = line.match(/^([0-9A-Fa-f]+)\s/);
                          const queueId = queueIdMatch?.[1] || '';
                          return (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
                              <Typography variant="caption" sx={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}>
                                {line}
                              </Typography>
                              {queueId && (
                                <>
                                  <Tooltip title="Retry">
                                    <IconButton size="small" onClick={() => void handleRetryMessage(queueId)}>
                                      <ReplayIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => void handleDeleteMessage(queueId)} color="error">
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                            </Box>
                          );
                        })}
                      </Paper>
                    )}

                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => void handleLoadQueue()} disabled={queueBusy}>
                        Refresh
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => void handleFlushQueue()} disabled={queueBusy}>
                        Flush queue
                      </Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={() => void handlePurgeQueue()} disabled={queueBusy}>
                        Purge all
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Collapse>
            </Stack>
          </Paper>

          {/* ---- Mail Log Viewer Panel ---- */}
          <Paper sx={{ p: 2.5, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={2}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                onClick={() => {
                  const next = !logsViewExpanded;
                  setLogsViewExpanded(next);
                  if (next && mailLogs.length === 0) void handleLoadMailLogs();
                }}
              >
                <DescriptionIcon color="primary" />
                <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                  Mail Logs
                </Typography>
                {logsViewExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={logsViewExpanded}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      label="Search"
                      placeholder="Filter by keyword, email, etc."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                      sx={{ minWidth: 200 }}
                    />
                    <TextField
                      size="small"
                      label="Lines"
                      type="number"
                      value={logLines}
                      onChange={(e) => setLogLines(Math.min(1000, Math.max(10, parseInt(e.target.value, 10) || 100)))}
                      sx={{ width: 100 }}
                    />
                    <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => void handleLoadMailLogs()} disabled={mailLogsLoading}>
                      {mailLogsLoading ? 'Loading…' : 'Load'}
                    </Button>
                  </Stack>

                  {mailLogs.length > 0 && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        maxHeight: 400,
                        overflow: 'auto',
                        bgcolor: 'grey.900',
                        color: 'grey.100',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {mailLogs.map((line, idx) => (
                        <Box key={idx}>{line}</Box>
                      ))}
                    </Paper>
                  )}

                  {!mailLogsLoading && mailLogs.length === 0 && logsViewExpanded && (
                    <Typography variant="body2" color="text.secondary">
                      No log entries found. Logs may not be available in development mode.
                    </Typography>
                  )}
                </Stack>
              </Collapse>
            </Stack>
          </Paper>

          {/* ---- Backups Panel ---- */}
          <Paper sx={{ p: 2.5, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Stack spacing={2}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                onClick={() => {
                  const next = !backupsExpanded;
                  setBackupsExpanded(next);
                  if (next) void handleLoadBackups();
                }}
              >
                <BackupIcon color="primary" />
                <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                  Mailbox Backups
                </Typography>
                {backupsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={backupsExpanded}>
                <Stack spacing={1.5}>
                  {backupsLoading && <CircularProgress size={20} />}

                  {!backupsLoading && backups.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No backups found. Use the backup button on individual mailboxes to create one.
                    </Typography>
                  )}

                  {!backupsLoading && backups.length > 0 && (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Email</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Size</TableCell>
                            <TableCell align="right">File</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {backups.map((bk) => (
                            <TableRow key={bk.file}>
                              <TableCell>{bk.email}</TableCell>
                              <TableCell>{formatTimestamp(bk.timestamp.replace(/-/g, ':').replace(/T/, ' ').slice(0, 19))}</TableCell>
                              <TableCell align="right">
                                {bk.sizeBytes < 1024 * 1024
                                  ? `${(bk.sizeBytes / 1024).toFixed(1)} KB`
                                  : `${(bk.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                                  {bk.file}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  <Button size="small" variant="text" onClick={() => void handleLoadBackups()} disabled={backupsLoading}>
                    Refresh backups
                  </Button>
                </Stack>
              </Collapse>
            </Stack>
          </Paper>

          {feedback && (
            <Alert
              severity={feedback.type}
              iconMapping={{ success: <ShieldIcon fontSize="inherit" />, error: <ErrorOutlineIcon fontSize="inherit" /> }}
              onClose={() => setFeedback(null)}
            >
              {feedback.message}
            </Alert>
          )}

          {loading && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={28} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Loading mail domains…
              </Typography>
            </Paper>
          )}

          {!loading && !hasAnyDomains && (
            <Alert severity="info" icon={<MailOutlineIcon fontSize="inherit" />}>
              No mail domains are provisioned yet. Create a domain first to configure spam and virus policies.
            </Alert>
          )}

          {!loading && hasAnyDomains && (
            <Stack spacing={2}>
              {domains.map((domain) => {
                const draft = drafts[domain.id];
                const errors = fieldErrors[domain.id];
                const busy = Boolean(saving[domain.id]);
                const hasPending = Boolean(draft && Object.keys(draft).length > 0);
                const hasErrors = Boolean(errors && Object.keys(errors).length > 0);

                const spamValue = getNumericDisplayValue(domain, draft, 'spamThreshold');
                const delayValue = getNumericDisplayValue(domain, draft, 'greylistingDelaySeconds');
                const greylisting = getBooleanDisplayValue(domain, draft, 'greylistingEnabled');
                const virusScan = getBooleanDisplayValue(domain, draft, 'virusScanEnabled');
                const expandedLogs = logsExpanded[domain.id] ?? false;
                const logsBusy = Boolean(logsLoading[domain.id]);
                const logsForDomain = domainLogs[domain.id];
                const logsError = logsErrors[domain.id];
                const mailboxForm = mailboxForms[domain.id] ?? { ...defaultMailboxFormState };
                const mailboxFormError = mailboxFormErrors[domain.id];
                const createMailboxBusy = Boolean(mailboxBusy[domain.id]);
                const aliasForm = aliasForms[domain.id] ?? { ...defaultAliasFormState };
                const aliasFormError = aliasFormErrors[domain.id];
                const createAliasBusy = Boolean(aliasBusy[domain.id]);

                return (
                  <Paper key={domain.id} sx={{ p: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <MailOutlineIcon color="primary" />
                          <Typography variant="h6" fontWeight={600}>
                            {domain.domain}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" color={domain.enabled ? 'success' : 'default'} label={domain.enabled ? 'Active' : 'Disabled'} />
                          <Chip size="small" variant="outlined" label={`Mailboxes ${domain.mailboxes.length}`} />
                          <Chip size="small" variant="outlined" label={`Aliases ${domain.aliases.length}`} />
                        </Stack>
                      </Box>

                      <Divider />

                      <Box
                        sx={{
                          display: 'grid',
                          gap: 2,
                          gridTemplateColumns: {
                            xs: 'repeat(1, minmax(0, 1fr))',
                            md: 'repeat(2, minmax(0, 1fr))',
                          },
                        }}
                      >
                        <Stack spacing={1}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Spam Threshold (0-20)
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            value={spamValue}
                            onChange={handleNumericChange(domain, 'spamThreshold')}
                            inputProps={{ min: SPAM_THRESHOLD_MIN, max: SPAM_THRESHOLD_MAX, step: SPAM_THRESHOLD_STEP }}
                            error={Boolean(errors?.spamThreshold)}
                            helperText={
                              errors?.spamThreshold ||
                              `Lower values reject more mail. Current: ${domain.spamThreshold ?? 'default'}.`
                            }
                          />
                        </Stack>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Greylisting Delay (seconds)
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            value={delayValue}
                            onChange={handleNumericChange(domain, 'greylistingDelaySeconds')}
                            inputProps={{ min: GREYLIST_DELAY_MIN, max: GREYLIST_DELAY_MAX, step: 1 }}
                            error={Boolean(errors?.greylistingDelaySeconds)}
                            helperText={
                              errors?.greylistingDelaySeconds ||
                              `Delay before accepting new senders. Current: ${domain.greylistingDelaySeconds ?? 'default'}s.`
                            }
                          />
                        </Stack>
                        <Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={greylisting}
                                onChange={handleToggle(domain, 'greylistingEnabled')}
                                color="primary"
                              />
                            }
                            label={greylisting ? 'Greylisting enabled' : 'Greylisting disabled'}
                          />
                        </Box>
                        <Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={virusScan}
                                onChange={handleToggle(domain, 'virusScanEnabled')}
                                color="primary"
                              />
                            }
                            label={virusScan ? 'Virus scanning enabled' : 'Virus scanning disabled'}
                          />
                        </Box>
                      </Box>

                      <Divider />

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleSave(domain)}
                            disabled={!hasPending || hasErrors || busy}
                          >
                            {busy ? 'Saving…' : 'Save changes'}
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleDiscardChanges(domain.id)}
                            disabled={!hasPending || busy}
                          >
                            Discard
                          </Button>
                        </Stack>
                        <Button
                          size="small"
                          color="secondary"
                          onClick={() => handleResetDefaults(domain)}
                          disabled={busy}
                        >
                          Restore defaults on save
                        </Button>
                      </Stack>

                      <Divider />

                      {/* DNS Suggestions & DKIM */}
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => { void handleToggleDns(domain); }}
                          startIcon={<DnsIcon fontSize="small" />}
                          endIcon={dnsExpanded[domain.id] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {dnsExpanded[domain.id] ? 'Hide DNS records' : 'View DNS records'}
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => { void handleRotateDkim(domain); }}
                          startIcon={<VpnKeyIcon fontSize="small" />}
                          disabled={Boolean(dkimBusy[domain.id])}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {dkimBusy[domain.id] ? 'Rotating…' : 'Rotate DKIM key'}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => { void handlePublishDns(domain.id, domain.domain); }}
                          startIcon={<PublishIcon fontSize="small" />}
                          disabled={Boolean(publishBusy[domain.id])}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {publishBusy[domain.id] ? 'Publishing…' : 'Publish to DNS'}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { void handleCheckPropagation(domain.id); }}
                          disabled={Boolean(propagationBusy[domain.id])}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {propagationBusy[domain.id] ? 'Checking…' : 'Check DNS Propagation'}
                        </Button>
                      </Stack>

                      {/* DNS Propagation Results */}
                      {propagationResults[domain.id] && (
                        <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
                          <Stack spacing={0.5}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {propagationResults[domain.id]!.allPropagated ? (
                                <CloudDoneIcon color="success" fontSize="small" />
                              ) : (
                                <CloudOffIcon color="warning" fontSize="small" />
                              )}
                              <Typography variant="body2" fontWeight={600}>
                                {propagationResults[domain.id]!.allPropagated
                                  ? 'All DNS records propagated'
                                  : 'Some records have not propagated yet'}
                              </Typography>
                            </Stack>
                            {propagationResults[domain.id]!.results.map((r, idx) => (
                              <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ pl: 2 }}>
                                {r.match ? (
                                  <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
                                ) : (
                                  <CancelIcon color="error" sx={{ fontSize: 16 }} />
                                )}
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                  {r.record.type} {r.record.name}
                                </Typography>
                                {!r.match && r.actual.length > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    (found: {r.actual.join(', ')})
                                  </Typography>
                                )}
                                {!r.match && r.actual.length === 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    (not found)
                                  </Typography>
                                )}
                              </Stack>
                            ))}
                          </Stack>
                        </Paper>
                      )}
                      <Collapse in={dnsExpanded[domain.id] ?? false} timeout="auto" unmountOnExit>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                          {dnsLoading[domain.id] ? (
                            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                              <CircularProgress size={18} />
                              <Typography variant="body2" color="text.secondary">
                                Loading DNS suggestions…
                              </Typography>
                            </Stack>
                          ) : dnsErrors[domain.id] ? (
                            <Alert severity="error">{dnsErrors[domain.id]}</Alert>
                          ) : dnsRecords[domain.id] && dnsRecords[domain.id].length > 0 ? (
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                                    {dnsRecords[domain.id].some((r) => r.priority !== undefined) && (
                                      <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                                    )}
                                    <TableCell sx={{ width: 40 }} />
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {dnsRecords[domain.id].map((record, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>
                                        <Chip size="small" label={record.type} variant="outlined" />
                                      </TableCell>
                                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                        {record.name}
                                      </TableCell>
                                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', maxWidth: 400 }}>
                                        {record.value}
                                      </TableCell>
                                      {dnsRecords[domain.id].some((r) => r.priority !== undefined) && (
                                        <TableCell>{record.priority ?? '—'}</TableCell>
                                      )}
                                      <TableCell>
                                        <Tooltip title="Copy value">
                                          <IconButton
                                            size="small"
                                            onClick={() => { void navigator.clipboard.writeText(record.value); }}
                                          >
                                            <ContentCopyIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No DNS records available for this domain.
                            </Typography>
                          )}
                        </Paper>
                      </Collapse>

                      <Divider />

                      <Stack spacing={1}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            void handleToggleLogs(domain);
                          }}
                          startIcon={<HistoryIcon fontSize="small" />}
                          endIcon={expandedLogs ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          disabled={logsBusy && !expandedLogs}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {expandedLogs ? 'Hide automation logs' : 'View automation logs'}
                        </Button>
                        <Collapse in={expandedLogs} timeout="auto" unmountOnExit>
                          <Paper variant="outlined" sx={{ mt: 1, p: 2, bgcolor: 'background.default' }}>
                            {logsBusy ? (
                              <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                                <CircularProgress size={18} />
                                <Typography variant="body2" color="text.secondary">
                                  Loading automation history…
                                </Typography>
                              </Stack>
                            ) : logsError ? (
                              <Alert severity="error" sx={{ mb: 0 }}>
                                {logsError}
                              </Alert>
                            ) : logsForDomain && logsForDomain.length > 0 ? (
                              <Stack spacing={1.5}>
                                {logsForDomain.map((log) => (
                                  <Box
                                    key={log.id}
                                    sx={{
                                      border: (theme) => `1px solid ${theme.palette.divider}`,
                                      borderRadius: 1,
                                      p: 1.5,
                                    }}
                                  >
                                    <Stack
                                      direction="row"
                                      alignItems="center"
                                      justifyContent="space-between"
                                      spacing={1}
                                      sx={{ mb: 0.5 }}
                                    >
                                      <Typography variant="subtitle2" fontWeight={600} sx={{ mr: 1 }}>
                                        {log.task}
                                      </Typography>
                                      <Chip
                                        size="small"
                                        color={log.success ? 'success' : 'error'}
                                        label={log.success ? 'Success' : 'Failed'}
                                      />
                                    </Stack>
                                    {log.message && (
                                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                                        {log.message}
                                      </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                      {formatTimestamp(log.executedAt)} • {formatScopeLabel(log.scope)}
                                      {log.target ? ` • ${log.target}` : ''}
                                    </Typography>
                                    {log.detail && (
                                      <Box
                                        component="pre"
                                        sx={{
                                          mt: 1,
                                          p: 1,
                                          borderRadius: 1,
                                          border: (theme) => `1px dashed ${theme.palette.divider}`,
                                          bgcolor: 'background.paper',
                                          fontFamily: 'monospace',
                                          fontSize: '0.75rem',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word',
                                          m: 0,
                                        }}
                                      >
                                        {log.detail}
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                              </Stack>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No automation runs recorded yet for this domain.
                              </Typography>
                            )}
                          </Paper>
                        </Collapse>
                      </Stack>

                      <Divider />

                      <Box>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Typography variant="subtitle1" fontWeight={600}>
                            Mailboxes
                          </Typography>
                          <Chip size="small" variant="outlined" label={`${domain.mailboxes.length} total`} />
                        </Stack>

                        {domain.mailboxes.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            No mailboxes configured yet.
                          </Typography>
                        ) : (
                          <Stack spacing={1.5} sx={{ mt: 1 }}>
                            {domain.mailboxes.map((mailbox) => {
                              const mailboxBusyState = Boolean(mailboxRowBusy[mailbox.id]);
                              return (
                                <Box
                                  key={mailbox.id}
                                  sx={{
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                    borderRadius: 1,
                                    p: 1.5,
                                    bgcolor: 'background.paper',
                                  }}
                                >
                                  <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                  >
                                    <Box>
                                      <Typography variant="body1" fontWeight={600}>
                                        {mailbox.email}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {mailbox.active ? 'Active' : 'Inactive'} • Quota:
                                        {mailbox.quotaMb !== undefined && mailbox.quotaMb !== null
                                          ? ` ${mailbox.quotaMb} MB`
                                          : ' Unlimited'}
                                        {mailbox.createdAt ? ` • Created ${formatTimestamp(mailbox.createdAt)}` : ''}
                                        {mailbox.updatedAt ? ` • Updated ${formatTimestamp(mailbox.updatedAt)}` : ''}
                                      </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => openMailboxDialog(domain, mailbox)}
                                        disabled={mailboxBusyState}
                                      >
                                        Edit
                                      </Button>
                                      <Tooltip title="Open Roundcube webmail as this mailbox (SSO)">
                                        <span>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                            startIcon={<OpenInNewIcon fontSize="small" />}
                                            onClick={() => void handleOpenWebmail(domain.id, mailbox.id)}
                                            disabled={!mailbox.active || Boolean(ssoBusy[`${domain.id}-${mailbox.id}`]) || mailboxBusyState}
                                          >
                                            {ssoBusy[`${domain.id}-${mailbox.id}`] ? 'Opening…' : 'Webmail'}
                                          </Button>
                                        </span>
                                      </Tooltip>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<BackupIcon fontSize="small" />}
                                        onClick={() => void handleBackupMailbox(domain.id, mailbox.id, mailbox.email)}
                                        disabled={Boolean(backupBusy[`${domain.id}-${mailbox.id}`]) || mailboxBusyState}
                                      >
                                        {backupBusy[`${domain.id}-${mailbox.id}`] ? 'Backing up…' : 'Backup'}
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => handleRemoveMailbox(domain, mailbox)}
                                        disabled={mailboxBusyState}
                                      >
                                        {mailboxBusyState ? 'Removing…' : 'Remove'}
                                      </Button>
                                    </Stack>
                                  </Stack>
                                  <SieveFiltersPanel
                                    domainId={domain.id}
                                    mailbox={mailbox}
                                    onFeedback={(type, message) => setFeedback({ type, message })}
                                  />
                                </Box>
                              );
                            })}
                          </Stack>
                        )}

                        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Add mailbox
                          </Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
                            <TextField
                              label="Mailbox"
                              value={mailboxForm.localPart}
                              onChange={(event) => setMailboxFormValue(domain.id, 'localPart', event.target.value)}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">@{domain.domain}</InputAdornment>,
                              }}
                              helperText="Leave off @domain to append automatically."
                              size="small"
                            />
                            <TextField
                              label="Password"
                              type="password"
                              value={mailboxForm.password}
                              onChange={(event) => setMailboxFormValue(domain.id, 'password', event.target.value)}
                              size="small"
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        const generated = generateStrongPassword();
                                        setMailboxFormValue(domain.id, 'password', generated);
                                        setMailboxFormErrors((prev) => {
                                          if (!prev[domain.id]) return prev;
                                          const clone = { ...prev };
                                          delete clone[domain.id];
                                          return clone;
                                        });
                                      }}
                                    >
                                      Generate
                                    </Button>
                                  </InputAdornment>
                                ),
                              }}
                            />
                            <TextField
                              label="Quota (MB)"
                              type="number"
                              value={mailboxForm.quotaMb}
                              onChange={(event) => setMailboxFormValue(domain.id, 'quotaMb', event.target.value)}
                              helperText="Optional — leave blank for unlimited"
                              size="small"
                              inputProps={{ min: 0, step: 1 }}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleCreateMailbox(domain)}
                              disabled={createMailboxBusy}
                            >
                              {createMailboxBusy ? 'Creating…' : 'Create mailbox'}
                            </Button>
                          </Stack>
                          {mailboxFormError && (
                            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                              {mailboxFormError}
                            </Typography>
                          )}
                        </Paper>
                      </Box>

                      <Divider />

                      {/* Rate Limiting */}
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <SpeedIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>
                            Sending Rate Limits
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => void handleLoadRateLimits(domain.id)}
                          >
                            Load
                          </Button>
                        </Stack>

                        {rateLimits[domain.id] && rateLimits[domain.id].length > 0 && (
                          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                            {rateLimits[domain.id].map((rl, idx) => (
                              <Typography key={idx} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                                {rl.email === '*' ? `@${domain.domain}` : rl.email}: {rl.limit}/hour
                              </Typography>
                            ))}
                          </Stack>
                        )}

                        <Stack direction="row" spacing={1} alignItems="flex-end">
                          <TextField
                            size="small"
                            label="Email or *"
                            value={rateLimitForm[domain.id]?.email || ''}
                            onChange={(e) => setRateLimitForm((prev) => ({
                              ...prev,
                              [domain.id]: { ...prev[domain.id], email: e.target.value, limit: prev[domain.id]?.limit || '' },
                            }))}
                            placeholder="user@domain or *"
                            sx={{ minWidth: 180 }}
                          />
                          <TextField
                            size="small"
                            label="Msgs/hour"
                            type="number"
                            value={rateLimitForm[domain.id]?.limit || ''}
                            onChange={(e) => setRateLimitForm((prev) => ({
                              ...prev,
                              [domain.id]: { ...prev[domain.id], email: prev[domain.id]?.email || '', limit: e.target.value },
                            }))}
                            sx={{ width: 120 }}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void handleSetupRateLimit(domain.id)}
                            disabled={Boolean(rateLimitBusy[domain.id])}
                          >
                            {rateLimitBusy[domain.id] ? 'Setting…' : 'Set limit'}
                          </Button>
                        </Stack>
                      </Box>

                      <Divider />

                      {/* Catch-All */}
                      <CatchAllPanel
                        domain={domain}
                        onDomainUpdate={(updated) => setDomains((prev) => prev.map((d) => d.id === updated.id ? updated : d))}
                        onFeedback={(type, message) => setFeedback({ type, message })}
                      />

                      <Divider />

                      {/* DMARC Reports */}
                      <DmarcReportsPanel
                        domainId={domain.id}
                        domainName={domain.domain}
                        onFeedback={(type, message) => setFeedback({ type, message })}
                      />

                      <Divider />

                      <Box>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Typography variant="subtitle1" fontWeight={600}>
                            Aliases
                          </Typography>
                          <Chip size="small" variant="outlined" label={`${domain.aliases.length} total`} />
                        </Stack>

                        {domain.aliases.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            No aliases configured yet.
                          </Typography>
                        ) : (
                          <Stack spacing={1.5} sx={{ mt: 1 }}>
                            {domain.aliases.map((alias) => {
                              const aliasBusyState = Boolean(aliasRowBusy[alias.id]);
                              return (
                                <Box
                                  key={alias.id}
                                  sx={{
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                    borderRadius: 1,
                                    p: 1.5,
                                    bgcolor: 'background.paper',
                                  }}
                                >
                                  <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                  >
                                    <Box>
                                      <Typography variant="body1" fontWeight={600}>
                                        {alias.source} → {alias.destination}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Created {formatTimestamp(alias.createdAt)}
                                        {alias.updatedAt ? ` • Updated ${formatTimestamp(alias.updatedAt)}` : ''}
                                      </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => openAliasDialog(domain, alias)}
                                        disabled={aliasBusyState}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => handleRemoveAlias(domain, alias)}
                                        disabled={aliasBusyState}
                                      >
                                        {aliasBusyState ? 'Removing…' : 'Remove'}
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}

                        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Add alias
                          </Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
                            <TextField
                              label="Alias"
                              value={aliasForm.source}
                              onChange={(event) => setAliasFormValue(domain.id, 'source', event.target.value)}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">@{domain.domain}</InputAdornment>,
                              }}
                              helperText="Leave off @domain to append automatically."
                              size="small"
                            />
                            <TextField
                              label="Destination"
                              value={aliasForm.destination}
                              onChange={(event) => setAliasFormValue(domain.id, 'destination', event.target.value)}
                              helperText="Forward mail to this address"
                              size="small"
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleCreateAlias(domain)}
                              disabled={createAliasBusy}
                            >
                              {createAliasBusy ? 'Creating…' : 'Create alias'}
                            </Button>
                          </Stack>
                          {aliasFormError && (
                            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                              {aliasFormError}
                            </Typography>
                          )}
                        </Paper>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Box>
      <Dialog
        open={Boolean(mailboxDialog && activeMailbox)}
        onClose={() => closeMailboxDialog()}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit mailbox</DialogTitle>
        <DialogContent dividers>
          {activeMailbox && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {activeMailbox.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current quota:
                  {activeMailbox.quotaMb !== undefined && activeMailbox.quotaMb !== null
                    ? ` ${activeMailbox.quotaMb} MB`
                    : ' Unlimited'}
                </Typography>
              </Box>
              <TextField
                label="New password"
                type="password"
                value={mailboxEditForm.password}
                onChange={(event) =>
                  setMailboxEditForm((prev) => ({ ...prev, password: event.target.value }))
                }
                helperText="Leave blank to keep current password"
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => {
                          const generated = generateStrongPassword();
                          setMailboxEditForm((prev) => ({ ...prev, password: generated }));
                          setMailboxEditError(null);
                        }}
                      >
                        Generate
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Quota (MB)"
                type="number"
                value={mailboxEditForm.quotaMb}
                onChange={(event) =>
                  setMailboxEditForm((prev) => ({ ...prev, quotaMb: event.target.value }))
                }
                disabled={mailboxEditForm.clearQuota}
                helperText={mailboxEditForm.clearQuota ? 'Quota will be removed' : 'Provide a positive integer'}
                inputProps={{ min: 0, step: 1 }}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={mailboxEditForm.clearQuota}
                    onChange={(event) =>
                      setMailboxEditForm((prev) => ({
                        ...prev,
                        clearQuota: event.target.checked,
                        quotaMb: event.target.checked ? '' : prev.quotaMb,
                      }))
                    }
                  />
                }
                label="Remove quota limit"
              />
              {mailboxEditError && (
                <Typography variant="body2" color="error">
                  {mailboxEditError}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeMailboxDialog()} disabled={mailboxEditBusy}>
            Cancel
          </Button>
          <Button onClick={() => void handleUpdateMailbox()} disabled={mailboxEditBusy} variant="contained">
            {mailboxEditBusy ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(aliasDialog && activeAlias)}
        onClose={() => closeAliasDialog()}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit alias</DialogTitle>
        <DialogContent dividers>
          {activeAlias && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {activeAlias.source}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current destination: {activeAlias.destination}
                </Typography>
              </Box>
              <TextField
                label="New destination"
                value={aliasEditForm.destination}
                onChange={(event) => setAliasEditForm({ destination: event.target.value })}
                helperText="Provide a full email address"
                fullWidth
              />
              {aliasEditError && (
                <Typography variant="body2" color="error">
                  {aliasEditError}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeAliasDialog()} disabled={aliasEditBusy}>
            Cancel
          </Button>
          <Button onClick={() => void handleUpdateAlias()} disabled={aliasEditBusy} variant="contained">
            {aliasEditBusy ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

    </DashboardLayout>
  );
}
