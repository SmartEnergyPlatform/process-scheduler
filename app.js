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

var settings = require("./settings");
var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var db = require('./lib/db');
var ns = require('node-schedule');
var schedule = require('./api/controllers/schedule');

var collectionGetter = db.getCollectionGetter("schedule");

var config = {
    appRoot: __dirname
};

SwaggerExpress.create(config, function (err, swaggerExpress) {
    if (err) {
        throw err;
    }

    //allow CORS
    app.use(function (req, res, next) {
        res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,OPTIONS,HEAD,PUT,PATCH,POST,DELETE');
        res.header('Access-Control-Expose-Headers', 'Content-Length');
        res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        } else {
            return next();
        }
    });

    // install middleware
    swaggerExpress.register(app);

    app.listen(settings.restServer);

    init();
});

function init() {
    collectionGetter().then(function (collection) {
        collection.find({}).toArray(function (err, docs) {
            if (docs.length) {
                docs.forEach(function (element, index, array) {
                    ns.scheduleJob(element._id.toString(), element.startTime, schedule.startJob(element.processDefinitionId))
                });
            }

        });
    });
}
