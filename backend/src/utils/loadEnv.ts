import fs from 'fs';
import path from 'path';

const parseLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const exportPrefix = 'export ';
  const normalized = trimmed.startsWith(exportPrefix)
    ? trimmed.slice(exportPrefix.length)
    : trimmed;

  const equalsIndex = normalized.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = normalized.slice(0, equalsIndex).trim();
  if (!key) {
    return null;
  }

  const rawValue = normalized.slice(equalsIndex + 1).trim();
  let value = rawValue;

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    value = rawValue.slice(1, -1);
  }

  return [key, value];
};

const loadEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const resolveEnvPath = (filename: string): string => path.resolve(process.cwd(), filename);

const loadDefaultEnvFile = () => {
  const customPath = process.env.DOTENV_CONFIG_PATH;
  if (customPath) {
    loadEnvFile(path.resolve(process.cwd(), customPath));
    return;
  }

  loadEnvFile(resolveEnvPath('.env'));
};

loadDefaultEnvFile();
