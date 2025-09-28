declare module 'argon2' {
  export interface Options {
    timeCost?: number;
    memoryCost?: number;
    parallelism?: number;
    saltLength?: number;
    raw?: false;
    type?: number;
  }

  export const argon2d: number;
  export const argon2i: number;
  export const argon2id: number;

  export function hash(password: string, options?: Options): Promise<string>;
  export function verify(
    hash: string,
    password: string,
    options?: Options
  ): Promise<boolean>;
  export function needsRehash(hash: string, options?: Options): boolean;

  const argon2: {
    hash: typeof hash;
    verify: typeof verify;
    needsRehash: typeof needsRehash;
    argon2d: typeof argon2d;
    argon2i: typeof argon2i;
    argon2id: typeof argon2id;
  };

  export default argon2;
}
