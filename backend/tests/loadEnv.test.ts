import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_KEY = 'LOAD_ENV_TEST_REPO_ROOT';
const BACKEND_KEY = 'LOAD_ENV_TEST_BACKEND_ROOT';
const ROOT_ONLY_KEY = 'LOAD_ENV_TEST_ROOT_ONLY';
const SHARED_KEY = 'LOAD_ENV_TEST_SHARED';

const writeEnvFileWithTestValue = (envPath: string, previousContent: string | null) => {
  const baseContent = previousContent ?? '';
  const normalized = baseContent.endsWith('\n') || baseContent.length === 0 ? baseContent : `${baseContent}\n`;
  fs.writeFileSync(envPath, `${normalized}${TEST_KEY}=root-level-value\n`, 'utf8');
};

const readEnvFileIfExists = (envPath: string): string | null => {
  return fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : null;
};

const restoreEnvFile = (envPath: string, previousContent: string | null) => {
  if (previousContent !== null) {
    fs.writeFileSync(envPath, previousContent, 'utf8');
  } else if (fs.existsSync(envPath)) {
    fs.unlinkSync(envPath);
  }
};

test('loads .env from repository root when cwd is backend directory', async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const backendRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');

  const originalCwd = process.cwd();
  const originalEnvValue = process.env[TEST_KEY];
  const originalDotenvConfigPath = process.env.DOTENV_CONFIG_PATH;
  const envFileExisted = fs.existsSync(envPath);
  const previousContent = envFileExisted ? fs.readFileSync(envPath, 'utf8') : null;

  try {
    writeEnvFileWithTestValue(envPath, previousContent);

    process.chdir(backendRoot);
    delete process.env[TEST_KEY];
    delete process.env.DOTENV_CONFIG_PATH;

    const modulePath = path.resolve(backendRoot, 'src/utils/loadEnv.ts');
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore if the module is not in the cache yet or cannot be resolved via require
    }

    const moduleUrl = pathToFileURL(modulePath);
    moduleUrl.searchParams.set('test', Date.now().toString());
    await import(moduleUrl.href);

    assert.strictEqual(
      process.env[TEST_KEY],
      'root-level-value',
      'env var from repo root should be loaded when cwd is backend/'
    );
  } finally {
    process.chdir(originalCwd);

    if (originalEnvValue === undefined) {
      delete process.env[TEST_KEY];
    } else {
      process.env[TEST_KEY] = originalEnvValue;
    }

    if (originalDotenvConfigPath === undefined) {
      delete process.env.DOTENV_CONFIG_PATH;
    } else {
      process.env.DOTENV_CONFIG_PATH = originalDotenvConfigPath;
    }

    if (envFileExisted) {
      fs.writeFileSync(envPath, previousContent ?? '', 'utf8');
    } else if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
  }
});

test('loads backend and repo .env files without overriding backend values', async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const backendRoot = path.resolve(__dirname, '..');
  const backendEnvPath = path.join(backendRoot, '.env');
  const repoEnvPath = path.join(repoRoot, '.env');

  const originalCwd = process.cwd();
  const originalBackendValue = process.env[BACKEND_KEY];
  const originalRootOnlyValue = process.env[ROOT_ONLY_KEY];
  const originalSharedValue = process.env[SHARED_KEY];
  const originalDotenvConfigPath = process.env.DOTENV_CONFIG_PATH;
  const backendPreviousContent = readEnvFileIfExists(backendEnvPath);
  const repoPreviousContent = readEnvFileIfExists(repoEnvPath);

  try {
    fs.writeFileSync(
      backendEnvPath,
      `${BACKEND_KEY}=backend-value\n${SHARED_KEY}=backend-only\n`,
      'utf8'
    );
    fs.writeFileSync(
      repoEnvPath,
      `${ROOT_ONLY_KEY}=root-value\n${SHARED_KEY}=root-value\n`,
      'utf8'
    );

    process.chdir(backendRoot);
    delete process.env[BACKEND_KEY];
    delete process.env[ROOT_ONLY_KEY];
    delete process.env[SHARED_KEY];
    delete process.env.DOTENV_CONFIG_PATH;

    const modulePath = path.resolve(backendRoot, 'src/utils/loadEnv.ts');
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore if the module is not in the cache yet or cannot be resolved via require
    }

    const moduleUrl = pathToFileURL(modulePath);
    moduleUrl.searchParams.set('test', Date.now().toString());
    await import(moduleUrl.href);

    assert.strictEqual(
      process.env[BACKEND_KEY],
      'backend-value',
      'should load values defined in backend/.env first'
    );
    assert.strictEqual(
      process.env[ROOT_ONLY_KEY],
      'root-value',
      'should load values that exist only in repo/.env'
    );
    assert.strictEqual(
      process.env[SHARED_KEY],
      'backend-only',
      'backend/.env should retain priority over repo/.env for shared keys'
    );
  } finally {
    process.chdir(originalCwd);

    if (originalBackendValue === undefined) {
      delete process.env[BACKEND_KEY];
    } else {
      process.env[BACKEND_KEY] = originalBackendValue;
    }

    if (originalRootOnlyValue === undefined) {
      delete process.env[ROOT_ONLY_KEY];
    } else {
      process.env[ROOT_ONLY_KEY] = originalRootOnlyValue;
    }

    if (originalSharedValue === undefined) {
      delete process.env[SHARED_KEY];
    } else {
      process.env[SHARED_KEY] = originalSharedValue;
    }

    if (originalDotenvConfigPath === undefined) {
      delete process.env.DOTENV_CONFIG_PATH;
    } else {
      process.env.DOTENV_CONFIG_PATH = originalDotenvConfigPath;
    }

    restoreEnvFile(backendEnvPath, backendPreviousContent);
    restoreEnvFile(repoEnvPath, repoPreviousContent);
  }
});

test('prefers backend values over repo defaults when running from repo root', async () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const backendRoot = path.resolve(__dirname, '..');
  const backendEnvPath = path.join(backendRoot, '.env');
  const repoEnvPath = path.join(repoRoot, '.env');

  const originalCwd = process.cwd();
  const originalBackendValue = process.env[BACKEND_KEY];
  const originalSharedValue = process.env[SHARED_KEY];
  const originalDotenvConfigPath = process.env.DOTENV_CONFIG_PATH;
  const backendPreviousContent = readEnvFileIfExists(backendEnvPath);
  const repoPreviousContent = readEnvFileIfExists(repoEnvPath);

  try {
    fs.writeFileSync(
      backendEnvPath,
      `${BACKEND_KEY}=backend-value\n${SHARED_KEY}=backend-only\n`,
      'utf8'
    );
    fs.writeFileSync(
      repoEnvPath,
      `${SHARED_KEY}=root-value\n`,
      'utf8'
    );

    process.chdir(repoRoot);
    delete process.env[BACKEND_KEY];
    delete process.env[SHARED_KEY];
    delete process.env.DOTENV_CONFIG_PATH;

    const modulePath = path.resolve(backendRoot, 'src/utils/loadEnv.ts');
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore if the module is not in the cache yet or cannot be resolved via require
    }

    const moduleUrl = pathToFileURL(modulePath);
    moduleUrl.searchParams.set('test', Date.now().toString());
    await import(moduleUrl.href);

    assert.strictEqual(
      process.env[BACKEND_KEY],
      'backend-value',
      'backend/.env should load even when cwd is repo root'
    );
    assert.strictEqual(
      process.env[SHARED_KEY],
      'backend-only',
      'backend/.env should maintain priority over repo/.env when cwd is repo root'
    );
  } finally {
    process.chdir(originalCwd);

    if (originalBackendValue === undefined) {
      delete process.env[BACKEND_KEY];
    } else {
      process.env[BACKEND_KEY] = originalBackendValue;
    }

    if (originalSharedValue === undefined) {
      delete process.env[SHARED_KEY];
    } else {
      process.env[SHARED_KEY] = originalSharedValue;
    }

    if (originalDotenvConfigPath === undefined) {
      delete process.env.DOTENV_CONFIG_PATH;
    } else {
      process.env.DOTENV_CONFIG_PATH = originalDotenvConfigPath;
    }

    restoreEnvFile(backendEnvPath, backendPreviousContent);
    restoreEnvFile(repoEnvPath, repoPreviousContent);
  }
});
