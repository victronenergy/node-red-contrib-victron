# Node Edit Dialog Design Guide

## Critical: CSS Isolation

**ALL CSS selectors MUST start with `.victron-form`** to prevent affecting other Node-RED nodes.

Node-RED loads all contrib node stylesheets globally. An unscoped CSS rule will affect EVERY node in the editor, breaking the appearance of non-Victron nodes.

```css
/* ❌ WRONG - affects all nodes */
.tooltip-icon { color: #00BCFF; }

/* ✅ CORRECT - only affects Victron nodes */
.victron-form .tooltip-icon { color: #00BCFF; }
```

Verify: Install another contrib node and confirm its edit dialog looks normal.

## Required Resources

Every node template must include:

```html
<link rel="stylesheet" href="resources/@victronenergy/node-red-contrib-victron/victron-styles.css">
<script src="resources/@victronenergy/node-red-contrib-victron/victron-common.js"></script>
```

## Standard HTML Structure

```html
<script type="text/html" data-template-name="victron-input-*">
    <div class="victron-form">
        <div id="stored-settings"></div>

        <div class="form-row">
            <label for="node-input-field">
                <i class="fa fa-tag"></i> Label
                <i class="fa fa-info-circle tooltip-icon" data-tooltip="Help text"></i>
            </label>
            <input type="text" id="node-input-field">
        </div>

        <div class="form-row community-link-row hidden" id="community-link-row">
            <div class="community-link-container">
                <a id="community-link" href="#" target="_blank">
                    <img class="community-link-img" src="resources/@victronenergy/node-red-contrib-victron/docs/community-link.svg">
                </a>
            </div>
        </div>
    </div>
</script>
```

Initialize tooltips after form render:
```javascript
window.__victronCommon.initializeTooltips();
```

## Label Icons

| Field | Icon |
|-------|------|
| Node name/label | `fa-tag` |
| Initial value | `fa-upload` |
| Rounding | `fa-minus-circle` |
| Only changes | `fa-bell` |
| Rate limit | `fa-tachometer` |

## Message Box Selection

| Use Case | Class | Icon |
|----------|-------|------|
| Errors, disconnected devices | `.form-warning` | `fa-exclamation-circle` |
| System notices | `.form-info` | None |
| Value types, enum options | `.form-tips` | None |
| Usage instructions | `.victron-doc-box` | None |
| Field help | `.tooltip-icon` | `fa-info-circle` |

**Info boxes do NOT use icons** - only warnings have icons to avoid confusion with tooltip icons.

See [victron-styles.css](/resources/victron-styles.css) for CSS definitions.

## Dynamic Content

Use CSS classes in JavaScript-generated HTML:

```javascript
// ✅ Good
$('#stored-settings').html(
    '<div class="stored-settings-display">' +
    '<i class="fa fa-save stored-settings-icon"></i>Stored: ' +
    node.serviceObj.name + ' &gt; ' + node.pathObj.name +
    '</div>'
);

// ❌ Bad - inline styles
$('#stored-settings').html(
    '<div style="font-size: 0.9em; color: #666;">Stored: ' +
    node.serviceObj.name +
    '</div>'
);
```

## CSS Override Example

When CSS inheritance causes issues (e.g., radio button labels inheriting `.form-row label` width), override explicitly:

```css
.victron-form .default-values-radio-container label {
    width: auto !important; /* Override .form-row label width */
}
```

See [victron-styles.css:274-293](/resources/victron-styles.css#L274-L293) for radio button example.

## Migration Notes

When removing inline styles:
- Static styles → move to `victron-styles.css` with semantic class
- Dynamic visibility (`display: none` toggled by JS) → acceptable to keep inline
- CSS class toggling preferred over inline style manipulation

## Reference Implementations

- Input/output nodes: [victron-nodes.html](/src/nodes/victron-nodes.html)
- Virtual device nodes: [victron-virtual.html](/src/nodes/victron-virtual.html)
