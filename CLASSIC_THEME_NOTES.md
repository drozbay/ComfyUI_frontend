# Classic Theme for Nodes 2.0: Design Notes

A skin that makes the Vue-based Nodes 2.0 renderer look and size like classic litegraph nodes. Written as a Q&A so you can scan for the part you care about.

## What is this, in one paragraph?

Three pieces: a `classic` color palette (`src/assets/palettes/classic.json`), a `classic-theme` class toggled on `<html>` when that palette is active (`src/views/GraphView.vue`), and one stylesheet that does almost all of the work (`src/assets/css/classic-theme.css`). Vue node components got small stable marker classes (`lg-node`, `lg-node-widgets`, `lg-widget-field`, `lg-node-badges`, `lg-combo-step`) so the CSS has hooks that survive refactors. Real code changes are few and deliberate: combo step buttons, a resize-clamp bug fix, and the marker classes. Everything is scoped under `.classic-theme`, so the default theme is untouched.

**Try it:** enable Nodes 2.0 (`Comfy.VueNodes.Enabled`) and pick the "Classic (LiteGraph)" color palette.

## Why CSS-only wherever possible?

So the theme stays a theme. Selecting a different palette must fully restore stock Nodes 2.0, and the diff has to be reviewable as "styling" rather than behavior changes. The exceptions below are cases where no CSS lever existed.

## How did you handle multiline text being compressed in 2.0?

The "squished" look came from the stock textarea spending its space on chrome: 12px side padding, 1.5 line-height, large radius, plus a hidden floating label reserving height. Classic sets:

- `padding: 4px`, `line-height: 1.2`, `border-radius: 2px` (on the textarea AND its wrapper; mismatched radii clipped the scrollbar corner)
- thin scrollbars, floating label hidden
- font was already classic's 10px via `--comfy-textarea-font-size`

Result: the same node height shows roughly the same number of text lines as the classic canvas.

## What's the deal with the minimum horizontal size?

Nodes 2.0 has a hard 225px floor (`MIN_NODE_WIDTH`). Classic litegraph's floor is 140px, or 210px when the node has widgets (`NODE_WIDTH * 1.5` in `computeSize()`). The theme mirrors that exactly:

- `min-width: 140px` on nodes, raised to `210px` for nodes `:has(.lg-node-widgets)` (collapsed nodes have no widget grid, so they get 140)
- the widget grid's own minimum content width was ~217px, coming from its column floors (`minmax(80px)` label + `minmax(125px)` value), not from label text; the theme relaxes the value column to `minmax(90px, 1fr)` so widgets fit inside 210 without poking out the right edge
- interactive resize used to snap back to 225 because both resize clamps read the element's inline `style` min-width, which is never set, and fell back to the constant; they now read the computed style (`useNodeResize.ts`, `LGraphNode.vue`). That fix is theme-agnostic: the default theme still resolves 225.

## Why are the inc/dec buttons not at the ends of the widget pill like the original?

Widget rows are a CSS grid: `[slot dot | label | value]`. The label and the value component live in separate grid columns, and the stepper buttons are DOM children of the value component. Anchoring the decrement arrow to the pill's far-left edge would mean restructuring the grid or teleporting the button across columns, which is behavior surgery, not styling. The arrows sit around the value instead, which was judged close enough to keep the diff CSS-shaped.

Related: 2.0 number widgets had hover-only minus/plus icons, restyled to always-visible classic `◀ ▶` glyphs. Combo (dropdown) widgets had NO stepping logic at all, so `WidgetSelectDefault.vue` gained two `lg-combo-step` buttons with wrap-around value stepping; they are hidden by default and only shown by the classic stylesheet.

## Why did node sizes change every time I toggled renderers, and how was that fixed?

A ResizeObserver writes the Vue node's DOM size back into the litegraph node (`useVueNodeResizeTracking` → layout store → `liteNode.size`). Any styling that inflates DOM size therefore permanently grows the node. The theme removes every inflation source so DOM height equals classic `computeSize()` exactly (delta 0 on the test workflow):

- 20px widget rows (cap the row-height drivers: control heights, slot-dot container, PrimeVue input padding, textarea min-height)
- badges floated absolutely above the node instead of in-flow
- 30px header, classic body padding (10px below last widget, 2px if widget-less)
- width floors matching classic (see above)

## What happened with the "Show advanced inputs" strip?

Kept, it's a good 2.0 feature. First attempt hid the strip and forced advanced widgets visible; that was reverted. The strip is now reskinned via CSS only (10px muted text, small icon) and stays in layout flow.

A subtle bug from the first attempt is worth knowing: hiding only the strip's button left its wrapper in flow, and the wrapper carries `-mt-5`. An orphaned -20px margin makes the node's layout box 20px shorter than its rendered content, so the selection outline (absolutely positioned off the layout box) cut through the last widget row. If you ever hide the footer, hide the whole wrapper div.

The advanced-widget marker ring is recolored to litegraph's own `WIDGET_ADVANCED_OUTLINE_COLOR` (rgb(56 139 253 / 0.8)). Note that Tailwind inlines ring colors, so you must override `--tw-ring-color` on the element; overriding the `--color-*` theme variable does nothing.

## How are the widget "pills" (single label+value capsule) built?

Stock 2.0 draws the label outside a control box. Classic paints the pill (background, ring, radius) on the whole row (`lg-widget-field`) and makes the inner control surfaces transparent, so label (left, muted) and value (right-aligned, bright) share one capsule like classic's widget rendering. Textareas opt out and keep their own outlined block.

## Smaller answers

- **Boolean toggle too big:** PrimeVue's ToggleSwitch is sized by design tokens; the theme sets `--p-toggleswitch-width/height/handle-size` to 30/16/12 and recenters with `margin-block: -2px`.
- **Media not edge-to-edge:** `.image-preview` gets `padding-inline: 0` and square corners; the dimensions caption drops to 10px.
- **Title/body separator:** 1px `rgb(0 0 0 / 0.2)` bottom border on the header, suppressed while collapsed.
- **Slot dots:** intentionally kept 2.0's dots overlapping the node edge instead of classic's links-under-the-node look.

## Known gaps

- Only `WidgetSelectDefault` combos have step arrows; `WidgetSelectDropdown` and `FormDropdown` do not yet.
- The classic canvas renderer always draws advanced widgets (ComfyUI never sets litegraph's `widget.advanced`, only `widget.options.advanced`), so canvas and Vue disagree on collapsed-advanced height. Same quirk exists with the default theme.
- The subgraph "Enter" footer tab has no classic styling pass yet.
