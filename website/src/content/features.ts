// Content: Feature categories and feature cards
// Source: docs/feature-analysis.md

export interface Feature {
    title: string;
    description: string;
    icon: string; // MUI icon name
}

export interface FeatureCategory {
    id: string;
    label: string;
    features: Feature[];
}

export const featureCategories: FeatureCategory[] = [
    {
        id: 'domain',
        label: 'Domain & Web',
        features: [
            {
                title: 'One-Click Domain Creation',
                description: 'Create domains instantly — clearPanel automatically creates the folder structure, configures Nginx virtual hosts, and provisions DNS zones.',
                icon: 'Language',
            },
            {
                title: 'Nginx Web Server Management',
                description: 'View status, manage virtual hosts, inspect configs, and control your Nginx web server from a clean UI.',
                icon: 'DnsOutlined',
            },
            {
                title: 'SSL Certificate Manager',
                description: 'Auto-issue and renew Let\'s Encrypt certificates or upload custom certificates. Pre-flight DNS checks catch issues before they happen.',
                icon: 'Lock',
            },
            {
                title: 'PHP Multi-Version Manager',
                description: 'Run PHP 7.4 through 8.4 side-by-side. Switch versions per domain, manage extensions, and edit php.ini directly in the UI.',
                icon: 'Code',
            },
            {
                title: 'Addon Domains & Subdomains',
                description: 'Add addon domains and subdomains with flexible path modes — all wired into Nginx automatically.',
                icon: 'AddCircleOutline',
            },
        ],
    },
    {
        id: 'dns',
        label: 'DNS & Nameservers',
        features: [
            {
                title: 'Authoritative BIND9 DNS Server',
                description: 'Run your VPS as its own authoritative nameserver. No dependency on Cloudflare, Route53, or your registrar for DNS.',
                icon: 'Router',
            },
            {
                title: 'Full DNS Record Management',
                description: 'Add, edit, and delete A, AAAA, CNAME, MX, TXT, SRV, and NS records with real-time zone updates.',
                icon: 'ListAlt',
            },
            {
                title: 'Custom Nameservers',
                description: 'Set up ns1/ns2 glue records for your domains — turn your VPS into a proper hosting infrastructure.',
                icon: 'SettingsEthernet',
            },
            {
                title: 'Automatic Zone Provisioning',
                description: 'Every domain you create gets a BIND9 zone file with SOA, NS, and A records auto-populated.',
                icon: 'AutoFixHigh',
            },
        ],
    },
    {
        id: 'email',
        label: 'Email Suite',
        features: [
            {
                title: 'Full Mail Stack',
                description: 'Postfix + Dovecot + Rspamd + ClamAV — a complete, enterprise-grade email stack provisioned automatically.',
                icon: 'Email',
            },
            {
                title: 'DKIM & DMARC Setup',
                description: 'Automatic DKIM key generation and DMARC policy configuration to maximize email deliverability.',
                icon: 'Verified',
            },
            {
                title: 'Email Account Management',
                description: 'Create and manage mailboxes with per-account quotas, view usage, and reset passwords.',
                icon: 'Inbox',
            },
            {
                title: 'Forwarders & Aliases',
                description: 'Set up email forwarders and aliases with per-domain filtering from the dashboard.',
                icon: 'Forward',
            },
            {
                title: 'Sieve Email Filters',
                description: 'Create Sieve rules to sort, redirect, or auto-respond to incoming email with built-in filter templates.',
                icon: 'FilterList',
            },
            {
                title: 'Roundcube Webmail + SSO',
                description: 'One-click Roundcube install from the App Store with Single Sign-On — no separate login required.',
                icon: 'MailOutline',
            },
        ],
    },
    {
        id: 'database',
        label: 'Database',
        features: [
            {
                title: 'Multi-Engine Database Support',
                description: 'Manage MySQL, MariaDB, and PostgreSQL databases through a single, unified interface.',
                icon: 'Storage',
            },
            {
                title: 'Database & User Management',
                description: 'Create databases, manage users, assign privileges, and drop databases in a few clicks.',
                icon: 'ManageAccounts',
            },
            {
                title: 'Built-In SQL Console',
                description: 'Execute SQL queries directly from your browser — no phpMyAdmin or separate client required.',
                icon: 'Terminal',
            },
            {
                title: 'Import & Export',
                description: 'Upload SQL dumps or export your databases for backup and migration.',
                icon: 'ImportExport',
            },
            {
                title: 'phpMyAdmin Integration',
                description: 'Install phpMyAdmin from the App Store for familiar database administration.',
                icon: 'TableChart',
            },
        ],
    },
    {
        id: 'files',
        label: 'File Management',
        features: [
            {
                title: 'Full-Featured File Manager',
                description: 'Browse, upload, download, rename, and delete files across all your domain folders with breadcrumb navigation.',
                icon: 'FolderOpen',
            },
            {
                title: 'Monaco Code Editor',
                description: 'Edit configuration files, PHP scripts, and HTML directly in the browser with VS Code-grade syntax highlighting.',
                icon: 'Edit',
            },
            {
                title: 'Archive Management',
                description: 'Create ZIP/TAR archives and extract them directly on the server — full archive operations without SSH.',
                icon: 'Archive',
            },
            {
                title: 'Drag-and-Drop Upload',
                description: 'Upload files up to 100MB by dragging them into the file manager. No FTP client needed.',
                icon: 'Upload',
            },
            {
                title: 'File Search & Permissions',
                description: 'Search across directories, change file permissions (chmod), and create symbolic links from the UI.',
                icon: 'Search',
            },
        ],
    },
    {
        id: 'security',
        label: 'Security',
        features: [
            {
                title: 'Two-Factor Authentication (TOTP)',
                description: 'Protect admin access with TOTP 2FA. Set up via QR code, receive 8 emergency recovery codes.',
                icon: 'Security',
            },
            {
                title: 'bcrypt Password Hashing',
                description: 'Admin credentials are hashed with bcrypt — never stored in plaintext.',
                icon: 'Key',
            },
            {
                title: 'UFW Firewall Manager',
                description: 'Manage Ubuntu\'s UFW firewall rules from the panel. Apply presets for web, mail, DNS, and database ports.',
                icon: 'Shield',
            },
            {
                title: 'Fail2Ban Integration',
                description: 'Monitor Fail2Ban status and manage brute-force protection directly from the dashboard.',
                icon: 'Block',
            },
            {
                title: 'Terminal Security Filtering',
                description: 'Web terminal blocks ~15 destructive command patterns via regex — protecting against accidental or malicious execution.',
                icon: 'VerifiedUser',
            },
            {
                title: 'SSH Key Manager',
                description: 'Generate Ed25519/RSA SSH keys, import public keys, and manage your authorized_keys from the UI.',
                icon: 'VpnKey',
            },
        ],
    },
    {
        id: 'server',
        label: 'Server Tools',
        features: [
            {
                title: 'Web Terminal',
                description: 'Execute shell commands directly from your browser with per-session working directory tracking and command history.',
                icon: 'Terminal',
            },
            {
                title: 'Cron Job Manager',
                description: 'Add, edit, toggle, and delete cron jobs with built-in schedule presets. Raw crontab editor also available.',
                icon: 'Schedule',
            },
            {
                title: 'Resource Monitoring',
                description: 'Real-time CPU, memory, disk, and network usage with auto-refresh. Monitor the health of all running services.',
                icon: 'Monitor',
            },
            {
                title: 'Process Manager',
                description: 'View running processes, search and sort, kill processes, and manage systemd services — all from one screen.',
                icon: 'Settings',
            },
            {
                title: 'System Logs Viewer',
                description: '16 log sources accessible in one place — Nginx access/error logs, mail logs, system logs — with real-time tail and color coding.',
                icon: 'Article',
            },
        ],
    },
    {
        id: 'backup',
        label: 'Backup & Recovery',
        features: [
            {
                title: 'Flexible Backup Types',
                description: 'Full server, panel-only, mail, database, or domain-specific backups — run on-demand or on a schedule.',
                icon: 'Backup',
            },
            {
                title: 'Backup Scheduling',
                description: 'Configure automatic backup schedules so you\'re always protected without manual intervention.',
                icon: 'EventRepeat',
            },
            {
                title: 'One-Click Restore',
                description: 'Restore any backup in a single click from the Backup & Restore page.',
                icon: 'RestoreFromTrash',
            },
        ],
    },
    {
        id: 'apps',
        label: 'App Store',
        features: [
            {
                title: 'One-Click App Install',
                description: 'Install server applications with a single click — no manual configuration required.',
                icon: 'Apps',
            },
            {
                title: 'phpMyAdmin',
                description: 'Database management interface, automatically configured to connect to your databases.',
                icon: 'TableChart',
            },
            {
                title: 'Roundcube Webmail',
                description: 'Full-featured webmail client with SSO — users don\'t need to log in separately.',
                icon: 'MailOutline',
            },
            {
                title: 'WordPress',
                description: 'Deploy WordPress sites into any of your domain folders with one click.',
                icon: 'Article',
            },
            {
                title: 'Redis & Fail2Ban',
                description: 'Install Redis caching and Fail2Ban intrusion prevention directly from the App Store.',
                icon: 'Speed',
            },
        ],
    },
    {
        id: 'connectivity',
        label: 'Connectivity',
        features: [
            {
                title: 'Direct VPS IP Access',
                description: 'Access the panel at your VPS public IP — straightforward for cloud servers with a public IP address.',
                icon: 'CloudQueue',
            },
            {
                title: 'Cloudflare Tunnel Support',
                description: 'Works behind NAT and CGNAT using Cloudflare Tunnel — perfect for home servers and restrictive network environments.',
                icon: 'Cloud',
            },
            {
                title: 'Nginx Reverse Proxy Ready',
                description: 'Deploy clearPanel behind nginx at your own domain with HTTPS — includes example configuration.',
                icon: 'SwapHoriz',
            },
        ],
    },
];

// ---- Home page highlights (subset for home page cards) ----
export const homeHighlights = [
    {
        title: 'Domain & Web Hosting',
        description: 'One-click domains with automatic Nginx vhost, folder structure, DNS zones, and SSL — from a single form.',
        icon: 'Language',
        href: '/features#domain',
    },
    {
        title: 'Authoritative DNS Server',
        description: 'Run BIND9 on your own VPS. Manage A, AAAA, CNAME, MX, TXT records with real-time zone updates.',
        icon: 'Router',
        href: '/features#dns',
    },
    {
        title: 'Complete Email Suite',
        description: 'Postfix + Dovecot + Rspamd + DKIM + DMARC + Roundcube SSO — enterprise email without enterprise complexity.',
        icon: 'Email',
        href: '/features#email',
    },
    {
        title: 'Multi-Engine Databases',
        description: 'Manage MySQL, MariaDB, and PostgreSQL with a built-in SQL console, import/export, and phpMyAdmin.',
        icon: 'Storage',
        href: '/features#database',
    },
    {
        title: 'Full File Manager',
        description: 'Browse, edit (Monaco editor), upload (100MB), zip/unzip, chmod — everything you do over FTP, in the browser.',
        icon: 'FolderOpen',
        href: '/features#files',
    },
    {
        title: 'Security-First Design',
        description: 'TOTP 2FA, bcrypt passwords, UFW firewall manager, scoped sudoers, and terminal command filtering.',
        icon: 'Security',
        href: '/features#security',
    },
];
