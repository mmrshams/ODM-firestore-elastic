// This file is entry point of the library
// Tipi-ODM is a library which helps you to keep your model logic and connect to your Database and Search engines
// Combination of databases and search engines can be added by implementing and exporting their models
// Currently we covered google cloud firestore as our database and Algolia and Elasticsearch as our search engines

"use strict"

const { Firestore } = require('@google-cloud/firestore')

module.exports = (config) => {

  if (!config || !config.firestore) throw Error('Missing Firestore configs')

  // Create a new client
  const firestore = new Firestore({
    projectId: config.firestore.projectId,
    keyFilename: config.firestore.keyFilename
  })

  const FirestoreAnalyticsCollector = require('./FirestoreAnalyticsCollector')(config)
  require('./FirestoreAnalyticsElasticPersist')(config, FirestoreAnalyticsCollector)
  const FirestoreWithSearch = require('./FirestoreWithSearch')(firestore, config, FirestoreAnalyticsCollector)
  const FirestoreTransactionHandler = require('./FirestoreTransactionHandler')(firestore, FirestoreAnalyticsCollector)
  const DatabaseName = require('./enums/DatabaseName')

  // Export classes based on given options
  // Configs can be set to export just needed classes
  // Currently we just have Firestore as database
  return { FirestoreWithSearch, FirestoreTransactionHandler, DatabaseName, FirestoreAnalyticsCollector }
}
