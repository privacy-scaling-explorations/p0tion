/**
 * @dev TODO: needs refactoring.
 * Custom countdown which throws an error when expires.
 * @param durationInSeconds <number> - the amount of time to be counted expressed in seconds.
 * @param intervalInSeconds <number> - the amount of time that must elapse between updates (default 1s === 1ms).
 */
export var createExpirationCountdown = function (durationInSeconds, intervalInSeconds) {
  if (intervalInSeconds === void 0) {
    intervalInSeconds = 1000
  }
  var seconds = durationInSeconds <= 60 ? durationInSeconds : 60
  setInterval(function () {
    try {
      if (durationInSeconds !== 0) {
        // Update times.
        durationInSeconds -= intervalInSeconds
        seconds -= intervalInSeconds
        if (seconds % 60 === 0) seconds = 0
        process.stdout.write("Expires in 00:".concat(Math.floor(durationInSeconds / 60), ":").concat(seconds, "\r"))
      } else console.log("Expired")
    } catch (err) {
      // Workaround to the \r.
      process.stdout.write("\n\n")
      console.log("Expired")
    }
  }, intervalInSeconds * 1000)
}
//# sourceMappingURL=utils.js.map
