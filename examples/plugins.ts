import { Exot } from '../lib';

const plugin = new Exot({
  prefix: '/me',
})
  .decorate('name', 'default name')
  .use(({ name }) => {

  })
  .add('GET', '/:name', ({ name, params }) => {

  })
  .get('/', (ctx) => {
    const { name, greeting } = ctx as typeof ctx & { greeting: string };
    return {
      greeting,
      name,
    };
  });

const ex = new Exot()
  .decorate('greeting', 'Hello')
  .use(plugin)
  .get('/', ({ greeting, name }) => {
    return `${greeting}, ${name}`;
  });

console.log(`Server listening on ${await ex.listen(3000)}`);