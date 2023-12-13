import { Exot } from '../lib';

// DB mock
const db = {
  find: () => {
    return {
      id: 1,
      text: 'Hello'
    };
  },
};

const ex = new Exot()
  .share({
    db,
  })
  .get('/', ({ shared: { db } }) => {
    return `Text from db: ${db.find().text}`;
  });

console.log(`Server listening on ${await ex.listen(3000)}`);