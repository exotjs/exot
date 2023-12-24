import { writeFile } from 'node:fs/promises';
import { Exot } from '../lib.js';

const ex = new Exot()
  .post('/', async ({ stream }) => {
    await writeFile('./uploaded_file', stream());
    return {
      ok: true,
    };
  });

console.log(`Server listening on ${await ex.listen(3000)}`);