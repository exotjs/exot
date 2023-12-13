import adapter from '../../lib/adapters/fetch';
import { Exot } from '../../lib';

const ex = new Exot()
  // Mount FetchAdapter
  .adapter(adapter())

  .get('/', ({ text }) => {
    // return 'Hello from Bun!';
    // res.text('Hi');
    // return 'Hi'
    text('Hi')
  })

  .post('/', async ({ json }) => {
    json({
      body: await json(),
    });
  })

  .post('/inspect', async ({ headers, method, path, query, json, remoteAddress }) => {
    return ({
      body: await json(),
      headers,
      method,
      path,
      query,
      remoteAddress,
    });
  });

// export handler and optional port number
export default {
  port: 3000,
  fetch: ex.fetch,
};

// or simply export x, as it exposes .fetch interface
// export default x;