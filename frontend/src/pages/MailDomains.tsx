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
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { DashboardLayout } from '../layouts/dashboard/layout';
import {
  AutomationLog,
  DomainSettingsUpdate,
  MailAutomationHistoryRecord,
  MailDomain,
  MailDomainResult,
  MailboxSummary,
  MailAliasSummary,
  UpdateMailboxPayload,
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
                Mail Domain Policies
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Adjust spam and malware enforcement for each hosted mail domain
              </Typography>
            </Box>
          </Box>

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
