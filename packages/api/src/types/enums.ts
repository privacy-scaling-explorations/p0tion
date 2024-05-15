/**
 * Log levels.
 * @notice useful to discriminate the log level for message printing.
 * @enum {string}
 */
export enum LogLevel {
    INFO = "INFO",
    DEBUG = "DEBUG",
    WARN = "WARN",
    ERROR = "ERROR",
    LOG = "LOG"
}

/**
 * Authentication providers.
 * @notice useful to discriminate the authentication provider.
 * @enum {string}
 */
export enum AuthProvider {
    SIWE = "siwe",
    GITHUB = "github",
    BANDADA = "bandada"
}
