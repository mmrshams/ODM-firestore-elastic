const { createLogger, format, transports } = require('winston')

const { combine, timestamp, json } = format

const Logger = createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    new transports.Console({ stderrLevels: ['error'] })
  ]
})

module.exports = Logger
