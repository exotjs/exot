import { Exot } from '../lib/index.js';

const exot = new Exot()
  .decorate('getDate', () => new Date())
  .get('/', ({ getDate }) => {
    return `Today is ${getDate()}`;
  });

console.log(`Server listening on ${await exot.listen(3000)}`);