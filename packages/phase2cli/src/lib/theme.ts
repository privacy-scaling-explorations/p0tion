import chalk from "chalk"
import logSymbols from "log-symbols"
import emoji from "node-emoji"

/**
 * Custom theme object.
 */
export default {
    colors: {
        yellow: chalk.yellow,
        magenta: chalk.magenta,
        red: chalk.red,
        green: chalk.green
    },
    text: {
        underlined: chalk.underline,
        bold: chalk.bold,
        italic: chalk.italic
    },
    symbols: {
        success: logSymbols.success,
        warning: logSymbols.warning,
        error: logSymbols.error,
        info: logSymbols.info
    },
    emojis: {
        tada: emoji.get("tada"),
        key: emoji.get("key"),
        broom: emoji.get("broom"),
        pointDown: emoji.get("point_down"),
        eyes: emoji.get("eyes"),
        wave: emoji.get("wave"),
        clipboard: emoji.get("clipboard"),
        fire: emoji.get("fire"),
        clock: emoji.get("hourglass"),
        dizzy: emoji.get("dizzy_face"),
        rocket: emoji.get("rocket"),
        oldKey: emoji.get("old_key"),
        pray: emoji.get("pray"),
        moon: emoji.get("moon"),
        upsideDown: emoji.get("upside_down_face"),
        arrowUp: emoji.get("arrow_up"),
        arrowDown: emoji.get("arrow_down")
    }
}
