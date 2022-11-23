const fastify =  require('fastify')({ logger: {
  level: 'error'
}})
const fastifyEnv = require('@fastify/env')
const TreblleMiddleware = require('../index')

fastify.register(TreblleMiddleware)

const schema = {
  type: 'object',
  required: [ 'TREBLLE_API_KEY', 'TREBLLE_PROJECT_ID' ],
  properties: {
    TREBLLE_API_KEY: {
      type: 'string'
    },
    TREBLLE_PROJECT_ID: {
      type: 'string'
    }
  }
}

fastify.register(fastifyEnv, {
  schema,
  dotenv: true
})

fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})


fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  console.log(`Server is now listening on http://localhost:3000`)
})
