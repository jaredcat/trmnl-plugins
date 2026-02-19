# trmnl-plugins

A collection of plugins for [TRMNL](https://trmnl.com) (recipes/widgets for TRMNL displays).

## Structure

Each plugin lives in its own directory at the repo root. A **plugin** is any directory that contains a `settings.yml` file.

## Plugins

| Plugin | Description |
|--------|-------------|
| [personal-steam-deals](personal-steam-deals/) | Personalized Steam deals you don’t already own |

## Development

### Prerequisites

- Node.js (for build tooling)
- npm

### Build

```bash
npm install
npm run build
```

The build script:

1. Finds all plugin directories (those with `settings.yml`)
2. Copies each plugin into `dist/` (excluding `transform.ts`)
3. Compiles any `transform.ts` in a plugin to `transform.js` in `dist/<plugin>/`
4. Zips each plugin as `dist/<plugin>.zip`

Output is in the `dist/` folder. Use the contents of a plugin folder or the corresponding zip when installing or sharing a plugin.

### Clean

```bash
npm run clean
```

Removes the `dist/` directory.

## Adding a plugin

1. Create a new directory at the repo root (e.g. `my-plugin`).
2. Add a `settings.yml` that defines the plugin for TRMNL (strategy, polling/static, custom fields, etc.).
3. Add layout templates (e.g. `full.liquid`, `half_vertical.liquid`) and optional `shared.liquid`.
4. Optionally add `transform.ts`; it will be compiled to `transform.js` during build.
5. Run `npm run build`; your plugin will be built and zipped in `dist/`.