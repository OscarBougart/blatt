/**
 * The English side of a library text, made at build time.
 *
 * Paragraph by paragraph, each one its own request, each result stored at the
 * same index it came from. Never batched — the same rule the extension follows
 * for Chrome's translator, and for the same reason: a model handed five
 * paragraphs may return four, and the index correspondence between the German
 * and the English *is* the product. A flip that lands on the wrong paragraph
 * is worse than no flip at all.
 *
 * The paragraph before is passed as context and explicitly not translated, so
 * pronouns and definite articles have something to refer back to. Without it
 * the second paragraph of every tale opens with a "she" the model has to guess
 * at.
 *
 * Output is committed to the repository. Nothing here runs in the app, and no
 * key ever reaches a reader.
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';

const SYSTEM = `You translate 19th-century German literary prose into English.

Rules:
- Translate ONLY the paragraph given under "TRANSLATE". Never translate or
  echo the CONTEXT paragraph — it is there so pronouns and articles have a
  referent.
- Return the translation and nothing else: no preamble, no notes, no quotes
  around the whole thing, no explanation of choices.
- One paragraph in, one paragraph out. Never split it, never merge, never
  summarise, never omit a sentence.
- Keep the register of a plainly told folk tale. Readable modern English, not
  mock-archaic — no "thee", no "'tis". Where the German is repetitive or
  formulaic, keep the repetition; it is the voice of the form.
- Keep proper names and rhymes recognisable. Verse should stay verse and
  should still rhyme where it can without inventing new content.
- The reader is learning German and is reading this against the original, so
  stay close to the sentence order of the German where English allows it.`;

export interface TranslateProgress {
  done: number;
  total: number;
}

/**
 * Translate every paragraph, preserving order.
 *
 * Concurrency is bounded by the caller's pool; failures are not swallowed,
 * because a library text with a missing paragraph must never be written to
 * disk and shipped.
 */
export async function translateParagraphs(
  german: string[],
  onProgress?: (progress: TranslateProgress) => void,
  concurrency = 4,
): Promise<string[]> {
  const client = new Anthropic();
  const english = new Array<string>(german.length);
  let done = 0;
  let next = 0;

  const worker = async () => {
    while (next < german.length) {
      const index = next++;
      const context = index > 0 ? german[index - 1] : null;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        // Low effort: this is translation, not reasoning. Higher settings cost
        // more and, on a folk tale, produce a more interpretive English than
        // a learner reading against the German wants.
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content:
              (context ? `CONTEXT (do not translate):\n${context}\n\n` : '') +
              `TRANSLATE:\n${german[index]}`,
          },
        ],
      });

      if (response.stop_reason === 'max_tokens') {
        throw new Error(`paragraph ${index} was cut off at max_tokens`);
      }
      if (response.stop_reason === 'refusal') {
        throw new Error(`paragraph ${index} was refused: ${response.stop_details?.category}`);
      }

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      if (!text) throw new Error(`paragraph ${index} came back empty`);
      english[index] = text;
      onProgress?.({ done: ++done, total: german.length });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, german.length) }, () => worker()),
  );

  return english;
}
