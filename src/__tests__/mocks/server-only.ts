// Stand-in for the "server-only" marker under vitest (see vitest.config.ts).
// In the app, Next resolves it and refuses any client bundle that imports
// a module carrying it; tests run on the server, so there is nothing to guard.
export {};
