declare module 'fs' {
  export function readFileSync(path: string, options?: any): string;
}

declare module 'path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
}

declare module 'node:test' {
  const test: any;
  export default test;
}

declare var process: any;
declare var __dirname: string;
declare module 'express';
declare module 'pg';
declare module 'net';
declare module 'node:assert';
