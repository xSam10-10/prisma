import { describe, expect, it } from 'vitest';
import { newer } from '../src/core/updater';

describe('comparação de versões', () => {
  it('compara número a número (não como texto)', () => {
    expect(newer('0.10.0', '0.9.9')).toBe(true);
    expect(newer('0.15.0', '0.14.2')).toBe(true);
    expect(newer('1.0.0', '0.99.99')).toBe(true);
  });
  it('mesma versão ou mais antiga não é atualização', () => {
    expect(newer('0.14.0', '0.14.0')).toBe(false);
    expect(newer('0.13.9', '0.14.0')).toBe(false);
  });
});
