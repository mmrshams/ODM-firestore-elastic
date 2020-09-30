// This model class wraps cloud firestore methods and adds validation and a life cycle to CRUD operations
// Implemented CRUD methods don't add any meta data (including ID) to be stored as data in firestore, ID and other meta data
// is storing as meta data in firestore. However all the wrapped methods add a field named `id` to the firestore returned data

"use strict"

const Promise = require('bluebird')
const Oops = require('tipi-oops')
const _ = require('lodash')
const JsonMask = require('json-mask')
const Moment = require('moment')

const Base = require('./Base')()
const DatabaseName = require('./enums/DatabaseName')
const FirestoreOperation = require('./enums/FirestoreOperation')
const FirestoreErrorHandler = require('./FirestoreErrorHandler')

module.exports = (firestore, firestoreAnalyticsCollector) => {

  return class FirestoreBase extends Base {

    async beforeCreate () {
      return this
    }

    async beforeSave () {
      return this
    }

    async beforeUpdate () {
      return this
    }

    async beforeSet () {
      return this
    }

    get databaseName () {
      return DatabaseName.firestore
    }

    static get databaseName () {
      return DatabaseName.firestore
    }

    // This method returns firestore instance to be used by classes if any firestore method is not implemented in this libraray
    static get firestore () {
      return firestore
    }

    // Gets document id and returns document reference based on the collection which the model is connected to
    static firestoreDocRef (id) {
      const resourceName = this.prototype.RESOURCE_NAME()
      if (!resourceName) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      return firestore.doc(`${resourceName}/${id}`)
    }

    // Handle hooks
    // Calls the before and after callbaks of create, update and set methods
    // `set` and `update` methods have the same callbacks (before and after update and save callbacks)
    // `create` method has before and after create and save callbacks
    async lifeCycle (type) {
      const before = Promise.method(this[`before${type}`].bind(this))
      const beforeSave = Promise.method(this.beforeSave.bind(this))
      await before()
      await beforeSave()
      this.validateDoc(this.doc)
      return this
    }

    async lifeCycleCreate () {
      this.doc.createdAt = Moment().format()
      this.doc.updatedAt = Moment().format()
      return this.lifeCycle('Create')
    }

    async lifeCycleUpdate () {
      this.doc.updatedAt = Moment().format()
      return this.lifeCycle('Update')
    }

    async lifeCycleSet () {
      this.doc.updatedAt = Moment().format()
      return this.lifeCycle('Set')
    }

    static createInstanceFromFirestoreDocumentSnapshot (documentSnapshot) {
      let instance = new this({}, documentSnapshot.id)
      instance.doc = documentSnapshot.data()
      instance.doc.id = documentSnapshot.id
      instance.id = documentSnapshot.id
      instance.createTime = documentSnapshot.createTime
      instance.updateTime = documentSnapshot.updateTime
      instance.isNew = false
      return instance
    }

    // Retrieves single document from Firestore.
    static async get (id, { raw = false } = {}) {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        let documentRef = firestore.doc(`${this.prototype.RESOURCE_NAME()}/${id}`)
        firestoreAnalyticsCollector.add(this.prototype.RESOURCE_NAME(), FirestoreOperation.get, id)
        const documentSnapshot = await documentRef.get()
        if (documentSnapshot.exists) {
          if (raw) return documentSnapshot
          return this.createInstanceFromFirestoreDocumentSnapshot(documentSnapshot)
        }
        else
          throw { code: 5, details: `Document with id: ${id} not found!` }
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Checks if document with given id exists or not and returns a boolean.
    static async doesExist (id) {
      try {
        const result = await this.tryGet(id)
        return result.exists
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Tries to retrieve the data of a single document from Firestore.
    // The function returns an object with following structure.
    // { exists: Boolean, data: Object }
    // If the document doesn't exist, the data will be undefined.
    static async tryFind (id, { mask = this._mask() } = {}) {
      try {
        const { exists, instance } = await this.tryGet(id)
        if (!exists) return { exists }
        return { exists, data: instance.mask(mask) }
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Tries to retrieve a single document from Firestore.
    // The function returns an object with following structure.
    // { exists: Boolean, instance: ModelInstance }
    // If the document doesn't exist, the instance will be undefined.
    static async tryGet (id) {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        let documentRef = firestore.doc(`${this.prototype.RESOURCE_NAME()}/${id}`)
        firestoreAnalyticsCollector.add(this.prototype.RESOURCE_NAME(), FirestoreOperation.get, id)
        const documentSnapshot = await documentRef.get()
        if (!documentSnapshot.exists) return { exists: false }
        return { exists: true, instance: this.createInstanceFromFirestoreDocumentSnapshot(documentSnapshot)}
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Retrieves multiple documents from Firestore as an object of Base class.
    // If a document does not exist in database, it'll be omitted from result.
    static async batchGet (ids, { raw = false, withMissedItems = false } = {}) {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      if (!ids) throw Oops.invalidArgument('Given ids can not be undefined!')
      if (!_.isArray(ids)) ids = [ids]
      if (ids.length < 1) return []
      let documentRefs = []
      ids.forEach(id => {
        documentRefs.push(firestore.doc(`${this.prototype.RESOURCE_NAME()}/${id}`))
      })
      try {
        firestoreAnalyticsCollector.batchAdd(this.prototype.RESOURCE_NAME(), FirestoreOperation.get, ids)
        const documentSnapshots = await firestore.getAll(...documentRefs)
        if (raw) return documentSnapshots
        let list = []
        documentSnapshots.forEach(documentSnapshot => {
          if (documentSnapshot.exists) {
            let instance = this.createInstanceFromFirestoreDocumentSnapshot(documentSnapshot)
            list.push(instance)
          } else if (withMissedItems)
            list.push(null)
        })
        return list
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Create a document with the provided object values. This will fail the write if a document exists at its location.
    // // Save and Create hooks will be fired for set function.
    async create ({ mask } = {}) {
      this.validateDoc(this.doc)
      await this.lifeCycleCreate()
      if (!this.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        const documentRef = firestore.doc(`${this.RESOURCE_NAME()}/${this.id}`)
        firestoreAnalyticsCollector.add(this.RESOURCE_NAME(), FirestoreOperation.create, this.id)
        await documentRef.create(this.doc)
        _.merge(this.doc, { id: this.id })
        return this.mask(mask)
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Updates fields in the document referred to by this DocumentReference.
    // If the document doesn't yet exist, the update fails and the returned Promise will be rejected.
    // Save and Update hooks will be fired for set function.
    // Note: This method just updates or adds given fields. If you want to remove some fields from a document use `set` method.
    async update ({ mask } = {}) {
      if (this.setRequired) throw Oops.failedPrecondition('There are properties to remove. Call set() instead of update()')
      this.validateDoc(this.doc)
      await this.lifeCycleUpdate()
      if (!this.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        const documentRef = firestore.doc(`${this.RESOURCE_NAME()}/${this.id}`)
        firestoreAnalyticsCollector.add(this.RESOURCE_NAME(), FirestoreOperation.update, this.id)
        await documentRef.update(this.doc)
        return this.mask(mask)
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Writes to the document. If the document does not yet exist, it will be created.
    // If you pass merge option with value false, the provided data will be replaced with existing document.
    // Save and Update hooks will be fired for set function.
    async set ({ mask } = {}) {
      this.validateDoc(this.doc)
      await this.lifeCycleSet()
      if (!this.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        const documentRef = firestore.doc(`${this.RESOURCE_NAME()}/${this.id}`)
        firestoreAnalyticsCollector.add(this.RESOURCE_NAME(), FirestoreOperation.set, this.id)
        await documentRef.set(this.doc, {merge: false})
        this.setRequired = false
        return this.mask(mask)
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Deletes the document referred to by this DocumentReference.
    // A delete for a non-existing document is treated as a success.
    static async remove (id) {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        let documentRef = firestore.doc(`${this.prototype.RESOURCE_NAME()}/${id}`)
        firestoreAnalyticsCollector.add(this.prototype.RESOURCE_NAME(), FirestoreOperation.delete, id)
        return await documentRef.delete()
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Query Ref
    static get firestoreQuery () {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      return firestore.collection(this.prototype.RESOURCE_NAME())
    }

    // Format query result
    static formatQueryResult (querySnapshot, { mask = null, documentSnapshots = false } = {}) {
      let list = []
      querySnapshot.forEach(documentSnapshot => {
        const data = documentSnapshot.data()
        data.id = documentSnapshot.id
        if (mask)
          list.push(JsonMask(data, mask))
        else
          list.push(data)
      })
      const result = { list, size: querySnapshot.size }
      if (documentSnapshots)
        result.documentSnapshots = querySnapshot.docs
      return result
    }

    // Finds single document from Firestore.
    static async find (id, { mask = this._mask() } = {}) {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      try {
        let documentRef = firestore.doc(`${this.prototype.RESOURCE_NAME()}/${id}`)
        firestoreAnalyticsCollector.add(this.prototype.RESOURCE_NAME(), FirestoreOperation.get, id)
        const documentSnapshot = await documentRef.get()
        if (documentSnapshot.exists) {
          let data = documentSnapshot.data()
          data.id = documentSnapshot.id
          return JsonMask(data, mask)
        }
        else
          throw { code: 5, details: `Document with id: ${id} not found!` }
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }

    // Retrieves multiple documents from Firestore.
    // If a document does not exist in database, it'll be omitted from result.
    static async batchFind (ids, { mask = this._mask(), raw = false, asObject = false, withMissedItems = false } = {}) {
      if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
      if (!ids) throw Oops.invalidArgument('Given ids can not be undefined!')
      if (!_.isArray(ids)) ids = [ids]
      if (ids.length < 1) return []
      let documentRefs = []
      ids.forEach(id => {
        documentRefs.push(firestore.doc(`${this.prototype.RESOURCE_NAME()}/${id}`))
      })
      try {
        firestoreAnalyticsCollector.batchAdd(this.prototype.RESOURCE_NAME(), FirestoreOperation.get, ids)
        const documentSnapshots = await firestore.getAll(...documentRefs)
        if (raw) return documentSnapshots
        let list = []
        documentSnapshots.forEach(documentSnapshot => {
          if (documentSnapshot.exists) {
            const data = documentSnapshot.data()
            data.id = documentSnapshot.id
            if (mask)
              list.push(JsonMask(data, mask))
            else
              list.push(data)
          }
          else if (withMissedItems)
            list.push(null)
        })
        if (!asObject)
          return list
        let resultObject = {}
        list.forEach((doc, index) => {
          if (!doc && withMissedItems) resultObject[ids[index]] = doc
          else if(doc) resultObject[doc.id] = doc
        })
        return resultObject
      } catch (err) {
        FirestoreErrorHandler(err)
      }
    }
  }
}
