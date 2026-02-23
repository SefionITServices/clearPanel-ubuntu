import type { Metadata } from 'next';
import { AppThemeProvider } from '@/lib/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
    title: {
        template: '%s | clearPanel',
        default: 'clearPanel — Modern VPS Control Panel for Ubuntu',
    },
    description:
        'clearPanel is an open-source web hosting control panel for Ubuntu VPS servers. Manage domains, DNS, email, databases, SSL, files, and more — without cPanel licensing fees.',
    keywords: [
        'VPS control panel',
        'cPanel alternative',
        'Ubuntu hosting panel',
        'open source control panel',
        'self-hosted hosting',
        'BIND9 DNS',
        'NestJS control panel',
    ],
    metadataBase: new URL('https://clearpanel.net'),
    openGraph: {
        type: 'website',
        siteName: 'clearPanel',
        title: 'clearPanel — Modern VPS Control Panel for Ubuntu',
        description:
            'Open-source, self-hosted web hosting control panel. Domain management, DNS server, email suite, databases, SSL, and more.',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <AppThemeProvider>{children}</AppThemeProvider>
            </body>
        </html>
    );
}
