import { Exot, t } from '../lib.js';
import { printTraces } from '../lib/helpers.js';

async function slowFunc(name: string) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Hello, ${name}`);
    }, 500);
  });
}

const ex = new Exot({
  // enable global tracing
  tracing: true,
})
  // Or define your trace handler
  /*
  .trace((ctx) => {
    printTraces(ctx);
  })
  */

  .get('/hello/:name', async ({ trace, params }) => {
    // custom tracer bound to a named function
    const greeting = await trace(() => slowFunc(params.name), 'slowFunc');
    return greeting;
  }, {
    params: t.Object({
      name: t.String({
        minLength: 4,
      }),
    }),
    response: t.String(),
  });

console.log(`Server listening on ${await ex.listen(3000)}`);