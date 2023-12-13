import { Exot } from '../lib';

const ex = new Exot()
  // It is possible to have GET and WS method routed to the same path
  .get('/', async () => {
    return 'Hello!';
  })

  // Simple WebSocket listener
  .ws('/', {
    message(ws, message) {
      ws.send(`WS received: ${new TextDecoder().decode(message)}`);
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
      ws.send(`WS received: ${new TextDecoder().decode(message)}`);
    },
    open(ws) {
      const { authorization } = ws.getUserData();
      console.log('WS open, user authorization:', authorization);
    },
    /*
    upgrade(res, req, context) {
      const remoteAddress = new TextDecoder().decode(res.getRemoteAddressAsText());
      const authorization = req.getHeader('authorization');
      if (!authorization) {
        console.log('WS unauthorized, remoteAddress:', remoteAddress);
        res.writeStatus('401');
        res.endWithoutBody();

      } else {
        res.upgrade(
          {
            authorization,
          },
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context,
        );
      }
    },
    */
  })

console.log(`Server listening on ${await ex.listen(3000)}`);