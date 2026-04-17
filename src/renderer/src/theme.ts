export type Theme = 'dark' | 'light'

export interface ThemeTokens {
  bg:       string
  bg1:      string
  bg2:      string
  bg3:      string
  border:   string
  border2:  string
  text:     string
  text2:    string
  text3:    string
  text4:    string
  accent:   string
  accentBg: string
  red:      string
  amber:    string
  green:    string
  panelShadow: string
  titlebar: string
  inputBg:  string
  hoverBg:  string
}

export const DARK: ThemeTokens = {
  bg:       '#0e0e0e',
  bg1:      '#141414',
  bg2:      '#1c1c1c',
  bg3:      '#252525',
  border:   '#1e1e1e',
  border2:  '#2a2a2a',
  text:     '#e0e0e0',
  text2:    '#9b9a97',
  text3:    '#5e5e5e',
  text4:    '#3a3a3a',
  accent:   '#2383e2',
  accentBg: 'rgba(35,131,226,0.1)',
  red:      '#e03e3e',
  amber:    '#dfab01',
  green:    '#0f7b6c',
  panelShadow: '0 2px 12px rgba(0,0,0,0.5)',
  titlebar: '#0a0a0a',
  inputBg:  'rgba(255,255,255,0.025)',
  hoverBg:  'rgba(255,255,255,0.04)',
}

export const LIGHT: ThemeTokens = {
  bg:       '#f0eeeb',
  bg1:      '#faf9f7',
  bg2:      '#f0eeeb',
  bg3:      '#e6e4e1',
  border:   '#e0dedd',
  border2:  '#ccc9c6',
  text:     '#1c1c1c',
  text2:    '#555350',
  text3:    '#9b9a97',
  text4:    '#c0bebc',
  accent:   '#1a72d1',
  accentBg: 'rgba(26,114,209,0.1)',
  red:      '#c03030',
  amber:    '#b07800',
  green:    '#0a6b5c',
  panelShadow: '0 2px 8px rgba(0,0,0,0.08)',
  titlebar: '#f5f3f0',
  inputBg:  'rgba(0,0,0,0.04)',
  hoverBg:  'rgba(0,0,0,0.04)',
}

import { createContext, useContext } from 'react'
export const ThemeContext = createContext<ThemeTokens>(DARK)
export const useTheme = () => useContext(ThemeContext)
