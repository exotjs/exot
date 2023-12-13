import adapter from '../../lib/adapters/node';
import { Exot } from '../../lib';

const ex = new Exot()
  // mount NodeAdapter
  .adapter(adapter())

  .get('/', ({ text }) => {
    // req.raw is an instance of IncomingMessage
    text('Hi')
  })

  .post('/', async ({ headers, method, path, query, json, remoteAddress }) => {
    json({
      body: await json(),
      headers,
      method,
      path,
      query,
      remoteAddress,
    });
  });

console.log(`Server listening on ${await ex.listen(3000)}`);