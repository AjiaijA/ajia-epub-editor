// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/app/App.js'
import { buildFixtureArchive } from '../support/fixtureArchive.js'

describe('Phase 1 read-only app', () => {
  it('opens a local EPUB and exposes navigation, sandbox preview, and issues', async () => {
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
    expect(screen.getByText(/只读模式/u)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /第二章/u }))
    await waitFor(() =>
      expect(screen.getByTitle('第二章只读预览')).toBeVisible(),
    )
  })
})
