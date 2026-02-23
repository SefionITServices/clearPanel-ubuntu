// Content: FAQ Items for Home page
export interface FaqItem {
    question: string;
    answer: string;
}

export const faqItems: FaqItem[] = [
    {
        question: 'What Linux distributions does clearPanel support?',
        answer: 'clearPanel is optimized for Ubuntu 20.04+ and Debian. The BIND9 DNS module also has partial support for RHEL/AlmaLinux. The installer uses apt and Ubuntu-native tooling (UFW, systemd, Ondřej PHP PPA).',
    },
    {
        question: 'Do I need to know the command line to use clearPanel?',
        answer: 'No. clearPanel is designed so that everyday tasks — creating domains, managing email, editing DNS records, deploying SSL certificates — can all be done through the web UI. SSH access is only needed for the initial installation.',
    },
    {
        question: 'How is this different from cPanel or Plesk?',
        answer: 'clearPanel is open source and self-hosted — there are no per-server licensing fees. It uses a modern NestJS + React 18 stack instead of legacy PHP, supports Cloudflare Tunnel for non-public IPs, and includes an authoritative BIND9 DNS server so you don\'t depend on external DNS providers.',
    },
    {
        question: 'Can I run clearPanel if I\'m behind NAT or CGNAT?',
        answer: 'Yes. clearPanel supports Cloudflare Tunnel out of the box. This means home servers, mini-PCs, and VPS environments without a public IP can still run the panel and have it publicly accessible.',
    },
    {
        question: 'Does clearPanel manage email security (DKIM, DMARC, SPF)?',
        answer: 'Yes. The email stack includes OpenDKIM for DKIM signing, DMARC policy configuration, Rspamd for spam filtering, and ClamAV for antivirus. This is all provisioned automatically when you add a mail domain.',
    },
    {
        question: 'What databases does clearPanel support?',
        answer: 'clearPanel supports MySQL, MariaDB, and PostgreSQL through a single unified interface. You get a built-in SQL console, user and privilege management, import/export, and phpMyAdmin from the App Store.',
    },
    {
        question: 'Is clearPanel production-ready?',
        answer: 'Version 2.1.0 (Phase 1 complete) is feature-stable with critical security issues resolved: bcrypt password hashing, TOTP 2FA, scoped sudoers, DTO validation on all API endpoints, and terminal command filtering. It is suitable for single-admin VPS deployments.',
    },
    {
        question: 'How do I install clearPanel?',
        answer: 'Run a single installer script on a fresh Ubuntu VPS: clone the repo and run `sudo ./install.sh`. The installer sets up Node.js 20, Nginx, BIND9, the full mail stack, Roundcube, and a systemd service automatically.',
    },
];

// Content: Testimonials (placeholder personas)
export interface Testimonial {
    quote: string;
    author: string;
    role: string;
    avatar: string; // initials
}

export const testimonials: Testimonial[] = [
    {
        quote: 'I was spending $180/year on cPanel just to manage 4 websites. clearPanel replaced it completely — domain management, email, SSL — all in a cleaner UI and without the licensing headache.',
        author: 'Alex R.',
        role: 'Freelance Web Developer',
        avatar: 'AR',
    },
    {
        quote: 'Setting up a full mail stack manually (Postfix + Dovecot + DKIM) used to take me half a day. clearPanel does it in minutes. The DMARC and Rspamd integration is especially impressive.',
        author: 'Mahruf S.',
        role: 'DevOps Engineer',
        avatar: 'MS',
    },
    {
        quote: 'Our small agency hosts 20+ client sites. clearPanel gives us the DNS server, database management, and Nginx vhost control we need — without paying per-server licensing fees we can\'t justify.',
        author: 'Jordan T.',
        role: 'Founder, Digital Agency',
        avatar: 'JT',
    },
];
