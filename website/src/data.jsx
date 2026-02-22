import {
  BiServer,
  BiNews,
  BiHelpCircle,
  BiLogIn,
} from "react-icons/bi";
import { BsHeadset } from "react-icons/bs";
import { FaLaptopCode } from "react-icons/fa";

const IconBoxData = [
  {
    classOption: "bg-primary",
    icon: "fal fa-layer-group fa-2x text-white",
    title: "Easy Management",
    description:
      "Manage domains, emails, databases, and files from a single intuitive dashboard designed for speed.",
  },
  {
    id: 2,
    classOption: "bg-danger",
    icon: "fal fa-shield-check fa-2x text-white",
    title: "Rock-Solid Security",
    description:
      "Built-in firewall, 2FA authentication, SSL automation, and server hardening keep your servers safe.",
  },
  {
    id: 3,
    classOption: "bg-dark",
    icon: "fal fa-code fa-2x text-white",
    title: "Lightning Performance",
    description:
      "Nginx-powered web serving, real-time monitoring, and process management for peak server performance.",
  },
];

const FaqOneData = [
  {
    faqTitle: "Is ClearPanel really free?",
    faqDesc:
      "Yes! The Community edition is 100% free and open-source. It includes all core features like domain management, email, DNS, file manager, and more. Pro and Enterprise plans add advanced features and priority support.",
  },
  {
    id: 2,
    faqTitle: "What operating systems does ClearPanel support?",
    faqDesc:
      "ClearPanel is designed for Ubuntu 22.04 LTS and Ubuntu 24.04 LTS. We recommend a fresh VPS installation with at least 1GB RAM and 20GB disk space for optimal performance.",
  },
  {
    id: 3,
    faqTitle: "How do I install ClearPanel?",
    faqDesc:
      "Installation takes less than 5 minutes. Simply SSH into your server, run our one-line installer script, and follow the setup wizard. Full documentation is available in our docs.",
  },
  {
    id: 4,
    faqTitle: "Can I migrate from cPanel or other panels?",
    faqDesc:
      "Yes, ClearPanel includes migration tools to help you move domains, email accounts, and databases from other hosting panels. Our documentation covers step-by-step migration guides.",
  },
  {
    id: 5,
    faqTitle: "What kind of support is available?",
    faqDesc:
      "Community users get access to our GitHub Issues and community Discord. Pro and Enterprise users receive priority email support and dedicated assistance.",
  },
];

const TestimonialData = [
  {
    authorImg: "/img/testimonial/1.jpg",
    authorName: "Alex Morgan",
    authorTitle: "DevOps Engineer at CloudScale",
    quoteTitle: "Finally, a panel that just works!",
    authorQuote:
      "ClearPanel replaced our complex server management workflow. The one-click app installer and email management saved us hours every week.",
  },
  {
    id: 2,
    authorImg: "/img/testimonial/2.jpg",
    authorName: "Sarah Chen",
    authorTitle: "Founder & CTO at WebForge",
    quoteTitle: "Best open-source panel out there!",
    authorQuote:
      "We migrated 50+ domains to ClearPanel and haven't looked back. The DNS management and SSL automation are top-notch.",
  },
  {
    id: 3,
    authorImg: "/img/testimonial/3.jpg",
    authorName: "James Rodriguez",
    authorTitle: "Lead Developer at TechStart",
    quoteTitle: "Perfect for our development team!",
    authorQuote:
      "The terminal access, file manager, and process monitoring give us everything we need without the bloat of other panels.",
  },
  {
    id: 4,
    authorImg: "/img/testimonial/4.jpg",
    authorName: "Priya Patel",
    authorTitle: "System Admin at DataHost",
    quoteTitle: "Enterprise features without the cost!",
    authorQuote:
      "2FA, firewall management, cron jobs, backups — ClearPanel has all the enterprise features we need and it's completely free.",
  },
];

// Footer data
const footerPrimaryPages = [
  {
    title: "Home",
    href: "/",
  },
  {
    title: "About",
    href: "/about",
  },
  {
    title: "Pricing",
    href: "/pricing",
  },
  {
    title: "Contact",
    href: "/contact",
  },
];

const footerPages = [
  {
    title: "Documentation",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/INSTALL.md",
  },
  {
    title: "Roadmap",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/ROADMAP.md",
  },
  {
    title: "Changelog",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/CHANGELOG.md",
  },
  {
    title: "GitHub",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu",
  },
];

const footerTemplate = [
  {
    title: "Contact Us",
    href: "/contact",
  },
  {
    title: "Community",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/discussions",
  },
  {
    title: "Report a Bug",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/issues",
  },
  {
    title: "Feature Request",
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/issues",
  },
];

// Navbar data — not used in simplified nav, but kept for OffCanvasMenu compatibility
const navHomeOne = [];
const navHomeTwo = [];
const navHomeThree = [];
const navHomeFour = [];

const navCompanyLinks = [
  {
    title: "Contact Us",
    icon: <BiLogIn />,
    href: "/contact",
  },
  {
    title: "Documentation",
    icon: <BiServer />,
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/INSTALL.md",
  },
  {
    title: "GitHub Repository",
    icon: <BiNews />,
    href: "https://github.com/SefionITServices/clearPanel-ubuntu",
  },
];

const navCompanyPage = [
  {
    title: "Community",
    icon: <BiHelpCircle />,
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/discussions",
  },
  {
    title: "Support",
    icon: <BsHeadset />,
    href: "https://github.com/SefionITServices/clearPanel-ubuntu/issues",
  },
  {
    title: "Get Started",
    icon: <FaLaptopCode />,
    href: "/pricing",
  },
];

const offcanvasMenuData = [];

const testimonialAuthor = [
  {
    name: "Alex Morgan",
    title: "DevOps Engineer",
    image: "/img/testimonial/1.jpg",
    target: "#testimonial-tab-1",
  },
  {
    name: "Sarah Chen",
    title: "CTO at WebForge",
    image: "/img/testimonial/2.jpg",
    target: "#testimonial-tab-2",
  },
  {
    name: "James Rodriguez",
    title: "Lead Developer",
    image: "/img/testimonial/3.jpg",
    target: "#testimonial-tab-3",
  },
  {
    name: "Priya Patel",
    title: "System Admin",
    image: "/img/testimonial/4.jpg",
    target: "#testimonial-tab-4",
  },
];

const pricingData = [
  {
    title: "Community",
    price: "Free",
    isPopular: false,
    features: [
      "Domain Management",
      "Email Server (Postfix/Dovecot)",
      "DNS Management (BIND9)",
      "File Manager & Terminal",
      "SSL Certificates",
      "MySQL Database",
      "App Store (WordPress, phpMyAdmin)",
      "Community Support",
    ],
  },
  {
    title: "Pro",
    price: "$9",
    isPopular: true,
    features: [
      "Everything in Community",
      "Automated Backups & Restore",
      "2FA Authentication",
      "Resource Monitoring",
      "Cron Job Manager",
      "Firewall Manager",
      "Process Manager",
      "Priority Email Support",
    ],
  },
  {
    title: "Enterprise",
    price: "$29",
    isPopular: false,
    features: [
      "Everything in Pro",
      "Multi-User & Reseller",
      "White-Label Branding",
      "Docker Manager",
      "Git Deployment",
      "REST API & Webhooks",
      "Audit Log",
      "Dedicated Support",
    ],
  },
];

export {
  offcanvasMenuData,
  IconBoxData,
  FaqOneData,
  TestimonialData,
  navHomeOne,
  navHomeTwo,
  navHomeThree,
  navHomeFour,
  navCompanyLinks,
  navCompanyPage,
  footerPrimaryPages,
  footerPages,
  footerTemplate,
  testimonialAuthor,
  pricingData,
};
