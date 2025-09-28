import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_KEY = 'LOAD_ENV_TEST_REPO_ROOT';

const writeEnvFileWithTestValue = (envPath: string, previousContent: string | null) => {
  const baseContent = previousContent ?? '';
  const normalized = baseContent.endsWith('\n') || baseContent.length === 0 ? baseContent : `${baseContent}\n`;
  fs.writeFileSync(envPath, `${normalized}${TEST_KEY}=root-level-value\n`, 'utf8');
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
