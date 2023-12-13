import { Exot, t } from '../lib';

const ex = new Exot({
  tracing: true,
})
  .post('/', async ({ json }) => {
    return {
      received: await json(),
    };
  }, {
    body: t.Object({
      message: t.String({
        minLength: 4,
      }),
    }),
  })

  .get('/hello/:name', ({ params, query }) => {
    return {
      message: `${query.greeting}, ${params.name}`,
    };
  }, {
    params: t.Object({
      name: t.String({
        minLength: 4,
      }),
    }),
    query: t.Object({
      greeting: t.Union([t.Literal('Hello'), t.Literal('Ahoy')], {
        default: 'Ahoy',
      }),
    }),
    response: t.Object({
      message: t.String(),
    }),
  });

console.log(`Server listening on ${await ex.listen(3000)}`);