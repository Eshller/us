import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRecap } from '../src/lib/recap/buildRecap.ts'
import { parseWhatsAppExportText } from '../src/lib/whatsapp/parseExport.ts'

test('preserves local chat dates for midnight messages', () => {
  const messages = parseWhatsAppExportText('02/01/24, 00:22 - You: Still awake?')

  assert.equal(messages[0]?.dateKey, '2024-01-02')
  assert.equal(messages[0]?.text, 'Still awake?')
})

test('parses multiline messages as one message', () => {
  const messages = parseWhatsAppExportText(`02/01/24, 10:00 - Her: First line
second line
third line`)

  assert.equal(messages.length, 1)
  assert.equal(messages[0]?.text, 'First line\nsecond line\nthird line')
})

test('extracts media references and classifies media messages', () => {
  const messages = parseWhatsAppExportText(
    '03/01/24, 18:02 - Her: IMG-20240103-WA0001.jpg (file attached)',
  )

  assert.equal(messages[0]?.type, 'image')
  assert.equal(messages[0]?.mediaRef, 'IMG-20240103-WA0001.jpg')
})

test('classifies WhatsApp omitted media rows as attachment placeholders', () => {
  const messages = parseWhatsAppExportText(`03/01/24, 18:02 - Her: image omitted
03/01/24, 18:03 - Her: video omitted
03/01/24, 18:04 - Her: audio omitted
03/01/24, 18:05 - Her: sticker omitted
03/01/24, 18:06 - Her: cute caption image omitted
03/01/24, 18:07 - Her: private.pdf document omitted
03/01/24, 18:08 - Her: video note omitted
03/01/24, 18:09 - Her: Contact card omitted`)

  assert.equal(messages[0]?.type, 'image')
  assert.equal(messages[1]?.type, 'video')
  assert.equal(messages[2]?.type, 'audio')
  assert.equal(messages[3]?.type, 'sticker')
  assert.equal(messages[4]?.type, 'image')
  assert.equal(messages[4]?.text, 'cute caption')
  assert.equal(messages[5]?.type, 'document')
  assert.equal(messages[5]?.text, 'Document attachment skipped for privacy.')
  assert.equal(messages[6]?.type, 'video')
  assert.equal(messages[6]?.text, '')
  assert.equal(messages[7]?.type, 'document')
  assert.equal(messages[7]?.text, 'Document attachment skipped for privacy.')

  for (const message of messages.slice(0, 4)) {
    assert.equal(message.mediaRef, null)
    assert.equal(message.text, '')
  }
})

test('cleans omitted media markers from multiline attachment rows', () => {
  const messages = parseWhatsAppExportText(`03/01/24, 18:02 - Her: cute caption
image omitted
03/01/24, 18:03 - Her: private.pdf
document omitted`)

  assert.equal(messages[0]?.type, 'image')
  assert.equal(messages[0]?.text, 'cute caption')
  assert.equal(messages[0]?.mediaRef, null)
  assert.equal(messages[1]?.type, 'document')
  assert.equal(messages[1]?.text, 'Document attachment skipped for privacy.')
  assert.equal(messages[1]?.mediaRef, null)
})

test('extracts iOS attached media filenames cleanly', () => {
  const messages = parseWhatsAppExportText(
    '03/01/24, 18:02 - Her: <attached: IMG-20240103-WA0001.jpg>',
  )

  assert.equal(messages[0]?.type, 'image')
  assert.equal(messages[0]?.mediaRef, 'IMG-20240103-WA0001.jpg')
  assert.equal(messages[0]?.text, 'IMG-20240103-WA0001.jpg')
})

test('redacts unsafe document attachment filenames from display data', () => {
  const messages = parseWhatsAppExportText(`03/01/24, 18:05 - Her: passport-scan.pdf (file attached)
03/01/24, 18:06 - Her: résumé.pdf (file attached)
03/01/24, 18:07 - Her: bank_statement[final].pdf (file attached)`)

  for (const message of messages) {
    assert.equal(message.type, 'document')
    assert.equal(message.mediaRef, null)
    assert.equal(message.text, 'Document attachment skipped for privacy.')
    assert.equal(message.raw, undefined)
  }
})

test('keeps unsafe document attachments redacted across continuation lines', () => {
  const messages = parseWhatsAppExportText(`03/01/24, 18:05 - Her: passport-scan.pdf (file attached)
‎<This message was edited>`)

  assert.equal(messages[0]?.type, 'document')
  assert.equal(messages[0]?.mediaRef, null)
  assert.equal(messages[0]?.text, 'Document attachment skipped for privacy.')
  assert.equal(messages[0]?.edited, true)
})

test('cleans WhatsApp formatting marks from call rows', () => {
  const messages = parseWhatsAppExportText(
    '03/01/24, 18:08 - Her: ‎Missed voice call, ‎Tap to call back',
  )

  assert.equal(messages[0]?.type, 'call')
  assert.equal(messages[0]?.text, 'Missed voice call, Tap to call back')
})

test('classifies iOS-exported WhatsApp notices as system rows', () => {
  const messages = parseWhatsAppExportText(`26/09/24, 4:52 PM - Riti🦋: ‎Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.
26/09/24, 4:52 PM - Riti🦋: ‎Riti🦋 is a contact.`)

  assert.equal(messages[0]?.type, 'system')
  assert.equal(messages[0]?.sender, null)
  assert.equal(
    messages[0]?.text,
    'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.',
  )
  assert.equal(messages[1]?.type, 'system')
  assert.equal(messages[1]?.sender, null)
  assert.equal(messages[1]?.text, 'Riti🦋 is a contact.')
})

test('skips blank exported sender rows', () => {
  const messages = parseWhatsAppExportText(`[27/11/24, 6:03:04 PM] Eshller:
[27/11/24, 6:04:04 PM] Eshller: real message`)

  assert.equal(messages.length, 1)
  assert.equal(messages[0]?.sender, 'Eshller')
  assert.equal(messages[0]?.text, 'real message')
})

test('extracts edited marker instead of rendering it as message text', () => {
  const messages = parseWhatsAppExportText('26/09/24, 4:49 PM - Riti🦋: Hi ‎<This message was edited>')

  assert.equal(messages[0]?.text, 'Hi')
  assert.equal(messages[0]?.edited, true)
})

test('recognizes iOS rows with leading formatting marks before the date prefix', () => {
  const messages = parseWhatsAppExportText(`‎[18/12/24, 10:56:42 PM] Riti🦋: First
‎[18/12/24, 10:57:56 PM] Riti🦋: Second`)

  assert.equal(messages.length, 2)
  assert.equal(messages[0]?.text, 'First')
  assert.equal(messages[1]?.text, 'Second')
})

test('extracts edited marker from multiline messages', () => {
  const messages = parseWhatsAppExportText(`26/09/24, 4:49 PM - Riti🦋: Hi
there ‎<This message was edited>`)

  assert.equal(messages[0]?.text, 'Hi\nthere')
  assert.equal(messages[0]?.edited, true)
})

test('does not redact filename-like plain text without an attachment marker', () => {
  const messages = parseWhatsAppExportText('26/09/24, 4:49 PM - Riti🦋: please check passport.pdf later')

  assert.equal(messages[0]?.type, 'text')
  assert.equal(messages[0]?.text, 'please check passport.pdf later')
})

test('recap buckets use local date keys rather than UTC slices', () => {
  const messages = parseWhatsAppExportText(`01/01/24, 23:58 - You: late one
02/01/24, 00:02 - Her: early two
02/01/24, 00:03 - You: early three`)
  const recap = buildRecap(messages)
  const busiestDay = recap.cards.find((card) => card.id === 'busiest-day')

  assert.equal(busiestDay?.title.includes('2 Jan'), true)
  assert.equal(busiestDay?.metric, '2 messages')
})
