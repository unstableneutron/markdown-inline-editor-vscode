import { mapNormalizedToOriginal } from '../position-mapping';
import type { MermaidBlock } from '../parser';

export interface MermaidIndicatorOffsets {
  blockStart: number;
  blockEnd: number;
  indicatorStart: number;
  indicatorEnd: number;
}

export function getMermaidIndicatorOffsets(
  block: MermaidBlock,
  normalizedText: string,
  originalText: string,
): MermaidIndicatorOffsets | undefined {
  const textForMapping = originalText || normalizedText;
  const blockStart = mapNormalizedToOriginal(block.startPos, textForMapping);
  const blockEnd = mapNormalizedToOriginal(block.endPos, textForMapping);
  const openingFenceLineEnd = textForMapping.indexOf('\n', blockStart);

  if (openingFenceLineEnd === -1) {
    return undefined;
  }

  const indicatorStart = openingFenceLineEnd + 1;
  return {
    blockStart,
    blockEnd,
    indicatorStart,
    indicatorEnd: indicatorStart + 1,
  };
}

export function findMermaidBlockAtIndicatorOffset(
  blocks: MermaidBlock[],
  normalizedText: string,
  originalText: string,
  offset: number,
): MermaidBlock | undefined {
  return blocks.find((block) => {
    const offsets = getMermaidIndicatorOffsets(block, normalizedText, originalText);
    return offsets !== undefined && offset >= offsets.indicatorStart && offset < offsets.indicatorEnd;
  });
}
