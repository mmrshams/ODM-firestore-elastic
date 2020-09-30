const { Client } = require('@elastic/elasticsearch')
const { CronJob } = require('cron')
const Moment = require('moment')
const IdGenerator = require('uuid')

const defaultConfig = {
  enabled: true,
  elasticIndex: 'goki_odm_firestore_analytics',
  cronTime: '0 */1 * * * *'
}

module.exports = (config, firestoreAnalyticsCollector) => {

  const { odm: { analytics = {} } = {}} = config
  const analyticConfig = {
    enabled: (typeof analytics.enabled === 'boolean') ? analytics.enabled : defaultConfig.enabled,
    elasticIndex: analytics.elasticIndex || defaultConfig.elasticIndex,
    cronTime: analytics.cronTime || defaultConfig.cronTime
  }

  const saveAnalytics = () => {
    const client = new Client({ cloud: config.elastic.cloud })
    const snapshot = firestoreAnalyticsCollector.resetAllAnalytics()
    snapshot.at = Moment().utc().startOf('minute').format()
    client.create({
      id: IdGenerator.v4(),
      index: analyticConfig.elasticIndex,
      body: snapshot
    })
  }

  const job = new CronJob(analyticConfig.cronTime, () => { saveAnalytics() })

  if (analyticConfig.enabled) job.start()

  return job
}
