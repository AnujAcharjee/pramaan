declare module 'ejs-mate' {
  const engine: (path: string, options: object, callback: (err: unknown, rendered?: string) => void) => void;

  export = engine;
}
