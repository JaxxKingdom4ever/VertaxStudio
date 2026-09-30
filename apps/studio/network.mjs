/** Bind local by default: /api/project can write files to a local workspace. */
export function resolveListenHost(env){return env.VERTAX_BIND_HOST || '127.0.0.1'}
