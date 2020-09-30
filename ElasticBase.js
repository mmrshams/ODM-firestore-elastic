// This class wraps Elastic search engine methods

"use strict"

const { Client } = require('@elastic/elasticsearch')
const _ = require('lodash')
const JsonMask = require('json-mask')
const Oops = require('tipi-oops')
const Promise = require('bluebird')
const IdGenerator = require('uuid')

module.exports = () => {

  return class ElasticBase {

    // The constructor connects to elastic and assign elastic client instance to class instance
    // Inherited classes have access to the elastic client which can be used to call methods of elastic
    // Which is not wrapped in this class
    constructor ({elastic, resourceName}) {
      this.resourceName = resourceName
      this.client = new Client({ cloud: elastic.cloud })
    }

    // Search an index with provided query.
    async search (query, options = {}) {
      let data
      const result = await this.client.search({
        index: this.resourceName,
        body: query
      }, {
        ignore: [404]
      })
      data = (result.statusCode && result.statusCode === 404) ? { body: { hits: { hits: [], total: { value: 0 } } } } : result
      return await this.handleElasticData(data, options)
    }

    async get (id, { retry = 0 } = {}) {
      try {
        const result = await this.client.get({
          index: this.resourceName,
          id
        })
        return result.body._source
      } catch (error) {
        if (error.statusCode === 404) {
          if (retry < 3) {
            await Promise.delay(1000)
            return this.get(id, { retry: retry + 1 })
          } else {
            throw Oops.notFound(`Document with id: ${id} not found!`)
          }
        }
        throw error
      }
    }

    async multiGet (ids, { mask, raw = false, asObject = false, withMissedItems = false } = {}) {
      if (!ids) throw Oops.invalidArgument('Given ids can not be undefined!')
      if (!_.isArray(ids)) ids = [ids]
      if (ids.length < 1) return asObject ? {} : []
      const result = await this.client.mget({
        index: this.resourceName,
        body: { ids }
      })
      if (raw) return result
      const list = []
      result.body.docs.forEach(doc => {
        if (doc.found) {
          const data = doc._source
          list.push(mask ? JsonMask(data, mask) : data)
        }
        else if (withMissedItems)
          list.push(null)
      })
      if (!asObject) return list
      let resultObject = {}
      list.forEach((doc, index) => {
        if (!doc && withMissedItems) resultObject[ids[index]] = doc
        else if(doc) resultObject[doc.id] = doc
      })
      return resultObject
    }

    async create (data, id = IdGenerator.v4()) {
      return this.client.create({ id, index: this.resourceName, body: data })
    }

    async update (id, data) {
      return this.client.update({ id, index: this.resourceName, body: { doc: data }})
    }

    async index (data, id = IdGenerator.v4()) {
      return this.client.index({ id, index: this.resourceName, body: data })
    }

    async delete (id) {
      return this.client.delete({id, index: this.resourceName })
    }

    // This will handle the heavy lifting of getting the data you want in the format that you desire
    async handleElasticData (data, { raw = false, mask = null, keysOnly = false, format = false } = {}) {
      // return data
      if (raw)
        return data
      if (keysOnly)
        return _.map(data.body.hits.hits, '_id')
      const total = data.body.hits.total.value
      let list = []
      data.body.hits.hits.forEach(doc => {
        if (mask) {
          list.push(JsonMask(doc._source, mask))
        } else
          list.push(doc._source)
      })
      if (format)
        return { list, total }
      return list
    }

  }

}
