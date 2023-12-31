import { Exot } from '../lib/index.js';

const exot = new Exot()
  .get('/', () => {
    return 'Hi';
  })
  .post('/', async ({ json }) => {
    json({
      received: await json(),
    });
  });

console.log(`Server listening on ${await exot.listen(3000)}`);