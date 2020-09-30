const WinstonLogger = require('./WinstonLogger')

const privateMethods = {
  shouldLogError (errorCode) {
    // Following codes are normal errors of firestore (operation canceled by caller, not found and already exists)
    if ([1, 5, 6].indexOf(errorCode) >= 0) return false
    return true
  },
  convertErrorToLog (error) {
    const errorData = { message: 'unknown error', stack: '', data: {} }
    const { message, details, stack, title, data } = (error.isOops) ? error.data || error.error : error
    if (message) errorData.message = message
    if (details) errorData.details = details
    if (title) errorData.title = title
    if (stack) errorData.stack = stack
    if (data) errorData.data = data
    return errorData
  },
  getEventNameByErrorCode (errorCode) {
    switch (errorCode) {
      case 1:
        return 'firestoreOperationCanceled'
      case 2:
        return 'firestoreUnknown'
      case 3:
        return 'firestoreInvalidArgument'
      case 4:
        return 'firestoreDeadlineExceeded'
      case 5:
        return 'firestoreDocumentNotFound'
      case 6:
        return 'firestoreDocumentAlreadyExists'
      case 7:
        return 'firestorePermissionDenied'
      case 8:
        return 'firestoreResourceExhausted'
      case 9:
        return 'firestoreFailedPrecondition'
      case 10:
        return 'firestoreOperationAborted'
      case 11:
        return 'firestoreOutOfRange'
      case 12:
        return 'firestoreUnimplemented'
      case 13:
        return 'firestoreInternal'
      case 14:
        return 'firestoreUnavailable'
      case 15:
        return 'firestoreDataLoss'
      case 16:
        return 'firestoreUnauthorized'
      default:
        return 'firestoreUnknown'
    }
  }
}

const FirestoreErrorLogger = {
  log (err) {
    let errorCode = 2 // code 2 is unknown error
    if (err.isOops) {
      if (err.data) errorCode = err.data.code
      else if (err.error) errorCode = err.error.code
    } else if (err && err.code) {
      errorCode = err.code
    }
    if (!privateMethods.shouldLogError(errorCode)) return true
    WinstonLogger.log({
      level: 'error',
      source: 'tipi-odm',
      message: `Firestore operation failed with code ${errorCode}!`,
      event: privateMethods.getEventNameByErrorCode(errorCode),
      error: privateMethods.convertErrorToLog(err)
    })
  }
}

module.exports = FirestoreErrorLogger
