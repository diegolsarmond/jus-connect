import type { Options as Argon2Options } from 'argon2';

export type { Argon2Options };

export interface Argon2Module {
  hash(password: string, options?: Argon2Options): Promise<string>;
  verify(hash: string, password: string, options?: Argon2Options): Promise<boolean>;
  needsRehash?(hash: string, options?: Argon2Options): boolean;
  argon2id: number;
}
