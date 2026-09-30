#!/usr/bin/env node
/**
 * Markup and settings checks that matter when a plugin is uploaded to TRMNL.
 * The JavaScript rules live in ESLint (SonarJS, Unicorn, typescript-eslint).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const IGNORE_DIRS = new Set([
  '.cursor',
  '.git',
  'node_modules',
  'dist',
  'scripts',
]);

const FIELD_TYPES = new Set([
  'string',
  'multi_string',
  'text',
  'code',
  'number',
  'password',
  'url',
  'date',
  'time',
  'select',
  'xhrSelect',
  'xhrSelectSearch',
  'plugin_instance_select',
  'time_zone',
  'boolean',
  'author_bio',
  'copyable',
  'copyable_webhook_url',
]);

const INLINE_STYLE_PROPERTIES = [
  'justify-content',
  'padding',
  'margin',
  'background-color',
  'border-radius',
  'text-align',
  'object-fit',
  'font-size',
];
const MAX_INLINE_STYLES = 6;

type Issue = { file: string; message: string };

type Settings = {
  framework_version?: unknown;
  name?: unknown;
  custom_fields?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const BROKEN_CLASSES = [
  {
    pattern: /\bb-h-gray(?:-\d+)?\b/,
    message:
      'b-h-gray is not in Framework 3.4. Use border--h-10 through border--h-75.',
  },
  {
    pattern: /(?<![\w-])w-full(?![\w-])/,
    message: 'w-full is not in Framework 3.4. Use w--full.',
  },
  {
    pattern: /\blabel--muted\b/,
    message: 'label--muted is not in Framework 3.4. Use text--muted.',
  },
  {
    pattern: /\bborder--[hv]-[1-7]\b/,
    message:
      'Numbered border levels are removed in Framework 4. Use border--h-10 through border--h-75.',
  },
];

function pluginDirs() {
  return fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !IGNORE_DIRS.has(entry.name),
    )
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(repoRoot, name, 'settings.yml')));
}

function markup(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.liquid'))
    .map((name) => {
      const file = path.join(dir, name);
      return { file, text: fs.readFileSync(file, 'utf8') };
    });
}

function issue(file: string, message: string): Issue {
  return { file, message };
}

function checkFrameworkVersion(settings: Settings, settingsPath: string) {
  const version = settings.framework_version;
  if (typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version)) return [];
  return [
    issue(
      settingsPath,
      'framework_version must be a pinned release such as "3.4.0". The value "latest" follows every new Framework CSS release.',
    ),
  ];
}

function checkPluginName(settings: Settings, settingsPath: string) {
  if (typeof settings.name === 'string' && settings.name.length <= 50) return [];
  return [
    issue(settingsPath, 'Plugin name must be a string of at most 50 characters.'),
  ];
}

function checkField(field: unknown, settingsPath: string): Issue[] {
  if (!isRecord(field)) return [];
  const keyname =
    typeof field.keyname === 'string' ? field.keyname : '(missing keyname)';
  const missing = ['keyname', 'name', 'field_type'].filter(
    (required) => typeof field[required] !== 'string' || field[required] === '',
  );
  const issues = missing.map((required) =>
    issue(settingsPath, `custom field ${keyname} is missing ${required}.`),
  );
  if (
    typeof field.field_type === 'string' &&
    !FIELD_TYPES.has(field.field_type)
  ) {
    issues.push(
      issue(
        settingsPath,
        `custom field ${keyname} has unknown field_type "${field.field_type}".`,
      ),
    );
  }
  return issues;
}

function checkCustomFields(settings: Settings, settingsPath: string): Issue[] {
  const fields = settings.custom_fields;
  if (fields === undefined) return [];
  return Array.isArray(fields)
    ? fields.flatMap((field) => checkField(field, settingsPath))
    : [issue(settingsPath, 'custom_fields must be a list.')];
}

const MARKUP_FAILURES = [
  {
    test: (text: string) => text.toLowerCase().includes('async function'),
    message:
      'Async JavaScript is not allowed. TRMNL screenshots time out while it is in flight.',
  },
  {
    test: (text: string) => {
      const lower = text.toLowerCase();
      return (
        lower.includes('window.onload') ||
        lower.includes('window.addeventlistener("load")') ||
        lower.includes("window.addeventlistener('load')")
      );
    },
    message: 'Use DOMContentLoaded, not window.onload.',
  },
  {
    test: (text: string) => /opacity:\s*[\d.]+/.test(text),
    message:
      'Opacity does not render on e-ink. Use Framework gray text or background classes.',
  },
  {
    test: (text: string) =>
      /\bview(?:--|__)(?:full|half_horizontal|half_vertical|quadrant)\b/.test(
        text,
      ),
    message:
      'TRMNL already applies the view size class. Remove view--full and the other size classes.',
  },
  {
    test: (text: string) =>
      text.toLowerCase().includes('highcharts') &&
      !/animation:\s{0,6}false/.test(text),
    message:
      'Highcharts animations must be disabled so the screenshot captures the finished chart.',
  },
];

function checkInlineStyles(text: string, file: string): Issue[] {
  const inlineCount = INLINE_STYLE_PROPERTIES.reduce(
    (count, property) => count + text.split(property).length - 1,
    0,
  );
  if (inlineCount <= MAX_INLINE_STYLES) return [];
  return [
    issue(
      file,
      `Markup uses ${inlineCount} inline layout styles. Prefer Framework classes.`,
    ),
  ];
}

function checkMarkup(dir: string): Issue[] {
  const files = markup(dir);
  const all = files.map((file) => file.text).join('\n');
  const failures = MARKUP_FAILURES.filter((failure) => failure.test(all)).map(
    (failure) => issue(dir, failure.message),
  );
  const broken = files.flatMap((file) =>
    BROKEN_CLASSES.filter((rule) => rule.pattern.test(file.text)).map((rule) =>
      issue(file.file, rule.message),
    ),
  );
  return [...failures, ...checkInlineStyles(all, dir), ...broken];
}

function checkPlugin(name: string): Issue[] {
  const dir = path.join(repoRoot, name);
  const settingsPath = path.join(dir, 'settings.yml');
  const settings = parse(fs.readFileSync(settingsPath, 'utf8')) as Settings;
  return [
    ...checkFrameworkVersion(settings, settingsPath),
    ...checkPluginName(settings, settingsPath),
    ...checkCustomFields(settings, settingsPath),
    ...checkMarkup(dir),
  ];
}

const issues = pluginDirs().flatMap((name) => checkPlugin(name));
if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`${path.relative(repoRoot, issue.file)}: ${issue.message}`);
  }
  process.exit(1);
}

console.log('TRMNL plugin checks passed.');
