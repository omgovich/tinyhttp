import type { AsyncHandler } from '@tinyhttp/app'
import { parse } from 'path'
import { existsSync } from 'fs'
import { readFile, readdir } from 'fs/promises'
import { promise as recursiveReaddir } from 'readdirp'
import md, { MarkedOptions } from 'marked'

export type MarkdownServerHandlerOptions = Partial<{
  prefix: string
  stripExtension: boolean
  recursive: boolean
  markedOptions: MarkedOptions
  markedExtensions: MarkedOptions[]
}>

export const markdownStaticHandler = (
  dir = process.cwd(),
  { prefix = '/', stripExtension = true, recursive = false, markedOptions = null, markedExtensions = [] }: MarkdownServerHandlerOptions
): AsyncHandler => async (req, res, next) => {
  if (req.url.startsWith(prefix)) {
    let unPrefixedURL = req.url.replace(prefix, '')

    if (prefix !== '/') unPrefixedURL = unPrefixedURL.slice(1)

    if (req.url === prefix) {
      const idxFile = [`${dir}/index.md`, `${dir}/index.markdown`, `${dir}/readme.md`, `${dir}/README.md`, `${dir}/readme.markdown`, `${dir}/readme.md`].find(
        (file) => existsSync(file) && file
      )

      if (idxFile) res.set('Content-Type', 'text/html').send(md((await readFile(idxFile)).toString()))
    }

    let files: string[]

    if (recursive) files = (await recursiveReaddir(dir)).map((f) => f.path)
    else files = await readdir(dir)

    let file: string

    if (stripExtension) {
      file = files.find((f) => {
        const { name, dir, ext } = parse(f)

        const isDir = !(dir === '')

        return /\.(md|markdown)/.test(ext) && unPrefixedURL === (isDir ? `${dir}/${name}`.replace('\\', '/') : name)
      })
    } else {
      file = files.find((f) => f === decodeURI(unPrefixedURL))
    }

    if (file) {
      const content = (await readFile(`${dir}/${file}`)).toString()

      if (markedExtensions?.length !== 0) {
        for (const ext of markedExtensions) md.use(ext)
      }

      res.set('Content-Type', 'text/html').send(md(content, markedOptions))
    }
  }
  next?.()
}
