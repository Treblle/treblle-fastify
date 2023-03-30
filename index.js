const fp = require('fastify-plugin')
const {
  sendPayloadToTreblle,
  generateFieldsToMask,
  maskSensitiveValues,
  generateTrebllePayload,
  getResponsePayload,
} = require('@treblle/utils')
const { version: sdkVersion } = require('./package.json')

async function treblleFastify(
  fastify,
  {
    apiKey = process.env.TREBLLE_API_KEY,
    projectId = process.env.TREBLLE_PROJECT_ID,
    additionalFieldsToMask = [],
  }
) {
  fastify.decorateReply('payload', null)

  fastify.addHook('onSend', (request, reply, payload, done) => {
    reply.payload = payload
    done()
  })
  fastify.addHook('onResponse', (request, reply, done) => {
    done()
    let errors = []
    const body = request.body ?? {}
    const params = request.params
    const query = request.query
    const requestPayload = { ...body, ...params, ...query }
    const fieldsToMask = generateFieldsToMask(additionalFieldsToMask)
    const maskedRequestPayload = maskSensitiveValues(requestPayload, fieldsToMask)
    const protocol = `${request.protocol}/${request.raw.httpVersion}`

    const { payload: maskedResponseBody, error: invalidResponseBodyError } = getResponsePayload(
      reply.payload,
      fieldsToMask
    )

    if (invalidResponseBodyError) {
      errors.push(invalidResponseBodyError)
    }

    const trebllePayload = generateTrebllePayload(
      { api_key: apiKey, project_id: projectId, sdk: 'fastify', version: sdkVersion },
      {
        server: {
          protocol,
          ip: fastify.server.address().address,
        },
        request: {
          ip: request.ip,
          url: `${request.protocol}://${request.headers['host']}${request.url}`,
          user_agent: request.headers['user-agent'],
          method: request.method,
          headers: maskSensitiveValues(request.headers, fieldsToMask),
          body: maskedRequestPayload,
        },
        response: {
          headers: maskSensitiveValues(reply.getHeaders(), fieldsToMask),
          code: reply.statusCode,
          size: reply.getHeader('content-length'),
          load_time: reply.getResponseTime(),
          body: maskedResponseBody ?? null,
        },
        errors,
      }
    )

    try {
      sendPayloadToTreblle(trebllePayload, apiKey)
    } catch (error) {
      console.log(error)
    }
  })
}

module.exports = fp(treblleFastify, {
  name: 'treblle-fastify',
})
