// This class extends FirestoreBase class and add the search engines as static properties using composition
// End classes should extend this class to connect to database and search engines

"use strict"
const Oops = require('tipi-oops')

module.exports = (firestore, config, firestoreAnalyticsCollector) => {

  const FirestoreBase = require("./FirestoreBase")(firestore, firestoreAnalyticsCollector);
  const AlgoliaBase = require('./AlgoliaBase')();
  const ElasticBase = require('./ElasticBase')();

  return class FirestoreWithSearch extends FirestoreBase {

    // This will return an instance of algolia class, when the algolia property of this class is looked up
    static get algolia () {
      const resourceName = this.prototype.RESOURCE_NAME()
      if (!resourceName || !config.algolia)
        return null
      return new AlgoliaBase(Object.assign(config, { resourceName }))
    }

    // This will return an instance of elastic class, when the elastic property of this class is looked up
    static get elastic () {
      const resourceName = this.prototype.RESOURCE_NAME()
      if (!resourceName || !config.elastic)
        return null
      return new ElasticBase(Object.assign(config, { resourceName }))
    }

    static async get (id, { elastic = false, ...rest } = {}) {
      if (elastic) {
        const data = await this.elastic.get(id)
        return super.createInstance(data, id)
      } else {
        return super.get(id, rest)
      }
    }

    async create ({ elastic = false, mask } = {}) {
      if (elastic) {
        this.validateDoc(this.doc)
        await this.lifeCycleCreate()
        if (!this.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
        await this.constructor.elastic.create(this.doc, this.id)
        return this.mask(mask)
      } else {
        return super.create({ mask })
      }
    }

    async update ({ elastic = false, mask } = {}) {
      if (elastic) {
        if (this.setRequired) throw Oops.failedPrecondition('There are properties to remove. Call set() instead of update()')
        this.validateDoc(this.doc)
        await this.lifeCycleUpdate()
        if (!this.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
        await this.constructor.elastic.update(this.id, this.doc)
        return this.mask(mask)
      } else {
        return super.update({ mask })
      }
    }

    async set ({ elastic = false, mask } = {}) {
      if (elastic) {
        this.validateDoc(this.doc)
        await this.lifeCycleSet()
        if (!this.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
        await this.constructor.elastic.index(this.doc, this.id)
        this.setRequired = false
        return this.mask(mask)
      } else {
        return super.set({ mask })
      }
    }

    static async remove (id, { elastic = false } = {}) {
      if (elastic) {
        if (!this.prototype.RESOURCE_NAME()) throw Oops.failedPrecondition('Model should have resource name to specify collection!')
        return this.elastic.delete(id)
      } else {
        return super.remove(id)
      }
    }
  }
}
