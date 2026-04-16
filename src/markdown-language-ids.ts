export const MARKDOWN_LIKE_LANGUAGE_IDS = [
  'markdown',
  'md',
  'mdx',
  'skill',
  'markdoc',
  'mdc',
  'juliamarkdown',
  'rmarkdown',
] as const;

export type MarkdownLikeLanguageId = (typeof MARKDOWN_LIKE_LANGUAGE_IDS)[number];

export function isMarkdownLikeLanguageId(languageId: string): languageId is MarkdownLikeLanguageId {
  return MARKDOWN_LIKE_LANGUAGE_IDS.includes(languageId as MarkdownLikeLanguageId);
}
