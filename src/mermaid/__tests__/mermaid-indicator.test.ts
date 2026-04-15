import { findMermaidBlockAtIndicatorOffset, getMermaidIndicatorOffsets } from '../indicator';
import type { MermaidBlock } from '../../parser';

describe('mermaid indicator helpers', () => {
  const source = ['```mermaid', 'graph TD', '  A --> B', '```'].join('\n');
  const blocks: MermaidBlock[] = [
    { startPos: 0, endPos: source.length, source: 'graph TD\n  A --> B', numLines: 2 },
  ];

  it('returns the 1-character indicator range immediately after the opening fence line', () => {
    const offsets = getMermaidIndicatorOffsets(blocks[0], source, source);
    expect(offsets).toEqual({
      blockStart: 0,
      blockEnd: source.length,
      indicatorStart: '```mermaid\n'.length,
      indicatorEnd: '```mermaid\n'.length + 1,
    });
  });

  it('finds the matching Mermaid block when the click offset hits the indicator', () => {
    const indicatorOffset = '```mermaid\n'.length;
    expect(findMermaidBlockAtIndicatorOffset(blocks, source, source, indicatorOffset)).toEqual(blocks[0]);
  });

  it('keeps working for CRLF documents', () => {
    const originalText = ['```mermaid', 'graph TD', '  A --> B', '```'].join('\r\n');
    const indicatorOffset = originalText.indexOf('graph TD');
    expect(findMermaidBlockAtIndicatorOffset(blocks, source, originalText, indicatorOffset)).toEqual(blocks[0]);
  });
});
