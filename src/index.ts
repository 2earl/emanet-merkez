import { createApp } from './app';

/** Emanet Merkez at emanet-merkez.2earl.com (emanet-core docs/DESIGN.md §7). */

const now = () => Math.floor(Date.now() / 1000);
const app = createApp(now);

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
