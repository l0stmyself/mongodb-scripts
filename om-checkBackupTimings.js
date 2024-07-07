//Run the following in mongosh
var backup = {};
backup.snapshotData = function(query) {
  query = query || {}
  if(query.constructor.name == "ObjectId") {
    query = {_id: query}
  }
  query["endTime"] = {"$ne" : null}
  query["deleted"] = { $ne: true }
  query["completed"] = true
  cursor = db.getSiblingDB("backupjobs").snapshots.find( query ).sort({rsId: 1, srcBackupName: 1});
  print("_id" + "\t" +"groupId" + "\t" + "rsId" + "\t" + "srcBackupName" + "\t" + "snapshotSize" + "\t" + "blockTransferTime" + "\t" + "transferSpeed" + "\t" + "fileListUploadTime" + "\t" + "finalizeFileListTime" + "\t" + "totalTime")
  while(cursor.hasNext()) {
    snapshot = cursor.next()
    startTime = snapshot.startTime
    dataStartTime = snapshot.dataTransferStartedAt
    descriptionCreatedAt = new Date(snapshot.descriptionCreatedAt.getHighBits() * 1000)
    fileSize = snapshot.headUsage.fileSize
    endTime = snapshot.endTime
    totalTime = (endTime - startTime) / 1000
    fileListUploadTime = (dataStartTime - descriptionCreatedAt) / 1000
    finalizeFileListTime = (dataStartTime - startTime) / 1000
    blockTransferTime = (endTime - dataStartTime)/ 1000
    totalTime = (endTime - descriptionCreatedAt)/ 1000
    transferSpeed = fileSize / blockTransferTime / 1024 / 1024
    print(snapshot._id + "\t" +snapshot.groupId + "\t" + snapshot.rsId + "\t" + snapshot.srcBackupName + "\t" + fileSize + "b\t" + blockTransferTime + "s\t" + transferSpeed + "mb/s\t" + fileListUploadTime + "s\t" + finalizeFileListTime + "s\t" + totalTime + "s")
  }
}

backup.snapshotData()
