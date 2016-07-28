
// Declare depencencies
var mongoose = require('mongoose');
var ftp = require('ftp');
var mysql = require("mysql");
var config = require('config');
var redis = require('redis');
var kafka = require('kafka-node');
var fs = require('fs');
var lineReader = require('line-reader');
var path = require( 'path' );
var processor = require( "process" );
var request = require('request');
var Client = require('node-rest-client').Client;

// Declare Model (Classes)
var TransactionStack = mongoose.model('transactionStack');
var Transaction = mongoose.model('transactionMain');
var TransactionEnrichment = mongoose.model('transaction');
var TransactionRows = mongoose.model('transactionRows');
var TransactionRowData = mongoose.model('transactionRowData');
var Enrichment = mongoose.model('enrichment');
var ReferenceEnrichment = mongoose.model('enrichmentReference');
var PartnerEnrichment = mongoose.model('enrichmentPartner');
var FilterSchema = mongoose.model('transactionFilter');


// Create JsonResponse
var sendJSONresponse = function(res, status, content) {
  res.status(status);
  res.json(content);
};

// Create global variables
var retOutputObj;
var response;
var redisConfig;
var client;
var CacheKeys = [];

//mongoose module for executing extraction scheme
module.exports.extractionsExecute = function(req, res) {
  var transactionStack = new TransactionStack();
  response = res;
  execute(transactionStack);
};

// main function
var execute = function(transactionStack)
{
  callContract(function(responseCallBack)
  {
      console.log('callback contract service');
      var contract = responseCallBack;
      extractData(transactionStack,contract[0]);
  });
}

// perform data matching and extract on the data from the file
var extractData = function(transactionStack, contract)
{

      var configFilePath = config.get('fileExtractionPath');
      var filePath = configFilePath.path;
      var partnerType;
      var partnerCode;
      var intPattern = /^[1-9]\d*$/;
      var decimalPattern = /d+|\d*\.\d{2,}/;
      fs.readdir( filePath, function( err, files ) {
         if( err ) {
             console.error( "Could not list the directory.", err );
             processor.exit( 1 );
         }

         files.forEach( function( file, index )
         {

           // declare local variables
           var transaction = new Transaction();
           transaction.rows = [];
           var extractColumnInfo = false;
           var filterFields = [];
           var UseColConfig = false;
           var colArray = [];
           var indexMappingKey = [];
           var filterIndex = [];
           var outputArray = [];
           var staticConfig = [];
           var curConfig;

           // extract partnerType from the file name
           var splits = file.split('_');
           partnerType = splits[3];

           if(partnerType == 'FPA')
           {
               partnerCode = splits[4];
           }

           curConfig = contract.partner.find(x=> x.code ==  splits[4]);
           if(curConfig != undefined)
           {
              UseColConfig = true;
              // extract column information from contract
              curConfig.mapping.fields.forEach(function(field)
              {
                if(field.partner_field == "")
                {
                  var staticRowData = new TransactionRowData();
                  staticRowData.column = "",
                  staticRowData.partnerField = "";
                  staticRowData.value = field.value;
                  staticConfig.push(staticRowData);
                }
                else
                  colArray.push(field.partner_field);
              });

              // extract filter information from contract
              curConfig.filter.forEach(function(filter)
              {
                var filterSchema = new FilterSchema();
                filterSchema.columnName = filter.name;
                filterSchema.columnValues = "";
                filter.value.forEach(function(value)
                {
                 filterSchema.columnValues += value + "|";
                });
                filterSchema.columnIndex = -1;
                filterFields.push(filterSchema);
              });
           }

           console.log("Processing file " + file + " in folder " + filePath);

           var columnKey = 0;
           var lookUpKey = 0;
           var localColumnIncrementor = 0;
           var previousLookupValue;
           var rowKey = 1;

           lineReader.eachLine(filePath + '/' + file, {separator: '\n', encoding: 'utf8'}, function(line, last) {

           // extract column info from the file
           if (!extractColumnInfo) {

             var columns = line.split('\t');

             columns.forEach(function(column)
             {
               var filterItem = filterFields.find(x=> x.columnName.toLowerCase() == column.toLowerCase())
               if(filterItem != undefined)
               {
                 filterItem.columnIndex = columnKey;
               }

               if(partnerType == 'TPA' && column == "Site Name")
               {
                 lookUpKey = localColumnIncrementor;
               }

               localColumnIncrementor++;

               if(UseColConfig)
               {
                 if(colArray.indexOf(column) > -1)
                 {
                     var output = new TransactionRowData();
                     output.column = columnKey;
                     output.partnerField = column;
                     outputArray.push(output);
                 }
               }
               else
               {
                 var output = new TransactionRowData();
                 output.column = columnKey;
                 output.partnerField = column;
                 outputArray.push(output);
               }

               columnKey++;

             });

             extractColumnInfo = true;
         }
         else
         {
           var outputObj = [];

         // extract data rows from the file
           var dataInfo = line.split('\t');
           var columnIndex = 0;
           var addDataRow = true;

           dataInfo.forEach(function(columnValue)
           {
               if(partnerType == 'TPA' && columnIndex == lookUpKey)
               {
                 var corrSiteName = contract.partner.find(x=> x.code == splits[4]).filter.find(y=> y.name == "Site Name").value.find(z=> z == columnValue);
                 if(corrSiteName != undefined)
                 {
                  contract.partner.forEach(function(partner)
                  {
                    var tag = partner.alias.find(x=> x == corrSiteName);
                    if(tag != undefined)
                      partnerCode = tag.code;
                  });
                 }

                 if(previousLookupValue == undefined)
                 {
                     previousLookupValue = columnValue;
                 }
                 else
                 {
                    if(previousLookupValue != columnValue)
                    {
                      var corrSiteName = contract.partner.find(x=> x.code == splits[4]).filter.find(x=> x.name == "Site Name").value.find(y=> y == columnValue);
                      if(corrSiteName != undefined)
                      {
                        contract.partner.forEach(function(partner)
                        {
                          var tag = partner.alias.find(x=> x == corrSiteName);
                          if(tag != undefined)
                            partnerCode = tag.code;
                        });
                      }

                      transaction.source = splits[4];
                      transaction.partner_code = partnerCode;
                      transactionStack.transactions.push(transaction);
                      transaction = new Transaction();
                      transaction.rows = [];
                      previousLookupValue = columnValue;
                    }
                 }
               }

               var newObj = outputArray.find(x=> x.column == columnIndex);
               if(newObj != undefined)
               {
                // if(columnIndex == 18)
              //      console.log(newObj);
                 var filterItem = filterFields.find(x=> x.columnIndex == columnIndex);
                 if(filterItem != undefined)
                 {
                    if(filterItem.columnValues.split('|').indexOf(columnValue) == -1)
                        addDataRow = false;
                 }

                 newObj.value = columnValue;
                 outputObj.push(newObj);
               }
             columnIndex++;
           });

         staticConfig.forEach(function(staticInfo)
         {
            outputObj.push(staticInfo);
         });
          // done dealing with a row
          if(outputObj.length > 0)
          {
             if(addDataRow)
             {
                 var rowInfo = new TransactionRows();
                 rowInfo.rowKey = rowKey;
                 rowInfo.rowData = outputObj;
                 rowKey++;
                 outputObj = [];
                 transaction.rows.push(rowInfo);
                 if(partnerType == 'TPA')
                 {
                    transaction.partner_type = partnerType;
                 }
             }
           }
        }
         if(last){
           if(partnerType == 'FPA')
           {
             transaction.partner_type = partnerType;
             transaction.partner_code = partnerCode;
             transaction.source = partnerCode;
             transaction.createdOn = new Date();
             transactionStack.transactions.push(transaction);
           }
           else {
             transaction.partner_code = partnerCode;
             transaction.source = splits[4];
             transactionStack.transactions.push(transaction);
           }

            // make call to clearing for every transaction
            var done = 0;
            transactionStack.transactions.forEach(function(transaction)
            {
              transaction.rows.forEach(function(row)
              {
              if(done < 1)
             {
                   var newTransaction = new Transaction();
                   newTransaction.partner_type = transaction.partner_type;
                   newTransaction.partner_code = transaction.partner_code;
                   newTransaction.source = transaction.source;
                   newTransaction.createdOn = new Date();
                   newTransaction.rows.push(row);
                  //  callCleaning(newTransaction, function (responseCallBack) {
                  //     // console.log('callback cleaning service');
                  //      transaction = responseCallBack;
                  //      var refConfig = {
                  //        "name": "fs_pm",
                  //        "adapter": "mySql",
                  //        "_type": "reference",
                  //        "host": "52.38.252.219",
                  //        "user": "fusionseven",
                  //        "password": "fs155borel",
                  //        "database": "fs_reference",
                  //        "port": 3306,
                  //        "_get": "select partner_type, partner_code, partner_field_type, partner_field, fs_field from fs_partner_mapping",
                  //        "key": ["partner_type", "partner_code", "partner_field_type","partner_field", "fs_field"],
                  //       "tkey":["partner_type", "partner_code","partner_field_type","partner_field", "fs_field"]
                  //      };
                  //      transaction.reference.push(refConfig);
                       callMapping(newTransaction, function (responseCallBack) {
                          console.log('callback mapping service');
                          transaction = responseCallBack;
                          sendJSONresponse(response, 201, transaction);
                          // var enrichment = new Enrichment();
                          // var transactionEnrichment = new TransactionEnrichment();
                          //
                          // transactionEnrichment.partner_type = transaction.partner_type;
                          // transactionEnrichment.partner_code = transaction.partner_code;
                          // transactionEnrichment.createdOn = transaction.createdOn;
                          // transactionEnrichment.rows = transaction.rows;
                          // console.log('Info' + transactionEnrichment);
                          // enrichment.transaction = TransactionEnrichment;
                          // enrichment.reference = new ReferenceEnrichment();
                          // enrichment.reference.partner = new PartnerEnrichment();
                          // enrichment.reference.partner.code = "TRG";
                          // enrichment.reference.partner.type = transaction.partner_type;
                          // callEnrichment(enrichment, function (responseCallBack) {
                          //      console.log('callback enrichment service');
                          //      enrichment = responseCallBack;
                          //      sendJSONresponse(response, 201, enrichment);
                          //  });
                      });
                //  });
                done++;
             }
               });
            });
         }
       });
       });
    });
}

var callContract = function(callback)
{
  var contractConfig = config.get('contractConfig');

  var configVer = config.get('contractVersion');

  commonGet(contractConfig.uri + '?client.code=' + configVer.client + '&version.major=' + configVer.majorVer, "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfaWQiOiI1NzhlN2ViZTE1MzdlNDFhMjQzYzNhOWMiLCJlbWFpbCI6ImR5YWRhdkBmdXNpb25zZXZlbi5jb20iLCJuYW1lIjoiZHlhZGF2IiwiZXhwIjoxNDcwMTU0ODQ1LCJpYXQiOjE0Njk1NTAwNDV9.8KRbFW6zJCQIneePYfHwKkFZvpMNKG1ZlpeBPbAYcKk", function(res)
  {
      callback(res);
  });
}

var callCleaning = function(newTransaction, callback)
{
  var cleaningConfig = config.get('cleaningConfig');
  commonPost(cleaningConfig.uri + '/execute', newTransaction, null, function(res)
  {
      callback(res);
  });
}

var callMapping = function(newTransaction, callback)
{
  var mappingConfig = config.get('mappingConfig');
  commonPost(mappingConfig.uri + '/execute', newTransaction, null, function(res)
  {
      callback(res);
  });
}

var callEnrichment = function(enrichment, callback)
{
  var enrichmentConfig = config.get('enrichmentConfig');
  commonGet(enrichmentConfig.uri + '/searchexec', enrichment, "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfaWQiOiI1NzhlN2ViZTE1MzdlNDFhMjQzYzNhOWMiLCJlbWFpbCI6ImR5YWRhdkBmdXNpb25zZXZlbi5jb20iLCJuYW1lIjoiZHlhZGF2IiwiZXhwIjoxNDcwMTU0ODQ1LCJpYXQiOjE0Njk1NTAwNDV9.8KRbFW6zJCQIneePYfHwKkFZvpMNKG1ZlpeBPbAYcKk", function(res)
  {
      callback(res);
  });
}

var commonPost = function(endpoint, body, token, callback)
{
  var client = new Client();
  var args = {
      data: body,
      headers: { "Content-Type": "application/json" }
  };

  if (token != null)
    args.headers.Authorization = "Bearer " + token;

  console.log('calling cleaning service');
  client.post(endpoint, args, function (data, response) {
      callback(data);
  });
}

var commonGet = function(endpoint, token, callback)
{
  var client = new Client();

  // set content-type header and data as json in args parameter
  var args = {
      headers: { "Content-Type": "application/json" }
  };

  if (token != null)
    args.headers.Authorization = "Bearer " + token;

  client.get(endpoint, args, function (data, response) {
      callback(data);
  });
}
