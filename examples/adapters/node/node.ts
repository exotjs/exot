import { WebSocketServer } from 'ws';
import { Exot } from '../../../lib';
import { adapter } from '../../../lib/adapters/node';

const ex = new Exot()
  .adapter(adapter({
    // enable WebSockets by attaching the WebSocketServer instance from the `ws` package
    wss: new WebSocketServer({
      noServer: true,
    }),
  }))

  .get('/', () => {
    return 'Hi';
  })

  .ws('/ws/:name', {
    beforeUpgrade(ctx) {
      // noop
    },
    open(ws) {
      ws.subscribe('test_topic');
    },
    message(_ws, data, { params }) {
      console.log('> received', params, data);
    },
  });

console.log(`Server listening on ${await ex.listen(3000)}`);