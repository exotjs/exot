# Exot

__Work in progress__

Exot is a cross-platform TypeScript framework for building modern, high-performance server applications.

Supported platforms:

- Node.js
- Bun
- WinterCG compliant systems

Platform support under way:

- Deno
- AWS Lambda

Supported adapters:

- Fetch (WinterCG)
- uWebSockets.js
- Node.js built-in http server

Example:

```js
import { Exot } from '@exotjs/exot';

new Exot()
  .get('/', () => 'Hello world')
  .post('/', async ({ json }) => {
    return {
      received: await json(),
    };
  })
  .listen(3000);
```

## License

MIT