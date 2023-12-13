import { Exot } from '../lib';

const exot = new Exot()
  .get('/', async ({ cookies }) => {
    // get all cookies as object
    const received = cookies.getAll();

    // set new cookie
    cookies.set('test', Date.now().toString(), {
      maxAge: 600,
    });

    return {
      received,
    };
  });

console.log(`Server listening on ${await exot.listen(3000)}`);