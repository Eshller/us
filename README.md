# WhatsApp Keepsake App

A private, local-first web keepsake for a WhatsApp export. The app renders a WhatsApp-inspired chat archive first, with a short Wrapped-style recap that links back to real chat moments.

## Use With A WhatsApp Export

1. Export a WhatsApp chat as `.zip` or `_chat.txt`.
2. Place the export somewhere outside git, or rely on the current `.gitignore` rules for `*.zip` and `*_chat.txt`.
3. Import it:

```bash
npm run import:whatsapp -- path/to/export.zip
```

For month-first dates, use:

```bash
npm run import:whatsapp -- path/to/export.zip --month-first
```

4. Build the local gift:

```bash
npm run build
```

5. Open or preview the generated `dist/` folder locally:

```bash
npm run preview
```

Generated chat data and media live under `public/memory-data/`, which is gitignored.
The built `dist/` folder includes that generated archive, so treat `dist/` as private too.

## Verify

```bash
npm run test
npm run lint
npm run build
```
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
