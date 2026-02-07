#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const PACKAGE_JSON_FILES_PATHS = [
  'package.json',
  'backend/package.json',
  'frontend/package.json',
  'shared/package.json',
];

const README_PATH = 'README.md';

const writeFileIfChanged = (fullPath, content) => {
  const existingContent = existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : null;

  if (existingContent !== content) {
    writeFileSync(fullPath, content, 'utf8');

    return true;
  }

  return false;
};

const readFile = (fullPath) => {
  if (!existsSync(fullPath)) {
    console.warn(`  ⚠️  File not found: ${fullPath}`);

    return null;
  }

  return readFileSync(fullPath, 'utf-8');
};

const readJsonFile = (fullPath) => {
  try {
    return JSON.parse(readFile(fullPath));
  } catch (error) {
    console.warn(`  ⚠️  Failed to read/parse JSON: ${fullPath} - ${error.message}`);

    return null;
  }
};

const updatePackageVersions = (newVersion) => {
  console.log(`📦 Updating package.json versions to ${newVersion}`);

  PACKAGE_JSON_FILES_PATHS.forEach((filePath) => {
    const fullPath = resolve(filePath);

    const json = readJsonFile(fullPath);

    if (!json) {
      return;
    }

    if (json.version !== newVersion) {
      json.version = newVersion;

      const out = JSON.stringify(json, null, 2) + '\n';

      if (writeFileIfChanged(fullPath, out)) {
        console.log(`  ✅ Updated ${filePath}`);
      }
    } else {
      console.log(`  ℹ️  ${filePath} already at version ${newVersion}`);
    }
  });
};

const updateReadmeVersion = (newVersion) => {
  console.log(`📝 Updating README Docker tags to ${newVersion}`);

  const fullPath = resolve(README_PATH);

  let content = readFile(fullPath);

  if (!content) {
    console.log(`  ℹ️  No README content found.`);
  }

  // e.g. ghcr.io/org/repo:1.2.3
  const ghcrSemverRegex = new RegExp(
    '(ghcr\\.io\\/[^\\s)]+:)(v?\\d+\\.\\d+\\.\\d+(?:-[\\w.-]+)?)',
    'g'
  );

  content = content.replace(ghcrSemverRegex, (match, prefix) => `${prefix}${newVersion}`);

  if (writeFileIfChanged(fullPath, content)) {
    console.log(`  ✅ Updated README Docker tags`);
  } else {
    console.log(`  ℹ️  Did not found any README Docker tags that needs changing.`);
  }
};

const main = () => {
  const args = process.argv.slice(2);

  if (!args.length) {
    console.error('❌ Error: Version number required');

    console.error('Usage: node change-version-references.js <version>');

    process.exit(1);
  }

  const version = args[0];

  try {
    updatePackageVersions(version);

    updateReadmeVersion(version);

    console.log(`✨ Version update complete!`);
  } catch (error) {
    console.error('❌ Error updating versions:', error.message);

    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
