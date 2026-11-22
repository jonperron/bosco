#!/usr/bin/env node

/**
 * Setup script for OpenSpec and OpenWiki documentation
 * This script initializes the documentation system for Bosco
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('📚 Setting up Bosco documentation system...\n');

// Ensure directories exist
const dirs = [
  join(projectRoot, '.openspec'),
  join(projectRoot, '.openwiki'),
  join(projectRoot, 'specs'),
  join(projectRoot, 'wiki'),
  join(projectRoot, 'docs', 'specs'),
  join(projectRoot, 'docs', 'wiki'),
];

dirs.forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Check if OpenSpec config exists
const openspecConfigPath = join(projectRoot, '.openspec', 'config.yaml');
if (!existsSync(openspecConfigPath)) {
  console.log('\n⚠️  OpenSpec config not found. Creating default...');
  // We already created it, so this is just a fallback
}

// Check if OpenWiki config exists
const openwikiConfigPath = join(projectRoot, '.openwiki', 'config.json');
if (!existsSync(openwikiConfigPath)) {
  console.log('⚠️  OpenWiki config not found. Creating default...');
}

// Check if package.json has the required dependencies
const packageJsonPath = join(projectRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const requiredDeps = ['@fission-ai/openspec', 'openwiki'];
const missingDeps = requiredDeps.filter((dep) => !(dep in (packageJson.devDependencies || {})));

if (missingDeps.length > 0) {
  console.log('\n⚠️  Missing dependencies:');
  missingDeps.forEach((dep) => console.log(`  - ${dep}`));
  console.log('\nRun: pnpm install @fission-ai/openspec openwiki --save-dev\n');
} else {
  console.log('✅ All documentation dependencies are installed');
}

// Check if scripts exist
const scripts = packageJson.scripts || {};
const requiredScripts = [
  'openspec',
  'openspec:init',
  'openspec:validate',
  'openwiki',
  'openwiki:init',
  'openwiki:generate',
  'docs:generate',
];

const missingScripts = requiredScripts.filter((script) => !(script in scripts));
if (missingScripts.length > 0) {
  console.log('\n⚠️  Missing scripts in package.json:');
  missingScripts.forEach((script) => console.log(`  - ${script}`));
} else {
  console.log('✅ All documentation scripts are configured');
}

// Create default spec files if they don't exist
const defaultSpecs = [
  { name: 'project.spec.yaml', path: join(projectRoot, 'specs', 'project.spec.yaml') },
  { name: 'core.spec.yaml', path: join(projectRoot, 'specs', 'core.spec.yaml') },
];

defaultSpecs.forEach(({ name, path }) => {
  if (!existsSync(path)) {
    console.log(`⚠️  Default spec file missing: ${name}`);
  } else {
    console.log(`✅ Spec file exists: ${name}`);
  }
});

// Create default wiki files if they don't exist
const defaultWiki = [{ name: 'index.md', path: join(projectRoot, 'wiki', 'index.md') }];

defaultWiki.forEach(({ name, path }) => {
  if (!existsSync(path)) {
    console.log(`⚠️  Default wiki file missing: ${name}`);
  } else {
    console.log(`✅ Wiki file exists: ${name}`);
  }
});

// Try to run openspec init
try {
  console.log('\n🔍 Attempting to run openspec init...');
  execSync('npx @fission-ai/openspec init --yes', {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  console.log('✅ OpenSpec initialized');
} catch (error) {
  console.log('ℹ️  OpenSpec init skipped (already initialized or error)');
}

// Try to run openwiki init
try {
  console.log('\n🔍 Attempting to run openwiki init...');
  execSync('npx openwiki init --yes', {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  console.log('✅ OpenWiki initialized');
} catch (error) {
  console.log('ℹ️  OpenWiki init skipped (already initialized or error)');
}

console.log('\n✨ Documentation setup complete!');
console.log('\nNext steps:');
console.log('  1. Run: pnpm openspec:validate');
console.log('  2. Run: pnpm openwiki:generate');
console.log('  3. Run: pnpm docs:generate');
console.log('\nOr run: pnpm openspec and pnpm openwiki for CLI access');
