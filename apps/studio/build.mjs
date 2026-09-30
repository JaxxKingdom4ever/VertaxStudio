import { cp, mkdir } from 'node:fs/promises';
await mkdir(new URL('../../dist/apps/studio/public/', import.meta.url), { recursive: true });
await cp(new URL('./public/index.html', import.meta.url), new URL('../../dist/apps/studio/public/index.html', import.meta.url));
await cp(new URL('./public/studio.css', import.meta.url), new URL('../../dist/apps/studio/public/studio.css', import.meta.url));
