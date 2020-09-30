// This class wraps Algolia search engine methods

"use strict"

const algoliasearch = require('algoliasearch')
const _ = require('lodash')
const JsonMask = require('json-mask')

module.exports = () => {

  return class AlgoliaBase {

    // The constructor connects to algolia and assign algolia index and client instances to class instance
    // Inherited class have access to it's algolia index and the algolia client which can be used to call methods of algolia
    // Which is not wrapped in this class
    constructor ({algolia, resourceName}) {
      this.resourceName = resourceName
      this.client = algoliasearch(algolia.applicationID, algolia.adminKey)
      this.index = this.client.initIndex(resourceName)
    }

    // Search an index with provided query.
    async search (query, options = {}) {
      const result = await this.index.search(query)
      return await this.handleAlgoliaData(result, options)
    }

    // This will handle the heavy lifting of getting the data you want in the format that you desire
    async handleAlgoliaData (data, { raw = false, mask = null, keysOnly = false, format = false } = {}) {
      if (raw)
        return data
      if (keysOnly)
        return _.map(data.hits, 'objectID')
      const total = data.nbHits
      let list = []
      data.hits.forEach(doc => {
        if (mask) {
          delete doc._highlightResult
          list.push(JsonMask(doc, mask))
        } else
          list.push(doc)
      })
      if (format)
        return { list, total }
      return list
    }

  }

}