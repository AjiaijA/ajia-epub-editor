// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strToU8 } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { App } from '../../src/app/App.js'
import {
  extractArchive,
  writeEpubArchive,
} from '../../src/epub/archive/epubZip.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('V0.1.1 editing app', () => {
  afterEach(() => {
    cleanup()
  })
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to English and offers persistent Chinese as an option', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Open a local EPUB' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Your file is processed only in this browser and is never uploaded.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute(
      'href',
      '/blog/',
    )
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      'https://about.ajia.site/en/',
    )

    await user.click(screen.getByRole('button', { name: '中文' }))
    expect(
      screen.getByRole('heading', { name: '打开一本本地 EPUB' }),
    ).toBeVisible()
    expect(window.localStorage.getItem('ajia-epub-editor-locale')).toBe('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('opens a local EPUB and exposes search, history, TOC, editing, and export controls', async () => {
    window.localStorage.setItem('ajia-epub-editor-locale', 'zh')
    const bytes = await buildFixtureArchive('epub3-nav')
    const fileBuffer = bytes.slice().buffer
    const file = new File([fileBuffer], '阶段一.epub', {
      type: 'application/epub+zip',
    })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(fileBuffer),
    })
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByText('文件只在您的浏览器中处理，不会上传到服务器。'),
    ).toBeVisible()
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    if (!(input instanceof HTMLInputElement))
      throw new Error('File input missing')
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByRole('heading', { name: '阶段一 EPUB 3 测试书' }),
    ).toBeVisible()
    expect(screen.getByRole('tree')).toBeVisible()
    expect(screen.getByRole('button', { name: /第二章/u })).toBeEnabled()
    expect(screen.getByTitle('第一章：本地阅读 只读预览')).toHaveAttribute(
      'sandbox',
      '',
    )
    expect(screen.getByText(/尚无修改 · V0.1.1/u)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '查找替换' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '导出 EPUB' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '查找替换' }))
    expect(screen.getByText('正文查找')).toBeVisible()
    expect(screen.getByLabelText('查找正文')).toHaveFocus()
    await user.type(screen.getByLabelText('查找正文'), '阶段一测试文字')
    expect(await screen.findByText('找到 1 处，涉及 1 章。')).toBeVisible()
    expect(screen.getByRole('button', { name: '上一处' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '下一处' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '全部替换 (1)' })).toBeEnabled()

    await user.click(screen.getByRole('tab', { name: 'XHTML 源码' }))
    expect(screen.getByLabelText('XHTML 源码编辑器')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: '预览' }))

    await user.click(screen.getByRole('button', { name: /第二章/u }))
    await waitFor(() =>
      expect(screen.getByTitle('第二章 只读预览')).toBeVisible(),
    )
    await user.click(screen.getByRole('tab', { name: '安全编辑' }))
    expect(screen.getByTitle('第二章 安全文字编辑')).toHaveAttribute(
      'sandbox',
      'allow-same-origin',
    )

    await user.click(screen.getByRole('button', { name: '关闭' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '查找替换' })).toHaveFocus(),
    )
  })

  it('keeps preview and source available while disabling safe edit for fixed layout', async () => {
    const entries = new Map(
      extractArchive(await buildFixtureArchive('epub3-nav')),
    )
    const packagePath = 'Books/内容/package.opf'
    const packageSource = new TextDecoder().decode(entries.get(packagePath))
    entries.set(
      packagePath,
      strToU8(
        packageSource.replace(
          '<meta property="dcterms:modified">',
          '<meta property="rendition:layout">pre-paginated</meta>\n    <meta property="dcterms:modified">',
        ),
      ),
    )
    const bytes = writeEpubArchive(entries)
    const fileBuffer = bytes.slice().buffer
    const file = new File([fileBuffer], 'fixed-layout.epub', {
      type: 'application/epub+zip',
    })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(fileBuffer),
    })
    const user = userEvent.setup()
    render(<App />)

    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement))
      throw new Error('File input missing')
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByRole('heading', { name: '阶段一 EPUB 3 测试书' }),
    ).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Safe edit' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'XHTML Source' })).toBeEnabled()
    expect(
      screen.getByText(
        'This publication declares fixed layout. Safe editing is disabled; use Preview or XHTML Source.',
      ),
    ).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'XHTML Source' }))
    expect(screen.getByLabelText('XHTML source editor')).toBeVisible()
  })
})
