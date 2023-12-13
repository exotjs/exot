import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { Exot } from '../lib';

const ex = new Exot()
  // Return this file using streams
  .get('/stream.ts', async ({ stream, set }) => {
    set.headers.set('content-type', 'text/plain');
    stream(createReadStream(new URL(import.meta.url).pathname));
  })
  
  // Event stream
  // test with `curl http://localhost:3000/event_stream --no-buffer --output -`
  .get('/event_stream', ({ set }) => {
    set.headers.set('content-type', 'text/event-stream');
    let iterations = 0;
    return new Readable({
      read() {
        if (iterations === 10) {
          // end stream
          this.push(null);

        } else {
          iterations += 1;
          setTimeout(() => {
            this.push(JSON.stringify({
              time: new Date(),
              event: 'test',
            }) + '\n');
          }, 1000);
        }
      }
    });
  });

console.log(`Server listening on ${await ex.listen(3000)}`);