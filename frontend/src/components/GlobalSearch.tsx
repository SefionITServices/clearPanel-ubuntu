/**
 * GlobalSearch — keyboard-navigable spotlight search for ClearPanel.
 *
 * Sources queried (once per browser session, cached in module scope):
 *   • Pages       — all navigation routes (static, instant)
 *   • Domains     — /api/domains
 *   • Databases   — /api/database/list
 *   • SSL certs   — /api/ssl/certificates
 *   • DNS zones   — /api/dns/zones
 *   • Apps        — /api/app-store/apps  (installed only)
 *
 * UX: type to filter, ↑↓ to move, Enter / click to navigate, Esc to close.
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Popper,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  InputBase,
  alpha,
  Chip,
  CircularProgress,
  Fade,
  ClickAwayListener,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import LanguageIcon from '@mui/icons-material/Language';
import DnsIcon from '@mui/icons-material/Dns';
import LockIcon from '@mui/icons-material/Lock';
import StorageIcon from '@mui/icons-material/Storage';
import CodeIcon from '@mui/icons-material/Code';
import EmailIcon from '@mui/icons-material/Email';
import TerminalIcon from '@mui/icons-material/Terminal';
import BuildIcon from '@mui/icons-material/Build';
import CloudIcon from '@mui/icons-material/Cloud';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShieldIcon from '@mui/icons-material/Shield';
import BackupIcon from '@mui/icons-material/Backup';
import SecurityIcon from '@mui/icons-material/Security';
import MemoryIcon from '@mui/icons-material/Memory';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArticleIcon from '@mui/icons-material/Article';
import KeyIcon from '@mui/icons-material/Key';
import AppsIcon from '@mui/icons-material/Apps';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultCategory = 'Pages' | 'Domains' | 'Databases' | 'SSL' | 'DNS' | 'Apps';

interface SearchResult {
  id: string;
  category: ResultCategory;
  title: string;
  subtitle?: string;
  path: string;
  icon: React.ReactNode;
}

// ─── Static page catalogue ────────────────────────────────────────────────────

const ALL_PAGES: SearchResult[] = [
  { id: 'p-dashboard',     category: 'Pages', title: 'Dashboard',        path: '/dashboard',      icon: <DashboardIcon /> },
  { id: 'p-files',         category: 'Pages', title: 'File Manager',     path: '/files',          icon: <FolderIcon /> },
  { id: 'p-terminal',      category: 'Pages', title: 'Terminal',         path: '/terminal',       icon: <TerminalIcon /> },
  { id: 'p-domains',       category: 'Pages', title: 'Domains',          path: '/domains',        icon: <LanguageIcon /> },
  { id: 'p-dns',           category: 'Pages', title: 'DNS Editor',       path: '/dns',            icon: <DnsIcon /> },
  { id: 'p-nameservers',   category: 'Pages', title: 'Nameservers',      path: '/nameservers',    icon: <DnsIcon /> },
  { id: 'p-ssl',           category: 'Pages', title: 'SSL Certificates', path: '/ssl',            icon: <LockIcon /> },
  { id: 'p-webserver',     category: 'Pages', title: 'Web Server',       path: '/webserver',      icon: <CloudIcon /> },
  { id: 'p-php',           category: 'Pages', title: 'PHP Manager',      path: '/php',            icon: <CodeIcon /> },
  { id: 'p-databases',     category: 'Pages', title: 'Databases',        path: '/databases',      icon: <StorageIcon /> },
  { id: 'p-email',         category: 'Pages', title: 'Email Hub',        path: '/email',          icon: <EmailIcon /> },
  { id: 'p-mail-domains',  category: 'Pages', title: 'Mail Domains',     path: '/mail-domains',   icon: <EmailIcon /> },
  { id: 'p-email-accts',   category: 'Pages', title: 'Email Accounts',   path: '/email-accounts', icon: <EmailIcon /> },
  { id: 'p-forwarders',    category: 'Pages', title: 'Email Forwarders', path: '/forwarders',     icon: <EmailIcon /> },
  { id: 'p-email-filters', category: 'Pages', title: 'Email Filters',    path: '/email-filters',  icon: <EmailIcon /> },
  { id: 'p-app-store',     category: 'Pages', title: 'App Store',        path: '/app-store',      icon: <AppsIcon /> },
  { id: 'p-logs',          category: 'Pages', title: 'Logs',             path: '/logs',           icon: <ArticleIcon /> },
  { id: 'p-ssh-keys',      category: 'Pages', title: 'SSH Keys',         path: '/ssh-keys',       icon: <KeyIcon /> },
  { id: 'p-cron-jobs',     category: 'Pages', title: 'Cron Jobs',        path: '/cron-jobs',      icon: <ScheduleIcon /> },
  { id: 'p-firewall',      category: 'Pages', title: 'Firewall',         path: '/firewall',       icon: <ShieldIcon /> },
  { id: 'p-monitoring',    category: 'Pages', title: 'Monitoring',       path: '/monitoring',     icon: <MonitorHeartIcon /> },
  { id: 'p-backup',        category: 'Pages', title: 'Backup',           path: '/backup',         icon: <BackupIcon /> },
  { id: 'p-two-factor',    category: 'Pages', title: 'Two-Factor Auth',  path: '/two-factor',     icon: <SecurityIcon /> },
  { id: 'p-processes',     category: 'Pages', title: 'Processes',        path: '/processes',      icon: <MemoryIcon /> },
  { id: 'p-git',           category: 'Pages', title: 'Git',              path: '/git',            icon: <AccountTreeIcon /> },
  { id: 'p-ftp',           category: 'Pages', title: 'FTP Manager',      path: '/ftp',            icon: <CloudUploadIcon /> },
  { id: 'p-tools',         category: 'Pages', title: 'Tools',            path: '/tools',          icon: <BuildIcon /> },
  { id: 'p-settings',      category: 'Pages', title: 'Settings',         path: '/settings',       icon: <StorageIcon /> },
].map((p) => ({ ...p, subtitle: p.path, category: p.category as ResultCategory }));

// ─── Module-level cache (survives re-renders, cleared on page reload) ─────────

type DataCache = {
  fetched: boolean;
  loading: boolean;
  domains: SearchResult[];
  databases: SearchResult[];
  ssl: SearchResult[];
  dns: SearchResult[];
  apps: SearchResult[];
};

const cache: DataCache = {
  fetched: false,
  loading: false,
  domains: [],
  databases: [],
  ssl: [],
  dns: [],
  apps: [],
};

// Listeners that want to be notified when the cache is populated
const cacheListeners = new Set<() => void>();

async function fetchAllData() {
  if (cache.fetched || cache.loading) return;
  cache.loading = true;

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const [domains, databases, ssl, dns, apps] = await Promise.all([
    safe(() => fetch('/api/domains', { credentials: 'include' }).then((r) => r.json()), []),
    safe(() => fetch('/api/database/list', { credentials: 'include' }).then((r) => r.json()), []),
    safe(() => fetch('/api/ssl/certificates', { credentials: 'include' }).then((r) => r.json()), []),
    safe(() => fetch('/api/dns/zones', { credentials: 'include' }).then((r) => r.json()), []),
    safe(() => fetch('/api/app-store/apps', { credentials: 'include' }).then((r) => r.json()), []),
  ]);

  // Normalise domains  (array of { id, name, folderPath, … })
  cache.domains = (Array.isArray(domains) ? domains : []).map((d: any) => ({
    id:       `domain-${d.id || d.name}`,
    category: 'Domains' as ResultCategory,
    title:    d.name || d.id,
    subtitle: d.folderPath || '/var/www/' + (d.name || ''),
    path:     '/domains',
    icon:     <LanguageIcon />,
  }));

  // Normalise databases (array of strings or objects { name, engine })
  cache.databases = (Array.isArray(databases) ? databases : []).map((d: any) => {
    const name   = typeof d === 'string' ? d : d.name;
    const engine = typeof d === 'object' ? d.engine : '';
    return {
      id:       `db-${name}`,
      category: 'Databases' as ResultCategory,
      title:    name,
      subtitle: engine ? `${engine} database` : 'Database',
      path:     '/databases',
      icon:     <StorageIcon />,
    };
  });

  // Normalise SSL certs (array of { domain, expiresAt, … })
  cache.ssl = (Array.isArray(ssl) ? ssl : []).map((c: any) => ({
    id:       `ssl-${c.domain || c.name}`,
    category: 'SSL' as ResultCategory,
    title:    c.domain || c.name || 'Certificate',
    subtitle: c.expiresAt ? `Expires ${new Date(c.expiresAt).toLocaleDateString()}` : 'SSL certificate',
    path:     '/ssl',
    icon:     <LockIcon />,
  }));

  // Normalise DNS zones (array of strings or { domain, records })
  cache.dns = (Array.isArray(dns) ? dns : []).map((z: any) => {
    const domain = typeof z === 'string' ? z : z.domain || z.name;
    return {
      id:       `dns-${domain}`,
      category: 'DNS' as ResultCategory,
      title:    domain,
      subtitle: 'DNS zone',
      path:     `/dns?zone=${encodeURIComponent(domain)}`,
      icon:     <DnsIcon />,
    };
  });

  // Normalise apps (only installed/recommended ones worth showing)
  cache.apps = (Array.isArray(apps) ? apps : []).map((a: any) => ({
    id:       `app-${a.id || a.name}`,
    category: 'Apps' as ResultCategory,
    title:    a.name || a.id,
    subtitle: a.installed ? 'Installed' : 'Available in App Store',
    path:     '/app-store',
    icon:     <AppsIcon />,
  }));

  cache.fetched = true;
  cache.loading = false;
  cacheListeners.forEach((fn) => fn());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: ResultCategory[] = ['Pages', 'Domains', 'Databases', 'SSL', 'DNS', 'Apps'];

// Max results per category to keep the list compact
const MAX_PER_CATEGORY: Record<ResultCategory, number> = {
  Pages:     5,
  Domains:   4,
  Databases: 4,
  SSL:       3,
  DNS:       3,
  Apps:      3,
};

function scoreMatch(item: SearchResult, q: string): number {
  const t = item.title.toLowerCase();
  const s = (item.subtitle || '').toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;
  if (s.includes(q)) return 40;
  return 0;
}

/** Highlight matching substring inside `text`. Returns React element or null. */
function Highlight({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="mark" sx={{ bgcolor: 'warning.light', color: 'inherit', borderRadius: 0.5, px: 0.25 }}>
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery]               = useState('');
  const [open, setOpen]                 = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [cacheVersion, setCacheVersion] = useState(0);    // bump to re-render on cache update

  const inputRef    = useRef<HTMLInputElement>(null);
  const anchorRef   = useRef<HTMLDivElement>(null);
  const listRef     = useRef<HTMLUListElement>(null);

  // Subscribe to cache updates so results appear without re-typing
  useEffect(() => {
    const bump = () => setCacheVersion((v) => v + 1);
    cacheListeners.add(bump);
    return () => { cacheListeners.delete(bump); };
  }, []);

  // Kick off a background fetch when the user focuses the input
  const handleFocus = useCallback(() => {
    setOpen(true);
    fetchAllData();
  }, []);

  // Compute filtered, scored, grouped results
  const results: SearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const all = [
      ...ALL_PAGES,
      ...cache.domains,
      ...cache.databases,
      ...cache.ssl,
      ...cache.dns,
      ...cache.apps,
    ];

    // Score and filter
    const scored = all
      .map((item) => ({ item, score: scoreMatch(item, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // Group + truncate per category
    const countPerCategory: Partial<Record<ResultCategory, number>> = {};
    const out: SearchResult[] = [];
    for (const { item } of scored) {
      const count = countPerCategory[item.category] ?? 0;
      const max   = MAX_PER_CATEGORY[item.category];
      if (count < max) {
        out.push(item);
        countPerCategory[item.category] = count + 1;
      }
    }

    // Re-sort in category display order (stable)
    out.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
    return out;
  }, [query, cacheVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset active index when results list changes
  useEffect(() => { setActiveIndex(-1); }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.path);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(results.length, 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
      return;
    }
    if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
      return;
    }
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[0]);
    }
  }, [open, results, activeIndex, handleSelect]);

  // Group results by category for section headers
  const grouped = useMemo(() => {
    const map = new Map<ResultCategory, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    return map;
  }, [results]);

  const showDropdown = open && query.trim().length > 0;
  const isLoading    = cache.loading;

  // Build flat index→result mapping matching the rendered order (for keyboard)
  const flatResults = useMemo(() => {
    const out: SearchResult[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = grouped.get(cat);
      if (items) out.push(...items);
    }
    return out;
  }, [grouped]);

  // Re-sync activeIndex to flatResults order
  useEffect(() => { setActiveIndex(-1); }, [flatResults]);

  return (
    <ClickAwayListener onClickAway={() => { setOpen(false); setActiveIndex(-1); }}>
      <Box ref={anchorRef} sx={{ position: 'relative', flexGrow: { sm: 1 }, maxWidth: { sm: 480 }, mr: 2, ml: { xs: 0, sm: 2 } }}>
        {/* ── Input ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.grey[500], 0.08),
            border: '1.5px solid',
            borderColor: open ? 'primary.main' : 'transparent',
            transition: 'border-color 0.15s',
            '&:hover': { bgcolor: (t) => alpha(t.palette.grey[500], 0.12) },
            px: 1.5,
            py: 0.5,
            width: '100%',
          }}
        >
          <SearchIcon sx={{ color: 'text.disabled', fontSize: 20, mr: 1, flexShrink: 0 }} />
          <InputBase
            inputRef={inputRef}
            value={query}
            placeholder="Search pages, domains, databases…"
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            sx={{
              flexGrow: 1,
              '& .MuiInputBase-input': {
                fontSize: '0.875rem',
                py: 0.5,
                '&::placeholder': { color: 'text.disabled', opacity: 1 },
              },
            }}
            inputProps={{ 'aria-label': 'global search', 'aria-autocomplete': 'list', 'aria-expanded': showDropdown }}
          />
          {isLoading && (
            <CircularProgress size={14} sx={{ ml: 1, flexShrink: 0, color: 'text.disabled' }} />
          )}
          {!isLoading && query && (
            <Typography
              variant="caption"
              sx={{
                ml: 1,
                px: 0.75,
                py: 0.25,
                bgcolor: (t) => alpha(t.palette.grey[500], 0.12),
                borderRadius: 1,
                color: 'text.disabled',
                fontSize: '0.7rem',
                flexShrink: 0,
                cursor: 'pointer',
                '&:hover': { color: 'text.secondary' },
              }}
              onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            >
              Esc
            </Typography>
          )}
        </Box>

        {/* ── Dropdown ── */}
        <Popper
          open={showDropdown}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          transition
          style={{ width: anchorRef.current?.offsetWidth ?? 'auto', zIndex: 1400 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={120}>
              <Paper
                elevation={8}
                sx={{
                  maxHeight: 440,
                  overflowY: 'auto',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  py: 0.75,
                }}
              >
                {/* No results */}
                {!isLoading && flatResults.length === 0 && (
                  <Box sx={{ px: 2.5, py: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No results for &ldquo;<strong>{query}</strong>&rdquo;
                    </Typography>
                  </Box>
                )}

                {/* Loading skeleton — cache not ready yet */}
                {isLoading && flatResults.length === 0 && (
                  <Box sx={{ px: 2.5, py: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Loading data…</Typography>
                  </Box>
                )}

                {/* Grouped results */}
                <List ref={listRef} disablePadding dense>
                  {CATEGORY_ORDER.map((cat) => {
                    const items = grouped.get(cat);
                    if (!items?.length) return null;
                    return (
                      <Box key={cat}>
                        <Typography
                          variant="overline"
                          sx={{
                            display: 'block',
                            px: 2,
                            pt: 1.25,
                            pb: 0.5,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'text.disabled',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {cat}
                        </Typography>
                        {items.map((result) => {
                          const flatIdx = flatResults.indexOf(result);
                          const isActive = flatIdx === activeIndex;
                          return (
                            <ListItemButton
                              key={result.id}
                              selected={isActive}
                              onClick={() => handleSelect(result)}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              sx={{
                                px: 2,
                                py: 0.75,
                                borderRadius: 0,
                                '&.Mui-selected': {
                                  bgcolor: (t) => alpha(t.palette.primary.main, 0.10),
                                  '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.14) },
                                },
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32, '& svg': { fontSize: 18 }, color: isActive ? 'primary.main' : 'text.secondary' }}>
                                {result.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Typography variant="body2" fontWeight={500} component="span">
                                    <Highlight text={result.title} query={query.trim()} />
                                  </Typography>
                                }
                                secondary={
                                  result.subtitle ? (
                                    <Typography variant="caption" color="text.secondary" component="span">
                                      <Highlight text={result.subtitle} query={query.trim()} />
                                    </Typography>
                                  ) : undefined
                                }
                              />
                              {cat === 'Pages' && (
                                <Chip
                                  label="page"
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.62rem', ml: 1, opacity: 0.55 }}
                                />
                              )}
                            </ListItemButton>
                          );
                        })}
                      </Box>
                    );
                  })}
                </List>

                {/* Footer hint */}
                {flatResults.length > 0 && (
                  <Box sx={{ px: 2, pt: 0.75, pb: 0.25, display: 'flex', gap: 1.5, borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }}>
                    <Typography variant="caption" color="text.disabled">↑↓ navigate</Typography>
                    <Typography variant="caption" color="text.disabled">↵ open</Typography>
                    <Typography variant="caption" color="text.disabled">Esc close</Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
