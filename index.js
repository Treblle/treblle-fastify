const fp = require('fastify-plugin')
const {
  sendPayloadToTreblle,
  generateFieldsToMask,
  maskSensitiveValues,
} = require('@treblle/utils')
const os = require('os')
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
    let originalResponseBody = reply.payload
    let maskedResponseBody
    try {
      if (Buffer.isBuffer(reply.payload)) {
        originalResponseBody = originalResponseBody.toString('utf8')
      }
      if (typeof originalResponseBody === 'string') {
        let parsedResponseBody = JSON.parse(originalResponseBody)
        maskedResponseBody = maskSensitiveValues(parsedResponseBody, fieldsToMask)
      } else if (typeof originalResponseBody === 'object') {
        maskedResponseBody = maskSensitiveValues(originalResponseBody, fieldsToMask)
      }
    } catch (error) {
      // if we can't parse the body we'll leave it empty and set an error
      errors.push({
        source: 'onShutdown',
        type: 'INVALID_JSON',
        message: 'Invalid JSON format',
        file: null,
        line: null,
      })
    }
    const trebllePayload = {
      api_key: apiKey,
      project_id: projectId,
      sdk: 'fastify',
      version: sdkVersion,
      data: {
        server: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          os: {
            name: os.platform(),
            release: os.release(),
            architecture: os.arch(),
          },
          software: null,
          signature: null,
          protocol,
          ip: fastify.server.address().address,
        },
        language: {
          name: 'node',
          version: process.version,
        },
        request: {
          timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
          ip: request.ip,
          url: `${request.protocol}://${request.headers['host']}${request.url}`,
          user_agent: request.headers['user-agent'],
          method: request.method,
          headers: request.headers,
          body: maskedRequestPayload,
        },
        response: {
          headers: reply.getHeaders(),
          code: reply.statusCode,
          size: reply.getHeader('content-length'),
          load_time: reply.getResponseTime(),
          body: maskedResponseBody ?? null,
        },
        errors,
      },
    }
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
