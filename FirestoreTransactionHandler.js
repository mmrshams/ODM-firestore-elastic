"use strict"

const Oops = require('tipi-oops')

const DatabaseName = require('./enums/DatabaseName')
const FirestoreOperation = require('./enums/FirestoreOperation')
const FirestoreErrorHandler = require('./FirestoreErrorHandler')

module.exports = (firestore, firestoreAnalyticsCollector) => {

  return class FirestoreTransactionHandler {

    constructor () {
      this.clear()
    }

    validateResourceName (resourceName) {
      if (!resourceName) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      return true
    }

    validateDatabaseName (databaseName) {
      if (databaseName !== DatabaseName.firestore) throw Oops.failedPrecondition('Firestore transaction models should be extended from FirestoreBase model')
      return true
    }

    queueToGet (modelClass, id) {
      this.validateDatabaseName(modelClass.databaseName)
      this.validateResourceName(modelClass.prototype.RESOURCE_NAME())
      this.documentsToGet.push({ modelClass, id })
      this.queuedToGet = true
      return this
    }

    getAll (callback) {
      if (this.queuedToGet != true) throw Oops.failedPrecondition('there is no queued get operation')
      const documentRefs = this.createQueuedDocumentRefs()
      this.transactionBuilder = async (transaction) => {
        const documentSnapshots = await transaction.getAll(...documentRefs)
        const instances = []
        const notFoundDocs = []
        this.documentsToGet.forEach((item, index) => {
          if (!documentSnapshots[index].exists)
            notFoundDocs.push(item.id)
          else
            instances.push(item.modelClass.createInstanceFromFirestoreDocumentSnapshot(documentSnapshots[index]))
        })
        if (notFoundDocs.length > 0) {
          throw Oops.notFound(`Following document ids not found: ${notFoundDocs.join(' ')}`)
        }
        await callback(instances)
        await this.registerActionsOnTransaction(transaction)
        this.collectAnalytics()
        return this.createTransactionResponse()
      }
      return this
    }

    createQueuedDocumentRefs () {
      return this.documentsToGet.map(item => {
        return firestore.doc(`${item.modelClass.prototype.RESOURCE_NAME()}/${item.id}`)
      })
    }

    create (model) {
      return this.add({ type: FirestoreOperation.transactionCreate, model })
    }

    update (model) {
      return this.add({ type: FirestoreOperation.transactionUpdate, model })
    }

    set (model) {
      return this.add({ type: FirestoreOperation.transactionSet, model })
    }

    delete (documentRef) {
      this.actions.push({ type: FirestoreOperation.transactionDelete, documentRef })
      return this
    }

    clear () {
      this.actions = []
      this.documentsToGet = []
      this.queuedToGet = false
      this.transactionBuilder = null
    }

    add ({ type, model }) {
      this.validateDatabaseName(model.databaseName)
      const resourceName = model.RESOURCE_NAME()
      this.validateResourceName(resourceName)
      const documentRef = firestore.doc(`${resourceName}/${model.id}`)
      this.actions.push({
        type, model, documentRef
      })
      return this
    }

    async run (maxAttempts = 1) {
      if(!this.transactionBuilder) {
        this.transactionBuilder = async (transaction) => {
          await this.registerActionsOnTransaction(transaction)
          this.collectAnalytics()
          return this.createTransactionResponse()
        }
      }
      try {
        return await firestore.runTransaction(this.transactionBuilder, { maxAttempts })
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    createTransactionResponse () {
      return this.actions.map(action => (action.model ? action.model : true))
    }

    collectAnalytics () {
      this.actions.forEach(action => {
        firestoreAnalyticsCollector.add(action.documentRef.parent.path, action.type, action.documentRef.id)
      })
      this.documentsToGet.forEach(item => {
        firestoreAnalyticsCollector.add(item.modelClass.prototype.RESOURCE_NAME(), FirestoreOperation.transactionGet, item.id)
      })
    }

    async registerActionsOnTransaction (transaction) {
      for (let action of this.actions) {
        switch (action.type) {
          case FirestoreOperation.transactionCreate:
            await action.model.lifeCycleCreate()
            transaction.create(action.documentRef, action.model.doc)
            break
          case FirestoreOperation.transactionUpdate:
            await action.model.lifeCycleUpdate()
            transaction.update(action.documentRef, action.model.doc)
            break
          case FirestoreOperation.transactionSet:
            await action.model.lifeCycleSet()
            transaction.set(action.documentRef, action.model.doc)
            break
          case FirestoreOperation.transactionDelete:
            transaction.delete(action.documentRef)
            break
          default:
            throw Oops.unknown('action type is not set correctly for unknown reason')
        }
      }
      return this
    }
  }
}
