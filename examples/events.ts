import { Exot } from '../lib';

const plugin = new Exot()
  .onRequest(async () => {
    console.log('> request received...');
  })

const exot = new Exot()
  .use(plugin)
  .get('/', () => {
    return 'Hi';
  })
  .post('/', async ({ json }) => {
    json({
      received: await json(),
    });
  });

console.log(`Server listening on ${await exot.listen(3000)}`);