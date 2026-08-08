// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/app/App.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('Phase 4 editing app', () => {
  it('opens a local EPUB and exposes search, history, TOC, editing, and export controls', async () => {
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
    expect(screen.getByTitle('第一章：本地阅读只读预览')).toHaveAttribute(
      'sandbox',
      '',
    )
    expect(screen.getByText(/尚无修改 · 阶段 4/u)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '查找替换' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '导出 EPUB' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '查找替换' }))
    await user.type(screen.getByLabelText('查找正文'), '阶段一测试文字')
    expect(screen.getByText('找到 1 处，涉及 1 章。')).toBeVisible()
    expect(screen.getByRole('button', { name: '上一处' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '下一处' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '全部替换 (1)' })).toBeEnabled()

    await user.click(screen.getByRole('tab', { name: 'XHTML 源码' }))
    expect(screen.getByLabelText('XHTML 源码编辑器')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: '预览' }))

    await user.click(screen.getByRole('button', { name: /第二章/u }))
    await waitFor(() =>
      expect(screen.getByTitle('第二章只读预览')).toBeVisible(),
    )
    await user.click(screen.getByRole('tab', { name: '安全编辑' }))
    expect(screen.getByTitle('第二章安全文字编辑')).toHaveAttribute(
      'sandbox',
      'allow-same-origin',
    )
  })
})
