/**
 * @dev TODO: needs refactoring.
 * Custom countdown which throws an error when expires.
 * @param durationInSeconds <number> - the amount of time to be counted expressed in seconds.
 * @param intervalInSeconds <number> - the amount of time that must elapse between updates (default 1s === 1ms).
 */
const createExpirationCountdown = (durationInSeconds: number, intervalInSeconds = 1000) => {
  let seconds = durationInSeconds <= 60 ? durationInSeconds : 60

  setInterval(() => {
    try {
      if (durationInSeconds !== 0) {
        // Update times.
        durationInSeconds -= intervalInSeconds
        seconds -= intervalInSeconds

        if (seconds % 60 === 0) seconds = 0

        process.stdout.write(`Expires in 00:${Math.floor(durationInSeconds / 60)}:${seconds}\r`)
      } else console.log(`Expired`)
    } catch (err: any) {
      // Workaround to the \r.
      process.stdout.write(`\n\n`)
      console.log(`Expired`)
    }
  }, intervalInSeconds * 1000)
}

export default createExpirationCountdown
