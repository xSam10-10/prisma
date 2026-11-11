import { describe, expect, it } from 'vitest';
import { cueCss, srtToVtt } from '../src/ui/subtitles';

describe('legendas', () => {
  it('converte .srt em WebVTT (números, vírgulas e quebras do Windows)', () => {
    const srt = '﻿1\r\n00:00:01,500 --> 00:00:03,000\r\nOlá, mundo!\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,250\r\nSegunda fala\r\ncom duas linhas\r\n';
    const vtt = srtToVtt(srt);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:01.500 --> 00:00:03.000\nOlá, mundo!');
    expect(vtt).toContain('00:00:04.000 --> 00:00:06.250\nSegunda fala\ncom duas linhas');
    expect(vtt).not.toMatch(/^1$/m);
  });
  it('.vtt passa direto', () => {
    expect(srtToVtt('WEBVTT\n\n00:01.000 --> 00:02.000\nOi')).toBe('WEBVTT\n\n00:01.000 --> 00:02.000\nOi\n');
  });
  it('estilo da legenda sem variáveis CSS (TV de 2017)', () => {
    const css = cueCss('g', 'yellow', 'box');
    expect(css).toContain('font-size: 125%');
    expect(css).toContain('#FFE14D');
    expect(css).toContain('rgba(0, 0, 0, 0.78)');
    expect(css).not.toContain('var(');
  });
});
