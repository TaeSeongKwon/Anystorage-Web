var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
	if(req.session.userInfo){
		var mem_id = req.session.userInfo.mem_id;

		req.getConnection(function(err, conn){
	  		var query = "SELECT * FROM DEVICE WHERE mem_no in(SELECT mem_no FROM MEMBER WHERE mem_id = ?)";
	  		conn.query(query, [mem_id], function(queryErr, result, fields){
	  			if(queryErr){
	  				console.log("SELECT Query Error : ", queryErr);
	  			}
	  			console.log("result : ", result);
	  			res.render('main', {userInfo : req.session.userInfo, deviceList : result});
	  		});
	  	});
		
	}else
		res.redirect('/');
});

module.exports = router;
