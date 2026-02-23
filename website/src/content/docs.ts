// Docs landing page content
export interface DocSection {
    title: string;
    icon: string;
    links: { label: string; href: string }[];
}

export const docSections: DocSection[] = [
    {
        title: 'Getting Started',
        icon: 'RocketLaunch',
        links: [
            { label: 'Quick Start Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/QUICK-START.md' },
            { label: 'Full Installation Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/INSTALL.md' },
            { label: 'Setup Wizard Overview', href: 'https://github.com/SefionITServices/clearPanel/blob/main/README.md' },
        ],
    },
    {
        title: 'Domain & Web Hosting',
        icon: 'Language',
        links: [
            { label: 'Domain Management', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/README.md' },
            { label: 'Nginx & Web Server Setup', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/WEB-SERVER.md' },
            { label: 'SSL Certificates', href: 'https://github.com/SefionITServices/clearPanel/blob/main/setup-ssl.sh' },
        ],
    },
    {
        title: 'DNS & Nameservers',
        icon: 'Router',
        links: [
            { label: 'DNS Zone Editor', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/DNS-SERVER.md' },
            { label: 'BIND9 DNS Server', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/DNS-SERVER-IMPLEMENTATION.md' },
            { label: 'Nameserver Setup Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/DOMAIN-SETUP-GUIDE.txt' },
        ],
    },
    {
        title: 'Email',
        icon: 'Email',
        links: [
            { label: 'Email Stack Overview', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/EMAIL-SERVER-IMPLEMENTATION.md' },
            { label: 'Mail Smoke Test', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/MAIL-SMOKE-TEST.md' },
        ],
    },
    {
        title: 'Connectivity',
        icon: 'Cloud',
        links: [
            { label: 'Connectivity Options', href: 'https://github.com/SefionITServices/clearPanel/blob/main/docs/CONNECTIVITY.md' },
            { label: 'Cloudflare Tunnel Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/CLOUDFLARE-TUNNEL-INFO.txt' },
            { label: 'External Access Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/EXTERNAL-ACCESS-GUIDE.txt' },
        ],
    },
    {
        title: 'Deployment & Updates',
        icon: 'Upload',
        links: [
            { label: 'Deployment Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/DEPLOY.md' },
            { label: 'Update Guide', href: 'https://github.com/SefionITServices/clearPanel/blob/main/UPDATE.md' },
            { label: 'Changelog', href: 'https://github.com/SefionITServices/clearPanel/blob/main/CHANGELOG.md' },
        ],
    },
];
