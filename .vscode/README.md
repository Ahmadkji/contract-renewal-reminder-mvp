# VSCode Configuration

This directory contains workspace-specific VSCode settings for the project.

## Files

### `settings.json`
Configures VSCode to properly handle Tailwind CSS v4 syntax:

- **`"css.validate": false`** - Disables VSCode's built-in CSS validation (which doesn't recognize Tailwind v4 at-rules)
- **`"files.associations": { "*.css": "tailwindcss" }`** - Associates CSS files with Tailwind CSS for better IntelliSense
- **`"css.lint.unknownAtRules": "ignore"`** - Ignores warnings for Tailwind-specific at-rules like `@reference`, `@custom-variant`, `@theme`, and `@apply`

### `extensions.json`
Recommends the **Tailwind CSS IntelliSense** extension for all developers working on this project.

## Why These Settings Are Needed

This project uses **Tailwind CSS v4**, which introduced new CSS at-rules:

- `@reference` - Import Tailwind CSS without emitting styles
- `@custom-variant` - Create custom variants (like dark mode)
- `@theme` - Define theme variables in CSS
- `@apply` - Apply utility classes to custom selectors

These are **valid Tailwind CSS v4 syntax**, but VSCode's default CSS language server doesn't recognize them, causing false-positive linting errors.

## Applying These Settings

After cloning this repository:

1. **Reload VSCode** - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux), then type "Reload Window"
2. **Install Recommended Extensions** - Click the Extensions icon in the sidebar, then click "Workspace Recommendations"
3. **Verify** - Open any CSS file and confirm no "Unknown at rule" errors appear

## Removing These Settings

If you prefer not to use these workspace settings:

1. Delete the `.vscode` directory
2. Reload VSCode
3. Manually configure your user-level VSCode settings to ignore Tailwind at-rules
