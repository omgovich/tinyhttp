import fs from 'fs'
import path from 'path'
import { makeFetch } from 'supertest-fetch'
import { json, send, sendFile, sendStatus, status } from '../../packages/send/src'
import { runServer } from '../../test_helpers/runServer'

describe('Testing @tinyhttp/send', () => {
  describe('json(body)', () => {
    it('should send a json-stringified reply when an object is passed', async () => {
      const app = runServer((_, res) => json(res)({ hello: 'world' }))

      await makeFetch(app)('/').expect({ hello: 'world' })
    })
    it('should set a content-type header properly', async () => {
      const app = runServer((_, res) => json(res)({ hello: 'world' }))

      await makeFetch(app)('/').expectHeader('content-type', 'application/json')
    })
  })
  describe('send(body)', () => {
    it('should send a plain text', async () => {
      const app = runServer((req, res) => send(req, res)('Hello World'))

      await makeFetch(app)('/').expect('Hello World')
    })
    it('should set HTML content-type header when sending plain text', async () => {
      const app = runServer((req, res) => send(req, res)('Hello World'))

      await makeFetch(app)('/').expectHeader('Content-Type', 'text/html; charset=utf-8')
    })
    it('should generate an eTag on a plain text response', async () => {
      const app = runServer((req, res) => send(req, res)('Hello World'))

      await makeFetch(app)('/').expectHeader('etag', 'W/"b-Ck1VqNd45QIvq3AZd8XYQLvEhtA"')
    })
    it('should send a JSON response', async () => {
      const app = runServer((req, res) => send(req, res)({ hello: 'world' }))

      await makeFetch(app)('/').expectHeader('Content-Type', 'application/json').expectBody({ hello: 'world' })
    })
    it('should send nothing on a HEAD request', async () => {
      const app = runServer((req, res) => send(req, res)('Hello World'))

      await makeFetch(app)('/', {
        method: 'HEAD',
      }).expectBody('')
    })
    it('should send nothing if body is empty', async () => {
      const app = runServer((req, res) => send(req, res)(null))

      await makeFetch(app)('/').expectBody('')
    })
    it('should remove some headers for 204 status', async () => {
      const app = runServer((req, res) => {
        res.statusCode = 204

        send(req, res)('Hello World')
      })

      await makeFetch(app)('/').expectHeader('Content-Length', null).expectHeader('Content-Type', null).expectHeader('Transfer-Encoding', null)
    })
    it('should remove some headers for 304 status', async () => {
      const app = runServer((req, res) => {
        res.statusCode = 304

        send(req, res)('Hello World')
      })

      await makeFetch(app)('/').expectHeader('Content-Length', null).expectHeader('Content-Type', null).expectHeader('Transfer-Encoding', null)
    })
    it("should set Content-Type to application/octet-stream for buffers if the header hasn't been set before", async () => {
      const app = runServer((req, res) => send(req, res)(Buffer.from('Hello World', 'utf-8')).end())

      await makeFetch(app)('/', { headers: { 'Content-Type': null } }).expectHeader('Content-Type', 'application/octet-stream')
    })
  })

  describe('status(status)', () => {
    it('sets response status', async () => {
      const app = runServer((_, res) => status(res)(418).end())

      await makeFetch(app)('/').expectStatus(418)
    })
  })

  describe('sendStatus(status)', () => {
    it(`should send "I'm a teapot" when argument is 418`, async () => {
      const app = runServer((req, res) => sendStatus(req, res)(418).end())

      await makeFetch(app)('/').expect("I'm a Teapot")
    })
  })

  describe('sendFile(path)', () => {
    const testFilePath = path.resolve(__dirname, 'test.txt')

    beforeAll(() => {
      fs.writeFileSync(testFilePath, 'Hello World')
    })

    afterAll(() => {
      fs.unlinkSync(testFilePath)
    })

    it('should throw if path is not absolute', async () => {
      const app = runServer(async (_, res) => {
        try {
          await sendFile(res)('../relative/path', {})
        } catch (err) {
          expect(err.message).toMatch(/absolute/)

          res.end()

          return
        }

        throw new Error('Did not throw an error')
      })

      await makeFetch(app)('/')
    })
    it('should set the Content-Type header based on the filename', async () => {
      const app = runServer((_, res) => sendFile(res)(testFilePath, {}))

      await makeFetch(app)('/').expectHeader('Content-Type', 'text/plain; charset=utf-8')
    })
    it('should allow custom headers through the options param', async () => {
      const HEADER_NAME = 'Test-Header'
      const HEADER_VALUE = 'Hello World'

      const app = runServer((_, res) => sendFile(res)(testFilePath, { headers: { [HEADER_NAME]: HEADER_VALUE } }))

      await makeFetch(app)('/').expectHeader(HEADER_NAME, HEADER_VALUE)
    })
  })
})
