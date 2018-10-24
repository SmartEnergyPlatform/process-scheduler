/*
 *    Copyright 2018 InfAI (CC SES)
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

'use strict';

var db = require('./../../lib/db');
var objectId = require('mongodb').ObjectID;
var ns = require('node-schedule');
var request = require('request');
var settings = require("./../../settings");
var jwt = require('jsonwebtoken');
var needle = require('needle');

function token(req){
    var auth = req.get("Authorization");
    var token = auth.replace('Bearer ','');
    var decoded = jwt.decode(token);
    return decoded;
}

function getUser(req){
    return token(req).sub
}


var collectionGetter = db.getCollectionGetter("schedule");

module.exports = {
    getJobs: getJobs,
    getJob: getJob,
    addJob: addJob,
    startJob: startJob,
    deleteJob: deleteJob,
    updateJob: updateJob
};

function getJobs(req, res) {
    collectionGetter().then(function (collection) {
        collection.find({'owner':getUser(req)}).toArray(function (err, docs) {
            if (!docs.length)
                res.json([]);
            else if (!err)
                res.json(docs);
            else
                res.status(500).json({"message": "An unexpected error occurred.", "err": err})
        });
    });
}

function getJob(req, res) {
    var id = req.swagger.params.id.value;
    collectionGetter().then(function (collection) {
        collection.find({'_id': objectId(id),'owner':getUser(req)}).toArray(function (err, doc) {
            if (!doc.length)
                res.status(404).json({"message": "no job found"});
            else if (!err)
                res.json(doc);
            else
                res.status(500).json({"message": "An unexpected error occurred.", "err": err})
        });
    });
}

function startJob(processDefinitionId) {
    return function () {
        console.log("start process", processDefinitionId);
        needle.request('post', settings.processEngineUrl + '/engine-rest/process-definition/' + processDefinitionId + '/start', {}, {json: true}, function (err, resp) {
            if(err){
                console.log("execution error:", err);
            }
        });
    }
}

function addJob(req, res) {
    var schedule = req.swagger.params.schedule.value;
    var processDefinitionId = schedule.processDefinitionId;
    var startTime = schedule.startTime;
    schedule.owner = getUser(req);

    collectionGetter().then(function (collection) {
        collection.insert(schedule, function (err, result) {
            if (!err) {

                ns.scheduleJob(result.ops[0]._id.toString(), startTime, startJob(processDefinitionId));

                res.status(201);
                res.json(result.ops[0]);
            } else
                res.status(500).json({"message": "An unexpected error occurred.", "err": err})
        });
    });
}

function updateJob(req, res) {
    var schedule = req.swagger.params.schedule.value;
    var id = req.swagger.params.id.value;
    var processDefinitionId = schedule.processDefinitionId;
    var startTime = schedule.startTime;
    schedule.owner = getUser(req);

    collectionGetter().then(function (collection) {
        collection.update({'_id': objectId(id), 'owner': schedule.owner}, schedule, function (err, count, status) {
            if (!err) {
                stopJob(id);
                ns.scheduleJob(id, startTime, startJob(processDefinitionId));

                res.status(200).json({"message": "ok"});
            } else
                res.status(500).json({"message": "An unexpected error occurred.", "err": err})
        });
    });
}

function stopJob(jobId) {
    ns.cancelJob(jobId)
}

function deleteJob(req, res) {
    var id = req.swagger.params.id.value;
    collectionGetter().then(function (collection) {
        try {
            collection.deleteOne({'_id': objectId(id),'owner':getUser(req)}, function(err, obj){
                if(err){
                    res.status(500).json({"message": "An unexpected error occurred.", "err": err})
                }else{
                    stopJob(id);
                    res.status(204).json({"message": "ok"});
                }
            });
        } catch (e) {
            res.status(500).json({"message": "An unexpected error occurred.", "err": e})
        }
    });
}
