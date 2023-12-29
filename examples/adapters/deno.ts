import { Exot } from '../../deno_dist/index.ts';

const exot = new Exot()
  .get('/', () => {
    return 'Hi';
  })
  .post('/', async ({ json }) => {
    json({
      received: await json(),
    });
  })

  .ws('/ws', {
    beforeUpgrade(ctx) {
      // noop
    },
    open(ws) {
      ws.subscribe('test_topic');
      ws.send('hello')
    },
    message(_ws, data) {
      console.log('> received', data);
    },
  });

Deno.serve({
  port: 3000,
}, exot.fetch)