import { Exot } from '../lib';
import { ForbiddenError } from '../lib/errors';

enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

// create `plugin/roles` implementing `userRole` decorator and `role` scope
const plugin = new Exot({
  name: 'plugin/roles',
})
  // user's role
  .decorate('userRole', null as Role | null)

  // required role
  .scope('role', undefined as Role | undefined)

  // execute this on every handler
  .onRoute(({ userRole, scope }) => {
    if (scope.role && userRole !== scope.role) {
      throw new ForbiddenError();
    }
  });

const ex = new Exot({
  tracing: true,
})
  // use the plugin above
  .use(plugin)

  // your authorization middleware, get the user's role somehow
  .use((ctx) => {
    // assuming ADMIN role, change this
    ctx.userRole = Role.ADMIN;
  })

  .get('/', async ({ userRole }) => {
    return {
      userRole,
    };
  }, {
    // define which role is required for this endpoint
    scope: {
      role: Role.ADMIN,
    },
  })
  .catch(Exot.throwNotFound);

console.log(`Server listening on ${await ex.listen(3000)}`);