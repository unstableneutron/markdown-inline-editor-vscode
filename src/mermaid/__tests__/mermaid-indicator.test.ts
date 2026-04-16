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

  it('falls back to blockStart indicator offsets when the opening fence line has no newline', () => {
    const malformedSource = '```mermaid';
    const malformedBlock: MermaidBlock = {
      startPos: 0,
      endPos: malformedSource.length,
      source: '',
      numLines: 0,
    };

    const offsets = getMermaidIndicatorOffsets(malformedBlock, malformedSource, malformedSource);
    expect(offsets).toEqual({
      blockStart: 0,
      blockEnd: malformedSource.length,
      indicatorStart: 0,
      indicatorEnd: 1,
    });

    expect(findMermaidBlockAtIndicatorOffset([malformedBlock], malformedSource, malformedSource, 0)).toEqual(
      malformedBlock,
    );
  });

  it('maps normalized block offsets into original CRLF coordinates', () => {
    const normalizedText = ['intro', '```mermaid', 'graph TD', '  A --> B', '```'].join('\n');
    const normalizedBlockText = ['```mermaid', 'graph TD', '  A --> B', '```'].join('\n');
    const startPos = normalizedText.indexOf(normalizedBlockText);
    const endPos = startPos + normalizedBlockText.length;
    const block: MermaidBlock = { startPos, endPos, source: 'graph TD\n  A --> B', numLines: 2 };
    const originalText = normalizedText.replace(/\n/g, '\r\n');

    const offsets = getMermaidIndicatorOffsets(block, normalizedText, originalText);
    expect(offsets).toEqual({
      blockStart: 7,
      blockEnd: 43,
      indicatorStart: 19,
      indicatorEnd: 20,
    });

    expect(findMermaidBlockAtIndicatorOffset([block], normalizedText, originalText, 19)).toEqual(block);
  });
});
