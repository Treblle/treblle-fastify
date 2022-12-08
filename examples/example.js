const fastify = require('fastify')({
  logger: {
    level: 'error',
  },
})
require('dotenv').config()

const treblleFastify = require('../index')

fastify.register(treblleFastify)

fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})

fastify.post('/', function (request, reply) {
  reply.send({ data: request.body })
})

fastify.get('/users/:id', function (request, reply) {
  reply.send({ message: `Retrieved user with ${request.params.id} successfully` })
})

fastify.listen({ port: 3000 }, function (err) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  console.log(`Server is now listening on http://localhost:3000`)
})
