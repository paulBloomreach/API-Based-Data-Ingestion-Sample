const dataConnect = require('./dataConnectModule'),
    settings = require('./settings.json')

dataConnect.loadData(
    settings.indexFile, 
    settings.accountId, 
    (settings.bearerAPIKey).split('-staging')[0],
    settings.bearerAPIKey,
    settings.mode)
.then(()=>{
    console.log('all done')
})
.catch((err) => {
    console.log(`error: ${err}`)
})