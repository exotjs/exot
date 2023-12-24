# Exot

__Status: currently in Alpha__

Exot is a cross-runtime TypeScript framework for building modern, high-performance server applications.

## Documentation

Visit [exot.dev](https://exot.dev) for documentation.

## Supported runtimes

- Node.js
- Bun
- Deno
- WinterCG compliant systems

## Usage

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