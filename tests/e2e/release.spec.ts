import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'

import { assertEpubMimetypeHeader } from '../../src/epub/archive/epubZip.js'
import { openEpubPublication } from '../../src/epub/parser/publication.js'

test('V0.1 RC edits, searches, undoes, exports, and stays local', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('./')
  const appOrigin = new URL(page.url()).origin
  await expect(page.getByText('V0.1 RC1 · 本地测试版本')).toBeVisible()

  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('artifacts/epub2-reader-smoke.epub'))
  await expect(
    page.getByRole('heading', { name: '阶段一 EPUB 2 测试书' }),
  ).toBeVisible()

  await page.getByLabel('目录显示文字').fill('RC 目录 & 一')
  await page.getByRole('button', { name: '更新目录名称' }).click()
  await expect(page.getByRole('treeitem')).toContainText('RC 目录 & 一')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('treeitem')).toContainText('唯一章节')
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(page.getByRole('treeitem')).toContainText('RC 目录 & 一')

  await page.getByRole('button', { name: '查找替换' }).click()
  await page.getByLabel('查找正文').fill('测试文字')
  await page.getByLabel('替换为').fill('RC & <完成>')
  await expect(page.getByText('找到 1 处，涉及 1 章。')).toBeVisible()
  await page.getByRole('button', { name: '全部替换 (1)' }).click()
  await expect(
    page
      .locator('iframe')
      .contentFrame()
      .getByText('这是自建的 EPUB 2 RC & <完成>。'),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 EPUB' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('epub2-reader-smoke-edited.epub')
  const downloadPath = await download.path()
  const exportedBytes = new Uint8Array(await readFile(downloadPath))
  assertEpubMimetypeHeader(exportedBytes)
  const reopened = openEpubPublication(
    exportedBytes,
    download.suggestedFilename(),
  )
  expect(reopened.navigation.items[0]?.label).toBe('RC 目录 & 一')
  expect(reopened.chapters[0]?.originalSource).toContain(
    'RC &amp; &lt;完成&gt;',
  )

  expect(
    requests.every((url) => {
      const parsed = new URL(url)
      return parsed.origin === appOrigin
    }),
  ).toBe(true)

  await page.setViewportSize({ height: 844, width: 390 })
  await expect(page.getByRole('button', { name: '导出 EPUB' })).toBeVisible()
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)

  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(
      (element) => element.id,
    )
    return ids.filter((id, index) => ids.indexOf(id) !== index)
  })
  expect(duplicateIds).toEqual([])
})
