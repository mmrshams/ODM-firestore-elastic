// This is Base class and all others classes should be inherited from this class.

"use strict"

const Joi = require('joi')
const Oops = require('tipi-oops')
const JsonMask = require('json-mask')
const _ = require('lodash')
const IdGenerator = require('uuid')
const Moment = require('moment')

module.exports = () => {

  // This is a Joi schema used to validate the props
  const propsSchema = Joi.object().pattern(/.*/, Joi.object().min(1).keys({
      schema: Joi.object().min(1).required(),
      whiteList: Joi.boolean().default(false)
    }
  )).min(1)

  return class Base {

    // Each model should have a resource name.
    // This specifies the resources (database collection and search engine index) which your model is connected to.
    RESOURCE_NAME () {
      return null
    }

    // This is a list of accepted properties on mass-assignments and their joi schema.
    // o stop mass assignment of some attributes you should set them to false. This will also affect your mask method and prevent those properties from getting exposed when calling `.mask()` (This can be changed by defining `_mask` list)
    props () {
      return []
    }

    // Masking is based on `props` by default and only properties which set to true will be exposed.
    // If you want to change this behavior you should set `_mask`.
    _mask () {
      const mask = _.keys(_.pickBy(this.props(), (prop) => ( prop.whiteList )))
      mask.unshift('id')
      mask.push('createdAt,updatedAt')
      return mask.join(',')
    }

    static _mask () {
      return this.prototype._mask()
    }

    // This will create a new document object of your model
    constructor (doc, id) {
      this.isNew = true
      if (id && (typeof id != 'string')) throw Oops.invalidArgument('Id should be a string!')
      this.validateProps()
      const whiteListedProps = _.keys(_.pickBy(this.props(), (prop) => ( prop.whiteList )))
      this.setterMask = whiteListedProps.join(',')
      this.doc = doc || {}
      this.doc = JsonMask(this.doc, this.setterMask)
      if (id) {
        this.id = id
      } else {
        this.id = this._id()
      }
      this.id = this.id.toString()
      this.doc.id = this.id
      this.doc.createdAt = Moment().format()
      this.doc.updatedAt = Moment().format()
      this.validateDoc(this.doc)
    }

    static createInstance (data, id) {
      if (!data || (!id && !data.id)) throw Oops.failedPrecondition('Id and data are required!')
      const docId = id || data.id
      let instance = new this({}, docId)
      instance.doc = data
      instance.doc.id = docId
      instance.id = docId
      instance.isNew = false
      return instance
    }

    // This will generate id for documents
    _id (rawId) {
      if (rawId && (typeof rawId != 'string')) throw Oops.invalidArgument('Id should be a string!')
      const id = rawId || IdGenerator.v4()
      return id
    }

    // Props will be validated with following method
    // All props should have `schema` and `whiteList` attributes
    validateProps () {
      const result = Joi.validate(this.props(), propsSchema)
      if(result.error) throw Oops.notAcceptable(result.error.message || 'Props validation failed!')
      return true
    }

    // Filters what properties should be exposed
    mask (mask = null) {
      let appliedMask = '*'
      if (!mask)
        appliedMask = this._mask()
      else if (typeof mask == 'string')
        appliedMask = mask
      else if (_.isArray(mask) && mask.length > 0)
        appliedMask = `${this._mask()},${mask.join(',')}`
      return JsonMask(this.doc, appliedMask)
    }

    static mask (data, mask) {
      let appliedMask = '*'
      if (!mask)
        appliedMask = `${_.keys(_.pickBy(this.prototype.props(), (prop) => ( prop.whiteList )))},id`
      else if (typeof mask == 'string')
        appliedMask = mask
      else if (_.isArray(mask) && mask.length > 0)
        appliedMask = `${_.keys(_.pickBy(this.prototype.props(), (prop) => ( prop.whiteList )))},id,${mask.join(',')}`
      return JsonMask(data, appliedMask)
    }

    // This method validates docs with the model's props
    validateDoc (doc) {
      const extendedProps = _.extend(this.props(), {
        id: {
          schema: Joi.string(),
          whiteList: true
        },
        createdAt: {
          schema: Joi.date(),
          whiteList: true
        },
        updatedAt: {
          schema: Joi.date(),
          whiteList: true
        }
      })
      let schema = {}
      _.each(extendedProps, (value, key) => {
        schema[key] = value.schema
      })
      const validationResult = Joi.validate(doc, schema)
      if (validationResult.error) throw Oops.notAcceptable(validationResult.error.message || 'Document validation failed!').meta(validationResult.error)
      return true
    }

    // This method merges the doc with the given data, but it doesn't persist the data to database.
    // Use `update` or `set` methods after this method to persist data.
    assign (data) {
      data.id = this.doc.id
      data.createdAt = this.doc.createdAt
      data.updatedAt = this.doc.updatedAt
      const tempDoc = _.merge({}, this.doc, data)
      this.validateDoc(tempDoc)
      this.doc = tempDoc
      return this
    }

    removeProps (props = []) {
      if (!_.isArray(props)) props = [props]
      if (props.length < 1) return this
      props.forEach(prop => {
        if (this.doc[prop]) {
          delete this.doc[prop]
          this.setRequired = true
        }
      })
      return this
    }

    // This method replaces the doc with the given data, but it doesn't persist the data to database.
    // Use `set` methods after this method to persist data.
    replace (data) {
      data.id = this.doc.id
      data.createdAt = this.doc.createdAt
      data.updatedAt = this.doc.updatedAt
      this.validateDoc(data)
      this.doc = data
      this.setRequired = true
      return this
    }

    // DB Methods
    static get () {
      throw Error("Method is not implemented!")
    }

    static batchGet () {
      throw Error("Method is not implemented!")
    }

    static find () {
      throw Error("Method is not implemented!")
    }

    create () {
      throw Error("Method is not implemented!")
    }

    update () {
      throw Error("Method is not implemented!")
    }

    static set () {
      throw Error("Method is not implemented!")
    }

    static remove () {
      throw Error("Method is not implemented!")
    }

    get databaseName () {
      throw Error("Method is not implemented!")
    }

    static doesExist () {
      throw Error("Method is not implemented!")
    }
  }

}
