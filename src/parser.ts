import { CardType } from "src/scheduling";

/**
 * Returns flashcards found in `text`
 *
 * @param text - The text to extract flashcards from
 * @param singlelineCardSeparator - Separator for inline basic cards
 * @param singlelineReversedCardSeparator - Separator for inline reversed cards
 * @param multilineCardSeparator - Separator for multiline basic cards
 * @param multilineReversedCardSeparator - Separator for multiline basic card
 * @returns An array of [CardType, card text, line number] tuples
 */
export function parse(
    text: string,
    singlelineCardSeparator: string,
    singlelineReversedCardSeparator: string,
    multilineCardSeparator: string,
    multilineReversedCardSeparator: string,
    fileCardSeparator: string,
    headingCardSeparator: string,
    convertHighlightsToClozes: boolean,
    convertBoldTextToClozes: boolean,
    convertCurlyBracketsToClozes: boolean
): [CardType, string, number][] {
    let cardText = "";
    const cards: [CardType, string, number][] = [];
    let cardType: CardType | null = null;
    let lineNo = 0;

    const lines: string[] = text.replaceAll("\r\n", "\n").split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length === 0) {
            if (cardType) {
                cards.push([cardType, cardText, lineNo]);
                cardType = null;
            }

            cardText = "";
            continue;
        } else if (lines[i].startsWith("<!--") && !lines[i].startsWith("<!--SR:")) {
            while (i + 1 < lines.length && !lines[i].includes("-->")) i++;
            i++;
            continue;
        }

        if (cardText.length > 0) {
            cardText += "\n";
        }
        cardText += lines[i];

        if (
            lines[i].includes(singlelineReversedCardSeparator) ||
            lines[i].includes(singlelineCardSeparator)
        ) {
            cardType = lines[i].includes(singlelineReversedCardSeparator)
                ? CardType.SingleLineReversed
                : CardType.SingleLineBasic;
            cardText = lines[i];
            lineNo = i;
            if (i + 1 < lines.length && lines[i + 1].startsWith("<!--SR:")) {
                cardText += "\n" + lines[i + 1];
                i++;
            }
            cards.push([cardType, cardText, lineNo]);
            cardType = null;
            cardText = "";
        } else if (
            cardType === null &&
            ((convertHighlightsToClozes && /==.*?==/gm.test(lines[i])) ||
                (convertBoldTextToClozes && /\*\*.*?\*\*/gm.test(lines[i])) ||
                (convertCurlyBracketsToClozes && /{{.*?}}/gm.test(lines[i])))
        ) {
            cardType = CardType.Cloze;
            lineNo = i;
        } else if (lines[i] === multilineCardSeparator) {
            cardType = CardType.MultiLineBasic;
            lineNo = i;
        } else if (lines[i] === multilineReversedCardSeparator) {
            cardType = CardType.MultiLineReversed;
            lineNo = i;
        } else if (lines[i] === fileCardSeparator) {
            const metaStarts = lines.indexOf("---");
            const metaEnds = metaStarts == 0 ? lines.indexOf("---", metaStarts + 1) + 1 : 0;
            const linesFileCard = lines.slice(metaEnds, lines.length - 1).join("\n");
            cards.push([CardType.File, linesFileCard, i]);
        } else if (lines[i] === headingCardSeparator) {
            let headingLvl=0;
            let headStartlineNo;
            const regexp = /^##{0,5}($| )/;
            for (let line = i; line >= 0; line--) {
                if (regexp.test(lines[line])) {
                    headingLvl = lines[line].split(" ")[0].length;
                    headStartlineNo = line;
                    break;
                }
            }
            if (headingLvl) {
                for (let line = i; line < lines.length; line++) {
                    if (regexp.test(lines[line]))
                        if (headingLvl === lines[line].split(" ")[0].length) {
                            const linesHeadingCard = lines
                                .slice(headStartlineNo, line)
                                .join("\n");
                            cards.push([CardType.Heading, linesHeadingCard, i]);
                            break;
                        }
                }
            }
        } else if (lines[i].startsWith("```") || lines[i].startsWith("~~~")) {
            const codeBlockClose = lines[i].match(/`+|~+/)[0];
            while (i + 1 < lines.length && !lines[i + 1].startsWith(codeBlockClose)) {
                i++;
                cardText += "\n" + lines[i];
            }
            cardText += "\n" + codeBlockClose;
            i++;
        }
    }

    if (cardType && cardText) {
        cards.push([cardType, cardText, lineNo]);
    }

    return cards;
}
