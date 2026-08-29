import { memo, useMemo } from 'react';
import { locate, tokenizeForDisplay } from '@/lib/segment';
import { wordKey } from '@/hooks/useSavedWords';

interface Props {
  text: string;
  paragraphIndex: number;
  /** Keys of words saved in this document. */
  savedKeys: Set<string>;
  /** Keys currently wiping out. */
  exitingKeys: Set<string>;
  innerRef: (element: HTMLElement | null) => void;
}

/**
 * One German paragraph, with every word in its own span so it can be tapped
 * and marked.
 *
 * The token list reproduces the paragraph character for character, so nothing
 * about the typography changes — the spans are invisible until a word is
 * saved.
 */
function GermanParagraph({
  text,
  paragraphIndex,
  savedKeys,
  exitingKeys,
  innerRef,
}: Props) {
  // Tokenising and sentence-locating every word is the expensive part, and it
  // depends only on the text. Saving a word must not redo it.
  const tokens = useMemo(
    () =>
      tokenizeForDisplay(text).map((token) => {
        if (!token.isWord) return { ...token, key: null };
        const { sentence, charOffset } = locate(text, token.start);
        return { ...token, key: wordKey(paragraphIndex, sentence, charOffset) };
      }),
    [text, paragraphIndex],
  );

  return (
    <p lang="de" data-index={paragraphIndex} ref={innerRef} className="type-de mb-7">
      {tokens.map((token, i) =>
        token.key === null ? (
          <span key={i}>{token.text}</span>
        ) : (
          <span
            key={i}
            className={[
              'word',
              savedKeys.has(token.key) && !exitingKeys.has(token.key) ? 'is-saved' : '',
              exitingKeys.has(token.key) ? 'is-exiting' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-key={token.key}
            data-p={paragraphIndex}
            data-o={token.start}
            data-w={token.text}
          >
            {token.text}
          </span>
        ),
      )}
    </p>
  );
}

export default memo(GermanParagraph);
