const https = require("https"),
  promise = require("promise"),
  fs = require("fs")

loadDataFromFile = (targetFile) => {
  return new promise(function (resolve, reject) {
    try {
      console.log("loading data from: " + targetFile)
      let patchData = fs.readFileSync(targetFile)
      console.log("Data loaded")
      resolve(patchData)
    } catch (err) {
      reject(`Data load error. This could be because the path to your patch file is invalid:  ${err}`)
    }
  })
}

submitPatchDataRequest = (patchData, accountId, catalogName, bearerAPIKey, mode) => {
  return new promise(function (resolve, reject) {
    try {
      let options = {
        hostname: "api-staging.connect.bloomreach.com",
        method: mode,
        path:
          "/dataconnect/api/v1/accounts/" +
          accountId +
          "/catalogs/" +
          catalogName +
          "/products",
        port: 443,
        headers: {
          "Content-Type": "application/json-patch+json",
          "Authorization": bearerAPIKey,
        }
      }

      req = https
        .request(options, (resp) => {
          let data = ""
          // A chunk of data has been recieved.
          resp.on("data", (chunk) => {
            data += chunk
          })

          // The whole response has been received.
          resp.on("end", () => {
            console.log(`patch request complete ${data}`)
            try{
              resolve(JSON.parse(data))
            } catch(err) {
              if(data.substring('Unable') != -1){
                reject(data)
              } else {
                resolve(data)
              }
            }
          })
        })
        .on("error", (err) => {
          console.log(`error: ${err}`)
          reject(err.message)
        })

      req.write(patchData)
      req.end()
    } catch (err) {
      reject(`patch data request error: ${err}`)
    }
  })
}

requestIndexUpdate = (accountId, catalogName, bearerAPIKey) => {
  return new promise(function (resolve, reject) {
    try {
      let options = {
        hostname: "api-staging.connect.bloomreach.com",
        method: "POST",
        path:
          "/dataconnect/api/v1/accounts/" +
          accountId +
          "/catalogs/" +
          catalogName +
          "/indexes",
        port: 443,
        headers: {
          "Authorization": bearerAPIKey,
          "BR-IGNORE-DOCUMENT-COUNT-DROP": true,
        }
      }

      req = https
        .request(options, (resp) => {
          let data = ""
          // A chunk of data has been recieved.
          resp.on("data", (chunk) => {
            data += chunk
          })

          // The whole response has been received.
          resp.on("end", () => {
            resolve(JSON.parse(data))
          })
        })
        .on("error", (err) => {
          reject(`index update error: ${err.message}`)
        })

      req.write("")
      req.end()
    } catch (err) {
      reject("index update request error: " + err)
    }
  })
}

getJobStatus = (jobId, bearerAPIKey) => {
  return new promise(function (resolve, reject) {
    let options = {
      hostname: "api-staging.connect.bloomreach.com",
      method: "GET",
      path: "/dataconnect/api/v1/jobs/" + jobId,
      port: 443,
      headers: {
        "Authorization": bearerAPIKey,
      },
    }

    req = https
      .request(options, (resp) => {
        let data = ""
        // A chunk of data has been recieved.
        resp.on("data", (chunk) => {
          data += chunk
        })

        // The whole response has been received.
        resp.on("end", () => {
          try{
            resolve(JSON.parse(data))
          } catch(err) {
            resolve(data)
          }
        })
      })
      .on("error", (err) => {
        reject(err.message)
      })
    req.end()
  })
}

checkJobStatusUntilComplete = (accountId, jobId, bearerAPIKey) => {
  return new promise(function (resolve, reject) {
    checkJobStatusUntilCompleteIterator(
      accountId,
      jobId,
      bearerAPIKey,
      function () {
        resolve()
      },
      function (err) {
        reject(`check job status error: ${err}`)
      }
    )
  })
}

checkJobStatusUntilCompleteIterator = (accountId, jobId, bearerAPIKey, callback, errCB) => {
  getJobStatus(jobId, bearerAPIKey)
    .then((statusMessage) => {
      let thisMessage = {
        'type' : 'jobStatus',
        'jobId' : jobId,
        'message' : statusMessage,
        'accountId' : accountId
      }
      
      if (statusMessage.status == "failed") {
        errCB(statusMessage)
      } else if (statusMessage.status == "success") {
        console.log("\u2705 success")
        callback()
      } else {
        process.stdout.write(statusMessage.status + '                          \r')
        setTimeout(function () {
          checkJobStatusUntilCompleteIterator(accountId, jobId, bearerAPIKey, callback, errCB)
        }, 10000)
      }
    })
    .catch((err) => {
      reject(err.message)
    })
}

loadData = (fileName, accountId, catalogName, bearerAPIKey, mode) => {
  return new promise(function (resolve, reject) {
    console.log("Running patching process.")
    try{
      loadDataFromFile(fileName)
      .then((patchData) => {
        return submitPatchDataRequest(patchData, accountId, catalogName, bearerAPIKey, mode)
      })
      .then((response) => {
        console.log("Patch job submitted with id: " + response.jobId)
        return checkJobStatusUntilComplete(accountId, response.jobId, bearerAPIKey)
      })
      .then(() => {
        console.log("About to update the index")
        return requestIndexUpdate(accountId, catalogName, bearerAPIKey)
      })
      .then((response) => {
        console.log("Index update job submitted with id: " + response.jobId)
        return checkJobStatusUntilComplete(accountId, response.jobId, bearerAPIKey)
      })
      .then(() => {
        resolve()
      })
      .catch((err) => {
        reject(err)
      })
    } catch(err){
      reject(`load sample data error: ${err}`)
    }
  })
}

module.exports = {
  loadData
}