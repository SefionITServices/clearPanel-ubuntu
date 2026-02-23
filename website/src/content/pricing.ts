// Content: Pricing tiers and feature comparison
// Source: docs/website-content-map.md

export interface PricingTier {
    id: string;
    name: string;
    tagline: string;
    price: string;
    pricePeriod: string;
    priceNote?: string;
    highlighted: boolean;
    ctaLabel: string;
    ctaHref: string;
    features: string[];
}

export interface ComparisonRow {
    feature: string;
    community: string | boolean;
    pro: string | boolean;
    business: string | boolean;
}

export const pricingTiers: PricingTier[] = [
    {
        id: 'community',
        name: 'Community',
        tagline: 'For self-hosters and learners',
        price: '$0',
        pricePeriod: 'forever',
        priceNote: 'Open source · MIT License',
        highlighted: false,
        ctaLabel: 'Get Started Free',
        ctaHref: 'https://github.com/SefionITServices/clearPanel',
        features: [
            'Unlimited domains',
            'DNS zone editor & BIND9 server',
            'Nginx web server management',
            'SSL via Let\'s Encrypt',
            'File manager (Monaco editor)',
            'Web terminal',
            'MySQL / MariaDB management',
            'Email (Postfix + Dovecot)',
            'Roundcube webmail',
            'App Store (5 apps)',
            'UFW firewall manager',
            'System logs viewer',
            'Community support (GitHub)',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        tagline: 'For developers and agencies',
        price: '$9',
        pricePeriod: 'per month',
        priceNote: 'or $79/year — billed annually',
        highlighted: true,
        ctaLabel: 'Start Pro Trial',
        ctaHref: '/contact',
        features: [
            'Everything in Community',
            'PostgreSQL management',
            'PHP multi-version (7.4–8.4)',
            'SSH key manager',
            'Cron job manager',
            'Two-Factor Authentication (TOTP)',
            'Resource monitoring dashboard',
            'Process manager',
            'Backup & restore (all types)',
            'Update checker',
            'License system',
            'Priority email support',
        ],
    },
    {
        id: 'business',
        name: 'Business',
        tagline: 'For power users and small teams',
        price: '$24',
        pricePeriod: 'per month',
        priceNote: 'or $199/year — billed annually',
        highlighted: false,
        ctaLabel: 'Contact Sales',
        ctaHref: '/contact',
        features: [
            'Everything in Pro',
            'Multi-server management',
            'Advanced backup scheduling',
            'Cloudflare Tunnel pre-configured',
            'Custom nameserver branding',
            'Faster priority support (48h SLA)',
            'Roadmap feature voting',
            'Early access to Phase 2 features',
        ],
    },
];

export const comparisonRows: ComparisonRow[] = [
    { feature: 'Domains managed', community: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Nginx web server', community: true, pro: true, business: true },
    { feature: 'SSL (Let\'s Encrypt)', community: true, pro: true, business: true },
    { feature: 'BIND9 DNS server', community: true, pro: true, business: true },
    { feature: 'File manager (Monaco editor)', community: true, pro: true, business: true },
    { feature: 'Web terminal', community: true, pro: true, business: true },
    { feature: 'MySQL / MariaDB', community: true, pro: true, business: true },
    { feature: 'PostgreSQL', community: false, pro: true, business: true },
    { feature: 'Email stack (Postfix + Dovecot)', community: true, pro: true, business: true },
    { feature: 'Roundcube webmail', community: true, pro: true, business: true },
    { feature: 'DKIM & DMARC', community: true, pro: true, business: true },
    { feature: 'PHP multi-version manager', community: false, pro: true, business: true },
    { feature: 'SSH key manager', community: false, pro: true, business: true },
    { feature: 'Cron job manager', community: false, pro: true, business: true },
    { feature: 'Two-Factor Auth (TOTP)', community: false, pro: true, business: true },
    { feature: 'Resource monitoring', community: false, pro: true, business: true },
    { feature: 'Process manager', community: false, pro: true, business: true },
    { feature: 'Backup & restore', community: 'Manual', pro: 'Scheduled', business: 'Scheduled + Multi-server' },
    { feature: 'App Store', community: '5 apps', pro: '11 apps', business: '11 apps + Early access' },
    { feature: 'Cloudflare Tunnel', community: 'Manual setup', pro: 'Guided', business: 'Pre-configured' },
    { feature: 'Support', community: 'Community (GitHub)', pro: 'Email (72h)', business: 'Priority (48h SLA)' },
];
