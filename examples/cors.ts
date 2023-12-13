import { Exot } from '../lib';
import { cors } from '../lib/middleware/cors';

const exot = new Exot({
  name: 'main',
  tracing: true,
})
  .use(cors())
  .use(() => {
    console.log('...')
  })
  .get('/', () => {
    return 'Hi';
  });

console.log(`Server listening on ${await exot.listen(3000)}`);