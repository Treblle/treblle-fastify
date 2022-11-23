module.exports = function (fastify, options, done) {
  console.log("Got here")
  fastify.addHook('onRequest', (request, reply, done) => {
    console.log('Treblle handler')
    done()
  })
  done()
}
