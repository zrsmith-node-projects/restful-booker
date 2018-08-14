var express = require('express');
var router  = express.Router(),
    parse   = require('../helpers/parser'),
    crypto = require('crypto'),
    Booking = require('../models/booking'),
    validator = require('../helpers/validator'),
    creator = require('../helpers/bookingcreator'),
    fs      = require('fs'),
    globalLogins = {};

if(process.env.SEED === 'true'){
  var count = 1;

  (function createBooking(){
    var newBooking = creator.createBooking()

    Booking.create(newBooking, function(err, result){
      if(err) return console.error(err);

      if(count < 10){
        count++;
        createBooking();
      }
    });
  })()
};

/**
 * @api {get} /ping HealthCheck
 * @apiName Ping
 * @apiGroup Ping
 * @apiVersion 1.0.0
 * @apiDescription A simple health check endpoint to confirm whether the API is up and running.
 *
 * @apiExample Ping server:
 * curl -i https://restful-booker.herokuapp.com/ping
 * 
 * @apiSuccess {String} OK Default HTTP 201 response
 * 
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 201 Created
 */
router.get('/ping', function(req, res, next) {
  res.sendStatus(201);
});

/**
 * @api {get} /booking GetBookingIds
 * @apiName GetBookings
 * @apiGroup Booking
 * @apiVersion 1.0.0
 * @apiDescription Returns the ids of all the bookings that exist within the API. Can take optional query strings to search and return a subset of booking ids.
 *
 * @apiParam {String} [firstname] Return bookings with a specific firstname
 * @apiParam {String} [lastname]  Return bookings with a specific lastname
 * @apiParam {date}   [checkin]   Return bookings that have a checkin date greater than or equal to the set checkin date. Format must be CCYY-MM-DD
 * @apiParam {date}   [checkout]  Return bookings that have a checkout date greater than or equal to the set checkout date. Format must be CCYY-MM-DD
 * 
 * @apiExample Example 1 (All IDs):
 * curl -i https://restful-booker.herokuapp.com/booking
 * 
 * @apiExample Example 2 (Filter by name):
 * curl -i https://restful-booker.herokuapp.com/booking?firstname=sally&lastname=brown
 * 
 * @apiExample Example 3 (Filter by checkin/checkout date):
 * curl -i https://restful-booker.herokuapp.com/booking?checkin=2014-03-13&checkout=2014-05-21
 * 
 * @apiSuccess {object[]} object Array of objects that contain unique booking IDs
 * @apiSuccess {number} object.bookingid ID of a specific booking that matches search criteria
 * 
 * @apiSuccessExample {json} Response:
 * HTTP/1.1 200 OK
 * 
 * [
  {
    "bookingid": 1
  },
  {
    "bookingid": 2
  },
  {
    "bookingid": 3
  },
  {
    "bookingid": 4
  }
] 
*/
router.get('/booking', function(req, res, next) {
  var query = {};

  if(typeof(req.query.firstname) != 'undefined'){
    query.firstname = req.query.firstname
  }

  if(typeof(req.query.lastname) != 'undefined'){
    query.lastname = req.query.lastname
  }

  if(typeof(req.query.checkin) != 'undefined'){
    query["bookingdates.checkin"] = {$gt: new Date(req.query.checkin).toISOString()}
  }

  if(typeof(req.query.checkout) != 'undefined'){
    query["bookingdates.checkout"] = {$lt: new Date(req.query.checkout).toISOString()}
  }

  Booking.getIDs(query, function(err, record){
    var booking = parse.bookingids(req, record);

    if(!booking){
      res.sendStatus(418);
    } else {
      res.send(booking);
    }
  })
});

/**
 * @api {get} /booking/:id GetBooking
 * @apiName GetBooking
 * @apiGroup Booking
 * @apiVersion 1.0.0
 * @apiDescription Returns a specific booking based upon the booking id provided
 * 
 * @apiParam (Url Parameter) {String} id The id of the booking you would like to retrieve
 * 
 * @apiHeader {string} Accept=application/json Sets what format the response body is returned in. Can be application/json or application/xml
 * 
 * @apiExample Example 1 (Get booking):
 * curl -i https://restful-booker.herokuapp.com/booking/1
 * 
 * @apiSuccess {String}  firstname             Firstname for the guest who made the booking
 * @apiSuccess {String}  lastname              Lastname for the guest who made the booking
 * @apiSuccess {Number}  totalprice            The total price for the booking
 * @apiSuccess {Boolean} depositpaid           Whether the deposit has been paid or not
 * @apiSuccess {Object}  bookingdates          Sub-object that contains the checkin and checkout dates
 * @apiSuccess {Date}    bookingdates.checkin  Date the guest is checking in
 * @apiSuccess {Date}    bookingdates.checkout Date the guest is checking out
 * @apiSuccess {String}  additionalneeds       Any other needs the guest has
 * 
 * @apiSuccessExample {json} JSON Response:
 * HTTP/1.1 200 OK
 * 
 * {
    "firstname": "Sally",
    "lastname": "Brown",
    "totalprice": 111,
    "depositpaid": true,
    "bookingdates": {
        "checkin": "2013-02-23",
        "checkout": "2014-10-23"
    },
    "additionalneeds": "Breakfast"
}
 * @apiSuccessExample {xml} XML Response:
 * HTTP/1.1 200 OK
 * 
 * <booking>
    <firstname>Sally</firstname>
    <lastname>Brown</lastname>
    <totalprice>111</totalprice>
    <depositpaid>true</depositpaid>
    <bookingdates>
        <checkin>2013-02-23</checkin>
        <checkout>2014-10-23</checkout>
    </bookingdates>
    <additionalneeds>Breakfast</additionalneeds>
</booking>
 */
router.get('/booking/:id',function(req, res, next){
  Booking.get(req.params.id, function(err, record){
    if(record){
      var booking = parse.booking(req.headers.accept, record);

      if(!booking){
        res.sendStatus(418);
      } else {
        res.send(booking);
      }
    } else {
      res.sendStatus(404)
    }
  })
});

/**
 * @api {post} /booking CreateBooking
 * @apiName CreateBooking
 * @apiGroup Booking
 * @apiVersion 1.0.0
 * @apiDescription Creates a new booking in the API
 * 
 * @apiParam (Request body) {String}  firstname             Firstname for the guest who made the booking
 * @apiParam (Request body) {String}  lastname              Lastname for the guest who made the booking
 * @apiParam (Request body) {Number}  totalprice            The total price for the booking
 * @apiParam (Request body) {Boolean} depositpaid           Whether the deposit has been paid or not
 * @apiParam (Request body) {Date}    bookingdates.checkin  Date the guest is checking in
 * @apiParam (Request body) {Date}    bookingdates.checkout Date the guest is checking out
 * @apiParam (Request body) {String}  additionalneeds       Any other needs the guest has
 * 
 * @apiHeader {string} Content-Type=application/json Sets the format of payload you are sending. Can be application/json or text/xml
 * @apiHeader {string} Accept=application/json Sets what format the response body is returned in. Can be application/json or application/xml
 * 
 * @apiExample JSON example usage:
 * curl -X POST \
  http://localhost:3001/booking \
  -H 'Content-Type: application/json' \
  -d '{
    "firstname" : "Jim",
    "lastname" : "Brown",
    "totalprice" : 111,
    "depositpaid" : true,
    "bookingdates" : {
        "checkin" : "2018-01-01",
        "checkout" : "2019-01-01"
    },
    "additionalneeds" : "Breakfast"
}'
 * @apiExample XML example usage:
 * curl -X POST \
  http://localhost:3001/booking \
  -H 'Content-Type: text/xml' \
  -d '<booking>
    <firstname>Jim</firstname>
    <lastname>Brown</lastname>
    <totalprice>111</totalprice>
    <depositpaid>true</depositpaid>
    <bookingdates>
      <checkin>2018-01-01</checkin>
      <checkout>2019-01-01</checkout>
    </bookingdates>
    <additionalneeds>Breakfast</additionalneeds>
  </booking>'
 * 
 * @apiSuccess {Number}  bookingid                     ID for newly created booking
 * @apiSuccess {Object}  booking                       Object that contains 
 * @apiSuccess {String}  booking.firstname             Firstname for the guest who made the booking
 * @apiSuccess {String}  booking.lastname              Lastname for the guest who made the booking
 * @apiSuccess {Number}  booking.totalprice            The total price for the booking
 * @apiSuccess {Boolean} booking.depositpaid           Whether the deposit has been paid or not
 * @apiSuccess {Object}  booking.bookingdates          Sub-object that contains the checkin and checkout dates
 * @apiSuccess {Date}    booking.bookingdates.checkin  Date the guest is checking in
 * @apiSuccess {Date}    booking.bookingdates.checkout Date the guest is checking out
 * @apiSuccess {String}  booking.additionalneeds       Any other needs the guest has
 * 
 * @apiSuccessExample {json} JSON Response:
 * HTTP/1.1 200 OK
 * 
 * {
    "bookingid": 1,
    "booking": {
        "firstname": "Jim",
        "lastname": "Brown",
        "totalprice": 111,
        "depositpaid": true,
        "bookingdates": {
            "checkin": "2018-01-01",
            "checkout": "2019-01-01"
        },
        "additionalneeds": "Breakfast"
    }
}
 * @apiSuccessExample {xml} XML Response:
 * HTTP/1.1 200 OK
 * 
 * <?xml version='1.0'?>
<created-booking>
    <bookingid>1</bookingid>
    <booking>
        <firstname>Jim</firstname>
        <lastname>Brown</lastname>
        <totalprice>111</totalprice>
        <depositpaid>true</depositpaid>
        <bookingdates>
            <checkin>2018-01-01</checkin>
            <checkout>2019-01-01</checkout>
        </bookingdates>
        <additionalneeds>Breakfast</additionalneeds>
    </booking>
</created-booking>
 */
router.post('/booking', function(req, res, next) {
  newBooking = req.body;
  if(req.headers['content-type'] === 'text/xml') newBooking = newBooking.booking;

  validator.scrubAndValidate(newBooking, function(payload, msg){
    if(!msg){
      Booking.create(newBooking, function(err, booking){
        if(err)
          res.sendStatus(500);
        else {
          var record = parse.bookingWithId(req, booking);

          if(!record){
            res.sendStatus(418);
          } else {
            res.send(record);
          }
        }
      })
    } else {
      res.sendStatus(500);
    }
  })
});

/**
 * @api {put} /booking/:id UpdateBooking
 * @apiName UpdateBooking
 * @apiGroup Booking
 * @apiVersion 1.0.0
 * @apiDescription Updates a current booking
 * 
 * @apiParam (Url Parameter) {Number} id                    ID for the booking you want to update
 * 
 * @apiParam (Request body) {String}  firstname             Firstname for the guest who made the booking
 * @apiParam (Request body) {String}  lastname              Lastname for the guest who made the booking
 * @apiParam (Request body) {Number}  totalprice            The total price for the booking
 * @apiParam (Request body) {Boolean} depositpaid           Whether the deposit has been paid or not
 * @apiParam (Request body) {Date}    bookingdates.checkin  Date the guest is checking in
 * @apiParam (Request body) {Date}    bookingdates.checkout Date the guest is checking out
 * @apiParam (Request body) {String}  additionalneeds       Any other needs the guest has
 * 
 * @apiHeader {string} Content-Type=application/json                    Sets the format of payload you are sending. Can be application/json or text/xml
 * @apiHeader {string} Accept=application/json                          Sets what format the response body is returned in. Can be application/json or application/xml
 * @apiHeader {string} [Cookie=token=<token_value>]                     Sets an authorisation token to access the PUT endpoint, can be used as an alternative to the Authorisation
 * @apiHeader {string} [Authorisation=Basic YWRtaW46cGFzc3dvcmQxMjM=]   Basic authorisation header to access the PUT endpoint, can be used as an alternative to the Cookie header
 * 
 * @apiExample JSON example usage:
 * curl -X PUT \
  http://localhost:3001/booking/1 \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Cookie: token=abc123' \
  -d '{
    "firstname" : "James",
    "lastname" : "Brown",
    "totalprice" : 111,
    "depositpaid" : true,
    "bookingdates" : {
        "checkin" : "2018-01-01",
        "checkout" : "2019-01-01"
    },
    "additionalneeds" : "Breakfast"
}'
 * @apiExample XML example usage:
 * curl -X PUT \
  http://localhost:3001/booking/1 \
  -H 'Content-Type: text/xml' \
  -H 'Accept: application/xml' \
  -H 'Authorisation: Basic YWRtaW46cGFzc3dvcmQxMjM=' \
  -d '<booking>
    <firstname>James</firstname>
    <lastname>Brown</lastname>
    <totalprice>111</totalprice>
    <depositpaid>true</depositpaid>
    <bookingdates>
      <checkin>2018-01-01</checkin>
      <checkout>2019-01-01</checkout>
    </bookingdates>
    <additionalneeds>Breakfast</additionalneeds>
  </booking>'
 * 
 * @apiSuccess {String}  firstname             Firstname for the guest who made the booking
 * @apiSuccess {String}  lastname              Lastname for the guest who made the booking
 * @apiSuccess {Number}  totalprice            The total price for the booking
 * @apiSuccess {Boolean} depositpaid           Whether the deposit has been paid or not
 * @apiSuccess {Object}  bookingdates          Sub-object that contains the checkin and checkout dates
 * @apiSuccess {Date}    bookingdates.checkin  Date the guest is checking in
 * @apiSuccess {Date}    bookingdates.checkout Date the guest is checking out
 * @apiSuccess {String}  additionalneeds       Any other needs the guest has
 * 
 * @apiSuccessExample {json} JSON Response:
 * HTTP/1.1 200 OK
 * 
 * {
    "firstname" : "James",
    "lastname" : "Brown",
    "totalprice" : 111,
    "depositpaid" : true,
    "bookingdates" : {
        "checkin" : "2018-01-01",
        "checkout" : "2019-01-01"
    },
    "additionalneeds" : "Breakfast"
}
 * @apiSuccessExample {xml} XML Response:
 * HTTP/1.1 200 OK
 * 
 * <booking>
    <firstname>James</firstname>
    <lastname>Brown</lastname>
    <totalprice>111</totalprice>
    <depositpaid>true</depositpaid>
    <bookingdates>
      <checkin>2018-01-01</checkin>
      <checkout>2019-01-01</checkout>
    </bookingdates>
    <additionalneeds>Breakfast</additionalneeds>
</booking>
 */
router.put('/booking/:id', function(req, res, next) {
  if(globalLogins[req.cookies.token] || req.headers.authorization == 'Basic YWRtaW46cGFzc3dvcmQxMjM='){
    updatedBooking = req.body;
    if(req.headers['content-type'] === 'text/xml') updatedBooking = updatedBooking.booking;

    validator.scrubAndValidate(updatedBooking, function(payload, msg){
      if(!msg){
        Booking.update(req.params.id, updatedBooking, function(err){
          Booking.get(req.params.id, function(err, record){
            if(record){
              var booking = parse.booking(req.headers.accept, record);

              if(!booking){
                res.sendStatus(418);
              } else {
                res.send(booking);
              }
            } else {
              res.sendStatus(405);
            }
          })
        })
      } else {
        res.sendStatus(400);
      }
    });
  } else {
    res.sendStatus(403);
  }
});

router.delete('/booking/:id', function(req, res, next) {
  if(globalLogins[req.cookies.token] || req.headers.authorization == 'Basic YWRtaW46cGFzc3dvcmQxMjM='){
    Booking.get(req.params.id, function(err, record){
      if(record){
        Booking.delete(req.params.id, function(err){
            res.sendStatus(201);
        });
      } else {
        res.sendStatus(405);
      }
    });
  } else {
    res.sendStatus(403);
  }
});

router.post('/auth', function(req, res, next){
  if(req.body.username === "admin" && req.body.password === "password123"){
    var token = crypto.randomBytes(Math.ceil(15/2))
                    .toString('hex')
                    .slice(0,15);

    globalLogins[token] = true;

    res.send({'token': token});
  } else {
    res.send({'reason': 'Bad credentials'});
  }
})

module.exports = router;
