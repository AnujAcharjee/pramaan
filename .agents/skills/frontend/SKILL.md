---
name: frontend
description: >-
  Architectural Stationery & Draftsman Aesthetic design system and UI implementation guide for Pramaan IdP.
  Use when styling, polishing, or refining UI components, views, buttons, forms, badges, and layout elements.
---

# Pramaan IdP Frontend Design System: Architectural Stationery & Draftsman Aesthetic

This design system defines the aesthetic standards, component styling, and implementation guidelines for **Pramaan Identity Provider (IdP)**. It translates the tactile atmosphere of architectural sketchbooks, fine stationery (reminiscent of Midori, Leuchtturm, and Smythson notebooks), and colored-pencil drafting into a modern, high-performance identity console.

---

## 1. Core Atmosphere & Principles

- **The Concept:** "A high-precision developer & identity workspace drafted with fine ink, crisp colored-pencil strokes, and delicate contour lines on tactile paper."
- **Visual Tone:** Mature, editorial, artisanal, distraction-free, and exceptionally legible.
- **Negative Constraints (What It Is NOT):**
  - NO generic SaaS cards with heavy, muddy floating drop shadows.
  - NO heavy glassy/frosted blur overlays (`backdrop-blur-2xl` / glassmorphism) that degrade contrast.
  - NO purple/pink futuristic AI gradients.
  - NO pixel art, faux-leather textures, or comic halftones.
  - NO changing of existing page layouts, grid structures, or routing.
  - NO modifying or rewriting existing application text, descriptions, error messages, or copy.

---

## 2. Preserved Color Hierarchy (Pramaan Native Palette)

Maintain a 60-30-10 distribution utilizing Pramaan's established brand tokens:

### ~60% Canvas & Paper Surfaces
- **Light Mode Paper Base:** Soft warm paper base (`#F8FAFC` blending into warm ivory `#FEF9E1`/30 and sand `#E9DAC1`/20).
- **Workspace Desk Cards:** Clean, warm natural parchment surfaces (`#FFFFFF` to `#FCFAF8`) with delicate contour lines.
- **Dark Mode ("Draftsman Blackbook"):** Rich ink black and deep graphite slate (`#000000`, surface `#0A0A0A`, sub-cards `#121212`, borders `#262626`).

### ~30% Secondary Surfaces, Dividers & Contours
- **Delicate Pencil Contours:** Ultra-crisp 1px to 1.5px subtle border lines (`border-slate-200/90` in light mode, `border-neutral-800` in dark mode).
- **Stationery Accent Lines:** Subtle contouring with Pramaan Sand (`#E9DAC1`/60) and slate dividers instead of heavy drop shadows.

### ~10% Colored-Pencil Interactive Accents
- **Primary Drafting Pencil (Brand Orange):** Pramaan Brand Orange (`#FF9644` / `#FA812F`) for active primary states, key buttons, and focus indicators.
- **Presence & Verified Badges (Pencil Mint/Sage):** `#D4E2D4` and Emerald tones for verified domains, active sessions, and security checks.
- **Pending & Attention States (Pencil Apricot/Amber):** `#FFD4B2` and `#FAEFD4` for pending verification and warning indicators.
- **Destructive & Revocation Alerts (Pencil Rose/Peach):** `#FFCACC`, `#F39F9F`, and Rose tones for deactivation, secret rotation, and session termination.

### Ink & Typography Contrast
- **Primary Ink:** Deep walnut-charcoal `#0F172A` (light) / Crisp ivory `#F8FAFC` (dark).
- **Muted Graphite:** Technical metadata & labels in `#475569` (light) / `#94A3B8` (dark).
- **Technical Monospace:** Draftsman font `JetBrains Mono` for tokens, client IDs, secrets, and hashes.
- **Editorial Headings:** `Instrument Serif` for brand titles and section hero headers.

---

## 3. Organic Geometry & Tactile Craftsmanship

Replace rigid machine-stamped corners and heavy blur overlays with smooth, subtle craftsman contours:

- **Small Controls / Action Buttons:**
  `border-radius: 10px 8px 11px 9px;`
- **Stationery Cards & Dashboard Panels:**
  `border-radius: 18px 15px 19px 16px;`
- **Form Inputs & Data Fields:**
  `border-radius: 10px 9px 11px 8px;`
- **Sub-cards & Nested Containers:**
  `border-radius: 14px 12px 15px 13px;`
- **Modal Containers & Dialogs:**
  `border-radius: 24px 21px 25px 22px;`
- **Pencil Outlines:**
  Prioritize fine 1px / 1.5px solid pencil contours (`border border-slate-200/90 dark:border-neutral-800/90`) over floating box shadows.

---

## 4. Component-Level Polish & Smoothing Rules

1. **Dashboard Sections & Console Cards (`.dashboard-section`, `.glass-card`):**
   - Eliminate heavy frosted blur (`backdrop-blur-2xl`).
   - Use clean paper surfaces (`bg-white dark:bg-[#0A0A0A]`) with 1px tactile contour borders (`border border-slate-200 dark:border-neutral-800`).
   - Add a subtle tactile lift on hover (`hover:-translate-y-0.5 hover:border-brand-orange/40 transition-all duration-200`).

2. **Buttons (`.btn-orange`, outline variants):**
   - Render primary buttons as solid colored-pencil blocks (`bg-linear-to-r from-brand-orange to-brand-orangeDark text-white`) with organic radii (`10px 8px 11px 9px`) and a tactile press feel (`active:scale-[0.98]`).
   - Outline buttons feature crisp 1.5px draftsman pencil borders with smooth, low-opacity wash hovers.

3. **Form Fields & Inputs (`.input-field`):**
   - Render input fields with a fine stationery notebook feel: crisp 1px borders, smooth background transition (`focus:bg-white dark:focus:bg-[#151515]`), and an architectural drafting focus ring (`focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange`).

4. **Status Badges & Chips:**
   - Style badges as hand-pressed notebook stamps (subtle tinted wash backgrounds, fine pencil borders, and high-contrast ink typography).
   - *Verified*: Soft mint/emerald wash with forest pencil text.
   - *Pending*: Soft apricot wash with deep amber pencil text.
   - *Confidential/Public*: Slate drafting wash with crisp dark ink.

5. **Console Header & Navigation Bar:**
   - Streamline into an architectural ruler bar: 1px bottom border, warm subtle wash, and crisp icon buttons with organic curvature.

6. **Code Blocks & Secrets Ledger:**
   - Format client IDs, secrets, and DNS TXT records with notebook ledger styling: monospace typography (`JetBrains Mono`), 1px bordered recessed paper blocks, and custom colored-pencil scrollbars (`.scrollbar-thin` with brand-orange thumb).

---

## 5. Build & Execution Rules

- **Mandatory CSS Recompilation:** Run `npm run css:build` whenever `input.css`, Tailwind configuration, or EJS markup classes are updated.
- **Code Integrity:** Run `npm run lint` before committing to ensure formatting and lint standards are upheld.
