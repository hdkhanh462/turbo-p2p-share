import type { Request } from "express";

interface CreateContextOptions {
  req: Request;
}

export async function createContext(opts: CreateContextOptions) {
  // No auth configured
  return {
    session: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
