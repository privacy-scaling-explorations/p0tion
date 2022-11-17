/**
 * @dev TODO: needs refactoring.
 * Custom countdown which throws an error when expires.
 * @param durationInSeconds <number> - the amount of time to be counted expressed in seconds.
 * @param intervalInSeconds <number> - the amount of time that must elapse between updates (default 1s === 1ms).
 */
export declare const createExpirationCountdown: (durationInSeconds: number, intervalInSeconds?: number) => void
