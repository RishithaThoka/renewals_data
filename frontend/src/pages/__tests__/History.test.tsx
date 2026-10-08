import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import History from '../History'

describe('History page render test', () => {
  it('renders without throwing', () => {
    const qc = new QueryClient()
    const html = renderToString(
      <QueryClientProvider client={qc}>
        <History />
      </QueryClientProvider>
    )
    expect(html).toContain('Snapshot &amp; Upload History')
    console.log('RENDER SUCCESS! HTML length:', html.length)
  })
})
