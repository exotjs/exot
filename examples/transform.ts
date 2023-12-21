import { Exot, t} from '../lib';


const ex = new Exot()
  .get('/:integer', ({ params }) => {
    return {
      params,
    };
  }, {
    params: t.Object({
      addedProp: t.String(),
      integer: t.Integer(),
    }),
    transform: (ctx) => {
      Object.assign(ctx.params, {
        addedProp: 'test',
      });
    },
  });

console.log(`Server listening on ${await ex.listen(3000)}`);