import { Exot } from '../lib';

const ex = new Exot()
  .ws('/chat', {
    message(ws, message) {
      // The message will be sent all subscribed sockets except for the current one (who sent the message)
      ws.publish('channel_1', message);
    },
    open(ws) {
      ws.subscribe('channel_1');
    },
  });

console.log(`Server listening on ${await ex.listen(3000)}`);