import { Exot } from '../../deno_dist/index.ts';

const exot = new Exot()
  .get('/', () => {
    return 'Hi';
  })
  .post('/', async ({ json }) => {
    json({
      received: await json(),
    });
  });

Deno.serve({
  port: 3000,
}, exot.fetch)