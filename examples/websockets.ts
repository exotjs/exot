import { Exot } from '../lib.js';

// Run this example in Bun (it has websockets built-in)

const exot = new Exot()
  // It is possible to have GET and WS method routed to the same path
  .get('/', async () => {
    return 'Hello!';
  })

  // Simple WebSocket listener
  .ws('/', {
    message(ws, message) {
      ws.send(`WS received: ${message}`);
    },
  })
  
  // Check for Authorization header and upgrade connection
  .ws<{
    // user data
    authorization: string | null,
  }>('/auth_ws', {
    close() {
      console.log('WS closed');
    },
    message(ws, message) {
      ws.send(`WS received: ${message}`);
    },
    open(_ws, { authorization }) {
      console.log('WS open, user authorization:', authorization);
    },
    beforeUpgrade(req) {
      return {
        authorization: req.headers.get('authorization'),
      };
    }
  })

export default {
  port: 3000,
  fetch: exot.fetch,
  websocket: exot.websocket,
}