import adapter from '../lib/adapters/uws';
import { Exot } from '../lib';

const exot = new Exot()
  .adapter(adapter())
  .get('/', () => {
    return 'Hi';
  })
  .post('/', async ({ json }) => {
    json({
      received: await json(),
    });
  });

console.log(`Server listening on ${await exot.listen(3000)}`);