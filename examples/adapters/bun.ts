import { Exot } from '../../lib';

const exot = new Exot()
  .get('/', () => {
    return 'Hi';
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
  })

  .post('/publish', async ({ json, pubsub }) => {
    return {
      subscribers: pubsub.publish('test_topic', await json()),
    };
  })
  
  .ws('/ws', {
    beforeUpgrade(req: Request) {
      return {
        auth: req.headers.get('authentication'),
      };
    },
    open(ws) {
      ws.subscribe('test_topic');
    },
    message(_ws, data, userData) {
      console.log('> received', data, userData);
    },
  });

console.log(`Server listening on ${await exot.listen(3000)}`);

// export handler and optional port number
/*
export default {
  port: 3000,
  fetch: exot.fetch,

  // enable websockets by attaching `.websocket` from the BunAdapter
  websocket: bunAdapter.websocket,
};
*/

// or simply export x, as it exposes .fetch interface
// export default x;