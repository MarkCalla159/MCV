# MaintenanceFlow design system

MaintenanceFlow is a light, operational workspace for reporting, assigning, executing, and reviewing maintenance work. Its visual language is calm and utilitarian: warm paper surfaces, restrained teal accents, dense records, and clear workflow states.

## Foundations

### Color

- `--mf-paper` (`#f7faf8`) is the workspace canvas.
- `--mf-surface` (`#ffffff`) is used for tables, cards, forms, and account controls.
- `--mf-ink` (`#18302f`) and `--mf-muted` (`#536963`) provide primary and secondary text.
- `--mf-teal` (`#0e756b`) is the primary action color; `--mf-teal-dark` is its hover state.
- `--mf-focus-ring` (`#075e54`) is the opaque keyboard-focus color and must remain at least 3:1 against adjacent surfaces.
- Warning, danger, violet, and blue tokens communicate workflow states. Do not use color as the only state cue.

### Typography

- Headings use self-hosted DM Serif Display at weight 400.
- Body text and controls use self-hosted DM Sans at weights 400–700.
- The page title uses `--mf-type-page`; section headings use `--mf-type-section`; body, small, and label sizes use the corresponding `--mf-type-*` tokens.
- Keep heading tracking at `-0.04em` or looser. Use sentence case for headings and controls.

### Layout

- Desktop pages use a 12-column grid with 24px gutters and 80px side padding.
- The desktop shell has a fixed 260px left sidebar and an independently scrollable content area.
- Between 960px and 1199px, page side padding is 40px.
- Below 960px, the sidebar becomes a fixed mobile bar and pages use a 4-column grid with 24px gutters and padding.
- Below 768px, search and filter controls stack to full width. Below 720px, detail layouts become one column.
- Direct children of `.dashboard-page` must span the full page grid unless a component explicitly defines another span. All grid children need `min-inline-size: 0`.

### Shape and depth

- Product cards and tables use 12–16px radii with a single full border.
- Use shadows only for elevated overlays, authentication panels, and toasts. Do not combine a strong border and a strong shadow.
- Pills are reserved for compact statuses, not general containers.

## Components

### Navigation

- Desktop navigation shows an icon and label for every route.
- Active links use a full border and tinted background.
- Mobile navigation uses the native `dialog` element, fills the viewport, restores focus to its trigger, and staggers link entry. Reduced-motion users receive no entrance animation.

### Buttons and controls

- Buttons are at least 48px tall; other mobile tap targets are at least 44×44px with 8px between adjacent controls.
- Primary buttons use teal, danger buttons use the danger tint, and disabled controls remain visible with an explanation when permissions or workflow state prevent the action.
- Every interactive element uses the shared opaque focus ring. Forced-colors mode uses the system `Highlight` color.
- Search groups use the semantic `<search>` element. Every input and select has a programmatic label.

### Tables and lists

- Tables are the primary desktop representation for work orders and assets.
- In narrow containers, table rows become labeled record blocks through the table container query.
- Record identifiers and primary names link to their detail routes.
- When the DeepSpace query limit is reached, show a visible notice that results may be partial and ask the user to narrow the filters.

### Loading, empty, and feedback states

- Skeletons match the final geometry and use the shared shimmer animation.
- Decorative skeleton shapes are hidden from assistive technology; one concise `role="status"` label announces the loading region.
- Empty states state what is absent. Errors name the failed action. Success messages use `role="status"`; errors use `role="alert"`.
- Toasts appear in the bottom-right, contain an icon and one-line title, slide in, and auto-dismiss after four seconds.

## Motion

- Motion is short and functional: button feedback, mobile-menu entry, toast entry/exit, and skeleton shimmer.
- Respect `prefers-reduced-motion: reduce` by removing transitions and continuous animation.

## Do and do not

- Do preserve the 12-column/4-column grid, semantic landmarks, visible focus, and role-aware workflow explanations.
- Do use real record data and identify demo data as sample content.
- Do not add a third typeface, decorative gradients, one-sided accent borders, or icon-like Unicode glyphs.
- Do not hide important actions solely because a user lacks permission; keep them disabled with a concise reason when the workflow benefits from visibility.
- Do not fetch an unrestricted role queue while profile data is unresolved.
