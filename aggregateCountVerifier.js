aggregateCountVerifier = function (loggingDbName,
    destUsername,
    destPassword,
    destConnString,
    collectionWhiteList) {

    //initialise databaseWhitelist
    if (collectionWhiteList && !Array.isArray(collectionWhiteList)) {
        print("*** Collection whitelist: " + JSON.stringify(collectionWhiteList));
        print("collectionWhiteList should be an array or null if no white list is required");
        return;
    }
    else if (collectionWhiteList && Array.isArray(collectionWhiteList)) {
        if (collectionWhiteList.length === 0) {
            print("*** Collection whitelist: " + JSON.stringify(collectionWhiteList));
            print("collectionWhiteList is empty array, but should contain at least one collection to verify");
            return;
        }
        else {
            print("*** collectionWhiteList whitelist: " + JSON.stringify(collectionWhiteList));
        }
    }
    else {
        print("*** No collectionWhiteList whitelist provided. Proceeding with all collections.");
    }

    loggingDb = db.getSiblingDB(loggingDbName);
    jobCollName = "aggcountjob";
    logCollName = "aggcountlog";

    runId = ObjectId();
    print("*** Starting new run with id " + runId.toString());
    loggingDb.getCollection(jobCollName).insert({ _id: runId, verificationType: "aggCount", start: ISODate() });
    runSummary = {
        collNames: {
            processed: [],
            skipped: []
        },
        collDetails: {
            processed: 0,
            skipped: 0,
            matches: 0,
            mismatches: 0
        }
    }

    destMongo = new Mongo(destConnString).getDB("admin")
    if (!destPassword) {
        print("Executing passwordPrompt() function to obtain destination password")
        pwd = passwordPrompt();
    }
    else if (destPassword && typeof destPassword === 'function') {
        print("Executing supplied password function to obtain destination password")
        pwd = destPassword();
    }
    else {
        pwd = destPassword;
    }
    destMongo.auth(destUsername, pwd);
    destLoggingDB = destMongo.getSiblingDB(loggingDbName);

    collectionWhiteList.forEach(countChecker);

    function countChecker(dbNamespace) {
        dbNameCollNameArray = dbNamespace.split('.');

        sourceDB = db.getSiblingDB(dbNameCollNameArray[0]);
        destDB = destLoggingDB.getSiblingDB(dbNameCollNameArray[0]);

        if (dbNameCollNameArray[0] !== 'admin' && dbNameCollNameArray[0] != 'local' && dbNameCollNameArray[0] != 'config') {

            print("Processing collection: " + dbNamespace);
            collStartDate = ISODate();
            addUniqueValueToArray(dbNamespace, runSummary.collNames.processed);
            runSummary.collDetails.processed++;

            finalCollName = "";

            if (dbNameCollNameArray.length > 2)
            {
              for (let index = 1; index < dbNameCollNameArray.length; index++) {
                
                finalCollName += dbNameCollNameArray[index] + ".";
                
              }
              
              finalCollName = finalCollName.substring(0, finalCollName.length-1);
              
            }
            else
            {
              finalCollName = dbNameCollNameArray[1];
            }
    
            sourceColl = sourceDB.getSiblingDB(dbNameCollNameArray[0]).getCollection(finalCollName);
            destColl = destDB.getSiblingDB(dbNameCollNameArray[0]).getCollection(finalCollName);

            //load counts to work with
            sourceCollCount = sourceColl.aggregate([
                { $group: { _id: null, count: { $sum: 1 } } },
                { $project: { count: 1 } }
            ]).toArray()[0].count;

            destCollCount = destColl.aggregate([
                { $group: { _id: null, count: { $sum: 1 } } },
                { $project: { count: 1 } }
            ]).toArray()[0].count;

            if (sourceCollCount === destCollCount) {
                runSummary.collDetails.matches++;
            }

            else {
                runSummary.collDetails.mismatches++;
            }

            resultDoc = {
                runId: runId,
                ns: dbNamespace,
                skipped: false,
                verificationType: "aggCount",
                start: collStartDate,
                end: ISODate(),
                srcCount: sourceCollCount,
                dstCount: destCollCount,
                matched: (sourceCollCount === destCollCount)
            }

            loggingDb.getCollection(logCollName).insert(resultDoc);
        }
    }

    runSummary.end = ISODate();
    loggingDb.getCollection(jobCollName).update({ _id: runId }, { $set: runSummary });

    print("*** Aggregate Count Results Summary ...")
    job = loggingDb.getCollection(jobCollName).findOne({ _id: runId });
    print(JSON.stringify(job, null, '\t'))
    print("*** Mismatches ...")
    results = loggingDb.getCollection(logCollName).find({ runId: runId, matched: false }).toArray();
    if (results && results.length > 0) {
        print("*** To view the _id of all the mismatched collections, run the following on the source database ...");
        print("   use " + loggingDbName);
        print("   db." + logCollName + ".find({runId: " + runId.toString() + ", matched: false}).pretty()");
        print("*** ")
    }
    print(JSON.stringify(results, null, '\t'))

}


addUniqueValueToArray = function (value, array) {
    if (array.indexOf(value) < 0) {
        array.push(value);
    }
}

aggregateCountVerifier(
    "test", //loggingDbName
    "", //destUsername
    "", //destPassword - can be <string>, <function reference> e.g. passwordPrompt, null will execute passwordPrompt()
    "mongodb+srv://cluster1.nnjyy.mongodb.net", //destination connection string (ignores credentials)
    ["sample_training.inspections", "sample_training.zips", "sample_mflix.movies"] //collectionWhitelist
);



