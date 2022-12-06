const fp = require('fastify-plugin')
const { fetch, generateFieldsToMask, maskSensitiveValues } = require('@treblle/utils')
const os = require('os')

async function treblleFastify (fastify, {
  apiKey = process.env.TREBLLE_API_KEY,
  projectId = process.env.TREBLLE_PROJECT_ID,
  showErrors = true,
  additionalFieldsToMask = []}) {

  fastify.addHook('onSend', async (request, reply, payload) => {
    let errors = []
    const body = request.body ?? {}
    const params = request.params
    const query = request.query
    const requestPayload = {...body, ...params, ...query}
    const fieldsToMask = generateFieldsToMask(additionalFieldsToMask)
    const maskedRequestPayload = maskSensitiveValues(requestPayload, fieldsToMask)

    const protocol = `${request.protocol}/${request.raw.httpVersion}`

    let originalResponseBody = payload
    let maskedResponseBody
    try {
      if (Buffer.isBuffer(payload)) {
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
          version: process.env.npm_package_version,
          sdk: 'fastify',
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
            },
            language: {
              name: 'node',
              version: process.version,
            },
            request: {
              timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
              ip: request.ip,
              url: `${request.protocol}://${request.headers["host"]}${request.url}`,
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
          showErrors,
        }
        fetch('https://rocknrolla.treblle.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({trebllePayload}),
        }).catch((error) => console.log(error))
  })

}

module.exports = fp(treblleFastify, {
  name: 'treblle-fastify'
})
