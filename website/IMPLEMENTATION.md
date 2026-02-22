# ClearPanel Website — Implementation Plan

## Overview

Build the **ClearPanel marketing website** using the Quiety React theme (Demo 5: Software Application — IT Solutions & SaaS). The site will be a stripped-down, ClearPanel-branded version of the theme with only the pages we need: **Home, Pricing, About, Contact**.

**Source Theme:** `website/theme/quiety-react` (Quiety React v7.5.0)  
**Output Project:** `website/` (root-level, production website)  
**Tech Stack:** React 19 + Vite 7 + Bootstrap 5 + React Router 6 + Swiper 8

---

## Architecture

```
website/
├── index.html               # Vite entry point
├── package.json              # Slimmed dependencies
├── vite.config.js            # Vite config
├── public/
│   └── img/                  # All images (copied from theme)
│       ├── logo-color.png    # ClearPanel logo (to be replaced)
│       ├── logo-white.png    # ClearPanel white logo (to be replaced)
│       └── ...               # Theme images
├── src/
│   ├── main.jsx              # React entry
│   ├── App.jsx               # Router with 4 routes + 404
│   ├── data.jsx              # Site content data (ClearPanel branded)
│   ├── assets/
│   │   ├── css/main.css      # Theme compiled CSS
│   │   └── fonts/            # FontAwesome fonts
│   ├── components/           # Only components used by our 4 pages
│   │   ├── common/           # PageMeta, PageHeader, SectionTitle, HeroTitle, ScrollToTop, Rating
│   │   ├── about/            # AboutPageHero, OurStory
│   │   ├── blog/             # LatestBlogTwo (for home page)
│   │   ├── contact/          # ContactBox, ContactFormTwo
│   │   ├── cta/              # CtaThree, CtaSubscribe, CtaTwo
│   │   ├── faqs/             # FaqTwo
│   │   ├── features/         # FeatureImgSix, FeatureImgSeven, FeatureImgThree
│   │   ├── integration/      # IntegrationTwo
│   │   ├── others/           # NotFoundScreen
│   │   ├── prices/           # PriceOne
│   │   ├── promo/            # PromoTwo
│   │   ├── review/           # Rating
│   │   ├── tabs/             # TabOne
│   │   ├── team/             # Team
│   │   ├── testimonial/      # TestimonialTwo
│   │   └── work-process/     # WorkProcessFour
│   ├── layout/
│   │   ├── Layout.jsx        # Main wrapper
│   │   ├── Header/
│   │   │   ├── Navbar.jsx    # Simplified nav (Home, About, Pricing, Contact)
│   │   │   └── OffCanvasMenu.jsx
│   │   └── Footer/
│   │       └── FooterOne.jsx # Main footer
│   ├── pages/
│   │   ├── About.jsx
│   │   ├── Pricing.jsx
│   │   └── Contact.jsx
│   └── themes/
│       └── index5/
│           ├── HomeSoftApplication.jsx  # Home page
│           └── HeroFive.jsx             # Home hero
```

---

## Pages & Component Map

### Page 1: Home (`/`)
**Source:** `themes/index5/HomeSoftApplication.jsx`  
**Sections (top → bottom):**

| # | Component | Purpose | Content Customization |
|---|-----------|---------|----------------------|
| 1 | `Navbar` | Site header | Simplified: Home, About, Pricing, Contact + "Login" + "Get Started" → links to ClearPanel app |
| 2 | `HeroFive` | Hero banner | Title: "Next-Gen Server Control Panel" / Subtitle: "#1 Open-Source Hosting Panel" / CTAs: "Get Started Free" → install docs, "View Demo" → demo link |
| 3 | `PromoTwo` | Feature highlights | 3 cards: Easy Management, Rock-Solid Security, Lightning Performance |
| 4 | `TabOne` | Tabbed features | Website Management, Email & DNS, One-Click Apps |
| 5 | `FeatureImgSix` | Feature + image | Server-grade tools: Domain Manager, SSL Automation, Nginx Configuration |
| 6 | `FeatureImgSeven` | Feature + checklist | 8-point checklist of all panel capabilities |
| 7 | `CtaThree` | Stats CTA | Stats: "26+ Features", "100% Free", "< 5 min Install" |
| 8 | `WorkProcessFour` | How it works | 4 steps: Install → Configure → Deploy → Monitor |
| 9 | `TestimonialTwo` | Social proof | User testimonials (placeholder or real) |
| 10 | `CtaSubscribe` | Newsletter | "Stay updated with ClearPanel releases" |
| 11 | `IntegrationTwo` | Integrations | PHP, Node.js, MySQL, WordPress, Let's Encrypt, Nginx, Postfix, BIND9, etc. |
| 12 | `LatestBlogTwo` | Blog/updates | Latest updates / release notes (can keep placeholder) |
| 13 | `FooterOne` | Footer | ClearPanel links, social media, copyright |

### Page 2: Pricing (`/pricing`)
**Source:** `pages/Pricing.jsx`  
**Sections:**

| # | Component | Purpose | Content Customization |
|---|-----------|---------|----------------------|
| 1 | `Navbar` | Site header | Same as home |
| 2 | `PageHeader` | Page title | "Flexible Plans for Every Server" |
| 3 | `PriceOne` | Pricing cards | **Community (Free):** Core features / **Pro ($9/mo):** + Backup, 2FA, Monitoring / **Enterprise ($29/mo):** + Multi-user, White-label, Priority Support |
| 4 | `FaqTwo` | FAQ | ClearPanel-specific: What OS? Is it free? How to install? Can I migrate? Support? |
| 5 | `TestimonialTwo` | Social proof | Same testimonials |
| 6 | `CtaSubscribe` | Newsletter | Same |
| 7 | `FooterOne` | Footer | Same |

### Page 3: About (`/about`)
**Source:** `pages/About.jsx`  
**Sections:**

| # | Component | Purpose | Content Customization |
|---|-----------|---------|----------------------|
| 1 | `Navbar` | Site header | Same (light variant) |
| 2 | `AboutPageHero` | About hero | "Building the Future of Server Management" / CTAs: View on GitHub, Join Community |
| 3 | `OurStory` | Stats & story | Stats: Features built, Contributors, Servers managed, Years / Story: ClearPanel mission |
| 4 | `FeatureImgThree` | Vision section | Open-source philosophy, community-driven development |
| 5 | `Team` | Team section | Team members or contributors |
| 6 | `TestimonialTwo` | Testimonials | Same |
| 7 | `CtaTwo` | CTA | "Ready to take control?" |
| 8 | `FooterOne` | Footer | Same (light variant) |

### Page 4: Contact (`/contact`)
**Source:** `pages/Contact.jsx`  
**Sections:**

| # | Component | Purpose | Content Customization |
|---|-----------|---------|----------------------|
| 1 | `Navbar` | Site header | Same (light variant) |
| 2 | `PageHeader` | Page title | "Get in Touch" |
| 3 | `ContactBox` | Contact cards | Chat (Discord/Community), Email (support@clearpanel.net), GitHub Issues |
| 4 | `ContactFormTwo` | Contact form | Standard contact form |
| 5 | `FooterOne` | Footer | Same |

---

## Implementation Steps

### Phase 1: Project Scaffold (Step 1-3)

**Step 1 — Copy theme base into `website/`**
- Copy `package.json`, `vite.config.js`, `index.html` from theme
- Copy `public/` folder (all images/assets)
- Copy `src/assets/` (CSS + fonts)
- Copy `src/main.jsx`, `src/index.css`, `src/App.css`

**Step 2 — Copy only required components**
- Copy all components listed in the architecture tree above
- Copy layout files (Layout, Navbar, FooterOne, OffCanvasMenu)
- Copy pages (About, Pricing, Contact) and theme index5
- Copy `data.jsx` (will be customized)
- Copy common utilities (ScrollToTop, PageMeta, etc.)

**Step 3 — Create simplified `App.jsx`**
- Only 5 routes: `/`, `/about`, `/pricing`, `/contact`, `*` (404)
- Remove all other theme/demo routes

### Phase 2: Navbar Simplification (Step 4)

**Step 4 — Simplify Navbar**
- Remove mega-menu "Home" dropdown (40 demos)
- Replace with simple nav links: Home, About, Pricing, Contact
- Change "Sign In" → link to ClearPanel app login
- Change "Get Started" → link to installation/demo
- Remove `Company` dropdown
- Keep sticky scroll behavior and mobile offcanvas

### Phase 3: Content Customization (Step 5-8)

**Step 5 — Customize Home page hero & sections**
- Update `HeroFive`: ClearPanel title, subtitle, CTA buttons, remove client logos or replace with tech logos
- Update text in PromoTwo, TabOne, FeatureImgSix/Seven with ClearPanel features
- Update CtaThree stats
- Update WorkProcessFour steps
- Update IntegrationTwo logos (replace with technology logos ClearPanel supports)

**Step 6 — Customize Pricing page**
- Update PriceOne: 3 ClearPanel-specific plans (Community/Pro/Enterprise)
- Update FaqTwo: ClearPanel-relevant FAQ items

**Step 7 — Customize About page**
- Update AboutPageHero text
- Update OurStory stats and narrative
- Update Team section (or remove/placeholder)

**Step 8 — Customize Contact page**
- Update ContactBox cards with ClearPanel support channels
- Update PageHeader description

### Phase 4: Branding & Footer (Step 9-10)

**Step 9 — Update FooterOne**
- Replace logo references
- Update footer links (Quick Links, Company, Support → ClearPanel-relevant)
- Update social media links
- Update copyright: "© 2026 ClearPanel. All rights reserved."

**Step 10 — Logo & Branding**
- Replace `logo-color.png` and `logo-white.png` with ClearPanel logos
- Update `PageMeta` titles to "ClearPanel — ..."
- Update favicon if available

### Phase 5: Build & Test (Step 11)

**Step 11 — Verify build**
- Run `npm install`
- Run `npm run dev` to test locally
- Run `npm run build` to produce `dist/` output
- Verify all 4 pages render, navigate, and look correct

---

## Components Inventory (Required Only)

### From `components/common/`
| Component | Used By | Notes |
|-----------|---------|-------|
| `PageMeta` | All pages | `<title>` via react-helmet |
| `PageHeader` | Pricing, Contact | Dark page header banner |
| `SectionTitle` | ~10 components | Reusable heading block |
| `HeroTitle` | HeroFive | Hero text block |
| `ScrollToTop` | App.jsx | Scroll restoration |
| `Rating` | TestimonialTwo | 5-star display |

### From `components/` (feature sections)
| Component | Used By |
|-----------|---------|
| `PromoTwo` | Home |
| `TabOne` | Home |
| `FeatureImgSix` | Home |
| `FeatureImgSeven` | Home |
| `FeatureImgThree` | About |
| `CtaThree` | Home |
| `CtaSubscribe` | Home, Pricing |
| `CtaTwo` | About |
| `WorkProcessFour` | Home |
| `TestimonialTwo` | Home, About, Pricing |
| `IntegrationTwo` | Home |
| `LatestBlogTwo` | Home |
| `PriceOne` | Pricing |
| `FaqTwo` | Pricing |
| `ContactBox` | Contact |
| `ContactFormTwo` | Contact |
| `AboutPageHero` | About |
| `OurStory` | About |
| `Team` | About |
| `NotFoundScreen` | 404 |

### From `layout/`
| Component | Notes |
|-----------|-------|
| `Layout` | Main wrapper div |
| `Navbar` | **Will be simplified** |
| `OffCanvasMenu` | Mobile nav |
| `FooterOne` | **Will be customized** |

---

## Image Assets Required

All images are in `public/img/` and will be copied as-is, then selectively replaced:

| Category | Files | Action |
|----------|-------|--------|
| Logos | `logo-color.png`, `logo-white.png` | **Replace** with ClearPanel logos |
| Backgrounds | `page-header-bg.svg` | Keep |
| Shapes | `shape/*.svg` (blob, dot-big-square, dot-dot-wave, contact-us-bg) | Keep |
| Screens | `screen/*.svg`, `screen/*.png` | Keep (generic SaaS mockups) |
| Features | `feature-hero-img.svg`, `feature-hero-img-2.svg`, `feature-img3.jpg` | Keep |
| Clients | `clients/*.svg` | Keep or replace with tech partner logos |
| Integrations | `integations/*.png` | **Replace** with tech logos (PHP, MySQL, Nginx, etc.) |
| Blog | `blog/*.jpg` | Keep (placeholder) |
| Testimonials | `testimonial/*.jpg`, `testimonial/quotes-dot.svg` | Keep (placeholder) |
| Team | `team/*.jpg` | Keep (placeholder) |
| About | `about-img-*.jpg` | Keep (placeholder) |
| Awards | `awards-*.svg` | Keep |
| Color shapes | `color-shape/*.svg` | Keep |
| Contact | `contact-us-img-2.svg` | Keep |

---

## Dependencies (Slimmed)

```json
{
  "dependencies": {
    "bootstrap": "^5.0.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-helmet": "^6.1.0",
    "react-icons": "^4.12.0",
    "react-router-dom": "^6.0.2",
    "sass": "^1.53.0",
    "swiper": "8.4.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.2",
    "vite": "^7.0.0"
  }
}
```

**Removed:** `react-player` (video modal not needed), `web-vitals`, `@headlessui/react`, eslint deps

> **Note:** If the About page's `CtaTwo` "Watch Demo" video modal is kept, add `react-player` back.

---

## Content Customization Summary

| Element | Current (Theme) | New (ClearPanel) |
|---------|-----------------|-------------------|
| Brand name | Quiety | ClearPanel |
| Tagline | "Software & IT Solutions" | "Next-Gen Server Control Panel" |
| Hero subtitle | "#1 Software Company In World" | "#1 Open-Source Hosting Panel" |
| Hero CTA 1 | "Request Demo" | "Get Started Free" |
| Hero CTA 2 | "Learn More" | "View Documentation" |
| Nav Sign In | `/login` | `https://panel.clearpanel.net` (or panel URL) |
| Nav Get Started | `/request-demo` | `/pricing` or install link |
| Pricing plans | Starter/Advanced/Premium | Community/Pro/Enterprise |
| Footer copyright | Quiety | © 2026 ClearPanel |
| Contact email | hello@quiety.com | support@clearpanel.net |
| Social links | Generic | GitHub, Discord, Twitter |

---

## Estimated Effort

| Phase | Steps | Est. Time |
|-------|-------|-----------|
| Phase 1: Scaffold | Steps 1-3 | ~15 min |
| Phase 2: Navbar | Step 4 | ~10 min |
| Phase 3: Content | Steps 5-8 | ~30 min |
| Phase 4: Branding | Steps 9-10 | ~10 min |
| Phase 5: Build | Step 11 | ~5 min |
| **Total** | **11 steps** | **~70 min** |

---

## File Count Estimate

- **Components:** ~22 JSX files
- **Layout:** ~4 JSX files
- **Pages:** ~3 JSX files + 1 theme home
- **Config:** ~4 files (package.json, vite.config, index.html, data.jsx)
- **Assets:** CSS + fonts + images (bulk copy)
- **Total new/modified JSX:** ~30 files
