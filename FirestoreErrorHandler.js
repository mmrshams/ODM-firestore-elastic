const Oops = require('tipi-oops')
const FirestoreErrorLogger = require('./FirestoreErrorLogger')

// Handles firestore errors based on [google api error codes](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto)
const FirestoreErrorHandler = (err) => {
  FirestoreErrorLogger.log(err)
  if (err.isOops) throw err
  if ((typeof err != 'object') || !err.code)
    throw Oops.unknown('An unknown error occurred!').meta(err)
  let details = 'unknown error'
  if (err && err.details && (typeof err.details === 'string'))
    details = err.details
  switch (err.code) {
    case 1:
      throw Oops.cancelled(details).meta(err)
      break
    case 2:
      throw Oops.unknown(details).meta(err)
      break
    case 3:
      throw Oops.invalidArgument(details).meta(err)
      break
    case 4:
      throw Oops.deadlineExceeded(details).meta(err)
      break
    case 5:
      throw Oops.notFound(details).meta(err)
      break
    case 6:
      throw Oops.alreadyExists(details).meta(err)
      break
    case 7:
      throw Oops.permissionDenied(details).meta(err)
      break
    case 8:
      throw Oops.resourceExhausted(details).meta(err)
      break
    case 9:
      throw Oops.failedPrecondition(details).meta(err)
      break
    case 10:
      throw Oops.aborted(details).meta(err)
      break
    case 11:
      throw Oops.outOfRange(details).meta(err)
      break
    case 12:
      throw Oops.unimplemented(details).meta(err)
      break
    case 13:
      throw Oops.internal(details).meta(err)
      break
    case 14:
      throw Oops.unavailable(details).meta(err)
      break
    case 15:
      throw Oops.dataLoss(details).meta(err)
      break
    case 16:
      throw Oops.unauthorized(details).meta(err)
      break
    default:
      throw Oops.internal(details).meta(err)
  }
}

module.exports = FirestoreErrorHandler
