import chalk from "chalk"

// TODO: make theme dinamyc B/W if possible.
/** Chalk custom theme */
export default {
  // Dark.
  purpleD: chalk.hex("#CFC4FB"),
  blueD: chalk.hex("#6BA7EF"),
  greenD: chalk.hex("#B8E891"),
  yellowD: chalk.hex("#FFED71"),
  pinkD: chalk.hex("#FFA69D"),
  acquaD: chalk.hex("#53D3E0"),
  violetD: chalk.hex("#DCA0D7"),
  redD: chalk.hex("#DD4217"),
  monoD: chalk.hex("#FCFCFC"),

  // Light.
  purpleW: chalk.hex("#B0A3E1"),
  blueW: chalk.hex("#518DD5"),
  greenW: chalk.hex("#95CB69"),
  yellowW: chalk.hex("#E6D245"),
  pinkW: chalk.hex("#E68C83"),
  acquaW: chalk.hex("#4BBECA"),
  violetW: chalk.hex("#C286BE"),
  redW: chalk.hex("#AF3412"),
  monoW: chalk.hex("#151616"),

  // Variations.
  underlined: chalk.underline,
  bold: chalk.bold,
  italic: chalk.italic
}
