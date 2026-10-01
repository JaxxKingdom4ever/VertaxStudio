# Lexical sources and limitations

The bounded English pack's candidate vocabulary and part-of-speech labels were selected
using the locally packaged TextBlob/Pattern `en-lexicon.txt` (Eric Brill's POS lexicon,
MIT License, with later CC-BY 3.0 additions). Its candidate-word frequency ordering
was selected with TextBlob's `en-spelling.txt`, itself derived from Norvig's corpus.
Word forms and semantic IDs were produced by the Vertax authoring script, with a
small set of common irregular verbs manually specified. Additional lexical data
requires review; the `generated-unverified` formStatus flag explicitly marks
unverified generated inflections. This is not a complete English grammar.

The generated JSON is standalone and needs none of those dependencies at runtime.
