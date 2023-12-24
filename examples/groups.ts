import { Exot } from '../lib.js';

const exot = new Exot({
  tracing: true,
});

const api = exot.group('/api', {
  name: 'API',
})
  .get('/', () => 'API endpoint')

api.group('/v1', {
  name: 'API v1'
})
  .get('/', async () => {
    return 'Hello from API v1';
  });

api.group('/v2', {
  name: 'API v2',
})
  .get('/', async () => {
    return 'Hello from API v2';
  });

console.log(`Server listening on ${await exot.listen(3000)}`);