import { mapNormalizedToOriginal } from '../position-mapping';
import type { MermaidBlock } from '../parser';

export interface MermaidIndicatorOffsets {
  blockStart: number;
  blockEnd: number;
  indicatorStart: number;
  indicatorEnd: number;
}

/**
 * Mermaid parser blocks use normalized (LF-only) offsets.
 * This helper maps those offsets into original-document coordinates,
 * using `originalText` as the CRLF-aware coordinate source when available.
 */
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

/**
 * Finds the Mermaid block whose indicator range contains `offset`.
 * `offset` is expected in original-document coordinates.
 */
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
