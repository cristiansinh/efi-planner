# Liquid Glass UI Redesign — Design Spec

**Date:** 2026-06-17  
**Scope:** Full visual redesign of `src/index.css` and minor JSX color adjustments  
**Approach:** Option A — Glass Completo (full Liquid Glass overhaul)

---

## Goals

Replace the current flat Vercel/Linear dark aesthetic with a macOS Liquid Glass visual language:
- Background: macOS Sequoia-style layered radial gradient (deep navy → black)
- All panels become frosted glass (`backdrop-filter: blur + saturate`)
- Accent color shifts from purple (`#a855f7`) to macOS blue (`#007AFF`)
- Typography activates SF Pro automatically on macOS via `-apple-system` font stack
- Specular highlights on every glass surface (inset top-edge glow)

---

## Out of Scope

- No changes to component logic, IPC, PowerShell scripts, or data flow
- No layout restructuring (sidebar stays as sidebar, no top-bar navigation)
- No traffic light buttons or macOS window chrome simulation
- No animations beyond existing hover transitions (no parallax, no animated gradients)

---

## Design Tokens (replaces current `:root` block)

### Background System
```css
--bg-base: #020810;

/* Sequoia gradient — applied to body */
background:
  radial-gradient(ellipse at 20% 20%, rgba(10,30,80,0.9) 0%, transparent 55%),
  radial-gradient(ellipse at 80% 10%, rgba(5,20,60,0.7) 0%, transparent 45%),
  radial-gradient(ellipse at 10% 80%, rgba(0,15,50,0.6) 0%, transparent 40%),
  radial-gradient(ellipse at 70% 90%, rgba(0,10,40,0.5) 0%, transparent 35%),
  #020810;
```

### Glass System (new tokens)
```css
--glass-bg:         rgba(255, 255, 255, 0.05);
--glass-bg-hover:   rgba(255, 255, 255, 0.08);
--glass-bg-active:  rgba(0, 122, 255, 0.15);
--glass-border:     rgba(255, 255, 255, 0.10);
--glass-border-hi:  rgba(255, 255, 255, 0.20);
--glass-specular:   inset 0 1px 0 rgba(255, 255, 255, 0.10);
--glass-blur:       blur(40px) saturate(180%);
--glass-blur-card:  blur(20px) saturate(150%);
--glass-blur-light: blur(10px);
--glass-shadow:     0 8px 32px rgba(0, 0, 0, 0.40);
--glass-shadow-sm:  0 4px 24px rgba(0, 0, 0, 0.35);
```

### Accent (replaces purple)
```css
--accent:           #007AFF;
--accent-glow:      rgba(0, 122, 255, 0.35);
--accent-glow-hi:   rgba(0, 122, 255, 0.55);
--accent-tint:      rgba(0, 122, 255, 0.15);
--accent-border:    rgba(0, 122, 255, 0.30);
```

### Text (unchanged — white text on dark glass stays legible)
```css
--text-primary:   #f4f4f5;
--text-secondary: #a1a1aa;
--text-muted:     #71717a;
```

### Typography
```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
--font-mono: "SF Mono", "Fira Code", "JetBrains Mono", Consolas, monospace;
```
On macOS this automatically resolves to SF Pro. On Windows it falls back to system-ui (Segoe UI Variable).

### Status Colors (unchanged semantics, glass treatment only)
```css
/* native: green, config: amber, incompatible: red — same hex values */
/* Badges change from solid-tint to glass-tint (see Badge section) */
```

---

## Component Specs

### Body / Root
```css
body {
  background: var(--bg-gradient-sequoia);  /* layered radial gradients */
  background-attachment: fixed;            /* doesn't scroll with content */
  min-height: 100vh;
}
```
`background-attachment: fixed` is critical — ensures the gradient stays static while glass panels scroll over it, preserving the depth illusion.

### Sidebar
```css
.sidebar {
  background: rgba(6, 12, 28, 0.50);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-right: 1px solid rgba(255, 255, 255, 0.07);
}
```

Nav items:
```css
.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(0, 122, 255, 0.15);
  border: 1px solid rgba(0, 122, 255, 0.30);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}
```

Logo icon: `color: #007AFF` + `filter: drop-shadow(0 0 10px rgba(0,122,255,0.5))`

### Page Header (sticky)
Higher blur than sidebar — visually "closer" to user:
```css
.page-header {
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(60px) saturate(200%);
  -webkit-backdrop-filter: blur(60px) saturate(200%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
```

### Cards
```css
.card, .summary-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.35),
              inset 0 1px 0 rgba(255,255,255,0.08);
}

.card:hover, .summary-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.40),
              inset 0 1px 0 rgba(255,255,255,0.12);
}
```

Icon box inside summary cards:
```css
.summary-icon-box {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
}
```

### Scan Container
```css
.scan-container {
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.10);
  border-radius: 16px;
}
```

Radial scan glow ring color: `--accent` (#007AFF) replaces purple.

### Console Box
Intentionally darker than cards for readability of monospace output:
```css
.console-box {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}
```

### Buttons

Primary (scan):
```css
.scan-btn {
  background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%);
  border: none;
  color: #ffffff;
  box-shadow: 0 4px 20px rgba(0,122,255,0.40),
              inset 0 1px 0 rgba(255,255,255,0.25);
  border-radius: 9999px;
}

.scan-btn:hover {
  background: linear-gradient(135deg, #1a8aff 0%, #0062ff 100%);
  box-shadow: 0 6px 28px rgba(0,122,255,0.55),
              inset 0 1px 0 rgba(255,255,255,0.30);
  transform: translateY(-2px);
}

.scan-btn.scanning {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  color: var(--text-muted);
  box-shadow: none;
}
```

Secondary (copy, filters):
```css
.copy-btn {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.70);
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.20);
  color: #ffffff;
}
```

### Badges
```css
.badge-native {
  background: rgba(52, 211, 153, 0.12);
  border-color: rgba(52, 211, 153, 0.35);
  backdrop-filter: blur(8px);
}

.badge-config {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.35);
  backdrop-filter: blur(8px);
}

.badge-incompatible {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.35);
  backdrop-filter: blur(8px);
}
```

### Search Input
```css
.search-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(20px);
}

.search-input:focus {
  border-color: rgba(0, 122, 255, 0.60);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);  /* macOS focus ring */
  outline: none;
}
```

### Alert / Warning / Success Boxes
Same semantic colors, glass treatment:
```css
.alert-box {
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.20);
  backdrop-filter: blur(12px);
}

.success-box {
  background: rgba(16, 185, 129, 0.07);
  border: 1px solid rgba(16, 185, 129, 0.20);
  backdrop-filter: blur(12px);
}

.warning-box {
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.20);
  backdrop-filter: blur(12px);
}
```

### Copy Box & Tree View
```css
.copy-box, .tree-view {
  background: rgba(0, 0, 0, 0.50);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}
```

### Scrollbars
```css
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }
```

### Checklist Items
```css
.checklist-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.checklist-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

.checklist-checkbox {
  accent-color: #007AFF;
}
```

---

## JSX Changes Required

Only two targeted changes in JSX files — no structural refactoring:

1. **`src/App.jsx` line 259** — sidebar footer status color:  
   `isFallback ? '#e0a82e' : '#10b981'` → unchanged (semantic, keep as-is)

2. **Any hardcoded `var(--accent-purple)`** references in component inline styles → replace with `var(--accent)`.  
   Grep target: `accent-purple` in `.jsx` files (approximately 3-4 occurrences in Dashboard.jsx and EfiPlanner.jsx).

---

## Files Changed

| File | Type of Change |
|------|---------------|
| `src/index.css` | Full rewrite of `:root` tokens + all class rules |
| `src/components/Dashboard.jsx` | Replace `var(--accent-purple)` → `var(--accent)` in inline styles |
| `src/components/EfiPlanner.jsx` | Same inline style replacement |

`App.jsx`, `HardwareDetails.jsx`, `CompatibilityLookup.jsx`, and all utility/logic files: **no changes.**

---

## Electron Note

`backdrop-filter` is fully supported in Electron's Chromium renderer. No special flags needed. The `background-attachment: fixed` on body works correctly in Electron's windowed mode.
