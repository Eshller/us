import AdmZip from 'adm-zip'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRecap } from '../src/lib/recap/buildRecap.ts'
import {
  inferMediaType,
  isSafePreviewMedia,
  parseWhatsAppExportText,
} from '../src/lib/whatsapp/parseExport.ts'
import type { MediaManifestItem } from '../src/lib/memory/types.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(rootDir, 'public', 'memory-data')
const mediaDir = path.join(outDir, 'media')
const maxEntryCount = 2_500
const maxSingleFileBytes = 150 * 1024 * 1024
const maxTotalMediaBytes = 1.5 * 1024 * 1024 * 1024

async function main() {
  const inputPath = process.argv[2]
  const dateOrder = process.argv.includes('--month-first') ? 'month-first' : 'day-first'

  if (!inputPath) {
    throw new Error('Usage: npm run import:whatsapp -- <export.zip|_chat.txt> [--month-first]')
  }

  await rm(outDir, { force: true, recursive: true })
  await mkdir(mediaDir, { recursive: true })

  const input = path.resolve(process.cwd(), inputPath)
  const imported = input.toLowerCase().endsWith('.zip')
    ? await importZip(input)
    : { chatText: await readTextExport(input), mediaManifest: [] }

  const messages = parseWhatsAppExportText(imported.chatText, { dateOrder })
  const recap = buildRecap(messages)

  await writeJson(path.join(outDir, 'messages.json'), messages)
  await writeJson(path.join(outDir, 'recap.json'), recap)
  await writeJson(path.join(outDir, 'media-manifest.json'), imported.mediaManifest)

  console.log(`Imported ${messages.length} messages into ${path.relative(rootDir, outDir)}`)
}

async function importZip(zipPath: string): Promise<{
  chatText: string
  mediaManifest: MediaManifestItem[]
}> {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory)

  if (entries.length > maxEntryCount) {
    throw new Error(`Export has too many files (${entries.length}). Limit is ${maxEntryCount}.`)
  }

  const chatEntry =
    entries.find((entry) => path.basename(entry.entryName).toLowerCase() === '_chat.txt') ??
    entries.find((entry) => entry.entryName.toLowerCase().endsWith('.txt'))

  if (!chatEntry) {
    throw new Error('No _chat.txt file found in the WhatsApp export zip.')
  }
  if (chatEntry.header.size > maxSingleFileBytes) {
    throw new Error('The chat text file is too large to import safely.')
  }

  const mediaManifest: MediaManifestItem[] = []
  let totalMediaBytes = 0

  for (const entry of entries) {
    if (entry === chatEntry) continue

    const filename = path.basename(entry.entryName)
    if (!filename || filename.startsWith('.')) continue
    if (!isSafePreviewMedia(filename)) continue
    if (entry.header.size > maxSingleFileBytes) {
      throw new Error(`${filename} is too large to import safely.`)
    }

    totalMediaBytes += entry.header.size
    if (totalMediaBytes > maxTotalMediaBytes) {
      throw new Error('Export media is too large to import safely.')
    }

    const targetPath = path.join(mediaDir, filename)
    await writeFile(targetPath, entry.getData())

    mediaManifest.push({
      filename,
      path: `/memory-data/media/${filename}`,
      type: inferMediaType(filename),
      size: entry.header.size,
    })
  }

  return {
    chatText: chatEntry.getData().toString('utf8'),
    mediaManifest,
  }
}

async function readTextExport(input: string): Promise<string> {
  const stats = await stat(input)
  if (stats.size > maxSingleFileBytes) {
    throw new Error('The chat text file is too large to import safely.')
  }

  return readFile(input, 'utf8')
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
