import type { Meta, StoryObj } from '@storybook/react'
import { HighlightedText } from '../src'

const meta: Meta<typeof HighlightedText> = {
  title: 'Core/HighlightedText',
  component: HighlightedText,
  args: {
    text: 'The quick brown fox jumps over the lazy dog',
  },
}

export default meta
type Story = StoryObj<typeof HighlightedText>

export const SingleMatch: Story = {
  args: { patterns: ['fox'] },
}

export const MultiplePatterns: Story = {
  args: { patterns: ['fox', 'dog'] },
}

export const OverlappingPatterns: Story = {
  args: {
    text: 'abcde',
    patterns: ['abc', 'bcd'],
  },
}

export const DiacriticInsensitive: Story = {
  args: {
    text: 'Héllo wörld, café au lait',
    patterns: ['hello', 'cafe'],
  },
}

export const NoMatch: Story = {
  args: { patterns: ['xyz'] },
}

export const EmptyPatterns: Story = {
  args: { patterns: [] },
}

export const CustomMarkStyle: Story = {
  args: {
    patterns: ['fox'],
    markStyle: {
      background: '#FF6B6B80',
      padding: '2px',
      margin: '-2px',
      borderRadius: '2px',
    },
  },
}
