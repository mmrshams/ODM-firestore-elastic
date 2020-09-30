module.exports = (config) => {
  const { odm: { analytics: analyticsConfig = {} } = {}} = config
  const analyticsEnabled = (typeof analyticsConfig.enabled === 'boolean') ? analyticsConfig.enabled : true

  let analytics = {}

  return class FirestoreAnalyticsCollector {
    static get snapshot () {
      const resourceNames = Object.keys(analytics)
      const result = {}
      resourceNames.forEach(resourceName => {
        const operations = Object.keys(analytics[resourceName])
        operations.forEach(operation => {
          let sum = 0
          let max = 0
          let maxId = ''
          const ids = Object.keys(analytics[resourceName][operation])
          ids.forEach(id => {
            sum += analytics[resourceName][operation][id]
            if (analytics[resourceName][operation][id] > max) {
              max = analytics[resourceName][operation][id]
              maxId = id
            }
          })
          result[resourceName] = {}
          result[resourceName][operation] = { sum, max, maxId }
        })
      })
      return result
    }

    static resetAnalytics (resourceName) {
      if (analytics[resourceName]) delete analytics[resourceName]
    }

    static resetAllAnalytics () {
      const snapshot = this.snapshot
      analytics = {}
      return snapshot
    }

    static batchAdd (resourceName, operation, ids) {
      if (!analyticsEnabled) return
      ids.forEach(id => this.add(resourceName, operation, id))
    }

    static add (resourceName, operation, id) {
      if (!analyticsEnabled) return
      if (!analytics[resourceName]) analytics[resourceName] = {}
      if (!analytics[resourceName][operation]) analytics[resourceName][operation] = {}
      if (!analytics[resourceName][operation][id]) analytics[resourceName][operation][id] = 0
      analytics[resourceName][operation][id]++
    }
  }
}
