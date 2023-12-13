import { Exot } from '../lib';

const adminRouter = new Exot({
  name: 'router/admin',
  prefix: '/admin'
})
  .get('/', () => {
    return {
      admin: true,
    };
  });

const apiUsersRouter = new Exot({
  name: 'router/api/users',
  prefix: '/users'
})
  .get('/', () => {
    return {
      users: true,
    };
  });

const apiRouter = new Exot({
  name: 'router/api',
  prefix: '/api'
})
  .use(apiUsersRouter)
  .get('/', () => {
    return {
      api: true,
    };
  });

const ex = new Exot({
  tracing: true,
})
  .use(adminRouter)
  .use(apiRouter)
  .get('/', () => {
    return {
      main: true,
    };
  })

console.log(`Server listening on ${await ex.listen(3000)}`);